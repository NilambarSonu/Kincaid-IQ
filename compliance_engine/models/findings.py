from sqlalchemy import Column, Integer, String, Text, DateTime, Date, func, ForeignKey
from backend.database import Base


class ComplianceFinding(Base):
    __tablename__ = "ce_findings"

    id              = Column(Integer, primary_key=True, index=True)
    control_id      = Column(Integer, ForeignKey("ce_controls.id", ondelete="CASCADE"), nullable=True, index=True)
    audit_id        = Column(Integer, ForeignKey("ce_audits.id", ondelete="CASCADE"), nullable=True, index=True)
    title           = Column(String(500), nullable=False)
    description     = Column(Text, nullable=False)
    severity        = Column(String(20), nullable=False, default="medium")
    status          = Column(String(50), default="open", index=True)
    remediation     = Column(Text, nullable=True)
    due_date        = Column(Date, nullable=True)
    owner           = Column(String(200), nullable=True)
    risk_score      = Column(Integer, nullable=True)
    false_positive  = Column(Integer, default=0)
    closed_at       = Column(DateTime, nullable=True)
    created_at      = Column(DateTime, server_default=func.now())
    updated_at      = Column(DateTime, server_default=func.now(), onupdate=func.now())
