"""
Export Router — enforces the export gate at the API boundary.

No claim data leaves a board/fiduciary surface without passing through this guard.
All responses return HTTP 200; the `allowed` field and `exportStatus` carry the decision.

POST /api/export/check                 Gate-check a list of claim IDs (no data returned)
POST /api/export/board-check           Stricter board-grade gate on a list of claim IDs
GET  /api/export/claim/{claim_id}      Attempt to export a single claim
POST /api/export/package               Attempt to export a batch of claims as a package
POST /api/export/board-pack            Build a formal board intelligence pack (auto-discovers board-grade claims)
"""
import hashlib
import html as _html
import io
import json
import textwrap
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, File, Query, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from backend.auth import get_current_user
from backend.database import get_db
from backend.models import Claim, DecisionReceipt, EvidenceArtifact, Transform
import backend.models as models
from backend.services.export_guard import (
    evaluate_export,
    board_export_check,
    _blocking_reasons,
    _is_board_admissible,
    _is_export_allowed,
)
from backend.services.policy_engine import (
    evaluate as eval_policy,
    CONFIDENCE_EXPORT_THRESHOLD,
    CONFIDENCE_BOARD_THRESHOLD,
)
from backend.services.pipeline import (
    _derive_render_policy,
    _derive_trust_posture,
    _gate_reason,
    _blocked_policy,
)
from backend.services.receipt_service import create_receipt, serialize_receipt

router = APIRouter(prefix="/api/export", tags=["export"])

from backend.manifest_utils import register_manifest_path as _reg_manifest_path  # noqa: E402
# These endpoints already ship Hard Rule #03 manifests (in-zip manifest.json).
_reg_manifest_path("/api/export/client-package")
_reg_manifest_path("/api/export/package")
_reg_manifest_path("/api/export/board-pack")


# ─── Pydantic model for client-package (must precede endpoint) ───────────────

class ClientPackageRequest(BaseModel):
    client_name: str = "Client"
    rx_defense_id: Optional[str] = None
    ein: Optional[str] = None
    include_rx_redline: bool = True
    include_rx_scorecard: bool = True
    include_benchmarking_employer: bool = True   # employer filing detail report
    include_benchmarking_summary: bool = True    # national/state peer comparison
    include_board_pack: bool = True
    requester: str = "unknown"


# ─── POST /api/export/client-package ──────────────────────────────────────────

@router.get("/board-pack-count")
def board_pack_count(
    ein: Optional[str] = Query(None, description="Company EIN — required for board pack to be considered ready"),
    current_user: models.User = Depends(get_current_user),
):
    """
    EIN-scoped readiness check for the War Room Fiduciary Intelligence Brief.
    Uses DuckDB employer data (same source as benchmarking) — fully company-scoped.
    Returns: {found: bool, status: 'ready'|'no_data'|'error'}
    """
    if not ein or not ein.strip():
        return {"found": False, "status": "no_data", "detail": "Company context required — select a company first"}
    try:
        from backend.duckdb import get_duck, duck_available
        if not duck_available():
            return {"found": False, "status": "error", "detail": "DuckDB unavailable"}
        ddb = get_duck()
        clean_ein = ein.replace("-", "").strip()
        row = ddb.execute(
            "SELECT employer_name, max_participants FROM employers WHERE EIN = ? LIMIT 1", [clean_ein]
        ).fetchone()
        if row:
            return {"found": True, "status": "ready", "employer_name": row[0], "participants": row[1]}
        return {"found": False, "status": "no_data", "detail": f"EIN {ein} not found in benefits database"}
    except Exception as e:
        return {"found": False, "status": "error", "detail": str(e)}


@router.get("/benchmarking-check")
def benchmarking_check(
    ein: str = Query(..., description="EIN to validate against DuckDB"),
    current_user: models.User = Depends(get_current_user),
):
    """
    Validates whether a DuckDB employer record exists for the given EIN.
    Returns: {found: bool, status: 'ready'|'no_data'|'error', employer_name?: str}
    """
    try:
        from backend.duckdb import get_duck, duck_available
        if not duck_available():
            return {"found": False, "status": "error", "detail": "DuckDB unavailable"}
        ddb = get_duck()
        clean_ein = ein.replace("-", "").strip()
        row = ddb.execute(
            "SELECT employer_name FROM employers WHERE EIN = ? LIMIT 1", [clean_ein]
        ).fetchone()
        if row:
            return {"found": True, "status": "ready", "employer_name": row[0]}
        return {"found": False, "status": "no_data", "detail": f"EIN {ein} not found in benefits database"}
    except Exception as e:
        return {"found": False, "status": "error", "detail": str(e)}


# Reverse of the per-component filename prefixes used throughout this router.
# Lets us tag each generated artifact with a stable component_id ("rx_redline",
# …) so a stored snapshot can be matched back to the drawer's preview ids.
_FILENAME_PREFIX_TO_ID: dict[str, str] = {
    "rx_defense_redline":            "rx_redline",
    "rx_defense_scorecard":          "rx_scorecard",
    "benchmarking_employer_report":  "benchmarking_employer",
    "benchmarking_national_summary": "benchmarking_summary",
    "war_room_fiduciary_brief":      "board_pack",
}


def _component_id_for_filename(filename: str) -> str:
    name = (filename or "").lower()
    for prefix, cid in _FILENAME_PREFIX_TO_ID.items():
        if name.startswith(prefix):
            return cid
    return name


# Reverse of the human-readable component labels persisted in
# `ClientPackageDelivery.components` (a JSON list of labels). Mirrors the
# frontend `_COMPONENT_LABEL_TO_ID` so history can flag snapshot availability
# per component using the same id space as the snapshot rows.
_COMPONENT_LABEL_TO_ID: dict[str, str] = {
    "PBM Contract Clarity 360 Redline (.docx)":           "rx_redline",
    "PBM Contract Clarity 360 Scorecard (JSON)":          "rx_scorecard",
    # Legacy labels persisted before the "Rx Defense" to "PBM Contract Clarity 360" rename.
    "Rx Defense Redline (.docx)":           "rx_redline",
    "Rx Defense Scorecard (JSON)":          "rx_scorecard",
    "Benchmarking Employer Report (JSON)":  "benchmarking_employer",
    "Benefits Benchmarking Summary (JSON)": "benchmarking_summary",
}
_VALID_COMPONENT_IDS = {
    "rx_redline", "rx_scorecard", "benchmarking_employer",
    "benchmarking_summary", "board_pack",
}

# Sentinel component_id for the full, byte-identical ZIP exactly as it was sent.
# Stored as one extra ClientPackageSnapshot row per delivery so an audit / legal
# request can recover the precise archive the client received — never a rebuild.
# Excluded from the per-component snapshot availability map.
FULL_ZIP_COMPONENT_ID = "__full_package_zip__"


def _full_zip_snapshot(delivery_id: int, zip_bytes: bytes, filename: str):
    """Build the ClientPackageSnapshot row that stores the complete sent ZIP
    verbatim (every entry: cover sheet, README, manifest, and all components),
    so `/redownload-original` can stream back the exact bytes the client got."""
    return models.ClientPackageSnapshot(
        delivery_id=delivery_id,
        component_id=FULL_ZIP_COMPONENT_ID,
        label="Original package (exact ZIP as sent)",
        filename=filename,
        kind="zip",
        sha256=hashlib.sha256(zip_bytes).hexdigest(),
        size_bytes=len(zip_bytes),
        data=zip_bytes,
    )


def _component_id_for_label(label: str) -> str:
    """Normalize a stored delivery component label to its preview component_id.
    Falls back to the raw value when already an id or unrecognized."""
    if not label:
        return label
    if label in _VALID_COMPONENT_IDS:
        return label
    if label in _COMPONENT_LABEL_TO_ID:
        return _COMPONENT_LABEL_TO_ID[label]
    if label.startswith("War Room Fiduciary Intelligence Brief"):
        return "board_pack"
    return label


# ── Standalone per-component builders ─────────────────────────────────────────
# Each returns (bytes, filename, label) on success, or None when the component
# cannot be produced from the available data (no error). Genuine generation
# errors raise — the caller decides whether to record them as `skipped`.
# These are shared by `_build_client_package_zip` and the preview endpoints so a
# single-component preview no longer has to re-build the whole ZIP and crack it
# open to extract one file.

def _build_rx_redline(contract, now_str: str) -> Optional[tuple[bytes, str, str]]:
    """PBM Contract Clarity 360 model-contract-language redline as a styled .docx."""
    import io as _io2
    import json as _json
    from docx import Document as DocxDocument
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH
    from docx.oxml.ns import qn as _qn
    from docx.oxml import OxmlElement as _Oxml

    pbm = contract.pbm_name or contract.id

    def _shade_para(paragraph, fill_hex: str):
        """Apply a solid background fill (w:shd) to a paragraph."""
        pPr = paragraph._p.get_or_add_pPr()
        shd = _Oxml("w:shd")
        shd.set(_qn("w:val"), "clear")
        shd.set(_qn("w:color"), "auto")
        shd.set(_qn("w:fill"), fill_hex)
        pPr.append(shd)

    def _border_para(paragraph, *, sides, color_hex: str, size: int = 12,
                     space: int = 6):
        """Apply borders (w:pBdr) to a paragraph. `sides` is a list of
        edge names: top/bottom/left/right."""
        pPr = paragraph._p.get_or_add_pPr()
        pBdr = pPr.find(_qn("w:pBdr"))
        if pBdr is None:
            pBdr = _Oxml("w:pBdr")
            pPr.append(pBdr)
        for side in sides:
            edge = _Oxml(f"w:{side}")
            edge.set(_qn("w:val"), "single")
            edge.set(_qn("w:sz"), str(size))
            edge.set(_qn("w:space"), str(space))
            edge.set(_qn("w:color"), color_hex)
            pBdr.append(edge)

    guide = []
    try:
        guide = _json.loads(contract.negotiation_guide or "[]")
    except Exception:
        pass

    doc = DocxDocument()

    # Roomier page margins so the rendered preview reads like a
    # polished Word document, not a wall of edge-to-edge text.
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.1)
        section.right_margin = Inches(1.1)

    title = doc.add_heading("PBM Contract Clarity 360™ — Model Contract Language", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if title.runs:
        title.runs[0].font.color.rgb = RGBColor(11, 31, 59)
    meta = doc.add_paragraph()
    meta_run = meta.add_run(
        f"PBM: {pbm}   |   Score: {contract.overall_score:.0f}/100   |   "
        f"Generated by Kincaid Health · {now_str}"
    )
    meta_run.italic = True
    meta_run.font.color.rgb = RGBColor(90, 98, 112)
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER
    doc.add_paragraph()

    intro = doc.add_paragraph(
        "The following provisions were identified as gaps. Model language "
        "is for negotiation purposes only — review with qualified counsel."
    )
    _shade_para(intro, "F1F4F9")
    _border_para(intro, sides=["top", "bottom", "left", "right"],
                 color_hex="D6DCE6")
    intro.paragraph_format.space_before = Pt(2)
    intro.paragraph_format.space_after = Pt(2)
    doc.add_paragraph()

    weak = sorted(
        [p for p in guide if float(p.get("score", 10)) < 7],
        key=lambda x: x.get("score", 10),
    )
    for p in weak:
        neg = p.get("negotiation", {})
        score_val = float(p.get("score", 0))
        lbl = "RED FLAG" if score_val < 3 else "CONCERN" if score_val < 5 else "FAIR"
        is_red = score_val < 5
        head_color = RGBColor(155, 28, 46) if is_red else RGBColor(180, 100, 0)
        head_fill = "FBEAEC" if is_red else "FBF1E2"
        head_border = "C0344A" if is_red else "B46400"

        h = doc.add_heading(
            f"Provision {p['id']}: {p['name']} — {score_val:.1f}/10 [{lbl}]", level=2
        )
        h.runs[0].font.color.rgb = head_color
        _shade_para(h, head_fill)
        _border_para(h, sides=["left"], color_hex=head_border, size=24)
        h.paragraph_format.space_before = Pt(10)
        h.paragraph_format.space_after = Pt(4)

        if neg.get("gap_summary"):
            gp = doc.add_paragraph()
            gp.add_run("Gap: ").bold = True
            gp.add_run(neg["gap_summary"])
            gp.paragraph_format.left_indent = Inches(0.15)
        if neg.get("model_language"):
            doc.add_paragraph()
            label = doc.add_paragraph()
            lr = label.add_run("SUGGESTED MODEL LANGUAGE")
            lr.bold = True
            lr.font.size = Pt(9)
            lr.font.color.rgb = RGBColor(21, 99, 56)
            _shade_para(label, "E5F4EA")
            _border_para(label, sides=["top", "left", "right"],
                         color_hex="9BCBA9")
            label.paragraph_format.left_indent = Inches(0.15)
            label.paragraph_format.space_after = Pt(0)

            lp = doc.add_paragraph(neg["model_language"])
            lp.paragraph_format.left_indent = Inches(0.15)
            lp.paragraph_format.space_before = Pt(0)
            _shade_para(lp, "EFFBF2")
            _border_para(lp, sides=["bottom", "left", "right"],
                         color_hex="9BCBA9")
            if lp.runs:
                lp.runs[0].font.color.rgb = RGBColor(21, 99, 56)
        if neg.get("talking_point"):
            tp = doc.add_paragraph()
            tp.add_run("Talking Point: ").bold = True
            tp.add_run(neg["talking_point"])
            tp.paragraph_format.left_indent = Inches(0.15)
        doc.add_paragraph()

    footer_p = doc.add_paragraph(
        "Generated by Kincaid Health · PBM Contract Clarity 360™. Not legal advice."
    )
    footer_p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if footer_p.runs:
        footer_p.runs[0].font.size = Pt(8)
        footer_p.runs[0].font.color.rgb = RGBColor(140, 148, 162)

    docx_buf = _io2.BytesIO()
    doc.save(docx_buf)
    safe_pbm = (pbm or "contract").replace(" ", "_").replace("/", "-")
    return (
        docx_buf.getvalue(),
        f"rx_defense_redline_{safe_pbm}.docx",
        "PBM Contract Clarity 360 Redline (.docx)",
    )


def _build_rx_scorecard(contract, now_str: str) -> Optional[tuple[bytes, str, str]]:
    """PBM Contract Clarity 360 scorecard as machine-readable JSON."""
    import json as _json
    scorecard = {
        "generated_by":    "Kincaid Health · PBM Contract Clarity 360™",
        "generated_at":    now_str,
        "pbm_name":        contract.pbm_name,
        "overall_score":   contract.overall_score,
        "rating":          contract.rating,
        "key_findings":    _json.loads(contract.key_findings or "[]"),
        "provision_scores": _json.loads(contract.provision_scores or "[]"),
    }
    return (
        _json.dumps(scorecard, indent=2, default=str).encode("utf-8"),
        "rx_defense_scorecard.json",
        "PBM Contract Clarity 360 Scorecard (JSON)",
    )


def _build_benchmarking_employer(ein: str, now_str: str) -> Optional[tuple[bytes, str, str]]:
    """Employer filing detail report (DuckDB) as JSON. Returns None when DuckDB
    is unavailable or no employer matches the EIN."""
    import json as _json
    from backend.duckdb import get_duck, duck_available
    if not duck_available():
        return None
    ddb = get_duck()
    clean_ein = ein.replace("-", "").strip()
    emp = ddb.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city,
               latest_year, max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, total_income, has_health,
               has_stop_loss, filing_count
        FROM employers WHERE EIN = ?
    """, [clean_ein]).fetchone()
    if not emp:
        return None

    employer_report = {
        "generated_by": "Kincaid Health · Benefits Benchmarking — Employer Report",
        "generated_at": now_str,
        "ein":          emp[0],
        "name":         emp[1],
        "plan_name":    emp[2],
        "state":        emp[3],
        "city":         emp[4],
        "latest_year":  emp[5],
        "participants": emp[6],
        "business_code": emp[7],
        "has_health":   bool(emp[12]),
        "has_stop_loss": bool(emp[13]),
        "filing_count": emp[14],
        "financials": {
            "total_welfare_premiums":    float(emp[8]  or 0),
            "total_broker_commissions":  float(emp[9]  or 0),
            "total_admin_fees":          float(emp[10] or 0),
            "total_income":              float(emp[11] or 0),
        },
    }
    return (
        _json.dumps(employer_report, indent=2, default=str).encode("utf-8"),
        "benchmarking_employer_report.json",
        "Benchmarking Employer Report (JSON)",
    )


def _build_benchmarking_summary(ein: str, now_str: str) -> Optional[tuple[bytes, str, str]]:
    """National / state peer comparison (DuckDB) as JSON. Returns None when
    DuckDB is unavailable or no employer matches the EIN."""
    import json as _json
    from backend.duckdb import get_duck, duck_available
    if not duck_available():
        return None
    ddb = get_duck()
    clean_ein = ein.replace("-", "").strip()
    emp = ddb.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city,
               latest_year, max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, total_income, has_health,
               has_stop_loss, filing_count
        FROM employers WHERE EIN = ?
    """, [clean_ein]).fetchone()
    if not emp:
        return None

    biz_code = emp[7] or ""
    nat = ddb.execute("""
        SELECT plan_count, avg_participants,
               p50_income, p75_income,
               p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm
        FROM industry_bench
        WHERE BUSINESS_CODE = ? AND FORM_YEAR = 2023
    """, [biz_code]).fetchone()

    summary = {
        "generated_by":   "Kincaid Health · Benefits Benchmarking — National Summary",
        "generated_at":   now_str,
        "ein":            emp[0],
        "employer_name":  emp[1],
        "business_code":  biz_code,
        "national_benchmark": {
            "p50_admin_fees":   float(nat[4] or 0),
            "p75_admin_fees":   float(nat[5] or 0),
            "p90_admin_fees":   float(nat[6] or 0),
            "p50_broker_comm":  float(nat[7] or 0),
            "p75_broker_comm":  float(nat[8] or 0),
            "p90_broker_comm":  float(nat[9] or 0),
        } if nat else None,
        "employer_vs_benchmark": {
            "admin_fees_actual":   float(emp[10] or 0),
            "admin_fees_p50_delta": float(emp[10] or 0) - float(nat[4] or 0) if nat else None,
            "broker_comm_actual":   float(emp[9]  or 0),
            "broker_comm_p50_delta": float(emp[9] or 0) - float(nat[7] or 0) if nat else None,
        },
    }
    return (
        _json.dumps(summary, indent=2, default=str).encode("utf-8"),
        "benchmarking_national_summary.json",
        "Benefits Benchmarking Summary (JSON)",
    )


