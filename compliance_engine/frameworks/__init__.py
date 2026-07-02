from compliance_engine.frameworks.soc2 import SOC2_CONTROLS
from compliance_engine.frameworks.iso27001 import ISO27001_CONTROLS
from compliance_engine.frameworks.nist_csf import NIST_CSF_CONTROLS
from compliance_engine.frameworks.hipaa import HIPAA_CONTROLS
from compliance_engine.frameworks.pci_dss import PCI_DSS_CONTROLS

FRAMEWORK_REGISTRY = {
    "soc2":     {"label": "SOC 2 Type II",           "controls": SOC2_CONTROLS},
    "iso27001": {"label": "ISO 27001:2022",           "controls": ISO27001_CONTROLS},
    "nist_csf": {"label": "NIST CSF 2.0",             "controls": NIST_CSF_CONTROLS},
    "hipaa":    {"label": "HIPAA Security Rule",      "controls": HIPAA_CONTROLS},
    "pci_dss":  {"label": "PCI DSS v4.0",             "controls": PCI_DSS_CONTROLS},
}

def get_framework(key: str):
    return FRAMEWORK_REGISTRY.get(key)

def list_frameworks():
    return [
        {"id": k, "label": v["label"], "control_count": len(v["controls"])}
        for k, v in FRAMEWORK_REGISTRY.items()
    ]
