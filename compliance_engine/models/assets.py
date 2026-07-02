from sqlalchemy import Column, Integer, String, Text, DateTime, Float, Boolean, func
from backend.database import Base


class ComplianceAsset(Base):
    __tablename__ = "ce_assets"

    id           = Column(Integer, primary_key=True, index=True)
    name         = Column(String(300), nullable=False)
    asset_type   = Column(String(100), nullable=False)
    description  = Column(Text, nullable=True)
    owner        = Column(String(200), nullable=True)
    location     = Column(String(300), nullable=True)
    risk_level   = Column(String(20), default="medium")
    in_scope     = Column(Boolean, default=True)
    frameworks   = Column(String(500), nullable=True)
    criticality  = Column(String(20), default="medium")
    vendor       = Column(String(200), nullable=True)
    ip_address   = Column(String(100), nullable=True)
    notes        = Column(Text, nullable=True)
    created_at   = Column(DateTime, server_default=func.now())
    updated_at   = Column(DateTime, server_default=func.now(), onupdate=func.now())
