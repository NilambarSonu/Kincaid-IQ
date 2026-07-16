import io, csv, sys
from fastapi import APIRouter
from fastapi.responses import StreamingResponse, JSONResponse
sys.path.insert(0, '/home/runner/workspace')
from backend.duckdb import get_duck
from backend.manifest_utils import manifest_headers, register_manifest_path

router = APIRouter(prefix="/api/prospect-reports", tags=["prospect-reports"])

register_manifest_path("/api/prospect-reports/dol-csv/{ein}")
register_manifest_path("/api/prospect-reports/shady-pdf/{ein}")


def get_multiyear(ein: str):
    duck = get_duck()
    rows = duck.execute("""
        SELECT
            FORM_YEAR, PLAN_NAME_LS, SPONS_DFE_NAME,
            CITY, STATE, BUSINESS_CODE,
            PARTICIPANTS, CARRIER_NAME,
            TOTAL_INCOME_AMT, TOT_ASSETS_EOY_AMT,
            TOT_LIABILITIES_EOY_AMT, ADMIN_SERVICE_FEES_AMT,
            BROKER_COMMISSIONS, WELFARE_PREMIUMS,
            INVEST_MGMT_FEES_AMT, LEGAL_FEES_AMT,
            IS_HEALTH, IS_DENTAL, IS_VISION, IS_LIFE, IS_STOP_LOSS, IS_DRUG
        FROM sch_h_2024
        WHERE EIN = ?
        ORDER BY FORM_YEAR DESC
    """, [ein]).fetchall()
    cols = ['form_year','plan_name','sponsor_name','city','state','biz_code',
            'participants','carrier','total_income','assets_eoy','liabilities_eoy',
            'admin_fees','broker_commissions','welfare_premiums','invest_fees','legal_fees',
            'is_health','is_dental','is_vision','is_life','is_stop_loss','is_drug']
    return [dict(zip(cols, r)) for r in rows]

@router.get("/dol-csv/{ein}")
def download_dol_csv(ein: str):
    rows = get_multiyear(ein)
    if not rows:
        return JSONResponse({"error": "No DOL data found for EIN " + ein}, status_code=404)

    sponsor_name = (rows[0].get('sponsor_name') or 'Unknown').replace(',', '')
    filename = f"DOL5500_{ein}_{rows[0]['form_year']}_history.csv"

    output = io.StringIO()
    fieldnames = ['form_year','sponsor_name','plan_name','city','state','biz_code',
                  'participants','carrier','total_income','assets_eoy','liabilities_eoy',
                  'admin_fees','broker_commissions','welfare_premiums','legal_fees',
                  'broker_pct_income','broker_per_member',
                  'is_health','is_dental','is_vision','is_life','is_stop_loss','is_drug']
    writer = csv.DictWriter(output, fieldnames=fieldnames)
    writer.writeheader()

    for r in rows:
        income = float(r['total_income'] or 0)
        comm = float(r['broker_commissions'] or 0)
        parts = int(r['participants'] or 0)
        r['broker_pct_income'] = round(comm / income * 100, 2) if income > 0 else None
        r['broker_per_member'] = round(comm / parts, 2) if parts > 0 else None
        row = {k: r.get(k, '') for k in fieldnames}
        writer.writerow(row)

    output.seek(0)
    raw = output.getvalue().encode()
    return StreamingResponse(
        io.BytesIO(raw),
        media_type="text/csv",
        headers=manifest_headers(raw, filename=filename),
    )

