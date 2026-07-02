"""
Lineage Engine — builds and validates evidence lineage chains for governed claims.
A lineage chain is a directed acyclic graph: evidence nodes → transform nodes → output.
"""
import hashlib
import json
from datetime import datetime, timezone


def sha3(data: str) -> str:
    return hashlib.sha3_256(data.encode()).hexdigest()[:16]


def _compute_chain_hash(evidence_ids: list[str], transform_ids: list[str]) -> str:
    """
    Recompute the canonical evidence hash from first principles.
    Must match claim_builder.compute_evidence_hash exactly.
    """
    blob = json.dumps(
        {"evidence_ids": sorted(evidence_ids), "transform_ids": sorted(transform_ids)},
        sort_keys=True,
    )
    return sha3(blob)


def build_lineage_chain(
    claim_id: str,
    evidence_ids: list[str],
    transform_ids: list[str],
    evidence_hash: str,
    verified_status: str,
) -> dict:
    """
    Construct a lineage chain dict for a single claim.
    Returns structured nodes with hashes; also verifies that the
    supplied evidence_hash matches the recomputed value.
    """
    recomputed_hash = _compute_chain_hash(evidence_ids, transform_ids)
    hash_integrity_ok = recomputed_hash == evidence_hash

    nodes = []

    for i, eid in enumerate(evidence_ids):
        nodes.append({
            "node_id": f"EV-{claim_id}-{i}",
            "node_type": "evidence",
            "label": eid,
            "hash": sha3(eid),
            "depth": 0,
            "parent_id": None,
        })

    for j, tid in enumerate(transform_ids):
        parent = nodes[-1]["node_id"] if nodes else None
        nodes.append({
            "node_id": f"TX-{claim_id}-{j}",
            "node_type": "transform",
            "label": tid,
            "hash": sha3(tid),
            "depth": 1 + j,
            "parent_id": parent,
        })

    parent_id = nodes[-1]["node_id"] if nodes else None
    nodes.append({
        "node_id": f"OUT-{claim_id}",
        "node_type": "output",
        "label": claim_id,
        "hash": recomputed_hash,
        "depth": len(nodes),
        "parent_id": parent_id,
    })

    return {
        "claim_id": claim_id,
        "nodes": nodes,
        "evidence_ids": evidence_ids,
        "transform_ids": transform_ids,
        "chain_hash": recomputed_hash,
        "chain_depth": len(nodes),
        "verified": verified_status == "VERIFIED",
        "hash_integrity_ok": hash_integrity_ok,
        "stored_evidence_hash": evidence_hash,
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def verify_chain_integrity(chain: dict) -> dict:
    """
    Re-verify a lineage chain by:
      1. Recomputing the canonical hash from evidence_ids + transform_ids
      2. Comparing it against the stored chain_hash (output node)
      3. Verifying each non-output node's hash matches sha3(label)
      4. Verifying parent linkage is topologically consistent
    Returns a result dict; integrity_ok is False if any check fails.
    """
    failures = []

    # 1. Hash recomputation — most critical check
    evidence_ids = chain.get("evidence_ids", [])
    transform_ids = chain.get("transform_ids", [])
    stored_chain_hash = chain.get("chain_hash", "")
    recomputed = _compute_chain_hash(evidence_ids, transform_ids)
    if recomputed != stored_chain_hash:
        failures.append({
            "check": "chain_hash",
            "stored": stored_chain_hash,
            "recomputed": recomputed,
            "integrity_ok": False,
        })

    # 2. Per-node label hashes (evidence + transform nodes)
    nodes = chain.get("nodes", [])
    for node in nodes:
        if node["node_type"] == "output":
            # Output node hash must equal the canonical chain hash
            if node.get("hash") != stored_chain_hash:
                failures.append({
                    "check": f"output_node_hash:{node['node_id']}",
                    "stored": node.get("hash"),
                    "expected": stored_chain_hash,
                    "integrity_ok": False,
                })
            continue
        recomputed_label = sha3(node.get("label", ""))
        stored_label = node.get("hash", "")
        if recomputed_label != stored_label:
            failures.append({
                "check": f"node_hash:{node['node_id']}",
                "stored_hash": stored_label,
                "recomputed_hash": recomputed_label,
                "integrity_ok": False,
            })

    # 3. Parent topology — each node's parent_id must reference an earlier node
    node_ids = [n["node_id"] for n in nodes]
    for i, node in enumerate(nodes):
        pid = node.get("parent_id")
        if pid is not None and pid not in node_ids[:i]:
            failures.append({
                "check": f"parent_topology:{node['node_id']}",
                "parent_id": pid,
                "integrity_ok": False,
            })

    return {
        "claim_id": chain.get("claim_id"),
        "chain_depth": chain.get("chain_depth"),
        "nodes_checked": len(nodes),
        "failures": failures,
        "integrity_ok": len(failures) == 0,
        "verified_at": datetime.now(timezone.utc).isoformat(),
    }
