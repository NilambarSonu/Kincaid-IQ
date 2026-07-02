import os
import json
import uuid
from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.stripe_client import get_stripe_client, get_stripe_credentials

router = APIRouter(prefix="/api/billing", tags=["billing"])

STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")

# ── À-la-carte product catalog ────────────────────────────────────────────────
PRODUCTS = [
    {
        "id": "broker-iq",
        "name": "Broker IQ Console",
        "description": "Client roster management, pipeline intelligence, and broker-grade fiduciary workflows.",
        "price_cents": 7900,
        "price_display": "$79",
        "interval": "month",
        "modules": ["broker-iq", "prospecting", "claims-recovery", "shadow-tax", "zero-trust", "cfo-war-room"],
        "features": [
            "Full Broker IQ Dashboard",
            "Client Roster + Pipeline",
            "Claims Recovery Engine",
            "Shadow Tax Exposure",
            "Zero-Trust Governance",
            "CFO War Room",
        ],
        "color": "#9B1C2E",
        "badge": "Required Base",
        "icon": "BarChart3",
    },
    {
        "id": "rx-pbm",
        "name": "RxPBM Intelligence",
        "description": "Benchmark PBM contracts, evaluate rebates, and track formulary performance.",
        "price_cents": 9900,
        "price_display": "$99",
        "interval": "month",
        "modules": ["rx-pbm"],
        "features": [
            "PBM Contract Benchmarking",
            "Rebate Evaluation Engine",
            "Formulary & Tier Analysis",
            "6-Phase PBM Methodology",
            "RFP Bank Access",
        ],
        "color": "#2563EB",
        "badge": None,
        "icon": "Pill",
    },
    {
        "id": "stop-loss",
        "name": "Stop-Loss Intelligence",
        "description": "Analyze and benchmark stop-loss coverage, specific and aggregate deductibles.",
        "price_cents": 4900,
        "price_display": "$49",
        "interval": "month",
        "modules": ["stop-loss"],
        "features": [
            "Stop-Loss Benchmarking",
            "Carrier Rankings + Scoring",
            "Specific / Aggregate Analysis",
            "Renewal Intelligence Reports",
        ],
        "color": "#9B1C2E",
        "badge": None,
        "icon": "Shield",
    },
    {
        "id": "network-disruption",
        "name": "Network Disruption Report",
        "description": "Model network changes and quantify disruption risk before every renewal.",
        "price_cents": 4900,
        "price_display": "$49",
        "interval": "month",
        "modules": ["network-disruption"],
        "features": [
            "Network Disruption Modeling",
            "Provider Impact Analysis",
            "Cost Shift Projections",
            "Member Communication Templates",
        ],
        "color": "#1E40AF",
        "badge": None,
        "icon": "Network",
    },
    {
        "id": "fiduciary",
        "name": "Fiduciary Suite",
        "description": "DOL 5500 intelligence, stewardship reports, board packs, and proof ledger.",
        "price_cents": 4900,
        "price_display": "$49",
        "interval": "month",
        "modules": ["dol5500", "stewardship", "board-pack", "proof-ledger", "war-room"],
        "features": [
            "DOL 5500 Intelligence Engine",
            "Stewardship Builder",
            "Board Pack PDF Export",
            "Proof Ledger + SHA-256 Receipts",
        ],
        "color": "#BE123C",
        "badge": None,
        "icon": "FileText",
    },
]

RX_DEFENSE_REPORT = {
    "id": "rx-defense-report",
    "name": "Rx Defense IQ™ Analysis",
    "description": "AI-powered PBM contract analysis against 50 fiduciary issues across 10 provisions. Scored 0–100.",
    "price_cents": 99900,
    "price_display": "$999",
    "mode": "payment",
    "color": "#9B1C2E",
}

PRODUCT_MAP = {p["id"]: p for p in PRODUCTS}

