"""Generates a compliance certification letter PDF using ReportLab."""
import io
from datetime import datetime
from typing import Dict, Any

try:
    from reportlab.lib.pagesizes import letter
    from reportlab.lib import colors
    from reportlab.lib.units import inch
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, HRFlowable
    from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_JUSTIFY
    REPORTLAB_OK = True
except ImportError:
    REPORTLAB_OK = False

KINCAID_NAVY = colors.HexColor("#0f2d5e")
KINCAID_GOLD = colors.HexColor("#c8a850")

FRAMEWORK_FULL_NAMES = {
    "soc2":     "SOC 2 Type II (Trust Services Criteria)",
    "iso27001": "ISO/IEC 27001:2022 (Information Security Management)",
    "nist_csf": "NIST Cybersecurity Framework 2.0",
    "hipaa":    "HIPAA Security Rule (45 CFR Part 164)",
    "pci_dss":  "PCI DSS v4.0 (Payment Card Industry Data Security Standard)",
}


def generate_certification_letter(
    audit: Dict[str, Any],
    org_name: str = "Kincaid IQ",
    signatory_name: str = "Kincaid IQ Compliance Team",
    signatory_title: str = "Chief Compliance Officer",
) -> bytes:
    if not REPORTLAB_OK:
        raise RuntimeError("ReportLab not installed")

    buf = io.BytesIO()
    doc = SimpleDocTemplate(
        buf, pagesize=letter,
        leftMargin=1.25 * inch, rightMargin=1.25 * inch,
        topMargin=1.0 * inch, bottomMargin=1.0 * inch,
    )
    styles = getSampleStyleSheet()

    letterhead_style = ParagraphStyle("LH", parent=styles["Heading1"],
                                      fontSize=20, textColor=KINCAID_NAVY,
                                      alignment=TA_CENTER, spaceAfter=2)
    tagline_style = ParagraphStyle("TL", parent=styles["Normal"],
                                   fontSize=10, textColor=KINCAID_GOLD,
                                   alignment=TA_CENTER, spaceAfter=10)
    date_style = ParagraphStyle("Date", parent=styles["Normal"],
                                fontSize=11, alignment=TA_LEFT, spaceAfter=20, spaceBefore=10)
    subject_style = ParagraphStyle("Subj", parent=styles["Heading2"],
                                   fontSize=13, textColor=KINCAID_NAVY, spaceAfter=12)
    body_style = ParagraphStyle("Body", parent=styles["Normal"],
                                fontSize=11, leading=18, spaceAfter=14, alignment=TA_JUSTIFY)
    sign_style = ParagraphStyle("Sign", parent=styles["Normal"],
                                fontSize=11, spaceAfter=4)

    fw_key = audit.get("framework", "")
    fw_full = FRAMEWORK_FULL_NAMES.get(fw_key, fw_key.upper())
    score = audit.get("score_pct") or 0.0
    date_str = datetime.utcnow().strftime("%B %d, %Y")
    year = datetime.utcnow().strftime("%Y")
    passed = audit.get("passed", 0)
    total = audit.get("total_controls", 0)
    status = "PASSED" if score >= 80 and audit.get("failed", 0) == 0 else "REVIEWED"

    elements = []
    elements.append(Paragraph(org_name, letterhead_style))
    elements.append(Paragraph("Private Banking & Healthcare Fiduciary Intelligence Platform", tagline_style))
    elements.append(HRFlowable(width="100%", thickness=2, color=KINCAID_NAVY))
    elements.append(Spacer(1, 0.3 * inch))

    elements.append(Paragraph(date_str, date_style))
    elements.append(Paragraph(
        f"SUBJECT: Compliance Audit Certification — {fw_full}",
        subject_style,
    ))

    elements.append(Paragraph(
        f"This letter certifies that <b>{org_name}</b> has completed a formal compliance audit "
        f"against the <b>{fw_full}</b> framework.",
        body_style,
    ))
    elements.append(Paragraph(
        f"The audit, titled <b>{audit.get('name', 'Compliance Audit')}</b>, was conducted by "
        f"<b>{audit.get('auditor', signatory_name)}</b>. A total of <b>{total}</b> controls were "
        f"evaluated, of which <b>{passed}</b> were confirmed as passing. The overall compliance "
        f"score achieved is <b>{score:.1f}%</b>.",
        body_style,
    ))

    if status == "PASSED":
        elements.append(Paragraph(
            f"Based on the results of this audit, {org_name} is hereby certified as having demonstrated "
            f"substantial compliance with the {fw_full} requirements as of {date_str}. "
            f"This certification is valid for a period of twelve (12) months from the date of this letter, "
            f"subject to continuous monitoring and any material changes in the control environment.",
            body_style,
        ))
    else:
        elements.append(Paragraph(
            f"The audit identified areas requiring remediation. {org_name} is committed to resolving "
            f"all outstanding findings and achieving full compliance. A remediation plan has been "
            f"established and progress will be tracked through the Kincaid IQ Compliance Engine.",
            body_style,
        ))

    elements.append(Paragraph(
        "This certification is based solely on the evidence reviewed during the audit engagement "
        "and does not constitute a third-party audit opinion. For regulatory submissions, "
        "an independent qualified assessor certification may be required.",
        ParagraphStyle("Disclaimer", parent=styles["Normal"],
                       fontSize=9, textColor=colors.HexColor("#6b7280"),
                       spaceAfter=20, alignment=TA_JUSTIFY),
    ))

    elements.append(Spacer(1, 0.5 * inch))
    elements.append(Paragraph("Respectfully,", sign_style))
    elements.append(Spacer(1, 0.4 * inch))
    elements.append(Paragraph(f"<b>{signatory_name}</b>", sign_style))
    elements.append(Paragraph(signatory_title, sign_style))
    elements.append(Paragraph(org_name, sign_style))
    elements.append(Spacer(1, 0.1 * inch))
    elements.append(HRFlowable(width="100%", thickness=1, color=KINCAID_NAVY))
    elements.append(Paragraph(
        f"Kincaid IQ Compliance Engine · Confidential · {year} · Document Reference: CERT-{audit.get('id', '000')}-{fw_key.upper()}",
        ParagraphStyle("Footer", parent=styles["Normal"], fontSize=7,
                       textColor=colors.HexColor("#9ca3af"), alignment=TA_CENTER),
    ))

    doc.build(elements)
    buf.seek(0)
    return buf.read()
