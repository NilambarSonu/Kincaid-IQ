from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, Float, func, ForeignKey
from backend.database import Base


class ControlCategory(Base):
    __tablename__ = "ce_control_categories"

    id          = Column(Integer, primary_key=True, index=True)
    framework   = Column(String(50), nullable=False, index=True)
    name        = Column(String(200), nullable=False)
    code        = Column(String(50), nullable=True)
    description = Column(Text, nullable=True)
    created_at  = Column(DateTime, server_default=func.now())


class ComplianceControl(Base):
    __tablename__ = "ce_controls"

    id              = Column(Integer, primary_key=True, index=True)
    framework       = Column(String(50), nullable=False, index=True)
    category_id     = Column(Integer, ForeignKey("ce_control_categories.id", ondelete="SET NULL"), nullable=True)
    control_id      = Column(String(50), nullable=False, index=True)
    title           = Column(String(500), nullable=False)
    description     = Column(Text, nullable=True)
    test_procedure  = Column(Text, nullable=True)
    owner           = Column(String(200), nullable=True)
    status          = Column(String(50), default="not_tested", index=True)
    risk_level      = Column(String(20), default="medium")
    compensating    = Column(Boolean, default=False)
    notes           = Column(Text, nullable=True)
    evidence_required = Column(Text, nullable=True)
    automated         = Column(Boolean, default=False)
    last_tested_at    = Column(DateTime, nullable=True)
    next_review_at    = Column(DateTime, nullable=True)
    created_at        = Column(DateTime, server_default=func.now())
    updated_at        = Column(DateTime, server_default=func.now(), onupdate=func.now())

    @property
    def status_color(self):
        return {
            "pass": "green", "fail": "red",
            "compensating": "yellow", "not_tested": "gray", "na": "blue",
        }.get(self.status, "gray")
