"""
Generic document upload endpoint — used by multiple Kincaid IQ pages
to accept PDF, DOCX, TXT, CSV, and XLSX uploads and extract text content.
"""

import io
import csv
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from typing import Optional

from backend import models
from backend.auth import get_current_user

logger = logging.getLogger("kincaid.documents")

router = APIRouter(prefix="/api/documents", tags=["documents"])

ALLOWED_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
    "text/plain",
    "text/csv",
    "application/csv",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/octet-stream",
}

MAX_BYTES = 100 * 1024 * 1024  # 20 MB


def _extract_pdf(data: bytes) -> str:
    try:
        import pypdf
        reader = pypdf.PdfReader(io.BytesIO(data))
        pages = [p.extract_text() or "" for p in reader.pages]
        return "\n\n".join(pages)
    except Exception as e:
        logger.warning(f"PDF extraction failed: {e}")
        return ""


def _extract_docx(data: bytes) -> str:
    try:
        import docx
        doc = docx.Document(io.BytesIO(data))
        return "\n".join(p.text for p in doc.paragraphs if p.text.strip())
    except Exception as e:
        logger.warning(f"DOCX extraction failed: {e}")
        return ""


def _extract_csv(data: bytes) -> str:
    try:
        text = data.decode("utf-8", errors="ignore")
        reader = csv.reader(io.StringIO(text))
        rows = list(reader)
        if not rows:
            return text
        lines = [", ".join(row) for row in rows[:200]]
        return "\n".join(lines)
    except Exception as e:
        logger.warning(f"CSV extraction failed: {e}")
        return data.decode("utf-8", errors="ignore")


def _extract_xlsx(data: bytes) -> str:
    try:
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
        parts = []
        for sheet in wb.worksheets:
            parts.append(f"Sheet: {sheet.title}")
            rows_seen = 0
            for row in sheet.iter_rows(values_only=True):
                cells = [str(c) if c is not None else "" for c in row]
                if any(cells):
                    parts.append(", ".join(cells))
                rows_seen += 1
                if rows_seen >= 200:
                    parts.append("… (truncated at 200 rows)")
                    break
        return "\n".join(parts)
    except Exception as e:
        logger.warning(f"XLSX extraction failed: {e}")
        return ""


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    context: Optional[str] = Form(None),
    user: models.User = Depends(get_current_user),
):
    """
    Upload a document and extract its text. Returns extracted text and metadata.
    Used by McKinsey Co-Pilot, SBI Forensic, Actuarial Engine, etc.
    """
    filename = file.filename or "document"
    content_type = file.content_type or "application/octet-stream"

    data = await file.read()
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="File exceeds 100 MB limit")

    name_lower = filename.lower()
    if name_lower.endswith(".pdf"):
        text = _extract_pdf(data)
        doc_type = "pdf"
    elif name_lower.endswith(".docx"):
        text = _extract_docx(data)
        doc_type = "docx"
    elif name_lower.endswith(".doc"):
        text = _extract_docx(data)
        doc_type = "doc"
    elif name_lower.endswith(".csv"):
        text = _extract_csv(data)
        doc_type = "csv"
    elif name_lower.endswith((".xlsx", ".xls")):
        text = _extract_xlsx(data)
        doc_type = "xlsx"
    elif name_lower.endswith(".txt"):
        text = data.decode("utf-8", errors="ignore")
        doc_type = "txt"
    else:
        text = data.decode("utf-8", errors="ignore")
        doc_type = "txt"

    char_count = len(text)
    preview = text[:500].strip() if text else ""

    if not text.strip():
        raise HTTPException(
            status_code=422,
            detail="Could not extract text from this file. For scanned PDFs, please use a text-based PDF or copy-paste the content into a .txt file.",
        )

    return {
        "filename": filename,
        "doc_type": doc_type,
        "file_size_bytes": len(data),
        "char_count": char_count,
        "preview": preview,
        "text": text[:80000],
        "context": context,
    }