def _build_board_pack(ein: str, client_name: str, now_str: str) -> Optional[tuple[bytes, str, str]]:
    """War Room Fiduciary Intelligence Brief (EIN-scoped, DuckDB) as a PDF.
    Returns None when DuckDB is unavailable or no employer matches the EIN."""
    import io as _io
    from backend.duckdb import get_duck, duck_available
    if not duck_available():
        return None
    ddb = get_duck()
    clean_ein = ein.replace("-", "").strip()
    emp = ddb.execute("""
        SELECT EIN, employer_name, latest_plan_name, state, city,
               latest_year, max_participants, business_code,
               total_welfare_premiums, total_broker_commissions,
               total_admin_fees, total_income
        FROM employers WHERE EIN = ?
    """, [clean_ein]).fetchone()
    if not emp:
        return None

    biz_code = emp[7] or ""
    nat = ddb.execute("""
        SELECT p50_admin_fees, p75_admin_fees, p90_admin_fees,
               p50_broker_comm, p75_broker_comm, p90_broker_comm
        FROM industry_bench
        WHERE BUSINESS_CODE = ? AND FORM_YEAR = 2023
    """, [biz_code]).fetchone()

    admin_fees  = float(emp[10] or 0)
    broker_comm = float(emp[9]  or 0)
    p50_admin   = float(nat[0] or 0) if nat else 0
    p75_admin   = float(nat[1] or 0) if nat else 0
    p90_admin   = float(nat[2] or 0) if nat else 0
    p50_broker  = float(nat[3] or 0) if nat else 0
    p75_broker  = float(nat[4] or 0) if nat else 0
    p90_broker  = float(nat[5] or 0) if nat else 0

    def _fmt(v): return f"${v:,.0f}" if v else "N/A"

    # Generate a real PDF artifact using reportlab
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.units import inch
    from reportlab.lib import colors as rl_colors
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    )

    pdf_buf = _io.BytesIO()
    doc = SimpleDocTemplate(
        pdf_buf, pagesize=letter,
        leftMargin=0.85*inch, rightMargin=0.85*inch,
        topMargin=0.85*inch, bottomMargin=0.85*inch,
    )
    styles  = getSampleStyleSheet()
    KINCAID = rl_colors.HexColor("#9B1C2E")
    DARK    = rl_colors.HexColor("#1f2937")
    GRAY6   = rl_colors.HexColor("#6b7280")

    title_style = ParagraphStyle(
        "KTitle", parent=styles["Title"],
        textColor=KINCAID, fontSize=18, spaceAfter=4,
    )
    h2_style = ParagraphStyle(
        "KH2", parent=styles["Heading2"],
        textColor=DARK, fontSize=11, spaceBefore=14, spaceAfter=4,
    )
    meta_style = ParagraphStyle(
        "KMeta", parent=styles["Normal"],
        textColor=GRAY6, fontSize=8, spaceAfter=14,
    )
    body_style = styles["Normal"]

    elems = []
    elems.append(Paragraph("War Room — Fiduciary Intelligence Brief", title_style))
    elems.append(Paragraph(
        f"<b>Company:</b> {emp[1]} (EIN {emp[0]}) &nbsp;|&nbsp; "
        f"<b>Plan:</b> {emp[2] or '—'} &nbsp;|&nbsp; "
        f"<b>Client:</b> {_html.escape(client_name)} &nbsp;|&nbsp; "
        f"<b>Generated:</b> {now_str}",
        meta_style,
    ))

    elems.append(Paragraph("Plan Overview", h2_style))
    overview_data = [
        ["Metric", "Value"],
        ["Plan Participants", f"{(emp[6] or 0):,}"],
        ["Total Plan Income", _fmt(float(emp[11] or 0))],
        ["Latest Plan Year", str(emp[5] or "—")],
        ["State / City", f"{emp[3] or '—'} / {emp[4] or '—'}"],
    ]
    overview_table = Table(overview_data, colWidths=[3*inch, 3*inch])
    overview_table.setStyle(TableStyle([
        ("BACKGROUND",  (0,0), (-1,0), DARK),
        ("TEXTCOLOR",   (0,0), (-1,0), rl_colors.white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,-1), 9),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [rl_colors.white, rl_colors.HexColor("#f9fafb")]),
        ("GRID",        (0,0), (-1,-1), 0.5, rl_colors.HexColor("#e5e7eb")),
        ("LEFTPADDING", (0,0), (-1,-1), 8),
        ("RIGHTPADDING",(0,0), (-1,-1), 8),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
    ]))
    elems.append(overview_table)
    elems.append(Spacer(1, 10))

    elems.append(Paragraph("Cost Positioning vs National Peers (DOL Form 5500)", h2_style))

    def _risk_label(actual, p75):
        if not p75: return "INSUFFICIENT EVIDENCE"
        return "ELEVATED ▲" if actual >= p75 else "WITHIN NORM ✓"

    def _risk_color(actual, p75):
        if not p75: return rl_colors.HexColor("#6b7280")
        return rl_colors.HexColor("#991b1b") if actual >= p75 else rl_colors.HexColor("#065f46")

    bench_data = [
        ["Cost Category", "This Plan", "P50", "P75", "P90", "Risk Flag"],
        [
            "Admin Fees",
            _fmt(admin_fees), _fmt(p50_admin), _fmt(p75_admin), _fmt(p90_admin),
            _risk_label(admin_fees, p75_admin),
        ],
        [
            "Broker Commissions",
            _fmt(broker_comm), _fmt(p50_broker), _fmt(p75_broker), _fmt(p90_broker),
            _risk_label(broker_comm, p75_broker),
        ],
    ]
    col_w = [1.7*inch, 0.9*inch, 0.85*inch, 0.85*inch, 0.85*inch, 1.1*inch]
    bench_table = Table(bench_data, colWidths=col_w)
    bench_style = [
        ("BACKGROUND",  (0,0), (-1,0), DARK),
        ("TEXTCOLOR",   (0,0), (-1,0), rl_colors.white),
        ("FONTNAME",    (0,0), (-1,0), "Helvetica-Bold"),
        ("FONTSIZE",    (0,0), (-1,-1), 8),
        ("ALIGN",       (1,0), (-1,-1), "RIGHT"),
        ("ALIGN",       (5,0), (5,-1), "CENTER"),
        ("GRID",        (0,0), (-1,-1), 0.5, rl_colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (0,1), (-1,-1), [rl_colors.white, rl_colors.HexColor("#f9fafb")]),
        ("LEFTPADDING", (0,0), (-1,-1), 6),
        ("RIGHTPADDING",(0,0), (-1,-1), 6),
        ("TOPPADDING",  (0,0), (-1,-1), 5),
        ("BOTTOMPADDING",(0,0),(-1,-1), 5),
    ]
    bench_style.append(("TEXTCOLOR", (5,1), (5,1), _risk_color(admin_fees, p75_admin)))
    bench_style.append(("TEXTCOLOR", (5,2), (5,2), _risk_color(broker_comm, p75_broker)))
    bench_style.append(("FONTNAME",  (5,1), (5,-1), "Helvetica-Bold"))
    bench_table.setStyle(TableStyle(bench_style))
    elems.append(bench_table)
    elems.append(Spacer(1, 20))

    elems.append(Paragraph(
        f"<font color='#9ca3af' size='7'>"
        f"Source: DOL Form 5500 · Industry code {biz_code} · {emp[3] or 'N/A'} &nbsp;|&nbsp; "
        f"Kincaid Health™ War Room · Fiduciary-Grade Healthcare Intelligence · Not legal advice."
        f"</font>",
        body_style,
    ))

    doc.build(elems)
    return (
        pdf_buf.getvalue(),
        "war_room_fiduciary_brief.pdf",
        f"War Room Fiduciary Intelligence Brief — {emp[1]} (PDF)",
    )


def _build_client_package_zip(
    body: ClientPackageRequest,
    db: Session,
    current_user: models.User,
) -> tuple[bytes, str, list[str], list[dict], list[dict]]:
    """
    Build the unified client delivery ZIP and return
    (zip_bytes, filename, included, skipped, components).
    `components` carries each artifact's component_id / filename / kind / sha256 /
    size_bytes / raw bytes — used to persist a point-in-time delivery snapshot.
    Shared by the download endpoint and the email-delivery endpoint.
    """
    import io
    import json as _json
    import zipfile
    from datetime import datetime, timezone
    from backend.models import RxDefenseContract

    now_utc = datetime.now(timezone.utc)
    now_str = now_utc.strftime("%Y-%m-%d %H:%M UTC")
    date_str = now_utc.strftime("%Y-%m-%d")

    included: list[str] = []
    skipped: list[dict] = []
    components: list[dict] = []  # {component_id, filename, label, kind, sha256, size_bytes, data}
    buf = io.BytesIO()

    def _add_component(filename: str, data: bytes, label: str) -> None:
        """Write a file to the zip and capture its SHA-256 + size + raw bytes
        for the manifest and (downstream) the point-in-time delivery snapshot."""
        zf.writestr(filename, data)
        lower = filename.lower()
        kind = ("pdf" if lower.endswith(".pdf")
                else "docx" if lower.endswith(".docx")
                else "json" if lower.endswith(".json")
                else "bin")
        components.append({
            "component_id": _component_id_for_filename(filename),
            "filename":     filename,
            "label":        label,
            "kind":         kind,
            "sha256":       hashlib.sha256(data).hexdigest(),
            "size_bytes":   len(data),
            "data":         data,
        })
        included.append(label)

    with zipfile.ZipFile(buf, mode="w", compression=zipfile.ZIP_DEFLATED) as zf:

        # ── PBM Contract Clarity 360 components ─────────────────────────────────────────────
        contract = None
        if body.rx_defense_id:
            contract = db.query(RxDefenseContract).filter(
                RxDefenseContract.id == body.rx_defense_id,
                RxDefenseContract.status == "complete",
                RxDefenseContract.user_id == current_user.id,
            ).first()

        if contract and body.include_rx_redline:
            # Redline .docx
            try:
                built = _build_rx_redline(contract, now_str)
                if built:
                    _add_component(built[1], built[0], built[2])
            except Exception as _e:
                skipped.append({"component": "rx_defense_redline", "reason": str(_e)})

        if contract and body.include_rx_scorecard:
            # Scorecard JSON — errors here intentionally propagate (no try/except),
            # matching the original build path.
            built = _build_rx_scorecard(contract, now_str)
            if built:
                _add_component(built[1], built[0], built[2])

        # ── Benefits Benchmarking (two distinct artifacts) ────────────────────
        if body.ein and (body.include_benchmarking_employer or body.include_benchmarking_summary):
            try:
                if body.include_benchmarking_employer:
                    built = _build_benchmarking_employer(body.ein, now_str)
                    if built:
                        _add_component(built[1], built[0], built[2])
                if body.include_benchmarking_summary:
                    built = _build_benchmarking_summary(body.ein, now_str)
                    if built:
                        _add_component(built[1], built[0], built[2])
            except Exception as _e:
                skipped.append({"component": "benchmarking", "reason": str(_e)})

        # ── War Room Fiduciary Intelligence Brief (EIN-scoped, DuckDB) ───────
        # Uses the same DuckDB employer + benchmark data as the benchmarking
        # components — fully scoped to the selected company EIN. Does NOT use
        # the global Claims governance table.
        if body.include_board_pack and body.ein:
            try:
                built = _build_board_pack(body.ein, body.client_name, now_str)
                if built:
                    _add_component(built[1], built[0], built[2])
            except Exception as _e:
                skipped.append({"component": "board_pack", "reason": str(_e)})

        # ── Cover sheet (includes Integrity Verification section) ─────────────
        included_html = "".join(f"<li>{_html.escape(c)}</li>" for c in included) if included else "<li><em>No components included</em></li>"
        try:
            from backend.config import settings as _kiq_settings
            _verifier_base = (_kiq_settings.base_url or "").rstrip("/")
        except Exception:
            _verifier_base = ""
        if not _verifier_base or _verifier_base.startswith("http://localhost"):
            _verifier_base = "https://kincaid-iq.replit.app"
        _verifier_url = f"{_verifier_base}/verify"
        # Generate inline SVG QR codes (no external hosts, print-safe). One QR for
        # the verifier landing page, plus one per-component QR encoding a deep-link
        # like /verify?sha256=<hash>&file=<filename>, so board members can scan a
        # single hash off the printed cover sheet with their phone camera.
        try:
            import segno as _segno
            import io as _io
            from urllib.parse import quote as _urlquote
            def _qr_svg_for(url: str, scale: int = 4, border: int = 2) -> str:
                _qr = _segno.make(url, error="m")
                _qr_buf = _io.BytesIO()
                _qr.save(_qr_buf, kind="svg", scale=scale, border=border, xmldecl=False, svgns=True, omitsize=False)
                return _qr_buf.getvalue().decode("utf-8")
            _qr_svg = _qr_svg_for(_verifier_url, scale=4, border=2)
            def _component_deep_link(c: dict) -> str:
                return (
                    f"{_verifier_base}/verify"
                    f"?sha256={c['sha256']}"
                    f"&file={_urlquote(c['filename'], safe='')}"
                )
            def _component_qr(c: dict) -> str:
                try:
                    return _qr_svg_for(_component_deep_link(c), scale=2, border=1)
                except Exception:
                    return ""
        except Exception:
            _qr_svg = ""
            def _component_deep_link(c: dict) -> str:  # type: ignore[no-redef]
                return _verifier_url
            def _component_qr(c: dict) -> str:  # type: ignore[no-redef]
                return ""
        if components:
            integrity_rows = "".join(
                f"<tr>"
                f"<td>{_html.escape(c['filename'])}</td>"
                f"<td style='text-align:right'>{c['size_bytes']:,}</td>"
                f"<td><code>{c['sha256']}</code></td>"
                f"<td style='text-align:center;line-height:0;width:64px;'>{_component_qr(c)}</td>"
                f"</tr>"
                for c in components
            )
            integrity_html = f"""<h2>Integrity Verification</h2>
<p style="font-size:12px;color:#444;">
  Each file below is hashed with SHA-256 at generation time. To verify, recompute
  the digest of any file in this package and compare to the value listed here
  (or in <code>manifest.json</code>). Any mismatch indicates tampering.
</p>
<div style="font-size:12px;color:#111;background:#F0F9FF;border:1px solid #BAE6FD;padding:10px 12px;border-radius:6px;display:flex;gap:14px;align-items:center;">
  <div style="flex:0 0 auto;line-height:0;">{_qr_svg}</div>
  <div style="flex:1 1 auto;">
    <strong>One-click verification, no account required.</strong> Drop this ZIP into the
    Kincaid Health public verifier and every SHA-256 will be recomputed in your browser.
    Scan the QR code with any phone camera, or open:<br>
    <a href="{_verifier_url}" style="color:#0369A1;font-family:'SF Mono',Menlo,Consolas,monospace;">
      {_verifier_url}
    </a>
  </div>
</div>
<p style="font-size:11px;color:#555;margin-top:14px;margin-bottom:6px;">
  <strong>Per-file scan-to-verify:</strong> point any phone camera at a QR code in the
  rightmost column. It opens the public verifier with that file's SHA-256 pre-filled —
  no typing, no upload, no account.
</p>
<table style="width:100%;border-collapse:collapse;font-size:11px;">
  <thead>
    <tr style="background:#f3f4f6;text-align:left;">
      <th style="padding:6px;border:1px solid #ddd;">File</th>
      <th style="padding:6px;border:1px solid #ddd;text-align:right;">Bytes</th>
      <th style="padding:6px;border:1px solid #ddd;">SHA-256</th>
      <th style="padding:6px;border:1px solid #ddd;text-align:center;">Scan</th>
    </tr>
  </thead>
  <tbody>{integrity_rows}</tbody>
</table>"""
        else:
            integrity_html = "<h2>Integrity Verification</h2><p><em>No components to hash.</em></p>"

        cover_html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Client Package — {_html.escape(body.client_name)}</title>
