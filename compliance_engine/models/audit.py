from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, func, ForeignKey
from backend.database import Base


class ComplianceAudit(Base):
    __tablename__ = "ce_audits"

    id            = Column(Integer, primary_key=True, index=True)
    name          = Column(String(300), nullable=False)
    framework     = Column(String(50), nullable=False, index=True)
    status        = Column(String(50), default="in_progress", index=True)
    scope         = Column(Text, nullable=True)
    auditor       = Column(String(200), nullable=True)
    started_at    = Column(DateTime, server_default=func.now())
    completed_at  = Column(DateTime, nullable=True)
    total_controls = Column(Integer, default=0)
    passed        = Column(Integer, default=0)
    failed        = Column(Integer, default=0)
    not_tested    = Column(Integer, default=0)
    score_pct     = Column(Float, nullable=True)
    summary       = Column(Text, nullable=True)
    created_at    = Column(DateTime, server_default=func.now())
    updated_at    = Column(DateTime, server_default=func.now(), onupdate=func.now())


class AuditControlResult(Base):
    __tablename__ = "ce_audit_control_results"

    id          = Column(Integer, primary_key=True, index=True)
    audit_id    = Column(Integer, ForeignKey("ce_audits.id", ondelete="CASCADE"), nullable=False, index=True)
    control_id  = Column(Integer, ForeignKey("ce_controls.id", ondelete="CASCADE"), nullable=False, index=True)
    result      = Column(String(50), nullable=False, default="not_tested")
    notes       = Column(Text, nullable=True)
    tested_at   = Column(DateTime, server_default=func.now())