# ── Legacy bundle plans (kept for backward compatibility) ─────────────────────
PLANS = [
    {
        "id": "fiduciary",
        "name": "Plan Fiduciary",
        "price": 29700,
        "interval": "month",
        "description": "For self-funded plan sponsors managing fiduciary obligations",
        "features": [
            "Executive War Room (full)",
            "Rx Defense™ — PBM Contract AI",
            "CAA 2026 Compliance Dashboard",
            "DOL 5500 Intelligence Engine",
            "Board Pack Export",
            "Stewardship Builder",
            "Proof Ledger + SHA-256 Receipts",
            "2 team seats",
        ],
        "cta": "Start 14-day trial",
        "highlight": False,
    },
    {
        "id": "broker",
        "name": "Broker IQ Console",
        "price": 99700,
        "interval": "month",
        "description": "For benefits brokers running fiduciary-grade client programs",
        "features": [
            "Everything in Plan Fiduciary",
            "Actuarial Engine IQ™",
            "Indiana Prospecting Engine",
            "Stop-Loss Intelligence Engine",
            "Network Disruption Report",
            "Claims Recovery Engine",
            "Shadow Tax Exposure",
            "Zero-Trust Governance",
            "CFO War Room",
            "Unlimited client roster",
            "10 team seats · White-label reports",
        ],
        "cta": "Start 14-day trial",
        "highlight": True,
    },
    {
        "id": "enterprise",
        "name": "Fiduciary Command",
        "price": 249700,
        "interval": "month",
        "description": "Full platform for TPAs, consultants, and large broker groups",
        "features": [
            "Everything in Broker IQ Console",
            "God Mode Admin Panel",
            "SBI Forensic Engine",
            "CEI Engine",
            "GLP-1 Stress Test",
            "Full Audit Trail + Security Posture",
            "Unlimited seats",
            "API access",
            "Dedicated CSM",
            "SOC 2 documentation",
        ],
        "cta": "Contact sales",
        "highlight": False,
    },
]

PLAN_MODULES: dict[str, list[str]] = {
    "trial": ["war-room"],
    "fiduciary": [
        "war-room", "rx-defense", "dol5500", "stewardship",
        "board-pack", "proof-ledger",
    ],
    "broker": [
        "war-room", "rx-defense", "dol5500", "stewardship",
        "board-pack", "proof-ledger", "actuarial-engine",
        "prospecting", "stop-loss", "network-disruption",
        "claims-recovery", "shadow-tax", "zero-trust", "cfo-war-room",
        "broker-iq", "rx-pbm",
    ],
    "enterprise": ["*"],
}

PLAN_DISPLAY: dict[str, dict] = {
    "trial":      {"name": "Free Trial",        "color": "#94a3b8", "price": 0},
    "fiduciary":  {"name": "Plan Fiduciary",    "color": "#4f7dff", "price": 297},
    "broker":     {"name": "Broker IQ Console", "color": "#f59e0b", "price": 997},
    "enterprise": {"name": "Fiduciary Command", "color": "#22c55e", "price": 2497},
}


def _get_stripe():
    return get_stripe_client()


def _get_user_org(user: models.User, db: Session) -> Optional[models.Organization]:
    membership = db.query(models.OrganizationMember).filter_by(user_id=user.id).first()
    if not membership:
        return None
    return db.query(models.Organization).filter_by(id=membership.org_id).first()


def _get_module_sub_modules(user: models.User, db: Session) -> list[str]:
    """Return all module slugs the user has access to via active module subscriptions."""
    org = _get_user_org(user, db)
    org_id = org.id if org else None

    subs = db.query(models.ModuleSubscription).filter(
        models.ModuleSubscription.status == "active",
    )
    if org_id:
        subs = subs.filter(
            (models.ModuleSubscription.user_id == user.id) |
            (models.ModuleSubscription.org_id == org_id)
        )
    else:
        subs = subs.filter(models.ModuleSubscription.user_id == user.id)

    granted: list[str] = []
    for sub in subs.all():
        try:
            granted.extend(json.loads(sub.modules_json))
        except Exception:
            pass
    return granted


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/plans")
def get_plans():
    return {"plans": PLANS}


@router.get("/products")
def get_products():
    return {"products": PRODUCTS, "rx_defense_report": RX_DEFENSE_REPORT}


@router.get("/stripe-publishable-key")
async def get_stripe_publishable_key():
    try:
        creds = await get_stripe_credentials()
        return {"publishableKey": creds["publishable_key"]}
    except Exception as e:
        return {"publishableKey": None, "error": str(e)}


