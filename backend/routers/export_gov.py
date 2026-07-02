import json

from fastapi import APIRouter, Response

from backend.manifest_utils import manifest_headers, register_manifest_path
from backend.service_container import container

router = APIRouter(prefix="/api/gov/export", tags=["governance"])

register_manifest_path("/api/gov/export/board-pack")

@router.post("/check")
def check_export(payload: dict):
    mode = payload.get("mode", "EXPORT").upper()
    claims = payload.get("claims") or container.claims
    return {
        "allowed": True,
        "mode": mode,
        "claim_count": len(claims),
        "results": [
            {
                "claim_id": c["claim_id"],
                "policy": c["policy"],
                "commit": {
                    "commit_id": "cm_demo",
                    "authorized": True,
                    "committed_state": "EXECUTED",
                    "reason_code": "OK",
                    "reason_detail": "Policy conditions satisfied.",
                },
            }
            for c in claims
        ],
        "reasons": [],
        "evaluated_at": "2026-03-10T00:00:00Z",
    }

@router.post("/board-pack")
def assemble_board_pack(payload: dict):
    claims = payload.get("claims") or container.claims
    body = {
        "board_pack_id": "bp_demo",
        "claim_count": len(claims),
        "claims": claims,
        "receipts": [],
        "assembled_at": "2026-03-10T00:00:00Z",
        "board_pack_hash": "sha256:board-pack",
    }
    raw = json.dumps(body, default=str, sort_keys=True).encode("utf-8")
    return Response(
        content=raw,
        media_type="application/json",
        headers=manifest_headers(raw, filename="board-pack.json"),
    )
