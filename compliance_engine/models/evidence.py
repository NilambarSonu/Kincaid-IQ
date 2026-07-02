from sqlalchemy import Column, Integer, String, Text, DateTime, Float, ForeignKey, func
from backend.database import Base


class ComplianceEvidence(Base):
    __tablename__ = "ce_evidence"

    id               = Column(Integer, primary_key=True, index=True)
    control_id       = Column(Integer, ForeignKey("ce_controls.id", ondelete="CASCADE"), nullable=False, index=True)
    filename         = Column(String(500), nullable=False)
    original_name    = Column(String(500), nullable=False)
    file_type        = Column(String(50), nullable=True)
    file_size        = Column(Integer, nullable=True)
    description      = Column(Text, nullable=True)
    uploaded_by      = Column(String(200), nullable=True)
    file_content     = Column(Text, nullable=True)
    source           = Column(String(50), default="manual")
    collection_method = Column(String(100), nullable=True)
    evidence_type    = Column(String(100), nullable=True)
    hash_val         = Column(String(64), nullable=True)
    created_at       = Column(DateTime, server_default=func.now())