<style>
  body {{ font-family: Arial, sans-serif; max-width: 760px; margin: 40px auto; color: #111; }}
  h1 {{ color: #9B1C2E; border-bottom: 2px solid #9B1C2E; padding-bottom: 8px; }}
  h2 {{ color: #111; margin-top: 28px; font-size: 15px; }}
  .meta {{ color: #666; font-size: 13px; margin-bottom: 24px; }}
  ul {{ line-height: 1.9; }}
  code {{ font-family: "SF Mono", Menlo, Consolas, monospace; font-size: 10px; word-break: break-all; }}
  table td {{ padding: 5px 6px; border: 1px solid #e5e7eb; vertical-align: top; }}
  .footer {{ margin-top: 40px; font-size: 11px; color: #999; border-top: 1px solid #ddd; padding-top: 12px; }}
</style>
</head>
<body>
<h1>Kincaid Health™ — Client Package</h1>
<div class="meta">
  <strong>Prepared for:</strong> {_html.escape(body.client_name)}<br>
  <strong>Generated:</strong> {now_str}<br>
  <strong>Requester:</strong> {_html.escape(body.requester or "")}
</div>
<h2>Included Components</h2>
<ul>{included_html}</ul>
{integrity_html}
<div class="footer">
  Kincaid Health™ · Fiduciary-Grade Healthcare Benefits Intelligence<br>
  This package was assembled automatically. All analyses reflect plan-specific
  data and current regulatory standards. Hard Rule #03 — every export carries a
  SHA-256 evidence manifest. Not legal advice.
</div>
</body>
</html>"""
        cover_bytes = cover_html.encode("utf-8")
        zf.writestr("cover_sheet.html", cover_bytes)

        # ── README.txt (human-readable data dictionary) ──────────────────────
        # Parity with the deliveries-audit CSV (Task #108): a compliance reviewer
        # opening this ZIP should not have to guess what each file is. Describes
        # every bundled artifact, the manifest/SHA-256 evidence model, and which
        # components were included vs skipped (and why).
        def _artifact_description(c: dict) -> str:
            lower = c["filename"].lower()
            if "redline" in lower:
                return ("PBM Contract Clarity 360 redline — a Word document of model contract "
                        "language for every weak PBM provision, ready to paste into "
                        "negotiations.")
            if "scorecard" in lower:
                return ("PBM Contract Clarity 360 scorecard — machine-readable JSON scoring the PBM "
                        "contract against 65 fiduciary-aligned issues across 13 "
                        "provisions on a 0–100 scale.")
            if "employer" in lower:
                return ("Benefits benchmarking (employer) — this company's admin fees, "
                        "broker commissions, and plan income from DOL Form 5500 data, "
                        "with PMPM figures.")
            if "summary" in lower or "benchmark" in lower:
                return ("Benefits benchmarking (peer summary) — national P50/P75/P90 "
                        "percentiles and state-level peer comparison for the company's "
                        "industry.")
            if "board" in lower:
                return ("Board pack — an EIN-scoped fiduciary intelligence brief built "
                        "from the same DOL Form 5500 / DuckDB benchmark data for "
                        "board-level review.")
            kind = c.get("kind", "bin")
            return f"Bundled {kind.upper()} artifact."

        readme_lines: list[str] = []
        readme_lines.append("KINCAID HEALTH\u2122 \u2014 CLIENT PACKAGE")
        readme_lines.append("=" * 60)
        readme_lines.append("")
        readme_lines.append(f"Prepared for: {body.client_name or ''}")
        readme_lines.append(f"Generated:    {now_str}")
        readme_lines.append(f"Requester:    {body.requester or ''}")
        readme_lines.append("")
        readme_lines.append("WHAT IS THIS PACKAGE?")
        readme_lines.append("-" * 60)
        readme_lines.append(
            "This ZIP is a self-documenting, verifiable delivery of fiduciary-grade"
        )
        readme_lines.append(
            "healthcare benefits analyses. Every analytical artifact below is hashed"
        )
        readme_lines.append(
            "with SHA-256 at generation time and recorded in manifest.json so any"
        )
        readme_lines.append(
            "recipient can prove the files have not been altered (Hard Rule #03 \u2014"
        )
        readme_lines.append("every export carries a SHA-256 evidence manifest).")
        readme_lines.append("")
        readme_lines.append("ALWAYS-PRESENT FILES")
        readme_lines.append("-" * 60)
        readme_lines.append(
            "cover_sheet.html  \u2014 Printable cover sheet listing the included"
        )
        readme_lines.append(
            "                    components, an Integrity Verification table of every"
        )
        readme_lines.append(
            "                    file's SHA-256, and scan-to-verify QR codes."
        )
        readme_lines.append(
            "manifest.json     \u2014 Machine-readable evidence record: the hash"
        )
        readme_lines.append(
            "                    algorithm, per-file SHA-256 + byte size, and the"
        )
        readme_lines.append(
            "                    list of any skipped components."
        )
        readme_lines.append(
            "README.txt        \u2014 This file."
        )
        readme_lines.append("")
        readme_lines.append("INCLUDED COMPONENTS")
        readme_lines.append("-" * 60)
        if components:
            for c in components:
                readme_lines.append(f"\u2022 {c['filename']}  ({c['label']})")
                desc = _artifact_description(c)
                for wrapped in textwrap.wrap(desc, width=72):
                    readme_lines.append(f"    {wrapped}")
                readme_lines.append(
                    f"    Size: {c['size_bytes']:,} bytes  |  SHA-256: {c['sha256']}"
                )
                readme_lines.append("")
        else:
            readme_lines.append("(No analytical components were included in this package.)")
            readme_lines.append("")
        readme_lines.append("SKIPPED COMPONENTS")
        readme_lines.append("-" * 60)
        if skipped:
            for s in skipped:
                readme_lines.append(
                    f"\u2022 {s.get('component', 'unknown')} \u2014 {s.get('reason', 'no reason recorded')}"
                )
        else:
            readme_lines.append("(None \u2014 every requested component was generated successfully.)")
        readme_lines.append("")
        readme_lines.append("HOW TO VERIFY")
        readme_lines.append("-" * 60)
        readme_lines.append(
            "Recompute the SHA-256 digest of any file in this ZIP and compare it to"
        )
        readme_lines.append(
            "the value in manifest.json (or on the cover sheet). A mismatch indicates"
        )
        readme_lines.append(
            "tampering. For one-click verification with no account, open:"
        )
        readme_lines.append(f"  {_verifier_url}")
        readme_lines.append("")
        readme_lines.append(
            "Kincaid Health\u2122 \u00b7 Fiduciary-Grade Healthcare Benefits Intelligence \u00b7 Not legal advice."
        )
        readme_bytes = ("\n".join(readme_lines) + "\n").encode("utf-8")
        zf.writestr("README.txt", readme_bytes)

        # ── Manifest (machine-readable SHA-256 evidence record) ───────────────
        manifest = {
            "generated_by":   "Kincaid Health · Client Package Builder",
            "generated_at":   now_str,
            "client_name":    body.client_name,
            "requester":      body.requester,
            "rx_defense_id":  body.rx_defense_id,
            "ein":            body.ein,
            "hash_algorithm": "SHA-256",
            "hard_rule":      "#03 — every export carries a SHA-256 evidence manifest",
            # Strip the raw `data` bytes — they are JSON-unserializable and only
            # needed for snapshot persistence, never for the in-zip manifest.
            "components":     [
                {k: v for k, v in c.items() if k != "data"} for c in components
            ] + [{
                "filename":   "cover_sheet.html",
                "label":      "Cover Sheet",
                "sha256":     hashlib.sha256(cover_bytes).hexdigest(),
                "size_bytes": len(cover_bytes),
            }, {
                "filename":   "README.txt",
                "label":      "README (Data Dictionary)",
                "sha256":     hashlib.sha256(readme_bytes).hexdigest(),
                "size_bytes": len(readme_bytes),
            }],
            "skipped":        skipped,
        }
        zf.writestr("manifest.json", _json.dumps(manifest, indent=2))

    buf.seek(0)
    safe_client = (body.client_name or "client").replace(" ", "_")[:24]
    filename = f"kiq_package_{safe_client}_{date_str}.zip"
    return buf.getvalue(), filename, included, skipped, components


@router.post("/client-package")
async def client_package(
    body: ClientPackageRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Assembles a unified client delivery ZIP and streams it to the caller.
    See `_build_client_package_zip` for the component matrix.
    """
    from fastapi.responses import StreamingResponse
    zip_bytes, filename, included, _skipped, component_blobs = _build_client_package_zip(body, db, current_user)

    # Record the download as a delivery (source="download") and persist a
    # byte-identical snapshot of every component, so the audit drawer can show
    # exactly what was downloaded on this date — parity with the email path.
    try:
        delivery = models.ClientPackageDelivery(
            user_id=getattr(current_user, "id", None),
            recipient="(direct download)",
            recipients=json.dumps([]),
            cc=json.dumps([]),
            bcc_count=0,
            subject=f"Direct download — {body.client_name or 'Client'}",
            filename=filename,
            size_bytes=len(zip_bytes),
            components=json.dumps(included),
            component_count=len(included),
            ein=body.ein,
            rx_defense_id=body.rx_defense_id,
            client_name=body.client_name,
            smtp_sent=False,
            source="download",
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        try:
            for blob in (component_blobs or []):
                data = blob.get("data")
                if not data:
                    continue
                db.add(models.ClientPackageSnapshot(
                    delivery_id=delivery.id,
                    component_id=blob.get("component_id") or "",
                    label=blob.get("label"),
                    filename=blob.get("filename"),
                    kind=blob.get("kind"),
                    sha256=blob.get("sha256"),
                    size_bytes=blob.get("size_bytes"),
                    data=data,
                ))
            # Plus the complete ZIP exactly as downloaded, for byte-identical recovery.
            db.add(_full_zip_snapshot(delivery.id, zip_bytes, filename))
            db.commit()
        except Exception as e:
            logger.error(f"[ClientPackageDownload] snapshot persist failed: {e}")
            db.rollback()
    except Exception as e:
        logger.error(f"[ClientPackageDownload] delivery persist failed: {e}")
        db.rollback()

    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ── Per-component preview ─────────────────────────────────────────────────────
# Calls the same standalone builder a full ZIP build uses, but for one component
# only — no ZIP is assembled and no cover sheet / manifest / hashing runs. The
# bytes the preview returns are produced by the identical generation code that
# ships in the final package.

class ClientPackagePreviewRequest(BaseModel):
    component_id: str  # rx_redline | rx_scorecard | benchmarking_employer | benchmarking_summary | board_pack
    rx_defense_id: Optional[str] = None
    ein: Optional[str] = None
    client_name: str = "Client"


_PREVIEW_COMPONENT_FLAGS = {
    "rx_redline":            "include_rx_redline",
    "rx_scorecard":          "include_rx_scorecard",
    "benchmarking_employer": "include_benchmarking_employer",
    "benchmarking_summary":  "include_benchmarking_summary",
    "board_pack":            "include_board_pack",
}


def _resolve_component(
    component_id: str,
    rx_defense_id: Optional[str],
    ein: Optional[str],
    client_name: str,
    db: Session,
    current_user: models.User,
) -> tuple[Optional[tuple[bytes, str, str]], Optional[str]]:
    """Build a single client-package component directly (no ZIP assembly).

    Returns ((bytes, filename, label) or None, skip_reason or None):
      - (built, None)  — component produced
      - (None, None)   — component not produced from the available data (no error)
      - (None, reason) — generation raised; `reason` carries the message
    """
    from datetime import datetime, timezone
    from backend.models import RxDefenseContract

    now_str = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")

    try:
        if component_id in ("rx_redline", "rx_scorecard"):
            contract = None
            if rx_defense_id:
                contract = db.query(RxDefenseContract).filter(
                    RxDefenseContract.id == rx_defense_id,
                    RxDefenseContract.status == "complete",
                    RxDefenseContract.user_id == current_user.id,
                ).first()
            if not contract:
                return None, None
            if component_id == "rx_redline":
                return _build_rx_redline(contract, now_str), None
            return _build_rx_scorecard(contract, now_str), None

        if component_id == "benchmarking_employer":
            if not ein:
                return None, None
            return _build_benchmarking_employer(ein, now_str), None

        if component_id == "benchmarking_summary":
            if not ein:
                return None, None
            return _build_benchmarking_summary(ein, now_str), None

        if component_id == "board_pack":
            if not ein:
                return None, None
            return _build_board_pack(ein, client_name, now_str), None
    except Exception as e:
        return None, str(e)

    return None, None


@router.post("/client-package/preview")
async def client_package_preview(
    body: ClientPackagePreviewRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Render a single client-package component using the same generation code
    that builds the final ZIP. Returns a JSON payload the drawer renders
    inline — text for JSON/docx, base64 data-URL for PDF.
    """
    import base64

    flag = _PREVIEW_COMPONENT_FLAGS.get(body.component_id)
    if not flag:
        return {"ok": False, "error": f"Unknown component_id: {body.component_id}"}

    # URL the drawer can use for an iframe (PDF) or ArrayBuffer fetch (DOCX).
    # Same auth cookie carries over since this is a same-origin GET.
    from urllib.parse import urlencode as _urlencode
    _qs = {"component_id": body.component_id, "client_name": body.client_name}
    if body.rx_defense_id: _qs["rx_defense_id"] = body.rx_defense_id
    if body.ein:           _qs["ein"]           = body.ein
    component_url = f"/api/export/client-package/component?{_urlencode(_qs)}"

    built, skip_reason = _resolve_component(
        body.component_id, body.rx_defense_id, body.ein, body.client_name, db, current_user
    )
    if not built:
        return {
            "ok": False,
            "error": skip_reason or "Component was not produced — check that the underlying data is ready.",
        }

    raw, match, _label = built
    lower = match.lower()
    if lower.endswith(".json"):
        try:
            text = raw.decode("utf-8")
        except Exception:
            text = raw.decode("utf-8", errors="replace")
        return {"ok": True, "kind": "json", "filename": match, "body": text, "size_bytes": len(raw), "component_url": component_url}

    if lower.endswith(".docx"):
        # Extract plain text via python-docx so the drawer can show the
        # actual rendered content (binary docx can't render inline).
        try:
            from docx import Document as _Doc
            d = _Doc(io.BytesIO(raw))
            lines: list[str] = []
            for p in d.paragraphs:
                if p.text and p.text.strip():
                    lines.append(p.text)
                else:
                    lines.append("")
            text = "\n".join(lines).rstrip() + "\n"
        except Exception as e:
            text = f"(Could not extract .docx text: {e})"
        b64 = base64.b64encode(raw).decode("ascii")
        return {
            "ok": True,
            "kind": "docx",
            "filename": match,
            "body": text,
            "size_bytes": len(raw),
            "data_url": f"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,{b64}",
            "component_url": component_url,
        }

    if lower.endswith(".pdf"):
        b64 = base64.b64encode(raw).decode("ascii")
        return {
            "ok": True,
            "kind": "pdf",
            "filename": match,
            "size_bytes": len(raw),
            "data_url": f"data:application/pdf;base64,{b64}",
            "component_url": component_url,
        }

    # Fallback — show whatever bytes we can decode.
    try:
        text = raw.decode("utf-8")
        return {"ok": True, "kind": "text", "filename": match, "body": text, "size_bytes": len(raw)}
    except Exception:
        return {"ok": False, "error": "Unsupported preview format"}


@router.get("/client-package/component")
async def client_package_component_bytes(
    component_id: str = Query(..., description="rx_redline | rx_scorecard | benchmarking_employer | benchmarking_summary | board_pack"),
    rx_defense_id: Optional[str] = Query(None),
    ein: Optional[str] = Query(None),
    client_name: str = Query("Client"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Stream the raw bytes for a single client-package component (docx / pdf / json).
    GET-based so it can be used directly as the `src` of an <iframe> for PDF preview
    or fetched as an ArrayBuffer for in-browser DOCX rendering (mammoth.js).
    The bytes returned here are byte-identical to what ships in the final ZIP.
    """
    from fastapi.responses import Response

    flag = _PREVIEW_COMPONENT_FLAGS.get(component_id)
    if not flag:
        raise HTTPException(400, f"Unknown component_id: {component_id}")

    built, skip_reason = _resolve_component(
        component_id, rx_defense_id, ein, client_name, db, current_user
    )
    if not built:
        # A captured generation error is a real server fault (500); a clean
        # "not produced" with no error means the data wasn't ready (404).
        if skip_reason:
            raise HTTPException(500, f"Build failed: {skip_reason}")
        raise HTTPException(404, "Component was not produced — check that the underlying data is ready.")

    raw, match, _label = built
    lower = match.lower()
    if lower.endswith(".pdf"):
        media = "application/pdf"
    elif lower.endswith(".docx"):
        media = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    elif lower.endswith(".json"):
        media = "application/json"
    else:
        media = "application/octet-stream"

    return Response(
        content=raw,
        media_type=media,
        headers={"Content-Disposition": f'inline; filename="{match}"'},
    )


class ClientPackageEmailRequest(ClientPackageRequest):
    recipient: Optional[str] = None
    recipients: list[str] = []
    cc: list[str] = []
    bcc: list[str] = []
    subject: Optional[str] = None
    message: Optional[str] = None


@router.post("/client-package/email")
async def client_package_email(
    body: ClientPackageEmailRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Build the unified client package ZIP and deliver it as an email attachment.
    Falls back to a 'queued' response when SMTP env vars are not configured —
    same pattern used by `/api/email-reports/send`.
    """
    import os, smtplib, logging
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    logger = logging.getLogger(__name__)

    to_list: list[str] = []
    for r in (body.recipients or []):
        s = (r or "").strip()
        if "@" in s and s not in to_list:
            to_list.append(s)
    if body.recipient:
        s = body.recipient.strip()
        if "@" in s and s not in to_list:
            to_list.insert(0, s)
    if not to_list:
        return {"success": False, "smtp_sent": False, "error": "Invalid recipient email address"}
    recipient = to_list[0]

    pkg_body = ClientPackageRequest(
        client_name=body.client_name,
        rx_defense_id=body.rx_defense_id,
        ein=body.ein,
        include_rx_redline=body.include_rx_redline,
        include_rx_scorecard=body.include_rx_scorecard,
        include_benchmarking_employer=body.include_benchmarking_employer,
        include_benchmarking_summary=body.include_benchmarking_summary,
        include_board_pack=body.include_board_pack,
        requester=body.requester,
    )

    try:
        zip_bytes, filename, included, skipped, component_blobs = _build_client_package_zip(pkg_body, db, current_user)
    except Exception as e:
        logger.error(f"[ClientPackageEmail] build failed: {e}")
        return {"success": False, "smtp_sent": False, "error": f"Package build failed: {e}"}

    if not included:
        return {"success": False, "smtp_sent": False,
                "error": "No package components available — select a contract or company first."}

    cc_clean  = [c.strip() for c in (body.cc  or []) if c and "@" in c]
    bcc_clean = [c.strip() for c in (body.bcc or []) if c and "@" in c]
    subject  = (body.subject or f"Kincaid Health Client Package — {body.client_name or 'Client'}").strip()
    user_msg = (body.message or "").strip()

    components_html = "".join(f"<li>{_html.escape(c)}</li>" for c in included)
    msg_block_html  = (
        f'<div style="margin:18px 0;padding:14px 18px;background:#F9FAFB;border-left:4px solid #9B1C2E;border-radius:6px;">'
        f'<p style="font-size:13px;color:#374151;line-height:1.65;margin:0;white-space:pre-wrap;">'
        f'{_html.escape(user_msg)}</p></div>'
        if user_msg else ""
    )

    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#0c1a3a,#1a3a6e);border-radius:12px 12px 0 0;padding:28px 32px;">
          <span style="font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);">KINCAID HEALTH</span>
          <h1 style="font-size:20px;font-weight:800;color:white;margin:8px 0 4px;">Client Package Delivery</h1>
          <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">{_html.escape(body.client_name or 'Client')}</p>
        </td></tr>
        <tr><td style="background:white;padding:28px 32px;">
          <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">
            Attached is the Kincaid Health client package assembled for
            <strong>{_html.escape(body.client_name or 'your team')}</strong>.
          </p>
          {msg_block_html}
          <p style="font-size:12px;font-weight:700;color:#111827;margin:18px 0 6px;">Included components</p>
          <ul style="font-size:12px;color:#374151;line-height:1.7;margin:0 0 18px;padding-left:18px;">{components_html}</ul>
          <p style="font-size:11px;color:#9CA3AF;margin:18px 0 0;line-height:1.6;">
            ZIP attachment includes a cover sheet and machine-readable manifest. Not legal advice.
          </p>
        </td></tr>
        <tr><td style="background:#1F2937;border-radius:0 0 12px 12px;padding:16px 32px;">
          <p style="font-size:11px;color:rgba(255,255,255,0.45);margin:0;">Kincaid Health™</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    smtp_sent  = False
    error: Optional[str] = None

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"]    = f"Kincaid Health <{smtp_user}>"
            msg["To"]      = ", ".join(to_list)
            if cc_clean:
                msg["Cc"] = ", ".join(cc_clean)

            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(html_body, "html"))
            msg.attach(alt)

            part = MIMEBase("application", "zip")
            part.set_payload(zip_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=filename)
            msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
                s.starttls()
                s.login(smtp_user, smtp_pass)
                # BCC: appended to the SMTP envelope only — never written into the
                # message headers so recipients in To/Cc cannot see them.
                s.sendmail(smtp_user, to_list + cc_clean + bcc_clean, msg.as_string())
            smtp_sent = True
        except Exception as e:
            logger.error(f"[ClientPackageEmail] SMTP failed: {e}")
            error = str(e)
    else:
        error = "SMTP not configured — message queued for delivery."

    logger.info(
        f"[ClientPackageEmail] to={to_list} cc={cc_clean} bcc_count={len(bcc_clean)} "
        f"components={len(included)} size={len(zip_bytes)} smtp_sent={smtp_sent}"
    )

    # Persist a delivery record (audit log) regardless of SMTP outcome.
    try:
        delivery = models.ClientPackageDelivery(
            user_id=getattr(current_user, "id", None),
            recipient=recipient,
            recipients=json.dumps(to_list),
            cc=json.dumps(cc_clean),
            bcc_count=len(bcc_clean),
            subject=subject,
            filename=filename,
            size_bytes=len(zip_bytes),
            components=json.dumps(included),
            component_count=len(included),
            ein=body.ein,
            rx_defense_id=body.rx_defense_id,
            client_name=body.client_name,
            smtp_sent=smtp_sent,
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)

        # Persist a point-in-time snapshot of every generated component so the
        # audit drawer can show exactly what was sent on this date, even after
        # the underlying EIN / contract / benchmark data changes.
        try:
            for blob in (component_blobs or []):
                data = blob.get("data")
                if not data:
                    continue
                db.add(models.ClientPackageSnapshot(
                    delivery_id=delivery.id,
                    component_id=blob.get("component_id") or "",
                    label=blob.get("label"),
                    filename=blob.get("filename"),
                    kind=blob.get("kind"),
                    sha256=blob.get("sha256"),
                    size_bytes=blob.get("size_bytes"),
                    data=data,
                ))
            # Plus the complete ZIP exactly as attached, for byte-identical recovery.
            db.add(_full_zip_snapshot(delivery.id, zip_bytes, filename))
            db.commit()
        except Exception as e:
            logger.error(f"[ClientPackageEmail] snapshot persist failed: {e}")
            db.rollback()
    except Exception as e:
        logger.error(f"[ClientPackageEmail] history persist failed: {e}")
        db.rollback()

    all_recips_label = ", ".join(to_list + ([f"cc: {c}" for c in cc_clean] if cc_clean else []))
    return {
        "success":    True,
        "smtp_sent":  smtp_sent,
        "recipient":  recipient,
        "recipients": to_list,
        "cc":         cc_clean,
        "bcc_count":  len(bcc_clean),
        "subject":    subject,
        "filename":   filename,
        "size_bytes": len(zip_bytes),
        "components": included,
        "skipped":    skipped,
        "message": (
            f"Package emailed to {all_recips_label}" if smtp_sent
            else f"Package built ({len(included)} components, {len(zip_bytes) // 1024} KB) — {error or 'queued for delivery'}"
        ),
    }


class DiffPayload(BaseModel):
    """
    Structured before/after content for an executive-summary diff, sent by the AI
    History panel when the recipient asks for an editable Word (.docx) document.
    Unlike the PDF (rendered client-side via jsPDF), the .docx is rendered
    server-side via python-docx — so the raw A/B strings travel here and the
    word-level diff (bold adds / struck removals) is computed on the server.
    """
    label_a: Optional[str] = None
    label_b: Optional[str] = None
    score_a: Optional[float] = None
    score_b: Optional[float] = None
    headline_a: Optional[str] = None
    headline_b: Optional[str] = None
    paras_a: list[str] = []
    paras_b: list[str] = []
    action_a: Optional[str] = None
    action_b: Optional[str] = None
    is_benchmarking: bool = False
    pct_a: Optional[dict] = None          # {adminFees, brokerCommissions, totalIncome}
    pct_b: Optional[dict] = None
    pmpm_a: Optional[float] = None
    pmpm_b: Optional[float] = None
    year_a: Optional[int] = None
    year_b: Optional[int] = None


def _diff_attachment_filename(entity_id: Optional[str], ext: str) -> str:
    """Stable, filesystem-safe filename for a diff attachment — mirrors the
    client-side jsPDF naming so PDF and DOCX exports look like siblings."""
    import re
    safe = re.sub(r"[^a-z0-9_-]", "_", (entity_id or "diff"), flags=re.I)[:40] or "diff"
    stamp = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    return f"kincaid-iq-diff-{safe}-{stamp}.{ext}"


def _build_diff_docx(payload: "DiffPayload", now_str: str) -> bytes:
    """
    Render an executive-summary before/after diff as an editable .docx.

    Mirrors the branded PDF and the PBM Contract Clarity 360 redline styling: bold = added
    words, strikethrough = removed words, plus a percentile-positioning table for
    benchmarking diffs. The word-level diff is computed here (difflib) so the
    recipient gets a clean, redline-ready Word document.
    """
    import io as _io2
    import difflib
    from docx import Document as DocxDocument
    from docx.shared import Pt, RGBColor, Inches
    from docx.enum.text import WD_ALIGN_PARAGRAPH

    NAVY = RGBColor(11, 31, 59)
    GREEN = RGBColor(13, 124, 79)
    RED = RGBColor(178, 36, 60)
    GREY = RGBColor(90, 98, 112)

    def _runs(a: Optional[str], b: Optional[str]):
        """List of (text, kind) where kind ∈ {'eq','add','del'} — word-level."""
        if a is None and b is None:
            return [("—", "eq")]
        if a is None:
            return [(b, "add")]
        if b is None:
            return [(a, "del")]
        if a == b:
            return [(a, "eq")]
        at, bt = a.split(), b.split()
        out = []
        for tag, i1, i2, j1, j2 in difflib.SequenceMatcher(None, at, bt).get_opcodes():
            if tag == "equal":
                out.append((" ".join(bt[j1:j2]), "eq"))
            elif tag == "delete":
                out.append((" ".join(at[i1:i2]), "del"))
            elif tag == "insert":
                out.append((" ".join(bt[j1:j2]), "add"))
            else:  # replace
                out.append((" ".join(at[i1:i2]), "del"))
                out.append((" ".join(bt[j1:j2]), "add"))
        return out

    def _render(paragraph, a: Optional[str], b: Optional[str]) -> None:
        first = True
        for text, kind in _runs(a, b):
            if not text:
                continue
            run = paragraph.add_run(("" if first else " ") + text)
            first = False
            if kind == "add":
                run.bold = True
                run.font.color.rgb = GREEN
            elif kind == "del":
                run.font.strike = True
                run.font.color.rgb = RED

    doc = DocxDocument()
    for section in doc.sections:
        section.top_margin = Inches(1.0)
        section.bottom_margin = Inches(1.0)
        section.left_margin = Inches(1.1)
        section.right_margin = Inches(1.1)

    title = doc.add_heading("Executive Summary — Before / After", 0)
    title.alignment = WD_ALIGN_PARAGRAPH.CENTER
    if title.runs:
        title.runs[0].font.color.rgb = NAVY

    la = payload.label_a or "Version A"
    lb = payload.label_b or "Version B"
    meta = doc.add_paragraph()
    meta_run = meta.add_run(f"{la}  →  {lb}   |   Generated by Kincaid Health · {now_str}")
    meta_run.italic = True
    meta_run.font.color.rgb = GREY
    meta.alignment = WD_ALIGN_PARAGRAPH.CENTER

    if payload.score_a is not None or payload.score_b is not None:
        sa = f"{payload.score_a:.1f}" if payload.score_a is not None else "—"
        sb = f"{payload.score_b:.1f}" if payload.score_b is not None else "—"
        delta = ""
        if payload.score_a is not None and payload.score_b is not None:
            d = payload.score_b - payload.score_a
            delta = f"  ({'+' if d > 0 else ''}{d:.1f})"
        score_p = doc.add_paragraph()
        score_p.add_run(f"Score: {sa} → {sb}{delta}").bold = True
        score_p.alignment = WD_ALIGN_PARAGRAPH.CENTER

    legend = doc.add_paragraph()
    legend.add_run("Legend:  ").italic = True
    add_l = legend.add_run("bold = added")
    add_l.bold = True
    add_l.font.color.rgb = GREEN
    legend.add_run("     ")
    del_l = legend.add_run("strikethrough = removed")
    del_l.font.strike = True
    del_l.font.color.rgb = RED
    legend.alignment = WD_ALIGN_PARAGRAPH.CENTER

    doc.add_paragraph()

    if payload.headline_a or payload.headline_b:
        h = doc.add_heading("Headline", level=1)
        if h.runs:
            h.runs[0].font.color.rgb = NAVY
        _render(doc.add_paragraph(), payload.headline_a, payload.headline_b)

    pa, pb = payload.paras_a or [], payload.paras_b or []
    n = max(len(pa), len(pb))
    if n:
        h = doc.add_heading("Analysis", level=1)
        if h.runs:
            h.runs[0].font.color.rgb = NAVY
        for i in range(n):
            a = pa[i] if i < len(pa) else None
            b = pb[i] if i < len(pb) else None
            para = doc.add_paragraph()
            num = para.add_run(f"¶{i + 1}.  ")
            num.bold = True
            num.font.color.rgb = GREY
            _render(para, a, b)

    if payload.action_a or payload.action_b:
        h = doc.add_heading("Recommended Next Step", level=1)
        if h.runs:
            h.runs[0].font.color.rgb = NAVY
        _render(doc.add_paragraph(), payload.action_a, payload.action_b)

    if payload.is_benchmarking and (payload.pct_a or payload.pct_b):
        year_suffix = ""
        if payload.year_a and payload.year_b and payload.year_a != payload.year_b:
            year_suffix = f" ({payload.year_a} → {payload.year_b})"
        elif payload.year_b:
            year_suffix = f" ({payload.year_b})"
        h = doc.add_heading(f"Percentile Positioning{year_suffix}", level=1)
        if h.runs:
            h.runs[0].font.color.rgb = NAVY

        table = doc.add_table(rows=1, cols=4)
        try:
            table.style = "Light Grid Accent 1"
        except Exception:
            try:
                table.style = "Table Grid"
            except Exception:
                pass
        for cell, text in zip(table.rows[0].cells, ["Metric", "A", "B", "Δ"]):
            r = cell.paragraphs[0].add_run(text)
            r.bold = True
            r.font.color.rgb = NAVY

        label_map = {
            "adminFees": "Admin Fees",
            "brokerCommissions": "Broker Commissions",
            "totalIncome": "Plan Income",
        }
        pct_a = payload.pct_a or {}
        pct_b = payload.pct_b or {}

        def _delta_cell(cell, a, b, *, dollars=False, eps=1.0):
            if a is None or b is None:
                cell.text = "—"
                return
            d = b - a
            if abs(d) < eps:
                cell.text = "≈"
                return
            improved = d < 0  # lower percentile / PMPM is better
            arrow = "↓" if improved else "↑"
            mag = f"${abs(d):.2f}" if dollars else f"{abs(d)} pts"
            run = cell.paragraphs[0].add_run(f"{arrow} {mag}")
            run.bold = True
            run.font.color.rgb = GREEN if improved else RED

        for key in ("adminFees", "brokerCommissions", "totalIncome"):
            av = pct_a.get(key)
            bv = pct_b.get(key)
            cells = table.add_row().cells
            cells[0].text = label_map[key]
            cells[1].text = "—" if av is None else f"{av}th"
            cells[2].text = "—" if bv is None else f"{bv}th"
            _delta_cell(cells[3], av, bv, eps=1.0)

        if payload.pmpm_a is not None or payload.pmpm_b is not None:
            cells = table.add_row().cells
            cells[0].paragraphs[0].add_run("PMPM").bold = True
            cells[1].text = "—" if payload.pmpm_a is None else f"${payload.pmpm_a}"
            cells[2].text = "—" if payload.pmpm_b is None else f"${payload.pmpm_b}"
            _delta_cell(cells[3], payload.pmpm_a, payload.pmpm_b, dollars=True, eps=0.5)

    doc.add_paragraph()
    disc = doc.add_paragraph()
    disc_run = disc.add_run("Kincaid Health™ · Not legal advice.")
    disc_run.italic = True
    disc_run.font.size = Pt(8)
    disc_run.font.color.rgb = GREY

    buf = _io2.BytesIO()
    doc.save(buf)
    return buf.getvalue()


class DiffLogRequest(BaseModel):
    """
    Logged record (and optional server-side send) of an emailed executive-summary
    diff that originates from the AI History panel's "Send diff" button.
    """
    recipients: list[str] = []
    cc: list[str] = []
    subject: Optional[str] = None
    body_markdown: Optional[str] = None
    tool: Optional[str] = None            # 'rx_defense' | 'war_room' | 'benchmarking'
    entity_id: Optional[str] = None       # contract id (rx_defense) or employer EIN
    client_name: Optional[str] = None
    # 'log'  — frontend already opened the user's mail client (mailto:); we only
    #          persist the audit record.
    # 'send' — "Send via Kincaid": deliver server-side over SMTP, then persist.
    mode: str = "log"
    # Optional branded diff PDF rendered client-side (jsPDF). When present on a
    # 'send', it is attached to the outgoing email so the recipient sees a
    # polished before/after document instead of raw Markdown.
    pdf_base64: Optional[str] = None
    pdf_filename: Optional[str] = None
    # Editable Word (.docx) alternative — rendered server-side from diff_payload.
    # When attach_docx is set on a 'send', the .docx is attached instead of the
    # PDF so recipients can edit / redline the before/after document.
    attach_docx: bool = False
    diff_payload: Optional[DiffPayload] = None


@router.post("/client-package/log-diff")
async def client_package_log_diff(
    body: DiffLogRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Record an emailed executive-summary diff in the same client-package delivery
    audit log used by the rest of the platform, so every diff a broker sends is
    accountable (who → whom → when). When `mode == 'send'` the diff is also
    delivered server-side over SMTP (falling back to a 'queued' record when SMTP
    env vars are not configured — same pattern as `/client-package/email`).
    """
    import os, smtplib, logging, base64
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    logger = logging.getLogger(__name__)

    to_list: list[str] = []
    for r in (body.recipients or []):
        s = (r or "").strip()
        if "@" in s and s not in to_list:
            to_list.append(s)
    if not to_list:
        return {"success": False, "smtp_sent": False, "error": "Invalid recipient email address"}
    recipient = to_list[0]

    cc_clean = [c.strip() for c in (body.cc or []) if c and "@" in c]
    subject  = (body.subject or "Executive summary diff").strip()
    md       = body.body_markdown or ""

    # Resolve the optional attachment up front so we can both attach it to the
    # email and note it in the audit trail. Two paths:
    #   • Word (.docx) — rendered server-side here from diff_payload (editable).
    #   • PDF          — rendered client-side (jsPDF) and shipped as base64.
    # DOCX takes precedence when both are present.
    attach_bytes: Optional[bytes] = None
    attach_filename: str = "executive-summary-diff.pdf"
    attach_subtype: str = "pdf"               # MIME subtype under 'application'
    attach_label: str = "Executive summary diff"
    attach_is_docx: bool = False

    if body.attach_docx and body.diff_payload is not None:
        try:
            now_str = datetime.now(timezone.utc).strftime("%b %d, %Y")
            attach_bytes = _build_diff_docx(body.diff_payload, now_str)
            attach_filename = _diff_attachment_filename(body.entity_id, "docx")
            attach_subtype = "vnd.openxmlformats-officedocument.wordprocessingml.document"
            attach_label = "Executive summary diff (Word)"
            attach_is_docx = True
        except Exception as e:
            logger.error(f"[DiffLog] DOCX build failed: {e}")
            attach_bytes = None
    elif body.pdf_base64:
        try:
            attach_bytes = base64.b64decode(body.pdf_base64)
            attach_filename = (body.pdf_filename or "executive-summary-diff.pdf").strip() or "executive-summary-diff.pdf"
            attach_subtype = "pdf"
            attach_label = "Executive summary diff (PDF)"
        except Exception as e:
            logger.error(f"[DiffLog] PDF decode failed: {e}")
            attach_bytes = None

    # Map the AI-history entity onto the audit-log scoping columns so the diff
    # send is filterable alongside package emails for the same client.
    ein = None
    rx_defense_id = None
    if (body.tool or "") == "rx_defense":
        rx_defense_id = body.entity_id
    elif body.entity_id:
        ein = body.entity_id

    smtp_sent = False
    error: Optional[str] = None

    if body.mode == "send":
        smtp_host = os.environ.get("SMTP_HOST", "")
        smtp_port = int(os.environ.get("SMTP_PORT", "587"))
        smtp_user = os.environ.get("SMTP_USER", "")
        smtp_pass = os.environ.get("SMTP_PASS", "")

        if smtp_host and smtp_user and smtp_pass:
            try:
                html_body = (
                    "<!DOCTYPE html><html><body style=\"margin:0;padding:24px;"
                    "background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,"
                    "'Segoe UI',Roboto,sans-serif;\">"
                    "<table width='100%' cellpadding='0' cellspacing='0'><tr><td align='center'>"
                    "<table width='640' style='max-width:640px;width:100%;'>"
                    "<tr><td style=\"background:linear-gradient(135deg,#0c1a3a,#1a3a6e);"
                    "border-radius:12px 12px 0 0;padding:24px 28px;\">"
                    "<span style=\"font-size:10px;font-weight:800;letter-spacing:0.2em;"
                    "text-transform:uppercase;color:rgba(255,255,255,0.45);\">KINCAID HEALTH</span>"
                    "<h1 style=\"font-size:18px;font-weight:800;color:white;margin:8px 0 0;\">"
                    f"{_html.escape(subject)}</h1>"
                    f"<p style=\"font-size:12px;color:rgba(255,255,255,0.5);margin:4px 0 0;\">"
                    f"{_html.escape(body.client_name or 'Client')}</p>"
                    "</td></tr><tr><td style=\"background:white;padding:24px 28px;\">"
                    "<pre style=\"font-size:12px;color:#1f2937;line-height:1.6;white-space:pre-wrap;"
                    "font-family:ui-monospace,SFMono-Regular,Menlo,monospace;margin:0;\">"
                    f"{_html.escape(md)}</pre></td></tr>"
                    "<tr><td style=\"background:#1F2937;border-radius:0 0 12px 12px;padding:14px 28px;\">"
                    "<p style=\"font-size:11px;color:rgba(255,255,255,0.45);margin:0;\">"
                    "Kincaid Health™ · Not legal advice.</p></td></tr>"
                    "</table></td></tr></table></body></html>"
                )
                # When an attachment (PDF or Word) is present, wrap the text/html
                # alternatives in a 'mixed' container so it sits alongside the body.
                alt = MIMEMultipart("alternative")
                alt.attach(MIMEText(md or "(empty diff)", "plain"))
                alt.attach(MIMEText(html_body, "html"))

                if attach_bytes:
                    msg = MIMEMultipart("mixed")
                    msg.attach(alt)
                    part = MIMEBase("application", attach_subtype)
                    part.set_payload(attach_bytes)
                    encoders.encode_base64(part)
                    part.add_header("Content-Disposition", "attachment", filename=attach_filename)
                    msg.attach(part)
                else:
                    msg = alt

                msg["Subject"] = subject
                msg["From"]    = f"Kincaid Health <{smtp_user}>"
                msg["To"]      = ", ".join(to_list)
                if cc_clean:
                    msg["Cc"] = ", ".join(cc_clean)
                with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
                    s.starttls()
                    s.login(smtp_user, smtp_pass)
                    s.sendmail(smtp_user, to_list + cc_clean, msg.as_string())
                smtp_sent = True
            except Exception as e:
                logger.error(f"[DiffLog] SMTP failed: {e}")
                error = str(e)
        else:
            error = "SMTP not configured — message queued for delivery."

    logger.info(
        f"[DiffLog] to={to_list} cc={cc_clean} tool={body.tool} entity={body.entity_id} "
        f"mode={body.mode} smtp_sent={smtp_sent}"
    )

    try:
        delivery = models.ClientPackageDelivery(
            user_id=getattr(current_user, "id", None),
            recipient=recipient,
            recipients=json.dumps(to_list),
            cc=json.dumps(cc_clean),
            bcc_count=0,
            subject=subject,
            filename=attach_filename if attach_bytes else "executive-summary-diff.md",
            size_bytes=len(attach_bytes) if attach_bytes else len(md.encode("utf-8")),
            components=json.dumps(
                [attach_label] if attach_bytes else ["Executive summary diff"]
            ),
            component_count=1,
            body_markdown=md or None,
            ein=ein,
            rx_defense_id=rx_defense_id,
            client_name=body.client_name,
            smtp_sent=smtp_sent,
            source="diff",
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        delivery_id = delivery.id
    except Exception as e:
        logger.error(f"[DiffLog] history persist failed: {e}")
        db.rollback()
        delivery_id = None

    return {
        "success":    True,
        "smtp_sent":  smtp_sent,
        "id":         delivery_id,
        "recipient":  recipient,
        "recipients": to_list,
        "cc":         cc_clean,
        "subject":    subject,
        "mode":       body.mode,
        "pdf_attached":  bool(attach_bytes and not attach_is_docx and smtp_sent),
        "docx_attached": bool(attach_bytes and attach_is_docx and smtp_sent),
        "message": (
            f"Diff emailed to {', '.join(to_list)}"
            + ((" with Word document attached" if attach_is_docx else " with PDF attached") if attach_bytes else "")
            if smtp_sent
            else (error or "Diff logged to delivery audit trail.")
        ),
    }


class BidEmailRequest(BaseModel):
    """Email the one-page Bid Optimizer recommendation PDF straight to a client.
    The PDF is rendered client-side (jsPDF) — identical to the Export PDF action —
    and shipped here as base64 so the recipient receives the polished document.
    Falls back to a 'queued' audit record when SMTP env vars are not configured,
    mirroring `/client-package/email` and `/client-package/log-diff`."""
    recipients: list[str] = []
    cc: list[str] = []
    subject: Optional[str] = None
    message: Optional[str] = None
    pdf_base64: str
    pdf_filename: Optional[str] = None
    employer_name: Optional[str] = None
    opp_id: Optional[str] = None


@router.post("/client-package/email-bid")
async def client_package_email_bid(
    body: BidEmailRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Deliver the Bid Optimizer one-page recommendation PDF as an email attachment
    and record the send in the same client-package delivery audit log used across
    the platform (source="bid"). Reuses the proven SMTP + audit plumbing; when
    SMTP is not configured the delivery is persisted as 'queued'.
    """
    import os, smtplib, logging, base64
    from email.mime.multipart import MIMEMultipart
    from email.mime.text import MIMEText
    from email.mime.base import MIMEBase
    from email import encoders

    logger = logging.getLogger(__name__)

    to_list: list[str] = []
    for r in (body.recipients or []):
        s = (r or "").strip()
        if "@" in s and s not in to_list:
            to_list.append(s)
    if not to_list:
        return {"success": False, "smtp_sent": False, "error": "Invalid recipient email address"}
    recipient = to_list[0]

    cc_clean = [c.strip() for c in (body.cc or []) if c and "@" in c]
    employer = (body.employer_name or "Client").strip() or "Client"
    subject  = (body.subject or f"Kincaid Health Bid Recommendation — {employer}").strip()
    user_msg = (body.message or "").strip()

    try:
        attach_bytes = base64.b64decode(body.pdf_base64)
    except Exception as e:
        logger.error(f"[BidEmail] PDF decode failed: {e}")
        return {"success": False, "smtp_sent": False, "error": "Could not decode the bid recommendation PDF."}

    attach_filename = (body.pdf_filename or "bid_recommendation.pdf").strip() or "bid_recommendation.pdf"
    if not attach_filename.lower().endswith(".pdf"):
        attach_filename += ".pdf"

    msg_block_html = (
        f'<div style="margin:18px 0;padding:14px 18px;background:#F9FAFB;border-left:4px solid #9B1C2E;border-radius:6px;">'
        f'<p style="font-size:13px;color:#374151;line-height:1.65;margin:0;white-space:pre-wrap;">'
        f'{_html.escape(user_msg)}</p></div>'
        if user_msg else ""
    )
    html_body = f"""<!DOCTYPE html>
<html><body style="margin:0;padding:0;background:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F3F4F6;padding:32px 16px;">
    <tr><td align="center">
      <table width="600" style="max-width:600px;width:100%;">
        <tr><td style="background:linear-gradient(135deg,#0c1a3a,#1a3a6e);border-radius:12px 12px 0 0;padding:28px 32px;">
          <span style="font-size:10px;font-weight:800;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.45);">KINCAID HEALTH</span>
          <h1 style="font-size:20px;font-weight:800;color:white;margin:8px 0 4px;">Bid Recommendation</h1>
          <p style="font-size:12px;color:rgba(255,255,255,0.5);margin:0;">{_html.escape(employer)}</p>
        </td></tr>
        <tr><td style="background:white;padding:28px 32px;">
          <p style="font-size:14px;color:#374151;line-height:1.7;margin:0 0 12px;">
            Attached is the Kincaid Health Bid Optimizer one-page recommendation for
            <strong>{_html.escape(employer)}</strong>.
          </p>
          {msg_block_html}
          <p style="font-size:11px;color:#9CA3AF;margin:18px 0 0;line-height:1.6;">
            The attached PDF carries a SHA-256 evidence manifest. Not legal advice.
          </p>
        </td></tr>
        <tr><td style="background:#1F2937;border-radius:0 0 12px 12px;padding:16px 32px;">
          <p style="font-size:11px;color:rgba(255,255,255,0.45);margin:0;">Kincaid Health™</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>"""

    smtp_host = os.environ.get("SMTP_HOST", "")
    smtp_port = int(os.environ.get("SMTP_PORT", "587"))
    smtp_user = os.environ.get("SMTP_USER", "")
    smtp_pass = os.environ.get("SMTP_PASS", "")

    smtp_sent = False
    error: Optional[str] = None

    if smtp_host and smtp_user and smtp_pass:
        try:
            msg = MIMEMultipart("mixed")
            msg["Subject"] = subject
            msg["From"]    = f"Kincaid Health <{smtp_user}>"
            msg["To"]      = ", ".join(to_list)
            if cc_clean:
                msg["Cc"] = ", ".join(cc_clean)

            alt = MIMEMultipart("alternative")
            alt.attach(MIMEText(user_msg or "Bid recommendation attached.", "plain"))
            alt.attach(MIMEText(html_body, "html"))
            msg.attach(alt)

            part = MIMEBase("application", "pdf")
            part.set_payload(attach_bytes)
            encoders.encode_base64(part)
            part.add_header("Content-Disposition", "attachment", filename=attach_filename)
            msg.attach(part)

            with smtplib.SMTP(smtp_host, smtp_port, timeout=20) as s:
                s.starttls()
                s.login(smtp_user, smtp_pass)
                s.sendmail(smtp_user, to_list + cc_clean, msg.as_string())
            smtp_sent = True
        except Exception as e:
            logger.error(f"[BidEmail] SMTP failed: {e}")
            error = str(e)
    else:
        error = "SMTP not configured — message queued for delivery."

    logger.info(
        f"[BidEmail] to={to_list} cc={cc_clean} opp={body.opp_id} "
        f"size={len(attach_bytes)} smtp_sent={smtp_sent}"
    )

    try:
        delivery = models.ClientPackageDelivery(
            user_id=getattr(current_user, "id", None),
            recipient=recipient,
            recipients=json.dumps(to_list),
            cc=json.dumps(cc_clean),
            bcc_count=0,
            subject=subject,
            filename=attach_filename,
            size_bytes=len(attach_bytes),
            components=json.dumps(["Bid recommendation (PDF)"]),
            component_count=1,
            client_name=employer,
            smtp_sent=smtp_sent,
            source="bid",
        )
        db.add(delivery)
        db.commit()
        db.refresh(delivery)
        delivery_id = delivery.id
    except Exception as e:
        logger.error(f"[BidEmail] history persist failed: {e}")
        db.rollback()
        delivery_id = None

    return {
        "success":    True,
        "smtp_sent":  smtp_sent,
        "id":         delivery_id,
        "recipient":  recipient,
        "recipients": to_list,
        "cc":         cc_clean,
        "subject":    subject,
        "message": (
            f"Bid recommendation emailed to {', '.join(to_list)}"
            if smtp_sent
            else (error or "Bid recommendation logged to delivery audit trail.")
        ),
    }


class DiffDocxRequest(BaseModel):
    """Build-and-download request for the editable Word (.docx) diff. Used by the
    'Open in mail' path, which can't carry attachments, so the broker downloads
    the Word document and attaches it to the message their mail client opened."""
    diff_payload: DiffPayload
    tool: Optional[str] = None
    entity_id: Optional[str] = None


@router.post("/client-package/diff-docx")
async def client_package_diff_docx(
    body: DiffDocxRequest,
    current_user: models.User = Depends(get_current_user),
):
    """Render the executive-summary before/after diff as an editable .docx and
    stream it back for download."""
    from fastapi.responses import StreamingResponse
    now_str = datetime.now(timezone.utc).strftime("%b %d, %Y")
    docx_bytes = _build_diff_docx(body.diff_payload, now_str)
    filename = _diff_attachment_filename(body.entity_id, "docx")
    return StreamingResponse(
        io.BytesIO(docx_bytes),
        media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/verify-package")
async def verify_package(
    file: UploadFile = File(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    Recompute SHA-256 for every file inside an uploaded Kincaid Health client-package ZIP
    and compare against the embedded `manifest.json`. Enforces Hard Rule #03 — every
    export carries a SHA-256 evidence manifest — by letting recipients confirm that
    no file was altered after generation.

    Returns:
      {
        ok: bool,                       # True iff every manifest entry matches and no extras/missing
        manifest_found: bool,
        manifest: {generated_at, generated_by, client_name, ein, ...} | None,
        files: [
          {filename, label, expected_sha256, actual_sha256,
           expected_size, actual_size, status: "match"|"mismatch"|"missing"|"extra"}
        ],
        summary: {total, matched, mismatched, missing, extra},
        error: str | None,
      }
    """
    import io as _io
    import zipfile

    raw = await file.read()
    size_kb = len(raw) / 1024
    if not raw:
        return {
            "ok": False, "manifest_found": False, "manifest": None,
            "files": [], "summary": {"total": 0, "matched": 0, "mismatched": 0, "missing": 0, "extra": 0},
            "error": "Uploaded file is empty.",
        }

    try:
        zf = zipfile.ZipFile(_io.BytesIO(raw))
    except zipfile.BadZipFile:
        return {
            "ok": False, "manifest_found": False, "manifest": None,
            "files": [], "summary": {"total": 0, "matched": 0, "mismatched": 0, "missing": 0, "extra": 0},
            "error": "Not a valid ZIP archive.",
        }

    # ── Locate manifest.json ────────────────────────────────────────────────
    names = zf.namelist()
    manifest_name = next((n for n in names if n.lower().endswith("manifest.json")), None)
    if not manifest_name:
        return {
            "ok": False, "manifest_found": False, "manifest": None,
            "files": [], "summary": {"total": 0, "matched": 0, "mismatched": 0, "missing": 0, "extra": 0},
            "error": "manifest.json not found — this ZIP is not a Kincaid Health evidence package.",
        }

    try:
        manifest = json.loads(zf.read(manifest_name).decode("utf-8"))
    except Exception as e:
        return {
            "ok": False, "manifest_found": True, "manifest": None,
            "files": [], "summary": {"total": 0, "matched": 0, "mismatched": 0, "missing": 0, "extra": 0},
            "error": f"manifest.json is unreadable: {e}",
        }

    expected = {
        c.get("filename"): c
        for c in (manifest.get("components") or [])
        if c.get("filename")
    }

    # ── Recompute SHA-256 for every file actually in the ZIP ───────────────
    actual: dict[str, dict] = {}
    for n in names:
        if n.endswith("/"):
            continue
        if n == manifest_name:
            continue
        data = zf.read(n)
        actual[n] = {
            "sha256": hashlib.sha256(data).hexdigest(),
            "size":   len(data),
        }

    results: list[dict] = []
    matched = mismatched = missing = extra = 0

    for fname, comp in expected.items():
        exp_hash = comp.get("sha256")
        exp_size = comp.get("size_bytes")
        label    = comp.get("label") or fname
        if fname not in actual:
            results.append({
                "filename":        fname,
                "label":           label,
                "expected_sha256": exp_hash,
                "actual_sha256":   None,
                "expected_size":   exp_size,
                "actual_size":     None,
                "status":          "missing",
            })
            missing += 1
            continue
        act = actual[fname]
        status = "match" if act["sha256"] == exp_hash else "mismatch"
        if status == "match":
            matched += 1
        else:
            mismatched += 1
        results.append({
            "filename":        fname,
            "label":           label,
            "expected_sha256": exp_hash,
            "actual_sha256":   act["sha256"],
            "expected_size":   exp_size,
            "actual_size":     act["size"],
            "status":          status,
        })

    for fname, act in actual.items():
        if fname in expected:
            continue
        results.append({
            "filename":        fname,
            "label":           fname,
            "expected_sha256": None,
            "actual_sha256":   act["sha256"],
            "expected_size":   None,
            "actual_size":     act["size"],
            "status":          "extra",
        })
        extra += 1

    total = len(results)
    ok = (mismatched == 0 and missing == 0 and extra == 0 and matched > 0)

    # Strip raw component list from manifest echo (we surface it via `files`)
    manifest_echo = {k: v for k, v in manifest.items() if k != "components"}
    manifest_echo["component_count"] = len(expected)
    manifest_echo["uploaded_filename"] = file.filename
    manifest_echo["uploaded_size_kb"]  = round(size_kb, 1)

    return {
        "ok":              ok,
        "manifest_found":  True,
        "manifest":        manifest_echo,
        "files":           results,
        "summary": {
            "total":      total,
            "matched":    matched,
            "mismatched": mismatched,
            "missing":    missing,
            "extra":      extra,
        },
        "error": None,
    }


# Map persisted component labels (see _build_client_package_zip) back to
# the ClientPackageRequest include_* booleans, so a stored delivery row can
# be hydrated into a fresh request without losing the original component
# selection.
_COMPONENT_LABEL_TO_FLAG: dict[str, str] = {
    "PBM Contract Clarity 360 Redline (.docx)":              "include_rx_redline",
    "PBM Contract Clarity 360 Scorecard (JSON)":             "include_rx_scorecard",
    # Legacy labels persisted before the "Rx Defense" to "PBM Contract Clarity 360" rename.
    "Rx Defense Redline (.docx)":              "include_rx_redline",
    "Rx Defense Scorecard (JSON)":             "include_rx_scorecard",
    "Benchmarking Employer Report (JSON)":     "include_benchmarking_employer",
    "Benefits Benchmarking Summary (JSON)":    "include_benchmarking_summary",
}


def _hydrate_request_from_delivery(
    delivery: "models.ClientPackageDelivery",
) -> ClientPackageRequest:
    """Rebuild the original ClientPackageRequest from a stored delivery row."""
    try:
        labels = json.loads(delivery.components or "[]")
        if not isinstance(labels, list):
            labels = []
    except Exception:
        labels = []

    flags = {
        "include_rx_redline":            False,
        "include_rx_scorecard":          False,
        "include_benchmarking_employer": False,
        "include_benchmarking_summary":  False,
        "include_board_pack":            False,
    }
    for raw in labels:
        lbl = str(raw or "")
        # War Room brief label is suffixed with the company name, so match
        # by prefix rather than equality.
        if lbl.startswith("War Room Fiduciary Intelligence Brief"):
            flags["include_board_pack"] = True
            continue
        flag = _COMPONENT_LABEL_TO_FLAG.get(lbl)
        if flag:
            flags[flag] = True

    return ClientPackageRequest(
        client_name=delivery.client_name or "Client",
        rx_defense_id=delivery.rx_defense_id,
        ein=delivery.ein,
        requester="kincaid-iq-resend",
        **flags,
    )


@router.get("/client-package/snapshot/{delivery_id}/{component_id}")
def client_package_snapshot(
    delivery_id: int,
    component_id: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return the point-in-time snapshot of a single component captured the day a
    delivery was sent. Same JSON shape the live `/client-package/preview`
    endpoint returns, so the drawer can render it identically — but the bytes
    are exactly what the client received, not a fresh rebuild.
    """
    import base64
    from fastapi import HTTPException

    delivery = (
        db.query(models.ClientPackageDelivery)
        .filter(
            models.ClientPackageDelivery.id == delivery_id,
            models.ClientPackageDelivery.user_id == current_user.id,
        )
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    snap = (
        db.query(models.ClientPackageSnapshot)
        .filter(
            models.ClientPackageSnapshot.delivery_id == delivery_id,
            models.ClientPackageSnapshot.component_id == component_id,
        )
        .order_by(models.ClientPackageSnapshot.id.desc())
        .first()
    )
    if not snap:
        return {"ok": False, "error": "No snapshot stored for this component."}

    raw = bytes(snap.data or b"")
    filename = snap.filename or component_id
    kind = snap.kind or "bin"
    snapshot_at = delivery.created_at.isoformat() if delivery.created_at else None

    if kind == "json":
        try:
            text = raw.decode("utf-8")
        except Exception:
            text = raw.decode("utf-8", errors="replace")
        b64 = base64.b64encode(raw).decode("ascii")
        return {
            "ok": True, "kind": "json", "filename": filename, "body": text,
            "size_bytes": len(raw), "snapshot": True, "snapshot_at": snapshot_at,
            "sha256": snap.sha256,
            "data_url": f"data:application/json;base64,{b64}",
        }

    if kind == "docx":
        try:
            from docx import Document as _Doc
            d = _Doc(io.BytesIO(raw))
            lines: list[str] = []
            for p in d.paragraphs:
                lines.append(p.text if (p.text and p.text.strip()) else "")
            text = "\n".join(lines).rstrip() + "\n"
        except Exception as e:
            text = f"(Could not extract .docx text: {e})"
        b64 = base64.b64encode(raw).decode("ascii")
        return {
            "ok": True, "kind": "docx", "filename": filename, "body": text,
            "size_bytes": len(raw), "snapshot": True, "snapshot_at": snapshot_at,
            "sha256": snap.sha256,
            "data_url": f"data:application/vnd.openxmlformats-officedocument.wordprocessingml.document;base64,{b64}",
        }

    if kind == "pdf":
        b64 = base64.b64encode(raw).decode("ascii")
        return {
            "ok": True, "kind": "pdf", "filename": filename,
            "size_bytes": len(raw), "snapshot": True, "snapshot_at": snapshot_at,
            "sha256": snap.sha256,
            "data_url": f"data:application/pdf;base64,{b64}",
        }

    try:
        text = raw.decode("utf-8")
        return {
            "ok": True, "kind": "text", "filename": filename, "body": text,
            "size_bytes": len(raw), "snapshot": True, "snapshot_at": snapshot_at,
        }
    except Exception:
        return {"ok": False, "error": "Unsupported snapshot format"}


@router.post("/client-package/redownload/{delivery_id}")
async def client_package_redownload(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Rebuild and stream the ZIP for a past delivery using its stored
    company/contract/component context. Does NOT send email.
    """
    from fastapi import HTTPException
    from fastapi.responses import StreamingResponse

    delivery = (
        db.query(models.ClientPackageDelivery)
        .filter(
            models.ClientPackageDelivery.id == delivery_id,
            models.ClientPackageDelivery.user_id == current_user.id,
        )
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    pkg_body = _hydrate_request_from_delivery(delivery)
    zip_bytes, filename, _included, _skipped, _components = _build_client_package_zip(pkg_body, db, current_user)
    return StreamingResponse(
        io.BytesIO(zip_bytes),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.post("/client-package/redownload-original/{delivery_id}")
async def client_package_redownload_original(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Re-download the EXACT original package that was sent, assembled purely from
    the byte-identical component snapshots captured the day the delivery went
    out (`ClientPackageSnapshot.data`). Unlike `/redownload`, this performs NO
    live regeneration — every file is the precise bytes the client received, so
    it is safe for audit / legal recovery requests.

    Returns 404 if the delivery doesn't belong to the user, and a clear 409 when
    the delivery predates snapshot capture (older deliveries have no stored
    bytes to recover).
    """
    import io as _io
    from fastapi import HTTPException
    from fastapi.responses import StreamingResponse

    delivery = (
        db.query(models.ClientPackageDelivery)
        .filter(
            models.ClientPackageDelivery.id == delivery_id,
            models.ClientPackageDelivery.user_id == current_user.id,
        )
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    # The complete ZIP is stored verbatim under the sentinel component_id the day
    # the delivery went out. We stream those exact bytes back — no rebuild, no
    # re-zip — so the recovered archive is byte-for-byte what the client received.
    snap = (
        db.query(models.ClientPackageSnapshot)
        .filter(
            models.ClientPackageSnapshot.delivery_id == delivery_id,
            models.ClientPackageSnapshot.component_id == FULL_ZIP_COMPONENT_ID,
        )
        .order_by(models.ClientPackageSnapshot.id.desc())
        .first()
    )
    if not snap or not snap.data:
        raise HTTPException(
            status_code=409,
            detail="The exact original ZIP wasn't captured for this delivery — it "
                   "predates byte-identical archiving. Use Download to rebuild from "
                   "current data instead (note: rebuilt, not the original bytes).",
        )

    raw = bytes(snap.data)
    filename = snap.filename or f"kiq_original_{delivery_id}.zip"
    return StreamingResponse(
        _io.BytesIO(raw),
        media_type="application/zip",
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            # Stored digest from capture time — lets the caller confirm the
            # recovered bytes match what was originally sent (Hard Rule #03).
            "X-KIQ-SHA256": snap.sha256 or "",
        },
    )


@router.post("/client-package/resend/{delivery_id}")
async def client_package_resend(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Re-fire a past client-package email using the same recipients, cc,
    subject, company, contract, and component selection as the original
    delivery. A new ClientPackageDelivery row is written for the resend.
    """
    from fastapi import HTTPException

    delivery = (
        db.query(models.ClientPackageDelivery)
        .filter(
            models.ClientPackageDelivery.id == delivery_id,
            models.ClientPackageDelivery.user_id == current_user.id,
        )
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")

    def _decode_list(raw):
        try:
            v = json.loads(raw or "[]")
            return [str(x) for x in v] if isinstance(v, list) else []
        except Exception:
            return []

    recipients = _decode_list(delivery.recipients)
    if not recipients and delivery.recipient:
        recipients = [delivery.recipient]
    if not recipients:
        raise HTTPException(status_code=400, detail="Original delivery has no recipients")

    pkg_body = _hydrate_request_from_delivery(delivery)
    email_body = ClientPackageEmailRequest(
        **pkg_body.model_dump(),
        recipients=recipients,
        cc=_decode_list(delivery.cc),
        subject=delivery.subject,
        message=None,
    )
    return await client_package_email(email_body, db, current_user)


@router.post("/client-package/resend-diff/{delivery_id}")
async def client_package_resend_diff(
    delivery_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Re-fire a previously emailed executive-summary diff straight from the
    delivery log. Unlike packaged-ZIP rows, a diff row carries no components to
    rebuild — instead it stores the original markdown body, subject, recipients,
    and client/entity scoping. We reconstruct the original DiffLogRequest and
    push it back through the server-side `/client-package/log-diff` send path,
    which writes a fresh `source == 'diff'` audit row for the resend.
    """
    from fastapi import HTTPException

    delivery = (
        db.query(models.ClientPackageDelivery)
        .filter(
            models.ClientPackageDelivery.id == delivery_id,
            models.ClientPackageDelivery.user_id == current_user.id,
        )
        .first()
    )
    if not delivery:
        raise HTTPException(status_code=404, detail="Delivery not found")
    if delivery.source != "diff":
        raise HTTPException(
            status_code=400,
            detail="This delivery is not an emailed diff — use the standard resend instead",
        )

    def _decode_list(raw):
        try:
            v = json.loads(raw or "[]")
            return [str(x) for x in v] if isinstance(v, list) else []
        except Exception:
            return []

    recipients = _decode_list(delivery.recipients)
    if not recipients and delivery.recipient:
        recipients = [delivery.recipient]
    if not recipients:
        raise HTTPException(status_code=400, detail="Original diff has no recipients")

    if not (delivery.body_markdown or "").strip():
        raise HTTPException(
            status_code=400,
            detail="This diff predates body persistence and can't be resent — re-send it from the AI History panel",
        )

    # Re-derive the AI-history scoping fields the log-diff endpoint expects.
    # rx_defense_id rows came from the PBM Contract Clarity 360 tool; otherwise the entity is
    # an employer EIN. Passing tool/entity this way reproduces the original
    # ein / rx_defense_id mapping exactly.
    if delivery.rx_defense_id:
        tool = "rx_defense"
        entity_id = delivery.rx_defense_id
    else:
        tool = None
        entity_id = delivery.ein

    diff_body = DiffLogRequest(
        recipients=recipients,
        cc=_decode_list(delivery.cc),
        subject=delivery.subject,
        body_markdown=delivery.body_markdown,
        tool=tool,
        entity_id=entity_id,
        client_name=delivery.client_name,
        mode="send",
    )
    return await client_package_log_diff(diff_body, db, current_user)


@router.get("/client-package/history.csv")
def client_package_history_csv(
    ein: str | None = Query(None, description="Filter to deliveries for this employer EIN"),
    rx_defense_id: str | None = Query(None, description="Filter to deliveries for this PBM Contract Clarity 360 contract id"),
    q: str | None = Query(None, description="Substring match against recipient email (To/Cc) or subject"),
    source: str | None = Query(None, description="Filter by send origin: 'manual', 'scheduled', 'diff', 'download', or 'resend'"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Export the current user's client-package delivery history as CSV.

    Columns: timestamp, source, recipient, cc, subject, filename, size_bytes,
    component_count, ein, client_name, smtp_sent, rx_defense_id.

    Used by brokers and compliance reviewers to prove delivery cadence in
    audits and RFP responses without screenshots.
    """
    import csv as _csv
    from fastapi.responses import StreamingResponse

    base = (
        db.query(models.ClientPackageDelivery)
        .filter(models.ClientPackageDelivery.user_id == current_user.id)
    )
    if ein:
        base = base.filter(models.ClientPackageDelivery.ein == ein)
    if rx_defense_id:
        base = base.filter(models.ClientPackageDelivery.rx_defense_id == rx_defense_id)
    if q:
        from sqlalchemy import or_, func
        needle = f"%{q.strip().lower()}%"
        base = base.filter(or_(
            func.lower(func.coalesce(models.ClientPackageDelivery.recipient, "")).like(needle),
            func.lower(func.coalesce(models.ClientPackageDelivery.recipients, "")).like(needle),
            func.lower(func.coalesce(models.ClientPackageDelivery.cc, "")).like(needle),
            func.lower(func.coalesce(models.ClientPackageDelivery.subject, "")).like(needle),
        ))
    if source in ("manual", "scheduled", "diff", "download", "resend"):
        base = base.filter(models.ClientPackageDelivery.source == source)
    rows = base.order_by(models.ClientPackageDelivery.created_at.desc()).all()

    from backend.services.delivery_log_scheduler import (
        CSV_BCC_NOTE_ROW,
        CSV_HEADER,
        build_csv_data_row,
    )

    buf = io.StringIO()
    writer = _csv.writer(buf)
    writer.writerow(CSV_BCC_NOTE_ROW)
    writer.writerow(CSV_HEADER)
    for r in rows:
        writer.writerow(build_csv_data_row(r))

    from backend.services.delivery_log_scheduler import build_history_zip

    stamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    csv_name = f"client-package-deliveries-{stamp}.csv"
    zip_name = f"client-package-deliveries-{stamp}.zip"
    zip_bytes = build_history_zip(buf.getvalue().encode("utf-8"), csv_name)
    return StreamingResponse(
        iter([zip_bytes]),
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="{zip_name}"'},
    )


@router.get("/client-package/history")
def client_package_history(
    limit: int = Query(10, ge=1, le=500),
    offset: int = Query(0, ge=0, description="Skip this many rows for pagination (most-recent-first ordering)"),
    ein: str | None = Query(None, description="Filter to deliveries for this employer EIN"),
    rx_defense_id: str | None = Query(None, description="Filter to deliveries for this PBM Contract Clarity 360 contract id"),
    q: str | None = Query(None, description="Substring match against recipient email (To/Cc) or subject"),
    source: str | None = Query(None, description="Filter by send origin: 'manual', 'scheduled', 'diff', 'download', or 'resend'"),
    format: str | None = Query(None, description="For diff sends, narrow by attachment format: 'pdf' (polished PDF attachment) or 'text' (plain-text Markdown body)"),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Return the current user's recent client-package email deliveries (most recent first).

    Optional `ein` and `rx_defense_id` query params scope the history to a single
    company or contract, so brokers managing many clients can use the log as a
    real audit tool. Optional `q` performs a case-insensitive substring match
    against the recipient field (covers both the legacy single `recipient`
    column and the JSON-encoded `recipients` / `cc` arrays) and the subject.
    """
    query = (
        db.query(models.ClientPackageDelivery)
        .filter(models.ClientPackageDelivery.user_id == current_user.id)
    )
    if ein:
        query = query.filter(models.ClientPackageDelivery.ein == ein)
    if rx_defense_id:
        query = query.filter(models.ClientPackageDelivery.rx_defense_id == rx_defense_id)
    if q:
        from sqlalchemy import or_, func
        needle = f"%{q.strip().lower()}%"
        query = query.filter(or_(
            func.lower(func.coalesce(models.ClientPackageDelivery.recipient, "")).like(needle),
            func.lower(func.coalesce(models.ClientPackageDelivery.recipients, "")).like(needle),
            func.lower(func.coalesce(models.ClientPackageDelivery.cc, "")).like(needle),
            func.lower(func.coalesce(models.ClientPackageDelivery.subject, "")).like(needle),
        ))
    if source in ("manual", "scheduled", "diff", "download", "resend"):
        query = query.filter(models.ClientPackageDelivery.source == source)
    # Format sub-filter for diff sends. Mirrors the frontend per-row badge
    # signal: a delivery counts as "pdf" when any recorded component label
    # carries a "(pdf)" marker OR the filename ends in ".pdf"; everything else
    # is "text". Applied in SQL so pagination offsets and `total` stay correct.
    if format in ("pdf", "text"):
        from sqlalchemy import or_, not_, func
        pdf_signal = or_(
            func.lower(func.coalesce(models.ClientPackageDelivery.components, "")).like("%(pdf)%"),
            func.lower(func.coalesce(models.ClientPackageDelivery.filename, "")).like("%.pdf"),
        )
        query = query.filter(pdf_signal if format == "pdf" else not_(pdf_signal))
    total = query.count()
    rows = (
        query.order_by(models.ClientPackageDelivery.created_at.desc())
         .offset(offset)
         .limit(limit)
         .all()
    )

    def _decode(raw):
        if not raw:
            return []
        try:
            v = json.loads(raw)
            return v if isinstance(v, list) else []
        except Exception:
            return []

    # Which components have a stored point-in-time snapshot? One batched query
    # for the page's delivery ids, grouped into {delivery_id: [component_id, …]}.
    snap_map: dict[int, list[str]] = {}
    # Delivery ids that captured the complete sent ZIP verbatim (recoverable via
    # /redownload-original). Tracked apart from the per-component snapshot map.
    full_zip_ids: set[int] = set()
    row_ids = [r.id for r in rows]
    if row_ids:
        try:
            snap_rows = (
                db.query(
                    models.ClientPackageSnapshot.delivery_id,
                    models.ClientPackageSnapshot.component_id,
                )
                .filter(models.ClientPackageSnapshot.delivery_id.in_(row_ids))
                .all()
            )
            for did, cid in snap_rows:
                if cid == FULL_ZIP_COMPONENT_ID:
                    # Tracked separately as `original_available` — never surfaced
                    # as a per-component snapshot id.
                    full_zip_ids.add(did)
                    continue
                snap_map.setdefault(did, [])
                if cid and cid not in snap_map[did]:
                    snap_map[did].append(cid)
        except Exception as e:
            import logging as _logging
            _logging.getLogger(__name__).warning(f"[ClientPackageHistory] snapshot lookup failed: {e}")

    return {
        "total": total,
        "deliveries": [
            {
                "id":              r.id,
                "recipient":       r.recipient,
                "recipients":      _decode(r.recipients),
                "cc":              _decode(r.cc),
                "bcc_count":       int(r.bcc_count or 0),
                "subject":         r.subject,
                "filename":        r.filename,
                "size_bytes":      r.size_bytes,
                "components":      _decode(r.components),
                "component_count": r.component_count or len(_decode(r.components)),
                "ein":             r.ein,
                "rx_defense_id":   r.rx_defense_id,
                "client_name":     r.client_name,
                "smtp_sent":       bool(r.smtp_sent),
                "source":          getattr(r, "source", None) or "manual",
                "created_at":      r.created_at.isoformat() if r.created_at else None,
                "snapshot_available": bool(snap_map.get(r.id)),
                "snapshot_components": snap_map.get(r.id, []),
                # True when the exact ZIP-as-sent was captured and can be
                # recovered byte-for-byte via /redownload-original.
                "original_available": r.id in full_zip_ids,
                # Per-component snapshot availability — one entry per recorded
                # component label, normalized to its preview component_id, with a
                # boolean flag indicating whether a byte-identical snapshot was
                # captured for it the day this delivery was sent.
                "components_snapshot": [
                    {
                        "label": label,
                        "component_id": _component_id_for_label(label),
                        "snapshot_available": _component_id_for_label(label) in set(snap_map.get(r.id, [])),
                    }
                    for label in _decode(r.components)
                ],
                "snapshot_at":     r.created_at.isoformat() if (snap_map.get(r.id) and r.created_at) else None,
            }
            for r in rows
        ]
    }


# ─── Delivery-log auto-email schedule ─────────────────────────────────────────
#
# Compliance teams typically want a recurring weekly or monthly audit log of
# every client-package email a broker has sent. The broker opts in once, picks
# a cadence and recipients, and a background job (see
# `backend/services/delivery_log_scheduler.py`) re-runs the same CSV produced
# by `GET /api/export/client-package/history.csv` and emails it on schedule.

class DeliveryLogScheduleRequest(BaseModel):
    enabled:      bool = True
    frequency:    str = "weekly"          # 'weekly' | 'monthly'
    day_of_week:  Optional[int] = 0       # 0=Mon..6=Sun, weekly only
    day_of_month: Optional[int] = 1       # 1..28, monthly only
    hour_utc:     int = 13                # 0..23, interpreted in `timezone` (legacy field name)
    timezone:     str = "UTC"             # IANA zone, e.g. 'America/New_York'
    recipients:   list[str] = []
    cc:           list[str] = []
    subject:      Optional[str] = None


def _clean_email_list(raw: list[str]) -> list[str]:
    out: list[str] = []
    for v in raw or []:
        s = (v or "").strip()
        if "@" in s and s not in out:
            out.append(s)
    return out


def _resolve_tz(tz_name: Optional[str]):
    """Resolve an IANA zone name to a tzinfo, falling back to UTC."""
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    try:
        return ZoneInfo((tz_name or "UTC").strip() or "UTC")
    except (ZoneInfoNotFoundError, Exception):
        return ZoneInfo("UTC")


def _compute_next_run_at(
    frequency: str,
    day_of_week: Optional[int],
    day_of_month: Optional[int],
    hour_utc: int,
    after: Optional[datetime] = None,
    tz_name: Optional[str] = "UTC",
) -> datetime:
    """
    First UTC instant strictly after `after` that matches the schedule's local
    wall-clock time in `tz_name`. The `hour_utc` parameter name is retained for
    backwards compatibility but is treated as the local-time hour in `tz_name`.

    Returns a naive UTC datetime (matching the column's storage convention).
    DST shifts are handled automatically because we compute the candidate as a
    local-aware datetime in `tz_name`, then convert to UTC.
    """
    from datetime import timedelta
    tz = _resolve_tz(tz_name)
    now_utc = after or datetime.now(timezone.utc)
    if now_utc.tzinfo is None:
        now_utc = now_utc.replace(tzinfo=timezone.utc)
    now_local = now_utc.astimezone(tz)
    hour = max(0, min(23, int(hour_utc or 0)))
    base_local = now_local.replace(hour=hour, minute=0, second=0, microsecond=0)

    if frequency == "monthly":
        dom = max(1, min(28, int(day_of_month or 1)))
        candidate = base_local.replace(day=dom)
        if candidate <= now_local:
            month = candidate.month + 1
            year  = candidate.year + (1 if month > 12 else 0)
            month = 1 if month > 12 else month
            candidate = candidate.replace(year=year, month=month)
    else:
        # weekly (default)
        dow = max(0, min(6, int(day_of_week or 0)))
        # python: Monday=0 ... Sunday=6 — matches our convention
        days_ahead = (dow - base_local.weekday()) % 7
        candidate = base_local + timedelta(days=days_ahead)
        if candidate <= now_local:
            candidate = candidate + timedelta(days=7)

    return candidate.astimezone(timezone.utc).replace(tzinfo=None)


def _serialize_schedule(s: "models.ClientPackageDeliverySchedule | None") -> dict:
    if not s:
        return {"schedule": None}
    def _dec(raw):
        if not raw: return []
        try:
            v = json.loads(raw)
            return v if isinstance(v, list) else []
        except Exception:
            return []
    return {
        "schedule": {
            "id":             s.id,
            "enabled":        bool(s.enabled),
            "frequency":      s.frequency,
            "day_of_week":    s.day_of_week,
            "day_of_month":   s.day_of_month,
            "hour_utc":       s.hour_utc,
            "timezone":       getattr(s, "timezone", None) or "UTC",
            "recipients":     _dec(s.recipients),
            "cc":             _dec(s.cc),
            "subject":        s.subject,
            "last_run_at":    s.last_run_at.isoformat() if s.last_run_at else None,
            "last_status":    s.last_status,
            "last_error":     s.last_error,
            "last_row_count": s.last_row_count,
            "next_run_at":    s.next_run_at.isoformat() if s.next_run_at else None,
            "updated_at":     s.updated_at.isoformat() if s.updated_at else None,
        }
    }


@router.get("/client-package/schedule")
def get_delivery_log_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Current user's recurring delivery-log auto-email schedule (or null)."""
    row = (
        db.query(models.ClientPackageDeliverySchedule)
        .filter(models.ClientPackageDeliverySchedule.user_id == current_user.id)
        .first()
    )
    return _serialize_schedule(row)


@router.put("/client-package/schedule")
def upsert_delivery_log_schedule(
    body: DeliveryLogScheduleRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Create or update the recurring delivery-log email for the current user.
    A user has at most one schedule; sending PUT replaces it.
    """
    from fastapi import HTTPException

    freq = (body.frequency or "weekly").lower().strip()
    if freq not in ("weekly", "monthly"):
        raise HTTPException(status_code=422, detail="frequency must be 'weekly' or 'monthly'")

    recipients = _clean_email_list(body.recipients)
    # Only enforce the recipient requirement when the schedule is actually
    # going to fire. A user disabling/pausing the schedule may legitimately
    # clear recipients first.
    if body.enabled and not recipients:
        raise HTTPException(status_code=422, detail="At least one valid recipient email is required")
    cc = _clean_email_list(body.cc)

    hour = max(0, min(23, int(body.hour_utc if body.hour_utc is not None else 13)))
    dow  = max(0, min(6,  int(body.day_of_week  if body.day_of_week  is not None else 0)))
    dom  = max(1, min(28, int(body.day_of_month if body.day_of_month is not None else 1)))

    # Validate the IANA timezone (e.g. 'America/New_York'). Reject unknown
    # zones up-front so brokers don't silently end up scheduled in UTC.
    from zoneinfo import ZoneInfo, ZoneInfoNotFoundError
    tz_name = (body.timezone or "UTC").strip() or "UTC"
    try:
        ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(status_code=422, detail=f"Unknown timezone: {tz_name}")

    next_run = _compute_next_run_at(freq, dow, dom, hour, tz_name=tz_name) if body.enabled else None

    row = (
        db.query(models.ClientPackageDeliverySchedule)
        .filter(models.ClientPackageDeliverySchedule.user_id == current_user.id)
        .first()
    )
    if not row:
        row = models.ClientPackageDeliverySchedule(user_id=current_user.id)
        db.add(row)

    row.enabled      = bool(body.enabled)
    row.frequency    = freq
    row.day_of_week  = dow if freq == "weekly"  else None
    row.day_of_month = dom if freq == "monthly" else None
    row.hour_utc     = hour
    row.timezone     = tz_name
    row.recipients   = json.dumps(recipients)
    row.cc           = json.dumps(cc)
    row.subject      = (body.subject or "").strip() or None
    row.next_run_at  = next_run

    db.commit()
    db.refresh(row)
    return _serialize_schedule(row)


@router.delete("/client-package/schedule")
def delete_delivery_log_schedule(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Remove the current user's recurring delivery-log email."""
    row = (
        db.query(models.ClientPackageDeliverySchedule)
        .filter(models.ClientPackageDeliverySchedule.user_id == current_user.id)
        .first()
    )
    if row:
        db.delete(row)
        db.commit()
    return {"success": True}


@router.post("/client-package/schedule/run-now")
def run_delivery_log_schedule_now(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Fire the current user's delivery-log email immediately (manual test).
    Updates `last_run_at` / `last_status` but does NOT advance `next_run_at`.
    """
    from fastapi import HTTPException
    from backend.services.delivery_log_scheduler import send_delivery_log_email_for_user

    row = (
        db.query(models.ClientPackageDeliverySchedule)
        .filter(models.ClientPackageDeliverySchedule.user_id == current_user.id)
        .first()
    )
    if not row:
        raise HTTPException(status_code=404, detail="No schedule configured")

    result = send_delivery_log_email_for_user(db, current_user, row, advance_next_run=False)
    db.commit()
    db.refresh(row)
    return {**_serialize_schedule(row), "result": result}


# ─── Helpers ──────────────────────────────────────────────────────────────────

def _parse_ids(raw) -> list[str]:
    if not raw:
        return []
    if isinstance(raw, list):
        return raw
    try:
        return json.loads(raw)
    except Exception:
        return []


def _iso(dt) -> str | None:
    return dt.isoformat() if dt else None


def _export_gate(c: Claim) -> dict:
    """
    Derive the export gate result for a single claim.
    Returns a dict with allowed, gate (which rule blocked), and reason.
    """
    evidence_ids = _parse_ids(c.evidence_ids)

    # Gate 1: evidence_missing
    if not evidence_ids:
        return {
            "allowed": False,
            "gate": "evidence_missing",
            "reason": "evidence_missing — no evidence IDs attached; export requires provenance",
        }
    # Gate 2: policy_violation
    if c.verified_status == "DISPUTED":
        return {
            "allowed": False,
            "gate": "policy_violation",
            "reason": f"policy_violation — verified_status=DISPUTED; export requires VERIFIED",
        }
    if c.verified_status != "VERIFIED":
        return {
            "allowed": False,
            "gate": "policy_violation",
            "reason": f"policy_violation — verified_status={c.verified_status}; export requires VERIFIED",
        }
    if (c.confidence_score or 0.0) < CONFIDENCE_EXPORT_THRESHOLD:
        return {
            "allowed": False,
            "gate": "confidence_low",
            "reason": (
                f"confidence_low — {c.confidence_score:.0%} is below "
                f"export threshold ({CONFIDENCE_EXPORT_THRESHOLD:.0%})"
            ),
        }
    return {"allowed": True, "gate": None, "reason": None}


def _board_gate(c: Claim) -> dict:
    """Stricter board-grade export gate."""
    base = _export_gate(c)
    if not base["allowed"]:
        return base
    if c.freshness_status == "RED":
        return {
            "allowed": False,
            "gate": "freshness_bad",
            "reason": f"freshness_bad — freshness_status=RED; board export requires GREEN",
        }
    if (c.confidence_score or 0.0) < CONFIDENCE_BOARD_THRESHOLD:
        return {
            "allowed": False,
            "gate": "confidence_low",
            "reason": (
                f"confidence_low — {c.confidence_score:.0%} is below "
                f"board export threshold ({CONFIDENCE_BOARD_THRESHOLD:.0%})"
            ),
        }
    return {"allowed": True, "gate": None, "reason": None}


def _claim_to_export_payload(c: Claim, db: Session) -> dict:
    """Build the full exportable claim payload including resolved provenance."""
    evidence_ids  = _parse_ids(c.evidence_ids)
    transform_ids = _parse_ids(c.transform_ids)

    artifacts = (
        db.query(EvidenceArtifact)
          .filter(EvidenceArtifact.evidence_id.in_(evidence_ids))
          .all()
        if evidence_ids else []
    )
    transforms = (
        db.query(Transform)
          .filter(Transform.transform_id.in_(transform_ids))
          .all()
        if transform_ids else []
    )

    try:
        policy = eval_policy(c.verified_status, c.freshness_status, c.confidence_score or 0.0)
    except ValueError:
        policy = _blocked_policy()

    return {
        "claim": {
            "claimId":         c.claim_id,
            "kpiKey":          c.kpi_key,
            "title":           c.title,
            "value":           c.value,
            "unit":            c.unit,
            "format":          c.format,
            "period":          c.period,
            "verifiedStatus":  c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": c.confidence_score,
            "evidenceHash":    c.evidence_hash,
            "computedAt":      _iso(c.computed_at),
        },
        "evidence": [
            {
                "evidenceId":  a.evidence_id,
                "sourceType":  a.source_type,
                "sourceUri":   a.source_uri,
                "sourceHash":  a.source_hash,
                "description": a.description,
                "receivedAt":  _iso(a.received_at),
            }
            for a in artifacts
        ],
        "transforms": [
            {
                "transformId":  t.transform_id,
                "name":         t.name,
                "formula":      t.formula,
                "inputHashes":  _parse_ids(t.input_hashes),
                "outputKpiKey": t.output_kpi_key,
                "outputHash":   t.output_hash,
                "executedAt":   _iso(t.executed_at),
                "codeVersion":  t.code_version,
                "executor":     t.executor,
            }
            for t in transforms
        ],
        "boardGrade":      policy.board_grade,
        "exportAdmissible": policy.export_allowed,
    }


# ─── Pydantic input models ─────────────────────────────────────────────────────

class ExportCheckRequest(BaseModel):
    claim_ids: list[str]
    requester: str = "unknown"
    format: str = "json"


class ExportPackageRequest(BaseModel):
    claim_ids: list[str]
    requester: str = "unknown"
    format: str = "json"
    audience: str = "executive"


class BoardPackRequest(BaseModel):
    claim_ids: list[str] = []          # empty = auto-discover all board-grade claims
    requester: str = "system"
    pack_title: str = "Board Intelligence Pack"
    format: str = "json"


# ─── POST /api/export/check ────────────────────────────────────────────────────

@router.post("/check")
def export_check(body: ExportCheckRequest, db: Session = Depends(get_db)):
    """
    Gate-check a list of claims for export eligibility.
    Does NOT return claim data — only the gate decision.
    """
    now = datetime.now(timezone.utc).isoformat()
    results = []
    blocked_count = 0
    missing = []

    for cid in body.claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if not c:
            missing.append(cid)
            blocked_count += 1
            continue
        gate = _export_gate(c)
        if not gate["allowed"]:
            blocked_count += 1
        results.append({
            "claimId":         cid,
            "title":           c.title,
            "exportStatus":    "ALLOWED" if gate["allowed"] else "BLOCKED",
            "allowed":         gate["allowed"],
            "gate":            gate["gate"],
            "reason":          gate["reason"],
            "verifiedStatus":  c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": c.confidence_score,
        })

    overall_allowed = blocked_count == 0 and len(missing) == 0

    return {
        "allowed":       overall_allowed,
        "exportStatus":  "ALLOWED" if overall_allowed else "BLOCKED",
        "claimsChecked": len(results),
        "claimsBlocked": blocked_count,
        "claimsMissing": missing,
        "results":       results,
        "format":        body.format,
        "requester":     body.requester,
        "reason": (
            "All claims pass export policy" if overall_allowed
            else f"{blocked_count} claim(s) blocked; {len(missing)} not found"
        ),
        "evaluatedAt": now,
    }


# ─── POST /api/export/board-check ─────────────────────────────────────────────

@router.post("/board-check")
def board_export_check_endpoint(body: ExportCheckRequest, db: Session = Depends(get_db)):
    """
    Board-grade export gate. Stricter: requires VERIFIED + GREEN + ≥90% confidence.
    """
    now = datetime.now(timezone.utc).isoformat()
    results = []
    blocked_count = 0
    missing = []

    for cid in body.claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if not c:
            missing.append(cid)
            blocked_count += 1
            continue
        gate = _board_gate(c)
        if not gate["allowed"]:
            blocked_count += 1
        results.append({
            "claimId":         cid,
            "title":           c.title,
            "exportStatus":    "ALLOWED" if gate["allowed"] else "BLOCKED",
            "allowed":         gate["allowed"],
            "gate":            gate["gate"],
            "reason":          gate["reason"],
            "verifiedStatus":  c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": c.confidence_score,
        })

    overall_allowed = blocked_count == 0 and len(missing) == 0

    return {
        "allowed":       overall_allowed,
        "exportStatus":  "ALLOWED" if overall_allowed else "BLOCKED",
        "claimsChecked": len(results),
        "claimsBlocked": blocked_count,
        "claimsMissing": missing,
        "results":       results,
        "format":        body.format,
        "requester":     body.requester,
        "reason": (
            "All claims pass board export policy" if overall_allowed
            else f"{blocked_count} claim(s) blocked from board export"
        ),
        "evaluatedAt": now,
    }


# ─── GET /api/export/claim/{claim_id} ─────────────────────────────────────────

@router.get("/claim/{claim_id}")
def export_claim(
    claim_id: str,
    audience: str = Query("executive", enum=["executive", "board"]),
    db: Session = Depends(get_db),
):
    """
    Attempt to export a single claim.

    Blocked response: allowed=false, exportStatus=BLOCKED, no claim data.
    Allowed response: allowed=true, exportStatus=ALLOWED, full claim payload.
    """
    now = datetime.now(timezone.utc).isoformat()

    c = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not c:
        return {
            "allowed":      False,
            "exportStatus": "BLOCKED",
            "claimId":      claim_id,
            "gate":         "not_found",
            "reason":       f"Claim {claim_id} not found",
            "claim":        None,
            "evaluatedAt":  now,
        }

    gate = _board_gate(c) if audience == "board" else _export_gate(c)

    if not gate["allowed"]:
        return {
            "allowed":         False,
            "exportStatus":    "BLOCKED",
            "claimId":         claim_id,
            "gate":            gate["gate"],
            "reason":          gate["reason"],
            "audience":        audience,
            "verifiedStatus":  c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": c.confidence_score,
            "claim":           None,
            "evidence":        None,
            "transforms":      None,
            "evaluatedAt":     now,
        }

    payload = _claim_to_export_payload(c, db)
    return {
        "allowed":         True,
        "exportStatus":    "ALLOWED",
        "claimId":         claim_id,
        "gate":            None,
        "reason":          None,
        "audience":        audience,
        **payload,
        "exportedAt":      now,
    }


# ─── POST /api/export/package ─────────────────────────────────────────────────

@router.post("/package")
def export_package(body: ExportPackageRequest, db: Session = Depends(get_db)):
    """
    Attempt to export a set of claims as a package.

    If ANY claim fails the gate, the entire package is blocked.
    The blocking detail identifies each failing claim and which gate it hit.
    No claim data is included in a blocked response.
    """
    now = datetime.now(timezone.utc).isoformat()
    gate_fn = _board_gate if body.audience == "board" else _export_gate

    allowed_claims = []
    blocked_claims = []
    missing = []

    for cid in body.claim_ids:
        c = db.query(Claim).filter(Claim.claim_id == cid).first()
        if not c:
            missing.append(cid)
            blocked_claims.append({
                "claimId": cid,
                "gate": "not_found",
                "reason": f"Claim {cid} not found in database",
            })
            continue
        gate = gate_fn(c)
        entry = {
            "claimId":         c.claim_id,
            "title":           c.title,
            "gate":            gate["gate"],
            "reason":          gate["reason"],
            "verifiedStatus":  c.verified_status,
            "freshnessStatus": c.freshness_status,
            "confidenceScore": c.confidence_score,
        }
        if gate["allowed"]:
            allowed_claims.append(entry)
        else:
            blocked_claims.append(entry)

    package_allowed = len(blocked_claims) == 0

    base = {
        "allowed":       package_allowed,
        "exportStatus":  "ALLOWED" if package_allowed else "BLOCKED",
        "audience":      body.audience,
        "format":        body.format,
        "requester":     body.requester,
        "claimsRequested": len(body.claim_ids),
        "claimsAllowed": len(allowed_claims),
        "claimsBlocked": len(blocked_claims),
        "claimsMissing": missing,
        "blockedClaims": blocked_claims,
        "reason": (
            f"Package export allowed — {len(allowed_claims)} claim(s) pass policy"
            if package_allowed else
            f"Package blocked — {len(blocked_claims)} of {len(body.claim_ids)} claim(s) failed export gate"
        ),
        "evaluatedAt": now,
    }

    if package_allowed:
        # Resolve full payloads only when allowed — never for blocked packages
        payloads = []
        for cid in body.claim_ids:
            c = db.query(Claim).filter(Claim.claim_id == cid).first()
            if c:
                payloads.append(_claim_to_export_payload(c, db))  # noqa: keep indented block
        base["claims"] = payloads
    else:
        base["claims"] = None

    return base


# ─── POST /api/export/board-pack ──────────────────────────────────────────────

def _next_pack_id(db: Session) -> str:
    year = datetime.now().year
    count = db.query(DecisionReceipt).filter(
        DecisionReceipt.action == "BOARD_PACK_EXPORT"
    ).count()
    return f"BP-{year}-{count + 1:04d}"


@router.post("/board-pack", status_code=201)
def board_pack(body: BoardPackRequest, db: Session = Depends(get_db)):
    """
    Build a formal board intelligence pack.

    Behaviour:
      - If claim_ids is empty, auto-discovers ALL board-grade claims in the DB.
      - Applies the strictest board gate to every candidate claim.
      - Admits only passing claims; lists failing claims in blockedClaims.
      - Pack is BLOCKED only when zero claims are admitted.
      - Full payloads (claim + evidence + transforms) included for every admitted claim.
      - A DecisionReceipt (BP-YYYY-NNNN) is persisted for audit.
      - Pack manifest includes a SHA3-256 integrity hash over admitted claim evidence hashes.
    """
    now = datetime.now(timezone.utc).isoformat()
    pack_id = _next_pack_id(db)

    # ── 1. Resolve candidate claims ──────────────────────────────────────────
    if body.claim_ids:
        candidates = [
            db.query(Claim).filter(Claim.claim_id == cid).first()
            for cid in body.claim_ids
        ]
        missing_ids = [
            body.claim_ids[i]
            for i, c in enumerate(candidates) if c is None
        ]
        candidates = [c for c in candidates if c is not None]
    else:
        # Auto-discover: all VERIFIED + GREEN claims; board gate will filter further
        candidates = db.query(Claim).filter(
            Claim.verified_status == "VERIFIED",
            Claim.freshness_status == "GREEN",
        ).order_by(Claim.confidence_score.desc()).all()
        missing_ids = []

    # ── 2. Apply board gate to every candidate ───────────────────────────────
    admitted:  list[Claim] = []
    blocked_details: list[dict] = []

    for c in candidates:
        gate = _board_gate(c)
        if gate["allowed"]:
            admitted.append(c)
        else:
            blocked_details.append({
                "claimId":         c.claim_id,
                "kpiKey":          c.kpi_key,
                "title":           c.title,
                "gate":            gate["gate"],
                "reason":          gate["reason"],
                "verifiedStatus":  c.verified_status,
                "freshnessStatus": c.freshness_status,
                "confidenceScore": c.confidence_score,
            })

    pack_allowed = len(admitted) > 0

    # ── 3. Build full payloads for admitted claims ───────────────────────────
    claim_payloads: list[dict] | None = None
    if pack_allowed:
        claim_payloads = [_claim_to_export_payload(c, db) for c in admitted]

    # ── 4. Pack manifest + integrity hash ────────────────────────────────────
    admitted_ids = [c.claim_id for c in admitted]
    evidence_hashes = [c.evidence_hash or "" for c in admitted]
    pack_hash = hashlib.sha3_256(
        "|".join(sorted(evidence_hashes)).encode()
    ).hexdigest()[:16]

    manifest = {
        "packId":          pack_id,
        "claimIds":        admitted_ids,
        "totalAdmitted":   len(admitted),
        "totalBlocked":    len(blocked_details),
        "totalMissing":    len(missing_ids),
        "packHash":        pack_hash,
        "hashMethod":      "SHA3-256 over admitted evidence hashes (sorted, pipe-delimited, truncated 16 hex)",
        "generatedAt":     now,
    }

    # ── 5. Cover metadata ────────────────────────────────────────────────────
    cover = {
        "packId":      pack_id,
        "packTitle":   body.pack_title,
        "account":     "SHRACK-7742",
        "client":      "Jeremiah Shrack",
        "brokerage":   "Kincaid Health",
        "audience":    "BOARD",
        "requester":   body.requester,
        "format":      body.format,
        "generatedAt": now,
        "classification": "BOARD-CONFIDENTIAL",
        "notice": (
            "This pack contains fiduciary-grade intelligence. "
            "All claims have passed a 4-gate board-grade render pipeline. "
            "Redistribution outside the intended board audience is prohibited."
        ),
    }

    # ── 6. Persist DecisionReceipt for audit trail ───────────────────────────
    dr = create_receipt(
        db,
        action="BOARD_PACK_EXPORT",
        rationale=(
            f"Board pack '{body.pack_title}' — {len(admitted)} claim(s) admitted, "
            f"{len(blocked_details)} blocked, packHash={pack_hash}"
        ),
        claim_ids=admitted_ids,
        model_path="kincaid-iq/board-gate/v1",
        generated_by=body.requester,
    )

    return {
        "packId":            pack_id,
        "packTitle":         body.pack_title,
        "allowed":           pack_allowed,
        "exportStatus":      "ALLOWED" if pack_allowed else "BLOCKED",
        "audience":          "board",
        "claimsDiscovered":  len(candidates),
        "claimsAdmitted":    len(admitted),
        "claimsBlocked":     len(blocked_details),
        "claimsMissing":     missing_ids,
        "cover":             cover,
        "claims":            claim_payloads,
        "blockedClaims":     blocked_details,
        "manifest":          manifest,
        "decisionReceiptId": dr.receipt_id,
        "reason": (
            f"{len(admitted)} board-grade claim(s) admitted to pack"
            if pack_allowed else
            "Board pack blocked — no claims passed the board-grade gate"
        ),
        "generatedAt": now,
    }
