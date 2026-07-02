"""
CRM Sync router — Provider-agnostic adapter + HubSpot + Salesforce + Lightfield.

Provider-agnostic interface (CrmProvider ABC):
  push_account(name, ein, **kwargs) → {"ok": bool, "provider_id": str, "demo": bool}
  push_contact(first_name, last_name, email, **kwargs) → {"ok": bool, ...}
  push_opportunity(title, estimated_value, **kwargs) → {"ok": bool, ...}

Concrete providers:
  LightfieldProvider — Bearer token auth, api version header (primary)
  HubSpotProvider    — Replit connector OAuth (secondary)

Endpoints:
  GET  /api/crm/lightfield/status          — Lightfield connection health
  POST /api/crm/lightfield/push-account    — push account to Lightfield
  POST /api/crm/lightfield/push-contact    — push contact to Lightfield
  POST /api/crm/lightfield/push-opportunity— push opportunity to Lightfield
  POST /api/crm/lightfield/push-alert      — push 5500 alert as CRM activity
  POST /api/crm/hubspot/push-contact       — create/update contact in HubSpot CRM
  POST /api/crm/hubspot/push-deal          — create deal linked to a contact
  GET  /api/crm/hubspot/contacts           — list recent HubSpot contacts
  GET  /api/crm/hubspot/deals              — list recent HubSpot deals
  POST /api/crm/salesforce/push-lead       — create/update lead in Salesforce
  GET  /api/crm/salesforce/leads           — list recent Salesforce leads
  GET  /api/crm/status                     — connection health for all CRMs
"""
import os, logging, httpx
from abc import ABC, abstractmethod
from typing import Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session


# ─── Provider-agnostic CRM adapter interface ──────────────────────────────────

class CrmProvider(ABC):
    """
    Abstract base for CRM integrations.
    Each concrete provider implements push_account, push_contact, push_opportunity.
    All methods return a standard dict: {"ok": bool, "provider_id": str|None, "demo": bool, ...}
    "demo" is True when the provider is not fully configured and returns a synthetic receipt.
    """

    @property
    @abstractmethod
    def name(self) -> str:
        """Human-readable provider name (e.g. 'Lightfield', 'HubSpot')."""

    @property
    @abstractmethod
    def configured(self) -> bool:
        """True when the provider has the credentials needed to make live API calls."""

    @abstractmethod
    async def push_account(self, name: str, **kwargs: Any) -> Dict[str, Any]:
        """Create or update an employer account record in the CRM."""

    @abstractmethod
    async def push_contact(self, first_name: str, last_name: str, **kwargs: Any) -> Dict[str, Any]:
        """Create or update a contact record in the CRM."""

    @abstractmethod
    async def push_opportunity(self, title: str, **kwargs: Any) -> Dict[str, Any]:
        """Create or update an opportunity/deal record in the CRM."""

    def _demo_receipt(self, entity: str, label: str) -> Dict[str, Any]:
        """Standard demo receipt returned when the provider is not configured."""
        return {
            "ok": True,
            "demo": True,
            "provider_id": None,
            "provider": self.name,
            "message": f"Demo receipt ({entity}: '{label}'). Set credentials to enable live {self.name} sync.",
        }


