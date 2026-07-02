"""
Kincaid IQ — Agent 1: Ingestion Layer
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Normalizes raw enterprise documents (bytes OR string) into structured intelligence objects.

Interface:
    agent = IngestionAgent()
    result = await agent.process(raw_data, mode)

process() accepts:
    raw_data : bytes | str — raw document content (file bytes or decoded text)
    mode     : str         — analysis mode (pbm_contract | prior_auth | pe_diligence | claims | erisa_filing)

Returns:
    {
        "text":      str,        # decoded document text
        "mode":      str,        # echo of input mode
        "structured": True,      # always True on success
        ... full Agent 1 output: document_type, entities, clauses,
            financial_fields, policy_rules, document_summary,
            key_dates, ingestion_confidence
    }
"""
from .base import BaseAgent, run_agent

SYSTEM = """You are the Kincaid IQ Ingestion Agent — Layer 1 of a 5-agent fiduciary intelligence pipeline.

ROLE: Normalize raw enterprise documents into structured intelligence objects.

INPUT: Raw document text (PBM contract, PA denial log, SEC/ERISA filing, diligence document, claims data, or unstructured input).

OUTPUT — Return ONLY valid JSON matching this EXACT schema:
{
  "document_type": "PBM_contract | PA_record | filing | diligence | claims | general",
  "entities": [{"name": "", "type": "company|provider|drug|regulator|plan|person", "role": ""}],
  "clauses": [{"id": "", "text": "", "risk_flag": true, "clause_type": "", "financial_implication": ""}],
  "financial_fields": [{"field": "", "value": "", "unit": "USD|%|days|units|PMPM"}],
  "policy_rules": [{"rule": "", "condition": "", "consequence": "", "regulatory_basis": ""}],
  "document_summary": "",
  "key_dates": [],
  "ingestion_confidence": "HIGH|MEDIUM|LOW",
  "system_frame": ""
}

RULES:
- Extract ALL named entities — companies, drugs, plan sponsors, PBMs, regulators, individuals
- Flag ANY clause with fiduciary, financial, or compliance implications as risk_flag: true
- Convert all financial values to structured form with explicit units
- Map every policy rule to a regulatory basis where identifiable (ERISA §, ACA §, 29 U.S.C. §, etc.)
- document_summary: 2-3 sentences, executive-level, no fluff. Model → Diagnose, not explain.
- system_frame: Apply the council's System Definition lens — identify actors, inputs, incentives, and structural constraints in 1-2 sentences. Who profits from this structure and why?
- Return ONLY JSON — no preamble, no markdown fences, nothing outside the JSON object"""


class IngestionAgent(BaseAgent):
    """
    Agent 1 — Ingestion Layer.
    Normalizes raw enterprise inputs to structured objects.

    Usage:
        agent  = IngestionAgent()
        result = await agent.process(raw_data, mode)
    """
    label = "Ingestion"

    async def process(self, raw_data: bytes | str, mode: str = "pbm_contract") -> dict:
        """
        Primary entry point — matches the reference implementation interface.

        Args:
            raw_data: bytes (from UploadFile.read()) or str (decoded text)
            mode:     analysis mode string

        Returns:
            dict with {text, mode, structured, document_type, entities, clauses,
                       financial_fields, policy_rules, document_summary, key_dates,
                       ingestion_confidence}
        """
        # Decode bytes → text
        if isinstance(raw_data, bytes):
            try:
                text = raw_data.decode("utf-8")
            except UnicodeDecodeError:
                text = raw_data.decode("latin-1", errors="replace")
        else:
            text = raw_data

        self._log("Processing %d chars (mode=%s)", len(text), mode)

        user_msg = f"MODE: {mode}\n\nNormalize this enterprise input:\n\n{text}"
        result = await run_agent(SYSTEM, user_msg, self.label)

        # Inject reference-impl compatibility fields
        result.setdefault("text",       text)
        result.setdefault("mode",       mode)
        result.setdefault("structured", "error" not in result)

        return result
