from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime, timedelta
import re

from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/orgs", tags=["organizations"])


def _slugify(name: str) -> str:
    slug = name.lower().strip()
    slug = re.sub(r"[^a-z0-9]+", "-", slug)
    return slug.strip("-")[:50]


def _get_user_org(user: models.User, db: Session) -> Optional[models.Organization]:
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id).first()
    if not membership:
        return None
    return db.query(models.Organization).filter_by(id=membership.org_id).first()


class OrgCreate(BaseModel):
    name: str
    org_type: str = "employer"
    employees: Optional[int] = None
    ein: Optional[str] = None
    industry: Optional[str] = None
    annual_premium: Optional[float] = None


class OrgUpdate(BaseModel):
    name: Optional[str] = None
    org_type: Optional[str] = None
    employees: Optional[int] = None
    ein: Optional[str] = None
    industry: Optional[str] = None
    annual_premium: Optional[float] = None


class PlanClientCreate(BaseModel):
    name: str
    ein: Optional[str] = None
    plan_type: Optional[str] = None
    funding_type: Optional[str] = None
    employees: Optional[int] = None
    annual_spend: Optional[float] = None
    tpa: Optional[str] = None
    carrier: Optional[str] = None
    renewal_date: Optional[str] = None
    state: Optional[str] = None
    notes: Optional[str] = None


def _org_to_dict(org: models.Organization) -> dict:
    return {
        "id": org.id,
        "name": org.name,
        "slug": org.slug,
        "plan": org.plan,
        "org_type": org.org_type,
        "subscription_status": org.subscription_status,
        "employees": org.employees,
        "ein": org.ein,
        "industry": org.industry,
        "annual_premium": org.annual_premium,
        "stripe_customer_id": org.stripe_customer_id,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        "created_at": org.created_at.isoformat() if org.created_at else None,
    }


@router.post("", status_code=201)
def create_org(body: OrgCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    existing_member = db.query(models.OrganizationMember).filter_by(user_id=user.id).first()
    if existing_member:
        raise HTTPException(status_code=400, detail="User already belongs to an organization")

    base_slug = _slugify(body.name)
    slug = base_slug
    counter = 1
    while db.query(models.Organization).filter_by(slug=slug).first():
        slug = f"{base_slug}-{counter}"
        counter += 1

    org = models.Organization(
        name=body.name,
        slug=slug,
        org_type=body.org_type,
        employees=body.employees,
        ein=body.ein,
        industry=body.industry,
        annual_premium=body.annual_premium,
        trial_ends_at=datetime.utcnow() + timedelta(days=14),
    )
    db.add(org)
    db.flush()

    member = models.OrganizationMember(org_id=org.id, user_id=user.id, role="owner")
    db.add(member)
    db.commit()
    db.refresh(org)
    return _org_to_dict(org)


@router.get("/me")
def get_my_org(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    org = _get_user_org(user, db)
    if not org:
        return {"org": None, "role": None}
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id, org_id=org.id).first()
    return {"org": _org_to_dict(org), "role": membership.role if membership else "viewer"}


@router.put("/{org_id}")
def update_org(org_id: str, body: OrgUpdate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id, org_id=org_id).first()
    if not membership or membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    org = db.query(models.Organization).filter_by(id=org_id).first()
    if not org:
        raise HTTPException(status_code=404, detail="Organization not found")
    for field, value in body.model_dump(exclude_none=True).items():
        setattr(org, field, value)
    db.commit()
    db.refresh(org)
    return _org_to_dict(org)


@router.get("/{org_id}/members")
def list_members(org_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id, org_id=org_id).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member")
    members = db.query(models.OrganizationMember, models.User).join(
        models.User, models.OrganizationMember.user_id == models.User.id
    ).filter(models.OrganizationMember.org_id == org_id).all()
    return [{"user_id": u.id, "username": u.username, "email": u.email,
             "full_name": u.full_name, "role": m.role} for m, u in members]


@router.post("/{org_id}/clients", status_code=201)
def create_client(org_id: str, body: PlanClientCreate, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id, org_id=org_id).first()
    if not membership or membership.role not in ("owner", "admin", "analyst"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    client = models.PlanClient(org_id=org_id, **body.model_dump())
    db.add(client)
    db.commit()
    db.refresh(client)
    return {c.name: getattr(client, c.name) for c in client.__table__.columns}


@router.get("/{org_id}/clients")
def list_clients(org_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id, org_id=org_id).first()
    if not membership:
        raise HTTPException(status_code=403, detail="Not a member")
    clients = db.query(models.PlanClient).filter_by(org_id=org_id).all()
    return [{c.name: getattr(cl, c.name) for c in cl.__table__.columns} for cl in clients]


@router.delete("/{org_id}/clients/{client_id}", status_code=204)
def delete_client(org_id: str, client_id: str, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id, org_id=org_id).first()
    if not membership or membership.role not in ("owner", "admin"):
        raise HTTPException(status_code=403, detail="Insufficient permissions")
    client = db.query(models.PlanClient).filter_by(id=client_id, org_id=org_id).first()
    if not client:
        raise HTTPException(status_code=404)
    db.delete(client)
    db.commit()


@router.post("/onboard", status_code=201)
def onboard(
    body: OrgCreate,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    existing = db.query(models.OrganizationMember).filter_by(user_id=user.id).first()
    if existing:
        org = db.query(models.Organization).filter_by(id=existing.org_id).first()
        return {"status": "existing", "org": _org_to_dict(org)}
    return create_org(body, db, user)