class _LightfieldProvider(CrmProvider):
    """
    Lightfield CRM — primary integration.
    Auth: Authorization: Bearer <LIGHTFIELD_API_KEY>
    Header: Lightfield-Version: <LIGHTFIELD_VERSION>
    Base URL: https://api.lightfield.app/v1
    """

    @property
    def name(self) -> str:
        return "Lightfield"

    @property
    def configured(self) -> bool:
        return bool(os.environ.get("LIGHTFIELD_API_KEY", ""))

    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Bearer {os.environ.get('LIGHTFIELD_API_KEY', '')}",
            "Lightfield-Version": os.environ.get("LIGHTFIELD_API_VERSION", "2026-03-01"),
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def _post(self, path: str, payload: dict) -> dict:
        async with httpx.AsyncClient(timeout=12) as client:
            resp = await client.post(
                f"https://api.lightfield.app/v1{path}",
                json=payload,
                headers=self._headers(),
            )
        if resp.status_code not in (200, 201):
            raise HTTPException(502, f"Lightfield API error {resp.status_code}: {resp.text[:200]}")
        return resp.json()

    async def push_account(self, name: str, **kwargs: Any) -> Dict[str, Any]:
        if not self.configured:
            return self._demo_receipt("account", name)
        data = await self._post("/accounts", {
            "name": name,
            "external_ref": kwargs.get("ein"),
            "industry": kwargs.get("industry"),
            "state": kwargs.get("state"),
            "employee_count": kwargs.get("employees"),
            "annual_premium_usd": kwargs.get("annual_premium"),
            "plan_type": kwargs.get("plan_type"),
            "tpa": kwargs.get("tpa"),
            "carrier": kwargs.get("carrier"),
            "renewal_date": kwargs.get("renewal_date"),
            "status": kwargs.get("relationship_status", "prospect"),
            "notes": kwargs.get("notes"),
            "tags": kwargs.get("tags", ["kincaid-iq"]),
            "source": "kincaid_iq",
        })
        return {"ok": True, "demo": False, "provider": self.name, "provider_id": data.get("id"), "data": data}

    async def push_contact(self, first_name: str, last_name: str, **kwargs: Any) -> Dict[str, Any]:
        if not self.configured:
            return self._demo_receipt("contact", f"{first_name} {last_name}")
        data = await self._post("/contacts", {
            "first_name": first_name, "last_name": last_name,
            "title": kwargs.get("title"), "email": kwargs.get("email"),
            "phone": kwargs.get("phone"), "role": kwargs.get("role"),
            "firm": kwargs.get("firm"), "account_id": kwargs.get("account_id"),
            "source": "kincaid_iq",
        })
        return {"ok": True, "demo": False, "provider": self.name, "provider_id": data.get("id"), "data": data}

    async def push_opportunity(self, title: str, **kwargs: Any) -> Dict[str, Any]:
        if not self.configured:
            return self._demo_receipt("opportunity", title)
        data = await self._post("/opportunities", {
            "title": title,
            "account_id": kwargs.get("account_id"),
            "stage": kwargs.get("stage", "prospect"),
            "estimated_value_usd": kwargs.get("estimated_value"),
            "renewal_date": kwargs.get("renewal_date"),
            "notes": kwargs.get("notes"),
            "source": "kincaid_iq",
        })
        return {"ok": True, "demo": False, "provider": self.name, "provider_id": data.get("id"), "data": data}


class _HubSpotProvider(CrmProvider):
    """
    HubSpot CRM — secondary integration.
    Contacts and deals only. Auth via a direct private-app token
    (HUBSPOT_ACCESS_TOKEN) or, on Replit, the connector proxy.
    """

    @property
    def name(self) -> str:
        return "HubSpot"

    @property
    def configured(self) -> bool:
        return _hubspot_configured()

    async def push_account(self, name: str, **kwargs: Any) -> Dict[str, Any]:
        # HubSpot doesn't have a native Account object in the connector interface;
        # represent as a Company via contact push path.
        return self._demo_receipt("company", name) if not self.configured else {"ok": True, "demo": False, "provider": self.name, "provider_id": None, "note": "Use push_contact for HubSpot."}

    async def push_contact(self, first_name: str, last_name: str, **kwargs: Any) -> Dict[str, Any]:
        if not self.configured:
            return self._demo_receipt("contact", f"{first_name} {last_name}")
        # Delegate to connector; implementation in hubspot_push_contact endpoint
        return {"ok": True, "demo": False, "provider": self.name, "provider_id": None, "note": "Use /api/crm/hubspot/push-contact endpoint."}

    async def push_opportunity(self, title: str, **kwargs: Any) -> Dict[str, Any]:
        if not self.configured:
            return self._demo_receipt("deal", title)
        return {"ok": True, "demo": False, "provider": self.name, "provider_id": None, "note": "Use /api/crm/hubspot/push-deal endpoint."}


# Singleton provider instances
lightfield_provider: CrmProvider = _LightfieldProvider()
hubspot_provider: CrmProvider = _HubSpotProvider()

def get_provider(name: str) -> CrmProvider:
    """Return the named CRM provider instance."""
    providers = {"lightfield": lightfield_provider, "hubspot": hubspot_provider}
    if name not in providers:
        raise HTTPException(400, f"Unknown CRM provider '{name}'. Valid: {list(providers)}")
    return providers[name]

from backend.database import get_db
from backend.models import DiscoveredContact

logger = logging.getLogger("kincaid.crm_sync")
router = APIRouter(prefix="/api/crm", tags=["crm-sync"])

REPLIT_CONNECTORS_HOSTNAME = os.environ.get("REPLIT_CONNECTORS_HOSTNAME", "")
REPL_IDENTITY = os.environ.get("REPL_IDENTITY", "")

