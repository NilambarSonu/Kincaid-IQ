from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime, date


class ControlCreate(BaseModel):
    framework: str
    control_id: str
    title: str
    description: Optional[str] = None
    test_procedure: Optional[str] = None
    owner: Optional[str] = None
    risk_level: str = "medium"
    notes: Optional[str] = None


class ControlUpdate(BaseModel):
    status: Optional[str] = None
    owner: Optional[str] = None
    notes: Optional[str] = None
    compensating: Optional[bool] = None
    risk_level: Optional[str] = None


class ControlOut(BaseModel):
    id: int
    framework: str
    control_id: str
    title: str
    description: Optional[str]
    test_procedure: Optional[str]
    status: str
    risk_level: str
    owner: Optional[str]
    compensating: bool
    notes: Optional[str]
    last_tested_at: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class EvidenceCreate(BaseModel):
    control_id: int
    description: Optional[str] = None


class EvidenceOut(BaseModel):
    id: int
    control_id: int
    filename: str
    original_name: str
    file_type: Optional[str]
    file_size: Optional[int]
    description: Optional[str]
    source: Optional[str]
    collection_method: Optional[str]
    evidence_type: Optional[str]
    hash_val: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AssetCreate(BaseModel):
    name: str
    asset_type: str
    description: Optional[str] = None
    owner: Optional[str] = None
    location: Optional[str] = None
    risk_level: str = "medium"
    in_scope: bool = True
    frameworks: Optional[str] = None
    criticality: str = "medium"
    vendor: Optional[str] = None
    ip_address: Optional[str] = None
    notes: Optional[str] = None


class AssetUpdate(BaseModel):
    name: Optional[str] = None
    asset_type: Optional[str] = None
    description: Optional[str] = None
    owner: Optional[str] = None
    risk_level: Optional[str] = None
    in_scope: Optional[bool] = None
    notes: Optional[str] = None


class AssetOut(BaseModel):
    id: int
    name: str
    asset_type: str
    description: Optional[str]
    owner: Optional[str]
    risk_level: str
    in_scope: bool
    frameworks: Optional[str]
    criticality: str
    created_at: datetime

    class Config:
        from_attributes = True


class FindingCreate(BaseModel):
    control_id: Optional[int] = None
    audit_id: Optional[int] = None
    title: str
    description: str
    severity: str = "medium"
    remediation: Optional[str] = None
    due_date: Optional[date] = None
    owner: Optional[str] = None
    risk_score: Optional[int] = None


class FindingUpdate(BaseModel):
    status: Optional[str] = None
    remediation: Optional[str] = None
    due_date: Optional[date] = None
    owner: Optional[str] = None
    false_positive: Optional[int] = None


class FindingOut(BaseModel):
    id: int
    control_id: Optional[int]
    audit_id: Optional[int]
    title: str
    description: str
    severity: str
    status: str
    remediation: Optional[str]
    due_date: Optional[date]
    owner: Optional[str]
    risk_score: Optional[int]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditCreate(BaseModel):
    name: str
    framework: str
    scope: Optional[str] = None
    auditor: Optional[str] = None


class AuditOut(BaseModel):
    id: int
    name: str
    framework: str
    status: str
    scope: Optional[str]
    auditor: Optional[str]
    started_at: datetime
    completed_at: Optional[datetime]
    total_controls: int
    passed: int
    failed: int
    not_tested: int
    score_pct: Optional[float]
    summary: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class AuditControlResultUpdate(BaseModel):
    result: str
    notes: Optional[str] = None
