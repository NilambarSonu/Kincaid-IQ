import uuid

class ServiceContainer:
    def __init__(self):
        self.evidence = []
        self.transforms = []
        self.metrics = []
        self.claims = []
        self.seed()

    def seed(self):
        evidence = {
            "evidence_id": f"ev_{uuid.uuid4().hex[:8]}",
            "title": "EBITDA Drag Source Extract",
            "source_uri": "s3://kincaid/demo/ebitda_drag.csv",
            "source_type": "CSV",
            "source_hash": "sha256:demo-ebitda-source",
            "received_at": "2026-03-10T00:00:00Z",
            "validation_state": "PASSED",
            "freshness_status": "GREEN",
        }
        transform = {
            "transform_id": "tr_demo_ebitda",
            "transform_type": "AGGREGATION",
            "code_version": "v1.0.0",
            "input_hashes": ["sha256:demo-1", "sha256:demo-2"],
            "output_hash": "sha256:demo-output",
            "executed_at": "2026-03-10T00:00:00Z",
            "executor": "governance-engine",
        }
        claim = {
            "claim_id": f"c_{uuid.uuid4().hex[:8]}",
            "kpi_key": "EBITDA_DRAG",
            "title": "Current EBITDA Drag",
            "value": 1285000,
            "unit": "USD",
            "format": "currency",
            "period": "TTM",
            "evidence_ids": [evidence["evidence_id"]],
            "transform_ids": [transform["transform_id"]],
            "evidence_hash": "sha256:claim-evidence",
            "computed_at": "2026-03-10T00:00:00Z",
            "verified_status": "VERIFIED",
            "freshness_status": "GREEN",
            "confidence_score": 0.94,
            "policy": {
                "policy_id": "p_demo",
                "scope": "RENDER",
                "decision": "ALLOW",
                "allowed": True,
                "verified_status": "VERIFIED",
                "freshness_status": "GREEN",
                "confidence_score": 0.94,
                "reason_code": "OK",
                "reason_detail": "Policy conditions satisfied.",
                "evaluated_at": "2026-03-10T00:00:00Z",
                "violations": [],
            },
        }
        self.evidence.append(evidence)
        self.transforms.append(transform)
        self.claims.append(claim)

container = ServiceContainer()