# Direct HubSpot private-app token (portable; required off-Replit, e.g. on AWS).
# When set, requests go straight to the HubSpot API instead of the Replit
# connector proxy.
HUBSPOT_ACCESS_TOKEN = os.environ.get("HUBSPOT_ACCESS_TOKEN", "")
HUBSPOT_API_BASE = "https://api.hubapi.com"


def _hubspot_configured() -> bool:
    """True when HubSpot can be reached either directly (token) or via the
    Replit connector proxy."""
    return bool(HUBSPOT_ACCESS_TOKEN or REPLIT_CONNECTORS_HOSTNAME)

# ─── Lightfield config ────────────────────────────────────────────────────────
LIGHTFIELD_API_KEY     = os.environ.get("LIGHTFIELD_API_KEY", "")
LIGHTFIELD_BASE_URL    = "https://api.lightfield.app/v1"
LIGHTFIELD_VERSION     = os.environ.get("LIGHTFIELD_API_VERSION", "2026-03-01")

SF_USERNAME      = os.environ.get("SALESFORCE_USERNAME", "")
SF_PASSWORD      = os.environ.get("SALESFORCE_PASSWORD", "")
SF_SECURITY_TOKEN = os.environ.get("SALESFORCE_SECURITY_TOKEN", "")
SF_DOMAIN        = os.environ.get("SALESFORCE_DOMAIN", "login")


# ─── HubSpot proxy helper ──────────────────────────────────────────────────────

async def _hs_request(method: str, path: str, body: dict | None = None) -> dict:
    """Call the HubSpot API.

    Prefers a direct private-app token (HUBSPOT_ACCESS_TOKEN) so the integration
    works off-Replit (e.g. on AWS); falls back to Replit's connector proxy.
    """
    if HUBSPOT_ACCESS_TOKEN:
        url = f"{HUBSPOT_API_BASE}{path}"
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {HUBSPOT_ACCESS_TOKEN}",
        }
    elif REPLIT_CONNECTORS_HOSTNAME:
        url = f"https://{REPLIT_CONNECTORS_HOSTNAME}/proxy/hubspot{path}"
        headers = {"Content-Type": "application/json"}
        if REPL_IDENTITY:
            headers["X-Replit-Identity"] = REPL_IDENTITY
    else:
        raise HTTPException(
            503,
            "HubSpot not configured — set HUBSPOT_ACCESS_TOKEN (direct) or "
            "REPLIT_CONNECTORS_HOSTNAME (Replit connector).",
        )

    try:
        async with httpx.AsyncClient(timeout=15) as client:
            if method.upper() == "GET":
                resp = await client.get(url, headers=headers)
            elif method.upper() == "POST":
                resp = await client.post(url, json=body or {}, headers=headers)
            elif method.upper() == "PATCH":
                resp = await client.patch(url, json=body or {}, headers=headers)
            else:
                raise ValueError(f"Unsupported method: {method}")

        if resp.status_code >= 400:
            logger.warning(f"[HubSpot] {method} {path} → {resp.status_code}: {resp.text[:300]}")
            raise HTTPException(resp.status_code, f"HubSpot API error: {resp.text[:200]}")
        return resp.json()
    except httpx.RequestError as e:
        raise HTTPException(503, f"HubSpot proxy unreachable: {e}")


# ─── Salesforce helper ─────────────────────────────────────────────────────────

def _get_sf():
    """Return an authenticated simple_salesforce.Salesforce client, or None."""
    if not (SF_USERNAME and SF_PASSWORD):
        return None
    try:
        from simple_salesforce import Salesforce
        return Salesforce(
            username=SF_USERNAME,
            password=SF_PASSWORD,
            security_token=SF_SECURITY_TOKEN or "",
            domain=SF_DOMAIN,
        )
    except Exception as e:
        logger.warning(f"[Salesforce] Auth failed: {e}")
        return None


# ─── Request models ────────────────────────────────────────────────────────────

class HubSpotContactPush(BaseModel):
    contact_id: Optional[int] = None
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    job_title: Optional[str] = None
    phone: Optional[str] = None
    state: Optional[str] = None
    participants: Optional[int] = None
    welfare_premiums: Optional[float] = None
    kincaid_score: Optional[int] = None

class HubSpotDealPush(BaseModel):
    contact_id: Optional[int] = None
    deal_name: str
    amount: Optional[float] = None
    stage: Optional[str] = "appointmentscheduled"
    employer_name: Optional[str] = None
    participants: Optional[int] = None

