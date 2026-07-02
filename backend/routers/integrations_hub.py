from fastapi import APIRouter
from typing import Optional
import random, datetime

router = APIRouter(prefix="/api/integrations", tags=["integrations-hub"])

# ── INTEGRATION REGISTRY ──────────────────────────────────────────────────────
INTEGRATIONS = [
    # Payroll & HR
    {"slug":"adp","name":"ADP Workforce Now","category":"Payroll & HR","tier":1,"status":"connected",
     "description":"Census data, headcount verification, payroll deductions, benefit eligibility cross-reference"},
    {"slug":"paychex","name":"Paychex Flex","category":"Payroll & HR","tier":1,"status":"available",
     "description":"Payroll registers, W-2 benefit values, benefit cost allocation, SMB payroll audit"},
    {"slug":"gusto","name":"Gusto","category":"Payroll & HR","tier":1,"status":"available",
     "description":"SMB payroll platform, benefits deductions, headcount trends, open enrollment sync"},
    {"slug":"paylocity","name":"Paylocity","category":"Payroll & HR","tier":2,"status":"available",
     "description":"Mid-market payroll, benefits module, employee self-service enrollment data"},
    {"slug":"ukg","name":"UKG (Kronos)","category":"Payroll & HR","tier":2,"status":"available",
     "description":"Workforce management, overtime & FTE tracking, manufacturing/shift benefit cost analysis"},
    {"slug":"bamboohr","name":"BambooHR","category":"Payroll & HR","tier":2,"status":"available",
     "description":"Org chart, headcount trends, turnover impact on benefit costs, professional services HR"},
    {"slug":"workday","name":"Workday HCM","category":"Payroll & HR","tier":3,"status":"available",
     "description":"Enterprise HRIS, compensation bands, benefit plan governance, workforce planning"},
    # Benefits Administration
    {"slug":"employee_navigator","name":"Employee Navigator","category":"Benefits Admin","tier":1,"status":"connected",
     "description":"Enrollment data, open enrollment calendar, plan elections, dependent verification"},
    {"slug":"anthem","name":"Anthem BCBS Indiana","category":"Benefits Admin","tier":2,"status":"available",
     "description":"Utilization rates, claims-to-premium ratio, renewal projections, Indiana carrier intel"},
    {"slug":"availity","name":"Availity","category":"Benefits Admin","tier":2,"status":"available",
     "description":"Claims clearinghouse, real-time eligibility verification, claims status monitoring"},
    # CRM & Pipeline
    {"slug":"salesforce","name":"Salesforce","category":"CRM & Pipeline","tier":1,"status":"available",
     "description":"Push KincaidCommit gate completions, BOR status, prospect scores into pipeline"},
    {"slug":"hubspot","name":"HubSpot CRM","category":"CRM & Pipeline","tier":1,"status":"connected",
     "description":"Deal stages, email sequences, prospect engagement scoring, renewal window alerts"},
    # Financial & ERP
    {"slug":"netsuite","name":"NetSuite ERP","category":"Financial & ERP","tier":2,"status":"available",
     "description":"GL benefit accounts, vendor spend analysis, hidden fee detection, mid-market ERP audit"},
    # Documents & Signing
    {"slug":"docusign","name":"DocuSign","category":"Documents & E-Sign","tier":2,"status":"connected",
     "description":"BOR execution, plan change authorization, engagement letters — auto-triggered at KincaidCommit Gate 6"},
    # Enterprise HR
    {"slug":"sap_sf","name":"SAP SuccessFactors","category":"Enterprise HR","tier":3,"status":"available",
     "description":"Large enterprise HR (Eli Lilly, Cummins), benefits governance, workforce intelligence"},
    # Communications
    {"slug":"slack","name":"Slack","category":"Alerts & Comms","tier":2,"status":"connected",
     "description":"KincaidCommit gate alerts, DOL anomaly notifications, renewal window pings to broker channels"},
    {"slug":"teams","name":"Microsoft Teams","category":"Alerts & Comms","tier":2,"status":"available",
     "description":"Teams channel alerts for renewal windows, prospect score changes, DOL filing updates"},
]

