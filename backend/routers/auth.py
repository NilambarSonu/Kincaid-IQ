from fastapi import APIRouter, HTTPException, Depends, Response, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import timedelta
from authlib.integrations.starlette_client import OAuth
from starlette.config import Config
from backend.database import get_db
from backend.config import settings
from backend import models, schemas
from backend.auth import (
    get_password_hash,
    create_access_token,
    authenticate_user,
    get_current_user,
)
from backend.security import (
    rate_limit,
    check_login_lockout,
    record_failed_login,
    clear_login_failures,
    _client_ip,
)
from backend.audit import audit_login
import logging
import os

logger = logging.getLogger("kincaid.auth")
IS_PRODUCTION = (
    os.environ.get("REPLIT_DEPLOYMENT", "") == "1"
    or (os.environ.get("APP_ENV") or os.environ.get("ENVIRONMENT") or "").strip().lower()
    in ("production", "prod")
)

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Set up OAuth
oauth_config = Config(environ={
    "GOOGLE_CLIENT_ID": settings.google_client_id or "",
    "GOOGLE_CLIENT_SECRET": settings.google_client_secret or "",
    "GITHUB_CLIENT_ID": settings.github_client_id or "",
    "GITHUB_CLIENT_SECRET": settings.github_client_secret or "",
})

oauth = OAuth(oauth_config)

if settings.google_client_id:
    oauth.register(
        name="google",
        server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
        client_kwargs={"scope": "openid email profile"},
        client_id=settings.google_client_id,
        client_secret=settings.google_client_secret,
    )

if settings.github_client_id:
    oauth.register(
        name="github",
        access_token_url="https://github.com/login/oauth/access_token",
        authorize_url="https://github.com/login/oauth/authorize",
        api_base_url="https://api.github.com/",
        client_kwargs={"scope": "read:user user:email"},
        client_id=settings.github_client_id,
        client_secret=settings.github_client_secret,
    )


def set_auth_cookie(response: Response, token: str):
    response.set_cookie(
        key="access_token",
        value=token,
        httponly=True,
        secure=IS_PRODUCTION,   # HTTPS-only in production
        samesite="lax",
        max_age=60 * 60 * 24 * 7,  # 7 days
        path="/",
    )


@router.post("/register", response_model=schemas.Token)
def register(user_data: schemas.UserCreate, response: Response, request: Request, db: Session = Depends(get_db)):
    # Rate limit registrations: 5 per IP per hour
    rate_limit(request, max_calls=5, window=3600, key_prefix="register")

    existing = db.query(models.User).filter(models.User.username == user_data.username).first()
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")

    user = models.User(
        username=user_data.username,
        email=user_data.email,
        hashed_password=get_password_hash(user_data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    token = create_access_token({"sub": str(user.id)})
    set_auth_cookie(response, token)
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/login", response_model=schemas.Token)
def login(credentials: schemas.UserLogin, response: Response, request: Request, db: Session = Depends(get_db)):
    ip = _client_ip(request)

    # ── Rate limit: 20 login attempts per IP per 5 minutes ──────────────────
    rate_limit(request, max_calls=20, window=300, key_prefix="login")

    # ── Lockout check: username + IP ────────────────────────────────────────
    check_login_lockout(credentials.username, ip)

    # ── Authenticate ────────────────────────────────────────────────────────
    user = authenticate_user(db, credentials.username, credentials.password)
    if not user:
        record_failed_login(credentials.username, ip)
        audit_login(credentials.username, ip, success=False, db=db)
        # Generic message — don't reveal which field is wrong
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # ── Success ─────────────────────────────────────────────────────────────
    clear_login_failures(credentials.username, ip)
    # Resolve primary tenant for the audit record
    primary_member = db.query(models.OrganizationMember).filter(
        models.OrganizationMember.user_id == user.id
    ).first()
    tenant_id = primary_member.org_id if primary_member else "system"
    audit_login(credentials.username, ip, success=True, tenant=tenant_id, db=db)
    token = create_access_token({"sub": str(user.id)})
    set_auth_cookie(response, token)
    return schemas.Token(access_token=token, user=schemas.UserOut.model_validate(user))


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("access_token")
    return {"message": "Logged out"}


@router.get("/me", response_model=schemas.UserOut)
def get_me(current_user: models.User = Depends(get_current_user)):
    return schemas.UserOut.model_validate(current_user)


# Google OAuth routes
@router.get("/google")
async def google_login(request: Request):
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")
    redirect_uri = f"{settings.base_url}/api/auth/google/callback"
    return await oauth.google.authorize_redirect(request, redirect_uri)


@router.get("/google/callback")
async def google_callback(request: Request, db: Session = Depends(get_db)):
    if not settings.google_client_id:
        raise HTTPException(status_code=400, detail="Google OAuth not configured")

    token = await oauth.google.authorize_access_token(request)
    userinfo = token.get("userinfo")
    if not userinfo:
        raise HTTPException(status_code=400, detail="Failed to get user info from Google")

    sub = userinfo.get("sub")
    email = userinfo.get("email")
    name = userinfo.get("name")
    picture = userinfo.get("picture")
    username = email.split("@")[0] if email else sub

    user = db.query(models.User).filter(
        models.User.oauth_provider == "google",
        models.User.oauth_sub == sub
    ).first()

    if not user:
        user = db.query(models.User).filter(models.User.email == email).first()
        if user:
            user.oauth_provider = "google"
            user.oauth_sub = sub
            user.avatar_url = picture
        else:
            base_username = username
            counter = 0
            while db.query(models.User).filter(models.User.username == username).first():
                counter += 1
                username = f"{base_username}{counter}"

            user = models.User(
                username=username,
                email=email,
                full_name=name,
                avatar_url=picture,
                oauth_provider="google",
                oauth_sub=sub,
            )
            db.add(user)

        db.commit()
        db.refresh(user)

    jwt_token = create_access_token({"sub": str(user.id)})
    response = RedirectResponse(url="/")
    set_auth_cookie(response, jwt_token)
    return response


# GitHub OAuth routes
@router.get("/github")
async def github_login(request: Request):
    if not settings.github_client_id:
        raise HTTPException(status_code=400, detail="GitHub OAuth not configured")
    redirect_uri = f"{settings.base_url}/api/auth/github/callback"
    return await oauth.github.authorize_redirect(request, redirect_uri)


@router.get("/github/callback")
async def github_callback(request: Request, db: Session = Depends(get_db)):
    if not settings.github_client_id:
        raise HTTPException(status_code=400, detail="GitHub OAuth not configured")

    token = await oauth.github.authorize_access_token(request)
    resp = await oauth.github.get("user", token=token)
    github_user = resp.json()

    sub = str(github_user.get("id"))
    username = github_user.get("login")
    name = github_user.get("name") or username
    avatar = github_user.get("avatar_url")

    user = db.query(models.User).filter(
        models.User.oauth_provider == "github",
        models.User.oauth_sub == sub
    ).first()

    if not user:
        base_username = username
        counter = 0
        while db.query(models.User).filter(models.User.username == username).first():
            counter += 1
            username = f"{base_username}{counter}"

        user = models.User(
            username=username,
            full_name=name,
            avatar_url=avatar,
            oauth_provider="github",
            oauth_sub=sub,
        )
        db.add(user)
        db.commit()
        db.refresh(user)

    jwt_token = create_access_token({"sub": str(user.id)})
    response = RedirectResponse(url="/")
    set_auth_cookie(response, jwt_token)
    return response