class SalesforcePush(BaseModel):
    contact_id: Optional[int] = None
    email: str
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    company: Optional[str] = None
    title: Optional[str] = None
    state: Optional[str] = None
    participants: Optional[int] = None
    welfare_premiums: Optional[float] = None


# ─── Status endpoint ───────────────────────────────────────────────────────────

@router.get("/status")
async def crm_status():
    hs_ok = _hubspot_configured()
    sf_ok = bool(SF_USERNAME and SF_PASSWORD)

    # Quick HubSpot ping
    hs_detail = "not configured"
    if hs_ok:
        try:
            data = await _hs_request("GET", "/crm/v3/objects/contacts?limit=1")
            hs_detail = f"connected · {data.get('total', 0)} contacts"
        except Exception as e:
            hs_detail = f"error: {str(e)[:80]}"

    # Salesforce ping
    sf_detail = "not configured — add SALESFORCE_USERNAME / SALESFORCE_PASSWORD secrets"
    if sf_ok:
        try:
            sf = _get_sf()
            if sf:
                result = sf.query("SELECT COUNT() FROM Lead")
                sf_detail = f"connected · {result.get('totalSize', 0)} leads"
            else:
                sf_detail = "authentication failed"
        except Exception as e:
            sf_detail = f"error: {str(e)[:80]}"

    return {
        "hubspot": {"configured": hs_ok, "detail": hs_detail},
        "salesforce": {"configured": sf_ok, "detail": sf_detail},
    }


# ─── HubSpot: list contacts ────────────────────────────────────────────────────

@router.get("/hubspot/contacts")
async def hs_list_contacts(limit: int = 20):
    props = "email,firstname,lastname,company,jobtitle,phone,state,createdate"
    data = await _hs_request("GET", f"/crm/v3/objects/contacts?limit={limit}&properties={props}&sorts=-createdate")
    results = data.get("results", [])
    return {
        "total": data.get("total", len(results)),
        "contacts": [
            {
                "id": r["id"],
                "email": r["properties"].get("email", ""),
                "first_name": r["properties"].get("firstname", ""),
                "last_name": r["properties"].get("lastname", ""),
                "company": r["properties"].get("company", ""),
                "job_title": r["properties"].get("jobtitle", ""),
                "state": r["properties"].get("state", ""),
                "created": r["properties"].get("createdate", ""),
            }
            for r in results
        ],
    }


# ─── HubSpot: list deals ───────────────────────────────────────────────────────

@router.get("/hubspot/deals")
async def hs_list_deals(limit: int = 20):
    props = "dealname,amount,dealstage,closedate,createdate"
    data = await _hs_request("GET", f"/crm/v3/objects/deals?limit={limit}&properties={props}")
    results = data.get("results", [])
    return {
        "total": data.get("total", len(results)),
        "deals": [
            {
                "id": r["id"],
                "name": r["properties"].get("dealname", ""),
                "amount": r["properties"].get("amount"),
                "stage": r["properties"].get("dealstage", ""),
                "close_date": r["properties"].get("closedate", ""),
                "created": r["properties"].get("createdate", ""),
            }
            for r in results
        ],
    }


# ─── HubSpot: push contact ─────────────────────────────────────────────────────

@router.post("/hubspot/push-contact")
async def hs_push_contact(req: HubSpotContactPush, db: Session = Depends(get_db)):
    props = {
        "email": req.email,
        "firstname": req.first_name or "",
        "lastname": req.last_name or "",
        "company": req.company or "",
        "jobtitle": req.job_title or "",
        "state": req.state or "",
    }
    if req.participants:
        props["numemployees"] = str(req.participants)
    if req.phone:
        props["phone"] = req.phone

    # Try to find existing contact first
    try:
        search_body = {
            "filterGroups": [{"filters": [{"propertyName": "email", "operator": "EQ", "value": req.email}]}],
            "properties": ["email", "firstname", "lastname"],
            "limit": 1,
        }
        search = await _hs_request("POST", "/crm/v3/objects/contacts/search", search_body)
        existing = search.get("results", [])

        if existing:
            hs_id = existing[0]["id"]
            result = await _hs_request("PATCH", f"/crm/v3/objects/contacts/{hs_id}", {"properties": props})
            action = "updated"
        else:
            result = await _hs_request("POST", "/crm/v3/objects/contacts", {"properties": props})
            hs_id = result["id"]
            action = "created"
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(500, f"HubSpot contact push failed: {e}")

    # Update local DB contact record if we have one
    if req.contact_id:
        try:
            c = db.query(DiscoveredContact).filter(DiscoveredContact.id == req.contact_id).first()
            if c:
                c.status = "contacted"
                db.commit()
        except Exception:
            pass

    logger.info(f"[HubSpot] Contact {action}: {req.email} (id={hs_id})")
    return {"ok": True, "action": action, "hubspot_id": hs_id}


