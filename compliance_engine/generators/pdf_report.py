"""ReportLab-based compliance PDF report generator."""
import io
from datetime import datetime
from typing import Dict, Any

try:
    from reportlab.lib.pagesizes import letter, A4
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
        HRFlowable, PageBreak,
    )
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False


STATUS_COLORS = {
    "pass":         colors.HexColor("#10b981"),
    "fail":         colors.HexColor("#ef4444"),
    "compensating": colors.HexColor("#f59e0b"),
    "not_tested":   colors.HexColor("#6b7280"),
    "na":           colors.HexColor("#3b82f6"),
}

SEVERITY_COLORS = {
    "high":   colors.HexColor("#ef4444"),
    "medium": colors.HexColor("#f59e0b"),
    "low":    colors.HexColor("#10b981"),
}

KINCAID_NAVY = colors.HexColor("#0f2d5e")
KINCAID_GOLD = colors.HexColor("#c8a850")


def generate_audit_pdf(
    audit: Dict[str, Any],
    controls: list,
    findings: list,
    org_name: str = "Kincaid IQ",
) -> bytes:
    if not REPORTLAB_OK:
        raise RuntimeError("ReportLab not installed")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=0.75 * inch, rightMargin=0.75 * inch,
        topMargin=0.75 * inch, bottomMargin=0.75 * inch,
    )
    styles = getSampleStyleSheet()

    title_style = ParagraphStyle("Title", parent=styles["Heading1"],
                                 fontSize=22, textColor=KINCAID_NAVY,
                                 spaceAfter=4, alignment=TA_CENTER)
    subtitle_style = ParagraphStyle("Subtitle", parent=styles["Normal"],
                                    fontSize=11, textColor=KINCAID_GOLD,
                                    spaceAfter=2, alignment=TA_CENTER)
    h2_style = ParagraphStyle("H2", parent=styles["Heading2"],
                              fontSize=14, textColor=KINCAID_NAVY, spaceBefore=16, spaceAfter=6)
    body_style = styles["Normal"]
    small_style = ParagraphStyle("Small", parent=styles["Normal"], fontSize=8)

    elements = []
    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph(org_name, title_style))
    fw_label = audit.get("framework", "").upper()
    elements.append(Paragraph(f"Compliance Audit Report — {fw_label}", subtitle_style))
    elements.append(Paragraph(f"Generated: {datetime.utcnow().strftime('%B %d, %Y at %H:%M UTC')}", subtitle_style))
    elements.append(Spacer(1, 0.3 * inch))
    elements.append(HRFlowable(width="100%", thickness=2, color=KINCAID_NAVY))
    elements.append(Spacer(1, 0.2 * inch))

    # Summary box
    total = audit.get("total_controls", 0)
    passed = audit.get("passed", 0)
    failed = audit.get("failed", 0)
    not_tested = audit.get("not_tested", 0)
    score = audit.get("score_pct") or 0.0
    summary_data = [
        ["Audit Name", audit.get("name", "N/A")],
        ["Framework", fw_label],
        ["Auditor", audit.get("auditor", "N/A")],
        ["Status", audit.get("status", "N/A").upper()],
        ["Total Controls", str(total)],
        ["Passed", str(passed)],
        ["Failed", str(failed)],
        ["Not Tested", str(not_tested)],
        ["Score", f"{score:.1f}%"],
        ["Date Started", str(audit.get("started_at", "N/A"))[:10]],
    ]
    summary_table = Table(summary_data, colWidths=[2.5 * inch, 4.5 * inch])
    summary_table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f4ff")),
        ("FONTNAME", (0, 0), (0, -1), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.HexColor("#d1d5db")),
        ("ROWBACKGROUNDS", (0, 0), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("TEXTCOLOR", (0, 0), (0, -1), KINCAID_NAVY),
        ("PADDING", (0, 0), (-1, -1), 6),
    ]))
    elements.append(summary_table)
    elements.append(Spacer(1, 0.3 * inch))

    # Controls table
    elements.append(Paragraph("Control Results", h2_style))
    ctrl_headers = ["Control ID", "Title", "Risk", "Result", "Notes"]
    ctrl_rows = [ctrl_headers]
    for c in controls:
        result_val = c.get("result", "not_tested")
        ctrl_rows.append([
            c.get("control_ref", "—"),
            Paragraph(c.get("control_title", "")[:80], small_style),
            c.get("risk_level", "medium").upper(),
            result_val.upper().replace("_", " "),
            Paragraph((c.get("notes") or "")[:100], small_style),
        ])
    ctrl_table = Table(ctrl_rows, colWidths=[1.1 * inch, 2.8 * inch, 0.8 * inch, 1.0 * inch, 1.8 * inch])
    ctrl_style = TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), KINCAID_NAVY),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#e5e7eb")),
        ("ROWBACKGROUNDS", (1, 0), (-1, -1), [colors.white, colors.HexColor("#f9fafb")]),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("PADDING", (0, 0), (-1, -1), 5),
    ])
    for i, c in enumerate(controls, start=1):
        result_val = c.get("result", "not_tested")
        clr = STATUS_COLORS.get(result_val, colors.HexColor("#6b7280"))
        ctrl_style.add("TEXTCOLOR", (3, i), (3, i), clr)
        ctrl_style.add("FONTNAME", (3, i), (3, i), "Helvetica-Bold")
    ctrl_table.setStyle(ctrl_style)
    elements.append(ctrl_table)
    elements.append(Spacer(1, 0.3 * inch))

    # Findings
    if findings:
        elements.append(PageBreak())
        elements.append(Paragraph("Findings & Observations", h2_style))
        for f in findings:
            sev = f.get("severity", "medium")
            sev_color = SEVERITY_COLORS.get(sev, colors.HexColor("#6b7280"))
            elements.append(Paragraph(
                f'<font color="#{sev_color.hexval()[2:]}"><b>[{sev.upper()}]</b></font>  {f.get("title", "")}',
                body_style,
            ))
            elements.append(Paragraph(f'<b>Description:</b> {f.get("description", "")}', small_style))
            if f.get("remediation"):
                elements.append(Paragraph(f'<b>Remediation:</b> {f["remediation"]}', small_style))
            if f.get("due_date"):
                elements.append(Paragraph(f'<b>Due Date:</b> {f["due_date"]}', small_style))
            elements.append(Spacer(1, 0.15 * inch))

    elements.append(HRFlowable(width="100%", thickness=1, color=KINCAID_NAVY))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(Paragraph(
        f"Kincaid IQ Compliance Engine · Confidential · {datetime.utcnow().strftime('%Y')}",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7,
                       textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER),
    ))

    doc.build(elements)
    buf.seek(0)
    return buf.read()