# ── DEMO DATA PER INTEGRATION ─────────────────────────────────────────────────
DEMO_DATA = {
    "adp": {
        "tenant": "Horizon Bancorp, Inc.",
        "connected_at": "2025-01-15T09:00:00Z",
        "summary": {"total_employees": 911, "benefit_eligible": 878, "enrolled": 833,
                     "participation_rate": 94.9, "dol_reported": 855, "discrepancy": -22},
        "departments": [
            {"name":"Retail Banking","headcount":312,"eligible":299,"enrolled":287},
            {"name":"Commercial Banking","headcount":198,"eligible":195,"enrolled":190},
            {"name":"Operations","headcount":187,"eligible":180,"enrolled":168},
            {"name":"IT & Technology","headcount":98,"eligible":98,"enrolled":95},
            {"name":"Finance & Risk","headcount":76,"eligible":76,"enrolled":74},
            {"name":"HR & Admin","headcount":40,"eligible":40,"enrolled":19},
        ],
        "flags": [
            {"flag":"HEADCOUNT_DISCREPANCY","detail":"ADP shows 911 employees vs DOL 5500 reported 855 — 56 person gap may indicate unreported benefit eligibles","severity":"high"},
            {"flag":"LOW_HR_ENROLLMENT","detail":"HR & Admin dept only 47.5% enrolled — possible benefits communication gap","severity":"medium"},
            {"flag":"DEDUCTION_ANOMALY","detail":"3 employees show $0 payroll deduction but are flagged enrolled in medical plan","severity":"high"},
        ],
        "deduction_summary": {"medical":1284.50,"dental":89.20,"vision":24.15,"ltd":98.40,"life":44.80,"total":1541.05},
    },
    "employee_navigator": {
        "tenant": "Horizon Bancorp, Inc.",
        "connected_at": "2025-01-20T09:00:00Z",
        "enrollment": {"open_enrollment_start":"2025-10-01","open_enrollment_end":"2025-10-31",
                        "status":"UPCOMING","days_until": 183,
                        "last_year_participation": 94.9, "plan_changes_pending": 12},
        "plans": [
            {"plan":"Medical - PPO High","enrolled":412,"tier":"employee_only","monthly_ee":287.50,"monthly_er":1140.00},
            {"plan":"Medical - PPO Low","enrolled":201,"tier":"employee_only","monthly_ee":187.50,"monthly_er":940.00},
            {"plan":"Medical - HSA","enrolled":124,"tier":"employee_only","monthly_ee":142.00,"monthly_er":780.00},
            {"plan":"Dental","enrolled":766,"tier":"employee_only","monthly_ee":18.50,"monthly_er":28.00},
            {"plan":"Vision","enrolled":701,"tier":"employee_only","monthly_ee":6.25,"monthly_er":8.50},
            {"plan":"LTD","enrolled":833,"tier":"employee","monthly_ee":0,"monthly_er":108.20},
            {"plan":"Life - 1x Salary","enrolled":833,"tier":"employee","monthly_ee":0,"monthly_er":44.80},
        ],
        "flags": [
            {"flag":"RENEWAL_APPROACHING","detail":"Open enrollment opens in 183 days — KincaidCommit Gate 4 window is NOW","severity":"high"},
            {"flag":"NO_STOP_LOSS","detail":"No stop-loss plan found in Employee Navigator — confirms DOL 5500 gap","severity":"critical"},
            {"flag":"PENDING_LIFE_EVENTS","detail":"12 qualifying life events pending review — may affect plan participation counts","severity":"medium"},
        ],
    },
    "hubspot": {
        "connected_at": "2025-02-01T09:00:00Z",
        "pipeline": [
            {"name":"Horizon Bancorp","stage":"Gate 4 - Engaged","score":84,"value":183280,"next_action":"Present SL gap proposal","due":"2025-06-15"},
            {"name":"Irving Materials Inc","stage":"Gate 2 - Diagnosed","score":79,"value":145000,"next_action":"Schedule forensic audit review","due":"2025-06-20"},
            {"name":"Aisin Holdings America","stage":"Gate 1 - Identified","score":91,"value":267000,"next_action":"Cold opener — DOL 5500 data ready","due":"2025-06-10"},
            {"name":"Zimmer Biomet Holdings","stage":"Gate 3 - Qualified","score":76,"value":112000,"next_action":"Qualification call — 8,104 covered lives","due":"2025-06-25"},
            {"name":"Methodist Hospitals Gary","stage":"Gate 2 - Diagnosed","score":82,"value":198000,"next_action":"Broker spike documentation","due":"2025-07-01"},
        ],
        "summary": {"total_pipeline": 905280,"gates_1_3": 3,"gates_4_7": 2,"avg_score":82.4,"projected_close_90d": 274640},
    },
    "docusign": {
        "connected_at": "2025-03-10T09:00:00Z",
        "templates": [
            {"id":"t001","name":"BOR Authorization — Standard","status":"active","uses":47},
            {"id":"t002","name":"BOR Authorization — With Stop-Loss","status":"active","uses":12},
            {"id":"t003","name":"Initial Engagement Letter","status":"active","uses":89},
            {"id":"t004","name":"Plan Audit Authorization","status":"active","uses":8},
            {"id":"t005","name":"Rx Defense Engagement","status":"active","uses":6},
        ],
        "recent": [
            {"id":"e001","signer":"Diane Garwood — Horizon Bancorp","template":"BOR Authorization — Standard","sent":"2025-05-20","status":"PENDING","due":"2025-06-03"},
            {"id":"e002","signer":"Mark Secor — Irving Materials","template":"Initial Engagement Letter","sent":"2025-05-18","status":"COMPLETED","signed":"2025-05-19"},
            {"id":"e003","signer":"CFO — Aisin Holdings","template":"Plan Audit Authorization","sent":"2025-05-15","status":"DECLINED","reason":"Needs legal review"},
        ],
        "stats": {"sent_30d": 14, "completed_30d": 9, "pending": 3, "avg_turnaround_hrs": 18.4},
    },
    "slack": {
        "connected_at": "2025-02-15T09:00:00Z",
        "channels": [
            {"name":"#kincaid-alerts","purpose":"DOL anomalies and critical flags","members":3,"active":True},
            {"name":"#renewal-windows","purpose":"Upcoming renewal and OE notifications","members":5,"active":True},
            {"name":"#commit-pipeline","purpose":"KincaidCommit gate completions","members":3,"active":True},
            {"name":"#broker-intel","purpose":"Shady broker spotlights and DOL news","members":7,"active":True},
        ],
        "recent_alerts": [
            {"channel":"#kincaid-alerts","message":"CRITICAL: Horizon Bancorp LTD broker spike +76% detected in 2022 DOL filing","time":"2 hours ago","emoji":"🚨"},
            {"channel":"#renewal-windows","message":"Horizon Bancorp open enrollment opens in 183 days — Gate 4 window open","time":"1 day ago","emoji":"📅"},
            {"channel":"#commit-pipeline","message":"Irving Materials Inc advanced to Gate 2 — DOL diagnosis complete","time":"3 days ago","emoji":"⚡"},
        ],
    },
    "anthem": {
        "portal": "Anthem BCBS Indiana Employer Portal",
        "group_id": "DEMO-IN-2025-HORIZ",
        "status": "NOT CONNECTED",
        "preview": {
            "utilization_2024": {"medical_pmpm":387.40,"rx_pmpm":142.60,"dental_pmpm":28.90,"vision_pmpm":9.80,"total_pmpm":568.70},
            "claims_ratio": 0.847,
            "renewal_projection": "+8.2%",
            "large_claims_over_100k": 4,
            "stop_loss_trigger_events": 0,
            "top_dx_categories": ["Musculoskeletal (22%)","Cardiovascular (18%)","Mental Health (14%)","Oncology (9%)","Diabetes (8%)"],
        },
    },
    "salesforce": {
        "status": "NOT CONNECTED",
        "preview": {
            "kincaid_objects": ["KincaidProspect__c","KincaidCommitGate__c","DOLIntelligence__c","BrokerAlert__c"],
            "sample_prospect": {"name":"Aisin Holdings","score":91,"gates_complete":1,"next_action":"Cold opener","annual_value":267000},
            "sync_frequency": "Real-time on gate completion",
        },
    },
    "paychex": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana SMBs 50-500 employees",
            "data_available": ["Payroll register","W-2 box 12 codes","Benefit deduction register","FMLA tracking","401k match rates"],
            "kincaid_use_case": "Cross-reference Paychex payroll deductions vs DOL 5500 admin fees to detect undisclosed broker compensation",
        },
    },
    "gusto": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana SMBs under 200 employees",
            "data_available": ["Employee census","Benefits enrollment","Payroll deductions","Open enrollment status"],
            "kincaid_use_case": "Auto-populate prospect census for commission modeling and eligibility cross-reference",
        },
    },
    "ukg": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana manufacturers 500-10,000 employees",
            "data_available": ["Workforce scheduling","FTE vs part-time split","Overtime hours","Shift differential data","ACA eligibility tracking"],
            "kincaid_use_case": "Identify manufacturing clients where overtime-driven headcount changes create ACA/benefit eligibility gaps",
        },
    },
    "paylocity": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana mid-market 200-1,500 employees",
            "data_available": ["Payroll registers","Benefits deductions","Employee self-service data","Open enrollment analytics"],
            "kincaid_use_case": "Detect benefit cost allocation discrepancies and unreported deductions vs carrier invoices",
        },
    },
    "bamboohr": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Professional services, tech, healthcare admin",
            "data_available": ["Org chart","Turnover data","Headcount trends","Compensation data","Benefit elections"],
            "kincaid_use_case": "Turnover rate above 20% triggers stop-loss re-underwriting opportunity and plan design review",
        },
    },
    "workday": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana enterprises 1,000+ employees",
            "data_available": ["HRIS full census","Compensation bands","Benefit governance","Workforce planning","Job classifications"],
            "kincaid_use_case": "Enterprise-grade census for stop-loss underwriting, salary-based life insurance audits, ACA affordability analysis",
        },
    },
    "availity": {
        "status": "NOT CONNECTED",
        "preview": {
            "capability": "Real-time HIPAA eligibility (270/271), claims status (276/277), remittance (835)",
            "kincaid_use_case": "Flag enrolled-but-not-utilizing members, verify eligibility before BOR submission, detect ghost enrollees",
            "carrier_connections": ["Anthem BCBS IN","Cigna","Aetna","UnitedHealth","Sun Life","LINA","MetLife","Guardian"],
        },
    },
    "netsuite": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana companies $25M-$500M revenue on NetSuite ERP",
            "gl_accounts": ["6200 - Employee Benefits","6210 - Medical/Dental","6220 - Life/LTD","6230 - Admin Fees","6240 - Broker Commissions"],
            "kincaid_use_case": "GL-level broker commission account reconciliation — catches fees routed as 'admin' or 'consulting' to obscure broker comp",
        },
    },
    "sap_sf": {
        "status": "NOT CONNECTED",
        "preview": {
            "target_clients": "Indiana Fortune 500 / large employers (Eli Lilly, Cummins, Zimmer Biomet)",
            "modules": ["Employee Central","Benefits","Compensation","Workforce Analytics","Succession Planning"],
            "kincaid_use_case": "Enterprise benefit governance audit — compensation-based life insurance, executive carve-outs, NQDC plan overlaps",
        },
    },
    "teams": {
        "status": "NOT CONNECTED",
        "preview": {
            "channels": ["#KincaidAlerts","#RenewalWindows","#CommitPipeline"],
            "alert_types": ["DOL 5500 anomaly detected","Renewal window opening","KincaidCommit gate completed","Shady broker spotlight"],
            "kincaid_use_case": "Real-time Teams notifications for brokers already in the Microsoft 365 ecosystem (covered by M365 integration)",
        },
    },
}