# ─── HubSpot: push deal ────────────────────────────────────────────────────────

@router.post("/hubspot/push-deal")
async def hs_push_deal(req: HubSpotDealPush):
    props = {
        "dealname": req.deal_name,
        "dealstage": req.stage or "appointmentscheduled",
        "pipeline": "default",
    }
    if req.amount:
        props["amount"] = str(req.amount)

    result = await _hs_request("POST", "/crm/v3/objects/deals", {"properties": props})
    deal_id = result["id"]
    logger.info(f"[HubSpot] Deal created: {req.deal_name} (id={deal_id})")
    return {"ok": True, "hubspot_deal_id": deal_id}


# ─── Salesforce: list leads ────────────────────────────────────────────────────

@router.get("/salesforce/leads")
def sf_list_leads(limit: int = 20):
    sf = _get_sf()
    if not sf:
        raise HTTPException(503, "Salesforce not configured — add SALESFORCE_USERNAME, SALESFORCE_PASSWORD, and SALESFORCE_SECURITY_TOKEN secrets")
    try:
        result = sf.query(
            f"SELECT Id, FirstName, LastName, Email, Company, Title, State, NumberOfEmployees, "
            f"AnnualRevenue, Status, CreatedDate FROM Lead ORDER BY CreatedDate DESC LIMIT {limit}"
        )
        records = result.get("records", [])
        return {
            "total": result.get("totalSize", len(records)),
            "leads": [
                {
                    "id": r["Id"],
                    "first_name": r.get("FirstName", ""),
                    "last_name": r.get("LastName", ""),
                    "email": r.get("Email", ""),
                    "company": r.get("Company", ""),
                    "title": r.get("Title", ""),
                    "state": r.get("State", ""),
                    "employees": r.get("NumberOfEmployees"),
                    "status": r.get("Status", ""),
                    "created": r.get("CreatedDate", ""),
                }
                for r in records
            ],
        }
    except Exception as e:
        raise HTTPException(500, f"Salesforce query failed: {e}")


# ─── Salesforce: push lead ─────────────────────────────────────────────────────

@router.post("/salesforce/push-lead")
def sf_push_lead(req: SalesforcePush, db: Session = Depends(get_db)):
    sf = _get_sf()
    if not sf:
        raise HTTPException(503, "Salesforce not configured — add SALESFORCE_USERNAME, SALESFORCE_PASSWORD, and SALESFORCE_SECURITY_TOKEN secrets")

    try:
        # Check if lead with this email already exists
        safe_email = req.email.replace("'", "\\'")
        check = sf.query(f"SELECT Id FROM Lead WHERE Email = '{safe_email}' LIMIT 1")
        existing = check.get("records", [])

        lead_data = {
            "Email": req.email,
            "FirstName": req.first_name or "",
            "LastName": req.last_name or "Unknown",
            "Company": req.company or "Unknown",
            "Title": req.title or "",
            "State": req.state or "",
            "LeadSource": "Kincaid IQ — Contact Intelligence™",
        }
        if req.participants:
            lead_data["NumberOfEmployees"] = req.participants
        if req.welfare_premiums:
            lead_data["AnnualRevenue"] = req.welfare_premiums

        if existing:
            lead_id = existing[0]["Id"]
            sf.Lead.update(lead_id, lead_data)
            action = "updated"
        else:
            result = sf.Lead.create(lead_data)
            lead_id = result["id"]
            action = "created"

    except Exception as e:
        raise HTTPException(500, f"Salesforce lead push failed: {e}")

    # Update local DB contact
    if req.contact_id:
        try:
            c = db.query(DiscoveredContact).filter(DiscoveredContact.id == req.contact_id).first()
            if c:
                c.status = "contacted"
                db.commit()
        except Exception:
            pass

    logger.info(f"[Salesforce] Lead {action}: {req.email} (id={lead_id})")
    return {"ok": True, "action": action, "salesforce_id": lead_id}


# ─── Lightfield CRM adapter ───────────────────────────────────────────────────

