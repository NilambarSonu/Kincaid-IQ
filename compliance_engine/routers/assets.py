import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional

from backend.database import get_db
from backend import models as base_models
from backend.auth import get_current_user
from compliance_engine.models.assets import ComplianceAsset
from compliance_engine.schemas.audit_schema import AssetCreate, AssetUpdate, AssetOut

logger = logging.getLogger("kincaid.compliance.assets")
router = APIRouter(prefix="/api/compliance/assets", tags=["compliance"])

ASSET_TYPES = [
    "server", "workstation", "database", "application", "cloud_service",
    "network_device", "storage", "mobile_device", "saas", "api", "other",
]


@router.get("", response_model=List[AssetOut])
def list_assets(
    in_scope: Optional[bool] = Query(None),
    risk_level: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    q = db.query(ComplianceAsset)
    if in_scope is not None:
        q = q.filter(ComplianceAsset.in_scope == in_scope)
    if risk_level:
        q = q.filter(ComplianceAsset.risk_level == risk_level)
    return q.order_by(ComplianceAsset.name).all()


@router.post("", response_model=AssetOut)
def create_asset(
    body: AssetCreate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    asset = ComplianceAsset(**body.model_dump())
    db.add(asset)
    db.commit()
    db.refresh(asset)
    return asset


@router.patch("/{asset_id}", response_model=AssetOut)
def update_asset(
    asset_id: int,
    body: AssetUpdate,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    asset = db.query(ComplianceAsset).filter(ComplianceAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    for field, val in body.model_dump(exclude_none=True).items():
        setattr(asset, field, val)
    db.commit()
    db.refresh(asset)
    return asset


@router.delete("/{asset_id}")
def delete_asset(
    asset_id: int,
    db: Session = Depends(get_db),
    user: base_models.User = Depends(get_current_user),
):
    asset = db.query(ComplianceAsset).filter(ComplianceAsset.id == asset_id).first()
    if not asset:
        raise HTTPException(status_code=404, detail="Asset not found")
    db.delete(asset)
    db.commit()
    return {"deleted": asset_id}


@router.get("/types")
def get_asset_types():
    return {"types": ASSET_TYPES}