@router.get("/list")
def list_integrations(category: Optional[str] = None):
    items = INTEGRATIONS
    if category and category != "All":
        items = [i for i in items if i["category"] == category]
    return {"integrations": items, "total": len(items),
            "connected": sum(1 for i in INTEGRATIONS if i["status"] == "connected"),
            "categories": list(dict.fromkeys(i["category"] for i in INTEGRATIONS))}

@router.get("/{slug}/data")
def get_integration_data(slug: str):
    item = next((i for i in INTEGRATIONS if i["slug"] == slug), None)
    if not item:
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "Integration not found"}, status_code=404)
    data = DEMO_DATA.get(slug, {"status": "Preview data available after connection"})
    return {"integration": item, "data": data, "demo_mode": True}

@router.post("/{slug}/connect")
def connect_integration(slug: str):
    item = next((i for i in INTEGRATIONS if i["slug"] == slug), None)
    if not item:
        from fastapi.responses import JSONResponse
        return JSONResponse({"error": "Not found"}, status_code=404)
    item["status"] = "connected"
    return {"success": True, "slug": slug, "connected_at": datetime.datetime.utcnow().isoformat()+"Z", "demo_mode": True}

@router.post("/{slug}/disconnect")
def disconnect_integration(slug: str):
    item = next((i for i in INTEGRATIONS if i["slug"] == slug), None)
    if item: item["status"] = "available"
    return {"success": True, "slug": slug}