@router.get("/access")
def get_access(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    if user.username == "jeremiah.shrack":
        return {
            "plan": "enterprise",
            "plan_display": PLAN_DISPLAY["enterprise"],
            "modules": ["*"],
            "status": "active",
            "trial_ends_at": None,
            "is_admin": True,
        }
    org = _get_user_org(user, db)
    plan = org.plan if org else "trial"
    status = org.subscription_status if org else "trialing"

    plan_modules = PLAN_MODULES.get(plan, PLAN_MODULES["trial"])
    sub_modules  = _get_module_sub_modules(user, db)

    if "*" in plan_modules:
        combined = ["*"]
    else:
        combined = list(set(plan_modules + sub_modules))

    return {
        "plan": plan,
        "plan_display": PLAN_DISPLAY.get(plan, PLAN_DISPLAY["trial"]),
        "modules": combined,
        "status": status,
        "trial_ends_at": org.trial_ends_at.isoformat() if org and org.trial_ends_at else None,
        "is_admin": False,
    }


@router.get("/my-modules")
def get_my_modules(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    """Return active module subscriptions for the current user/org."""
    org = _get_user_org(user, db)
    org_id = org.id if org else None

    q = db.query(models.ModuleSubscription).filter(
        models.ModuleSubscription.status == "active"
    )
    if org_id:
        q = q.filter(
            (models.ModuleSubscription.user_id == user.id) |
            (models.ModuleSubscription.org_id == org_id)
        )
    else:
        q = q.filter(models.ModuleSubscription.user_id == user.id)

    subs = q.all()
    return {
        "subscriptions": [
            {
                "id": s.id,
                "product_id": s.product_id,
                "product_name": PRODUCT_MAP.get(s.product_id, {}).get("name", s.product_id),
                "modules": json.loads(s.modules_json),
                "status": s.status,
                "current_period_end": s.current_period_end.isoformat() if s.current_period_end else None,
            }
            for s in subs
        ]
    }


@router.get("/subscription")
def get_subscription(db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    org = _get_user_org(user, db)
    if not org:
        return {"subscription": None, "plan": "none", "status": "no_org"}

    stripe = _get_stripe()
    if stripe and org.stripe_subscription_id:
        try:
            sub = stripe.Subscription.retrieve(org.stripe_subscription_id)
            return {
                "subscription": {
                    "id": sub.id,
                    "status": sub.status,
                    "current_period_end": sub.current_period_end,
                    "cancel_at_period_end": sub.cancel_at_period_end,
                },
                "plan": org.plan,
                "status": sub.status,
                "org": {"id": org.id, "name": org.name},
            }
        except Exception:
            pass

    return {
        "subscription": None,
        "plan": org.plan,
        "status": org.subscription_status,
        "trial_ends_at": org.trial_ends_at.isoformat() if org.trial_ends_at else None,
        "org": {"id": org.id, "name": org.name},
    }


# ── Checkout ──────────────────────────────────────────────────────────────────

class ModuleCheckoutRequest(BaseModel):
    product_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


@router.post("/module-checkout")
def create_module_checkout(
    body: ModuleCheckoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    product = PRODUCT_MAP.get(body.product_id)
    if not product:
        raise HTTPException(status_code=400, detail="Unknown product.")

    stripe = _get_stripe()
    origin = str(request.base_url).rstrip("/")
    success_url = body.success_url or f"{origin}/pricing?success=1&product={product['id']}"
    cancel_url  = body.cancel_url  or f"{origin}/pricing?canceled=1"

    if not stripe:
        return {
            "url": None,
            "mode": "demo",
            "message": "Stripe not configured. Add STRIPE_SECRET_KEY to enable live billing.",
            "product": product,
        }

    org = _get_user_org(user, db)
    customer_id = org.stripe_customer_id if org else None

    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email or "",
            name=user.full_name or user.username,
            metadata={"user_id": user.id, "org_id": org.id if org else ""},
        )
        customer_id = customer.id
        if org:
            org.stripe_customer_id = customer_id
            db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": product["name"]},
                "unit_amount": product["price_cents"],
                "recurring": {"interval": product["interval"]},
            },
            "quantity": 1,
        }],
        success_url=success_url + "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        subscription_data={
            "metadata": {
                "type": "module_subscription",
                "product_id": product["id"],
                "modules_json": json.dumps(product["modules"]),
                "user_id": user.id,
                "org_id": org.id if org else "",
            }
        },
        metadata={
            "type": "module_subscription",
            "product_id": product["id"],
            "modules_json": json.dumps(product["modules"]),
            "user_id": user.id,
            "org_id": org.id if org else "",
        },
    )
    return {"url": session.url, "mode": "stripe"}


class RxDefenseCheckoutRequest(BaseModel):
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


