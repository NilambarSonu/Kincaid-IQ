import os
import uuid
import asyncio
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import FileResponse as FastFileResponse
from sqlalchemy.orm import Session
from typing import Optional
from backend.database import get_db
from backend import models
from backend.auth import get_current_user
from backend.config import settings
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from backend.anthropic_compat import AsyncAnthropic

openai_client = AsyncOpenAI(api_key=settings.openai_api_key, base_url=settings.openai_base_url)
anthropic_client = AsyncAnthropic(api_key=settings.openai_api_key, base_url=settings.openai_base_url)

TAX_SYSTEM_PROMPT = """You are a senior fiduciary tax advisor at Kincaid Health, specializing in UHNW individual, trust, and family office tax matters. You are analyzing a client's tax return document.

Provide a structured analysis covering:
1. **Key Figures** — AGI, total tax, effective rate, taxable income
2. **Income Sources** — Ordinary income, capital gains (short/long), qualified dividends, partnership/trust K-1 income, passive income
3. **Deductions & Credits** — Material itemized deductions, charitable contributions, state/local taxes, investment interest
4. **Tax Planning Opportunities** — Loss harvesting potential, estimated tax payment optimization, Roth conversion windows, charitable giving timing, trust income shifting
5. **Risk Flags** — AMT exposure, underpayment penalties, wash sale issues, passive activity limitations, NIIT exposure
6. **Estate & Entity Considerations** — Trust distributions, grantor trust income, entity-level elections
7. **Action Items** — Specific recommendations for this client's situation

Format your response with clear headers and bullet points. Be specific, actionable, and fiduciary-grade."""


def extract_text_from_file(file_path: str, file_type: str, original_filename: str) -> str:
    """Extract readable text from the uploaded file."""
    try:
        if file_type and "pdf" in file_type.lower() or original_filename.lower().endswith(".pdf"):
            from pypdf import PdfReader
            reader = PdfReader(file_path)
            text_parts = []
            for page_num, page in enumerate(reader.pages):
                page_text = page.extract_text()
                if page_text:
                    text_parts.append(f"--- Page {page_num + 1} ---\n{page_text}")
            return "\n\n".join(text_parts) if text_parts else ""
        elif file_type and "text" in file_type.lower() or original_filename.lower().endswith((".txt", ".csv")):
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                return f.read()
        else:
            return ""
    except Exception as e:
        return ""

router = APIRouter(prefix="/api/vault", tags=["vault"])

from backend.manifest_utils import register_manifest_path as _reg_manifest_path  # noqa: E402
_reg_manifest_path("/api/vault/{doc_id}/download")

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_CATEGORIES = ["K-1", "Statement", "Trust Document", "Deal Document", "Tax Return", "Legal", "Other"]