class LightfieldAccountReq(BaseModel):
    name: str
    ein: Optional[str] = None
    industry: Optional[str] = None
    state: Optional[str] = None
    employees: Optional[int] = None
    annual_premium: Optional[float] = None
    plan_type: Optional[str] = None
    tpa: Optional[str] = None
    carrier: Optional[str] = None
    renewal_date: Optional[str] = None
    relationship_status: Optional[str] = "prospect"
    notes: Optional[str] = None
    tags: Optional[list] = None

class LightfieldContactReq(BaseModel):
    account_id: Optional[str] = None
    first_name: Optional[str] = None
    last_name: Optional[str] = None
    title: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    role: Optional[str] = "decision_maker"
    firm: Optional[str] = None

class LightfieldOpportunityReq(BaseModel):
    account_id: Optional[str] = None
    title: str
    stage: Optional[str] = "prospect"
    estimated_value: Optional[float] = None
    renewal_date: Optional[str] = None
    notes: Optional[str] = None


@router.get("/lightfield/status")
def lightfield_status():
    """Check whether the Lightfield integration is configured."""
    lf = lightfield_provider
    return {
        "configured": lf.configured,
        "base_url": LIGHTFIELD_BASE_URL,
        "api_version": LIGHTFIELD_VERSION,
        "demo_mode": not lf.configured,
        "message": (
            "Lightfield is connected." if lf.configured
            else "Set LIGHTFIELD_API_KEY to enable Lightfield CRM sync. Running in demo mode."
        ),
    }


@router.post("/lightfield/push-account")
async def lightfield_push_account(req: LightfieldAccountReq):
    """Push an employer account to Lightfield CRM via the provider adapter."""
    result = await lightfield_provider.push_account(
        name=req.name,
        ein=req.ein,
        industry=req.industry,
        state=req.state,
        employees=req.employees,
        annual_premium=req.annual_premium,
        plan_type=req.plan_type,
        tpa=req.tpa,
        carrier=req.carrier,
        renewal_date=req.renewal_date,
        relationship_status=req.relationship_status,
        notes=req.notes,
        tags=req.tags,
    )
    if result.get("demo"):
        logger.info("[Lightfield] Demo mode — push-account returned synthetic receipt")
    else:
        logger.info(f"[Lightfield] Account pushed: {req.name} → id={result.get('provider_id')}")
    return result


@router.post("/lightfield/push-contact")
async def lightfield_push_contact(req: LightfieldContactReq):
    """Push a contact to Lightfield CRM via the provider adapter."""
    result = await lightfield_provider.push_contact(
        first_name=req.first_name or "",
        last_name=req.last_name or "",
        title=req.title,
        email=req.email,
        phone=req.phone,
        role=req.role,
        firm=req.firm,
        account_id=req.account_id,
    )
    return result


@router.post("/lightfield/push-opportunity")
async def lightfield_push_opportunity(req: LightfieldOpportunityReq):
    """Push an opportunity/deal to Lightfield CRM via the provider adapter."""
    result = await lightfield_provider.push_opportunity(
        title=req.title,
        account_id=req.account_id,
        stage=req.stage,
        estimated_value=req.estimated_value,
        renewal_date=req.renewal_date,
        notes=req.notes,
    )
    return result


@router.post("/lightfield/push-alert")
async def lightfield_push_alert(
    ein: str,
    employer_name: str,
    alert_type: str,
    summary: str,
    re_engagement_angle: Optional[str] = None,
):
    """
    Push a 5500 filing-change alert to Lightfield as an activity/note on the account.
    Routes through the provider adapter for graceful demo fallback.
    """
    if not lightfield_provider.configured:
        return lightfield_provider._demo_receipt("alert", summary)

    payload = {
        "entity_type": "account",
        "external_ref": ein,
        "activity_type": "form_5500_alert",
        "alert_type": alert_type,
        "summary": summary,
        "body": re_engagement_angle or summary,
        "source": "kincaid_iq",
        "tags": ["form-5500", "filing-alert", "kincaid-iq"],
    }

    async with httpx.AsyncClient(timeout=12) as client:
        resp = await client.post(
            f"{LIGHTFIELD_BASE_URL}/activities",
            json=payload,
            headers=lightfield_provider._headers(),
        )

    if resp.status_code not in (200, 201):
        raise HTTPException(502, f"Lightfield API error: {resp.status_code}")

    return {"ok": True, "demo": False, "provider": "Lightfield", "data": resp.json()}