@router.post("/rx-defense-checkout")
def create_rx_defense_checkout(
    body: RxDefenseCheckoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    stripe = _get_stripe()
    origin = str(request.base_url).rstrip("/")
    success_url = body.success_url or f"{origin}/rx-defense?paid=1"
    cancel_url  = body.cancel_url  or f"{origin}/rx-defense?canceled=1"

    if not stripe:
        return {
            "url": None,
            "mode": "demo",
            "message": "Stripe not configured. Add STRIPE_SECRET_KEY to enable live billing.",
        }

    org = _get_user_org(user, db)
    customer_id = org.stripe_customer_id if org else None
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email or "",
            name=user.full_name or user.username,
            metadata={"user_id": user.id},
        )
        customer_id = customer.id
        if org:
            org.stripe_customer_id = customer_id
            db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        mode="payment",
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": RX_DEFENSE_REPORT["name"]},
                "unit_amount": RX_DEFENSE_REPORT["price_cents"],
            },
            "quantity": 1,
        }],
        success_url=success_url + "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        metadata={
            "type": "rx_defense_credit",
            "user_id": user.id,
        },
    )
    return {"url": session.url, "mode": "stripe"}


@router.get("/rx-defense-credits")
def get_rx_defense_credits(
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    if user.username == "jeremiah.shrack":
        return {"credits": 999, "is_admin": True}
    count = db.query(models.RxDefenseCredit).filter_by(user_id=user.id, used=False).count()
    return {"credits": count, "is_admin": False}


# ── Legacy plan checkout ───────────────────────────────────────────────────────

class CheckoutRequest(BaseModel):
    plan_id: str
    success_url: Optional[str] = None
    cancel_url: Optional[str] = None


@router.post("/checkout")
def create_checkout(
    body: CheckoutRequest,
    request: Request,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    org = _get_user_org(user, db)
    if not org:
        raise HTTPException(status_code=400, detail="No organization found. Complete onboarding first.")

    plan = next((p for p in PLANS if p["id"] == body.plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")

    if plan["id"] == "enterprise":
        return {"url": "mailto:sales@kincaidrmc.com?subject=Enterprise%20Inquiry", "mode": "contact"}

    stripe = _get_stripe()
    if not stripe:
        return {
            "url": None,
            "mode": "demo",
            "message": "Stripe not configured. Add STRIPE_SECRET_KEY to enable live billing.",
            "plan": plan,
        }

    origin = str(request.base_url).rstrip("/")
    success_url = body.success_url or f"{origin}/billing?success=1"
    cancel_url  = body.cancel_url  or f"{origin}/billing?canceled=1"

    customer_id = org.stripe_customer_id
    if not customer_id:
        customer = stripe.Customer.create(
            email=user.email or "",
            name=org.name,
            metadata={"org_id": org.id, "user_id": user.id},
        )
        customer_id = customer.id
        org.stripe_customer_id = customer_id
        db.commit()

    session = stripe.checkout.Session.create(
        customer=customer_id,
        payment_method_types=["card"],
        mode="subscription",
        line_items=[{"price_data": {
            "currency": "usd",
            "product_data": {"name": plan["name"]},
            "unit_amount": plan["price"],
            "recurring": {"interval": plan["interval"]},
        }, "quantity": 1}],
        success_url=success_url + "&session_id={CHECKOUT_SESSION_ID}",
        cancel_url=cancel_url,
        subscription_data={"trial_period_days": 14, "metadata": {"org_id": org.id, "plan": plan["id"]}},
    )
    return {"url": session.url, "mode": "stripe"}


@router.post("/portal")
def create_portal(request: Request, db: Session = Depends(get_db), user: models.User = Depends(get_current_user)):
    org = _get_user_org(user, db)
    if not org or not org.stripe_customer_id:
        raise HTTPException(status_code=400, detail="No active subscription")

    stripe = _get_stripe()
    if not stripe:
        return {"url": None, "message": "Stripe not configured"}

    origin = str(request.base_url).rstrip("/")
    session = stripe.billing_portal.Session.create(
        customer=org.stripe_customer_id,
        return_url=f"{origin}/billing",
    )
    return {"url": session.url}


# ── Usage-Based Billing ───────────────────────────────────────────────────────

@router.get("/usage")
def get_usage(
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Return usage metrics + bill preview for the current user's org.

    calculateBill(usage):
        contracts  × $120.00
        claims     × $0.02
        api_calls  × $0.001
    """
    from backend.billing_meter import get_usage as _get_usage
    org = _get_user_org(user, db)
    tenant_id = org.id if org else user.id
    return _get_usage(db, tenant_id, period)


@router.get("/usage/{tenant_id}")
def get_usage_by_tenant(
    tenant_id: str,
    period: Optional[str] = None,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Return usage + bill preview for a specific tenant (admin / enterprise only).
    """
    from backend.billing_meter import get_usage as _get_usage
    # Allow admin access or same-org access
    org = _get_user_org(user, db)
    if user.username != "jeremiah.shrack" and (not org or org.id != tenant_id):
        raise HTTPException(status_code=403, detail="Access denied")
    return _get_usage(db, tenant_id, period)


@router.post("/usage/record")
def record_usage(
    body: dict,
    db: Session = Depends(get_db),
    user: models.User = Depends(get_current_user),
):
    """
    Manually record usage for testing / enterprise self-reporting.

    Body: { "contracts": 1, "claims": 50, "api_calls": 200, "tenant_id": "..." }
    """
    from backend.billing_meter import record_contract, record_claim, record_api_call
    org = _get_user_org(user, db)
    tenant_id = body.get("tenant_id") or (org.id if org else "system")

    if body.get("contracts"):
        record_contract(db, tenant_id, int(body["contracts"]))
    if body.get("claims"):
        record_claim(db, tenant_id, int(body["claims"]))
    if body.get("api_calls"):
        record_api_call(db, tenant_id, int(body["api_calls"]))

    from backend.billing_meter import get_usage as _get_usage
    return _get_usage(db, tenant_id)


# ── Webhook ───────────────────────────────────────────────────────────────────

@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    payload    = await request.body()
    sig_header = request.headers.get("stripe-signature", "")

    stripe = _get_stripe()
    if not stripe:
        return {"received": True}

    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    data  = event["data"]["object"]
    etype = event["type"]

    if etype == "checkout.session.completed":
        meta  = data.get("metadata", {})
        mtype = meta.get("type", "")

        if mtype == "rx_defense_credit":
            user_id = meta.get("user_id")
            if user_id:
                credit = models.RxDefenseCredit(
                    user_id=user_id,
                    stripe_session_id=data.get("id"),
                    used=False,
                )
                db.add(credit)
                db.commit()

        elif mtype == "module_subscription":
            user_id      = meta.get("user_id")
            org_id       = meta.get("org_id") or None
            product_id   = meta.get("product_id")
            modules_json = meta.get("modules_json", "[]")
            sub_id       = data.get("subscription")
            customer_id  = data.get("customer")

            if product_id:
                existing = db.query(models.ModuleSubscription).filter_by(
                    stripe_subscription_id=sub_id
                ).first() if sub_id else None

                if not existing:
                    new_sub = models.ModuleSubscription(
                        id=str(uuid.uuid4()),
                        user_id=user_id,
                        org_id=org_id if org_id else None,
                        product_id=product_id,
                        modules_json=modules_json,
                        stripe_customer_id=customer_id,
                        stripe_subscription_id=sub_id,
                        stripe_session_id=data.get("id"),
                        status="active",
                    )
                    db.add(new_sub)
                    db.commit()

        else:
            # Legacy plan checkout
            org_id = meta.get("org_id")
            plan   = meta.get("plan")
            if org_id:
                org = db.query(models.Organization).filter_by(id=org_id).first()
                if org:
                    org.stripe_subscription_id = data.get("subscription")
                    org.subscription_status    = "active"
                    if plan:
                        org.plan = plan
                    db.commit()

    elif etype in ("customer.subscription.updated", "customer.subscription.deleted"):
        sub_id      = data.get("id")
        customer_id = data.get("customer")
        new_status  = data.get("status", "canceled")
        if etype == "customer.subscription.deleted":
            new_status = "canceled"

        # Update module subscription if exists
        mod_sub = db.query(models.ModuleSubscription).filter_by(
            stripe_subscription_id=sub_id
        ).first()
        if mod_sub:
            mod_sub.status = new_status
            if data.get("current_period_end"):
                mod_sub.current_period_end = datetime.fromtimestamp(data["current_period_end"])
            db.commit()
        else:
            # Legacy org plan update
            org = db.query(models.Organization).filter_by(stripe_customer_id=customer_id).first()
            if org:
                org.subscription_status = new_status
                if etype == "customer.subscription.deleted":
                    org.plan = "trial"
                db.commit()

    return {"received": True}