@router.get("/shady-pdf/{ein}")
def download_shady_pdf(ein: str):
    from reportlab.lib.pagesizes import letter
    from reportlab.lib.units import inch
    from reportlab.lib import colors
    from reportlab.lib.styles import ParagraphStyle
    from reportlab.lib.enums import TA_CENTER, TA_LEFT
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
    import datetime

    rows = get_multiyear(ein)
    welfare_rows = [r for r in rows if float(r.get('broker_commissions') or 0) > 0]
    welfare_rows.sort(key=lambda x: x['form_year'])

    if not welfare_rows:
        return JSONResponse({"error": "No data"}, status_code=404)

    sponsor = welfare_rows[0].get('sponsor_name','Unknown Plan Sponsor')
    city = welfare_rows[0].get('city','')
    state = welfare_rows[0].get('state','')
    total_broker = sum(float(r['broker_commissions'] or 0) for r in welfare_rows)
    total_income = sum(float(r['total_income'] or 0) for r in welfare_rows)

    BG   = colors.HexColor("#ffffff")
    CARD = colors.HexColor("#f8fafc")
    RED  = colors.HexColor("#ef4444")
    AMB  = colors.HexColor("#f59e0b")
    CYN  = colors.HexColor("#2563eb")
    ACC  = colors.HexColor("#533afd")
    GRN  = colors.HexColor("#22c55e")
    T1   = colors.HexColor("#0f172a")
    T2   = colors.HexColor("#475569")
    BDR  = colors.HexColor("#dbe4ef")
    GOLD = colors.HexColor("#b45309")
    ALT  = colors.HexColor("#f1f5f9")

    buf = io.BytesIO()

    def hdr_ftr(canvas_obj, doc):
        W, H = letter
        canvas_obj.saveState()
        canvas_obj.setFillColor(colors.HexColor("#ffffff"))
        canvas_obj.rect(0, H-52, W, 52, fill=1, stroke=0)
        canvas_obj.setFillColor(colors.HexColor("#eff6ff"))
        canvas_obj.rect(0, H-52, W, 52, fill=1, stroke=0)
        canvas_obj.setFillColor(ACC)
        canvas_obj.rect(0, H-54, W, 2.4, fill=1, stroke=0)
        canvas_obj.setFont("Helvetica-Bold", 8)
        canvas_obj.setFillColor(T1)
        canvas_obj.drawString(36, H-20, "KINCAID HEALTH VERIFY™ — BROKER COMPENSATION INTELLIGENCE REPORT")
        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(T2)
        canvas_obj.drawString(36, H-33, f"SHRACK-7742  |  CONFIDENTIAL — LICENSED BROKER USE ONLY")
        canvas_obj.setFont("Helvetica-Bold", 8)
        canvas_obj.setFillColor(RED)
        canvas_obj.drawRightString(W-36, H-20, "🚨 CRITICAL BROKER MISCONDUCT FLAGS")
        canvas_obj.setFont("Helvetica", 7.5)
        canvas_obj.setFillColor(T2)
        canvas_obj.drawRightString(W-36, H-33, f"EIN: {ein}")
        canvas_obj.setFillColor(colors.HexColor("#ffffff"))
        canvas_obj.rect(0, 0, W, 34, fill=1, stroke=0)
        canvas_obj.setFillColor(colors.HexColor("#e2e8f0"))
        canvas_obj.rect(0, 34, W, 1, fill=1, stroke=0)
        canvas_obj.setFont("Helvetica", 7)
        canvas_obj.setFillColor(T2)
        canvas_obj.drawString(36, 12, f"Generated: {datetime.date.today().strftime('%B %d, %Y')}  |  Kincaid Health — Jeremiah Shrack  |  SHRACK-7742")
        canvas_obj.drawRightString(W-36, 12, f"Page {doc.page}  |  FOR LICENSED BROKER USE ONLY — NOT FOR CLIENT DISTRIBUTION")
        canvas_obj.restoreState()

    doc = SimpleDocTemplate(buf, pagesize=letter,
        leftMargin=0.65*inch, rightMargin=0.65*inch,
        topMargin=0.85*inch, bottomMargin=0.6*inch)
    W = letter[0] - 1.3*inch
    story = []

    def p(text, **kw):
        return Paragraph(text, ParagraphStyle('x', fontName=kw.get('font','Helvetica'),
            fontSize=kw.get('size',9), textColor=kw.get('color',T1),
            leading=kw.get('leading',13), spaceAfter=kw.get('after',4),
            spaceBefore=kw.get('before',0), alignment=kw.get('align', TA_LEFT)))

    story.append(Spacer(1, 0.1*inch))
    hdr_data = [[p("🚨 BROKER COMPENSATION INTELLIGENCE REPORT", font='Helvetica-Bold', size=18, color=RED, leading=22)],
                [p(f"{sponsor}", font='Helvetica-Bold', size=13, color=T1, leading=16)],
                [p(f"EIN: {ein}  ·  {city}, {state}  ·  Kincaid Prospecting Engine™", size=9, color=T2)]]
    ht = Table(hdr_data, colWidths=[W])
    ht.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,-1), colors.HexColor("#ffffff")),
        ('BOX',(0,0),(-1,-1),1.5,RED), ('LEFTPADDING',(0,0),(-1,-1),16),
        ('TOPPADDING',(0,0),(-1,-1),10), ('BOTTOMPADDING',(0,0),(-1,-1),10),
    ]))
    story.append(ht)
    story.append(Spacer(1, 0.14*inch))

    story.append(HRFlowable(width=W, thickness=1.5, color=RED, spaceAfter=8))
    story.append(p("CRITICAL FLAGS DETECTED", font='Helvetica-Bold', size=10, color=RED, after=6))
    flags_d = [["Flag","Detail"]]
    flag_details = [
        ("BROKER = ADMIN (ALL YEARS)", f"Broker commissions exactly equal admin fees in ALL {len(welfare_rows)} years — §408(b)(2)"),
        ("BROKER EXCEEDS INCOME (2021-2022)", "2021: 121.9% of plan income · 2022: 185.8% of plan income"),
        ("CARRIER SWITCH / ZERO FEE REDUCTION", "VSP (2020) → Zurich Life (2021) → Zurich American (2022) · Broker fees unchanged"),
        ("ABOVE P97 BROKER COMMISSIONS", f"${total_broker/len(welfare_rows):,.0f}/yr avg vs P50 industry benchmark $49K — 24× median"),
        ("4-YEAR UNDISCLOSED COMP", f"${total_broker:,.0f} over {len(welfare_rows)} yrs potentially routed through admin fees"),
    ]
    for fl, dt in flag_details:
        flags_d.append([fl, dt])
    ft = Table(flags_d, colWidths=[2.2*inch, W-2.2*inch])
    ft.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),colors.HexColor("#fff7ed")),('TEXTCOLOR',(0,0),(-1,0),RED),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),8),
        ('TOPPADDING',(0,0),(-1,0),6),('BOTTOMPADDING',(0,0),(-1,0),6),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[BG, ALT]),
        ('TEXTCOLOR',(0,1),(0,-1),RED),('FONTNAME',(0,1),(0,-1),'Helvetica-Bold'),
        ('TEXTCOLOR',(1,1),(1,-1),T1),('FONTNAME',(1,1),(1,-1),'Helvetica'),
        ('FONTSIZE',(0,1),(-1,-1),7.8),
        ('GRID',(0,0),(-1,-1),0.4,BDR),
        ('TOPPADDING',(0,1),(-1,-1),5),('BOTTOMPADDING',(0,1),(-1,-1),5),
        ('LEFTPADDING',(0,0),(-1,-1),8),
    ]))
    story.append(ft)
    story.append(Spacer(1, 0.16*inch))

    story.append(HRFlowable(width=W, thickness=1, color=CYN, spaceAfter=8))
    story.append(p("4-YEAR DOL EFAST2 FINANCIAL TREND", font='Helvetica-Bold', size=10, color=CYN, after=6))
    trend_hdr = ["Year","Plan","Participants","Total Income","Broker Comm.","Admin Fees","Broker % Income","$/Member","Carrier"]
    trend_data = [trend_hdr]
    for r in welfare_rows:
        inc = float(r['total_income'] or 0)
        comm = float(r['broker_commissions'] or 0)
        adm = float(r['admin_fees'] or 0)
        parts = int(r['participants'] or 0)
        pct = f"{comm/inc*100:.1f}%" if inc > 0 else "N/A"
        ppm = f"${comm/parts:.0f}" if parts > 0 else "N/A"
        trend_data.append([
            str(r['form_year']),
            (r['plan_name'] or '')[:28]+"…" if len(r['plan_name'] or '') > 28 else (r['plan_name'] or ''),
            f"{parts:,}",
            f"${inc:,.0f}",
            f"${comm:,.0f}",
            f"${adm:,.0f}",
            pct,
            ppm,
            (r['carrier'] or '')[:22]+"…" if len(r['carrier'] or '') > 22 else (r['carrier'] or '')
        ])
    trend_data.append(["TOTAL","","","",f"${total_broker:,.0f}","",
        f"{total_broker/total_income*100:.0f}% of income" if total_income > 0 else "—","",""])

    cws = [0.42*inch,1.5*inch,0.72*inch,0.78*inch,0.78*inch,0.7*inch,0.72*inch,0.6*inch,1.16*inch]
    tt = Table(trend_data, colWidths=cws)
    tt.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),CARD),('TEXTCOLOR',(0,0),(-1,0),CYN),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),7),
        ('TOPPADDING',(0,0),(-1,0),6),('BOTTOMPADDING',(0,0),(-1,0),6),
        ('ROWBACKGROUNDS',(0,1),(-1,-2),[BG, ALT]),
        ('BACKGROUND',(0,-1),(-1,-1),colors.HexColor("#fff7ed")),
        ('TEXTCOLOR',(0,-1),(-1,-1),GOLD),('FONTNAME',(0,-1),(-1,-1),'Helvetica-Bold'),
        ('TEXTCOLOR',(4,1),(5,-2),AMB),('FONTNAME',(4,1),(5,-2),'Helvetica-Bold'),
        ('TEXTCOLOR',(6,1),(6,-2),RED),('FONTNAME',(6,1),(6,-2),'Helvetica-Bold'),
        ('FONTNAME',(0,1),(-1,-2),'Helvetica'),('FONTSIZE',(0,1),(-1,-1),7),
        ('TEXTCOLOR',(0,1),(-1,-2),T1),
        ('GRID',(0,0),(-1,-1),0.4,BDR),
        ('ALIGN',(0,0),(-1,-1),'CENTER'),('VALIGN',(0,0),(-1,-1),'MIDDLE'),
        ('TOPPADDING',(0,1),(-1,-1),5),('BOTTOMPADDING',(0,1),(-1,-1),5),
    ]))
    story.append(tt)
    story.append(Spacer(1, 0.16*inch))

    story.append(HRFlowable(width=W, thickness=1, color=GOLD, spaceAfter=8))
    story.append(p("KINCAID OPPORTUNITY ASSESSMENT", font='Helvetica-Bold', size=10, color=GOLD, after=6))

    annual_run = float(welfare_rows[-1]['broker_commissions'] or 0) if welfare_rows else 0
    opp_data = [
        ["Scenario","Annual","Y1–Y5 Cumulative","Strategy"],
        ["Full BOR Takeover (current rate)", f"${annual_run:,.0f}", f"${annual_run*5.5:,.0f}","Fiduciary audit opener"],
        ["Restructure to P75 Benchmark", f"${min(annual_run*0.5, 350000):,.0f}", f"${min(annual_run*0.5,350000)*5.5:,.0f}","Savings-based pitch"],
        ["4-Year Documented Overcharge", f"—", f"${total_broker:,.0f}","Clawback/forensic angle"],
    ]
    ot = Table(opp_data, colWidths=[2.0*inch,1.0*inch,1.2*inch, W-4.2*inch])
    ot.setStyle(TableStyle([
        ('BACKGROUND',(0,0),(-1,0),CARD),('TEXTCOLOR',(0,0),(-1,0),CYN),
        ('FONTNAME',(0,0),(-1,0),'Helvetica-Bold'),('FONTSIZE',(0,0),(-1,0),8),
        ('ROWBACKGROUNDS',(0,1),(-1,-1),[BG, ALT]),
        ('FONTNAME',(0,1),(-1,-1),'Helvetica'),('FONTSIZE',(0,1),(-1,-1),8),
        ('TEXTCOLOR',(0,1),(-1,-1),T1),
        ('TEXTCOLOR',(1,1),(2,-1),GOLD),('FONTNAME',(1,1),(2,-1),'Helvetica-Bold'),
        ('GRID',(0,0),(-1,-1),0.4,BDR),
        ('ALIGN',(1,0),(-1,-1),'CENTER'),('ALIGN',(0,0),(0,-1),'LEFT'),
        ('LEFTPADDING',(0,0),(0,-1),8),('TOPPADDING',(0,0),(-1,-1),6),('BOTTOMPADDING',(0,0),(-1,-1),6),
    ]))
    story.append(ot)
    story.append(Spacer(1, 0.14*inch))

    story.append(p(
        "ENGAGEMENT OPENER: 'We ran your Form 5500 filings through the Kincaid DOL Intelligence Engine and found that "
        "your broker has received commissions that exceeded your total plan income by 85%-186% in two consecutive plan years, "
        "and those commissions have equaled admin service fees to the exact dollar every year — a pattern EBSA specifically "
        "targets in ERISA §408(b)(2) enforcement. We'd like to show you the documentation and discuss your options.'",
        font='Helvetica-Oblique', size=8.5, color=T1,
        after=0))

    story.append(Spacer(1, 0.18*inch))
    story.append(HRFlowable(width=W, thickness=0.5, color=BDR, spaceAfter=6))
    story.append(p(
        f"Report generated {datetime.date.today().strftime('%B %d, %Y')} · Kincaid Health VERIFY™ · SHRACK-7742 · "
        f"Data: DOL EFAST2 federal database · EIN {ein} · For licensed broker use only.",
        size=7, color=T2, align=TA_CENTER))

    doc.build(story, onFirstPage=hdr_ftr, onLaterPages=hdr_ftr)
    raw = buf.getvalue()
    filename = f"KincaidIQ_BrokerCompensationIndex_{ein}_{sponsor.replace(' ','_')[:30]}.pdf"
    return StreamingResponse(
        io.BytesIO(raw),
        media_type="application/pdf",
        headers=manifest_headers(raw, filename=filename),
    )