@router.get("")
def list_documents(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    docs = db.query(models.VaultDocument).filter(
        models.VaultDocument.user_id == current_user.id
    ).order_by(models.VaultDocument.created_at.desc()).all()
    return [
        {
            "id": d.id,
            "filename": d.filename,
            "original_filename": d.original_filename,
            "category": d.category,
            "description": d.description,
            "linked_asset": d.linked_asset,
            "file_size": d.file_size,
            "file_type": d.file_type,
            "created_at": d.created_at.isoformat() if d.created_at else None,
        }
        for d in docs
    ]


@router.post("")
async def upload_document(
    file: UploadFile = File(...),
    category: str = Form(...),
    description: Optional[str] = Form(None),
    linked_asset: Optional[str] = Form(None),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    if category not in ALLOWED_CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Invalid category. Must be one of: {', '.join(ALLOWED_CATEGORIES)}")

    MAX_SIZE = 100 * 1024 * 1024
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 100MB.")

    ext = os.path.splitext(file.filename or "")[1].lower()
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_name)

    with open(file_path, "wb") as f:
        f.write(content)

    doc = models.VaultDocument(
        user_id=current_user.id,
        filename=unique_name,
        original_filename=file.filename or unique_name,
        category=category,
        description=description,
        linked_asset=linked_asset,
        file_size=len(content),
        file_type=file.content_type,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return {
        "id": doc.id,
        "filename": doc.filename,
        "original_filename": doc.original_filename,
        "category": doc.category,
        "file_size": doc.file_size,
    }


@router.get("/{doc_id}/download")
def download_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = db.query(models.VaultDocument).filter(
        models.VaultDocument.id == doc_id,
        models.VaultDocument.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")
    from fastapi.responses import Response
    from backend.manifest_utils import manifest_headers
    with open(file_path, "rb") as fh:
        raw = fh.read()
    return Response(
        content=raw,
        media_type=doc.file_type or "application/octet-stream",
        headers=manifest_headers(raw, filename=doc.original_filename),
    )


@router.delete("/{doc_id}")
def delete_document(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = db.query(models.VaultDocument).filter(
        models.VaultDocument.id == doc_id,
        models.VaultDocument.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")
    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if os.path.exists(file_path):
        os.remove(file_path)
    db.delete(doc)
    db.commit()
    return {"deleted": True}


@router.post("/{doc_id}/analyze")
async def analyze_tax_return(
    doc_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    doc = db.query(models.VaultDocument).filter(
        models.VaultDocument.id == doc_id,
        models.VaultDocument.user_id == current_user.id,
    ).first()
    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    file_path = os.path.join(UPLOAD_DIR, doc.filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="File not found on disk")

    extracted_text = extract_text_from_file(file_path, doc.file_type or "", doc.original_filename)

    if extracted_text and len(extracted_text.strip()) > 100:
        doc_context = f"Tax Return Document: {doc.original_filename}\nTax Year: {doc.linked_asset or 'Unknown'}\nDescription: {doc.description or 'None'}\n\n--- DOCUMENT CONTENT ---\n{extracted_text[:12000]}"
    else:
        doc_context = f"Tax Return Document: {doc.original_filename}\nTax Year: {doc.linked_asset or 'Unknown'}\nDescription: {doc.description or 'None'}\n\nNote: This document format does not support automated text extraction (may be a scanned PDF or image). Please provide your analysis based on the metadata and any context in the description field. Identify what forms and schedules this return likely contains based on the filename and year, and provide standard UHNW tax planning guidance for this client profile."

    user_prompt = f"""Please analyze this tax return document for Jeremiah Shrack (UHNW client, Carmel IN, ~$2.4B net worth, Kincaid Health). 

{doc_context}

Provide a complete fiduciary-grade tax analysis as specified."""

    async def call_openai_analysis() -> str:
        try:
            response = await openai_client.chat.completions.create(
                model="gemini-2.5-flash",
                messages=[
                    {"role": "system", "content": TAX_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt},
                ],
                max_tokens=2000,
                temperature=0.2,
            )
            return response.choices[0].message.content or "No response generated."
        except Exception as e:
            return f"OpenAI analysis unavailable: {str(e)}"

    async def call_anthropic_analysis() -> str:
        try:
            response = await anthropic_client.messages.create(
                model="claude-opus-4-5",
                max_tokens=2000,
                system=TAX_SYSTEM_PROMPT,
                messages=[{"role": "user", "content": user_prompt}],
            )
            content = response.content[0]
            return content.text if content.type == "text" else "No text response."
        except Exception as e:
            return f"Claude analysis unavailable: {str(e)}"

    openai_result, anthropic_result = await asyncio.gather(
        call_openai_analysis(),
        call_anthropic_analysis(),
    )

    log1 = models.Log(prompt=f"[Tax Return Analysis] {doc.original_filename}", provider="openai", response=openai_result)
    log2 = models.Log(prompt=f"[Tax Return Analysis] {doc.original_filename}", provider="anthropic", response=anthropic_result)
    db.add(log1)
    db.add(log2)
    db.commit()

    return {
        "doc_id": doc_id,
        "filename": doc.original_filename,
        "tax_year": doc.linked_asset,
        "openai": openai_result,
        "anthropic": anthropic_result,
        "text_extracted": bool(extracted_text and len(extracted_text.strip()) > 100),
    }
