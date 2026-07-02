import asyncio
import json as json_lib
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from backend.gemini_compat import AsyncGeminiClient as AsyncOpenAI
from anthropic import AsyncAnthropic
from pydantic import BaseModel
from backend.database import get_db
from backend import models, schemas
from backend.config import settings
from typing import List

router = APIRouter(prefix="/api", tags=["ai"])

openai_client = AsyncOpenAI(
    api_key=settings.openai_api_key,
    base_url=settings.openai_base_url,
)
anthropic_client = AsyncAnthropic(
    api_key=settings.anthropic_api_key,
    base_url=settings.anthropic_base_url,
)


async def call_openai(prompt: str) -> str:
    try:
        response = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "user", "content": prompt}],
        )
        return response.choices[0].message.content or "No response"
    except Exception as e:
        return f"Error: {str(e)}"


async def call_anthropic(prompt: str) -> str:
    try:
        response = await anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            messages=[{"role": "user", "content": prompt}],
        )
        content = response.content[0]
        return content.text if content.type == "text" else "No text response"
    except Exception as e:
        return f"Error: {str(e)}"


async def call_openai_with_system(system: str, messages: list, max_tokens: int = 2000) -> str:
    try:
        response = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[{"role": "system", "content": system}] + messages,
            max_tokens=max_tokens,
            temperature=0.3,
        )
        return response.choices[0].message.content or "No response generated."
    except Exception as e:
        return f"Error: {str(e)}"


async def call_anthropic_with_system(system: str, user_content: str, max_tokens: int = 2000) -> str:
    try:
        response = await anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=max_tokens,
            system=system,
            messages=[{"role": "user", "content": user_content}],
        )
        content = response.content[0]
        return content.text if content.type == "text" else "No text response"
    except Exception as e:
        return f"Error: {str(e)}"


@router.post("/logs", response_model=List[schemas.LogOut])
async def submit_prompt(request: schemas.PromptRequest, db: Session = Depends(get_db)):
    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    openai_text, anthropic_text = await asyncio.gather(
        call_openai(prompt),
        call_anthropic(prompt),
    )

    log1 = models.Log(prompt=prompt, provider="openai", response=openai_text)
    log2 = models.Log(prompt=prompt, provider="anthropic", response=anthropic_text)
    db.add(log1)
    db.add(log2)
    db.commit()
    db.refresh(log1)
    db.refresh(log2)

    return [schemas.LogOut.from_orm_custom(log1), schemas.LogOut.from_orm_custom(log2)]


@router.post("/pull-kincaid")
async def pull_kincaid(request: schemas.PullKincaidRequest, db: Session = Depends(get_db)):
    prompt = request.prompt or "all of Kincaid IQ"

    try:
        response = await anthropic_client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=8192,
            system="You are an expert engineer with access to the Kincaid IQ transparency engine codebase. Provide the full source code for components requested. Return ONLY the code, no markdown blocks, no explanations.",
            messages=[{"role": "user", "content": f"Pull all code for: {prompt}"}],
        )
        content = response.content[0]
        code = content.text if content.type == "text" else ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Claude error: {str(e)}")

    log = models.Log(prompt=f"Pull Kincaid IQ: {prompt}", provider="anthropic-kincaid", response=code)
    db.add(log)
    db.commit()

    return {"code": code}


class AskPortfolioRequest(BaseModel):
    question: str
    history: list = []


class MarketBriefingRequest(BaseModel):
    pass


class DealMemoRequest(BaseModel):
    name: str
    sector: str
    stage: str
    check_size: str
    co_investors: str = ""
    valuation: str = ""
    notes: str = ""


PORTFOLIO_CONTEXT = """
Jeremiah Shrack — UHNW Client, Carmel IN. Net Worth ~$2.41B managed via Kincaid RMC.

ASSET ALLOCATION:
- Public Equities: $580M (24.1%) — large-cap US, international developed, emerging markets
- Private Equity: $420M (17.4%) — KKR Americas XII, Blackstone Real Estate IX, Apollo Buyout VIII
- Venture Capital: $290M (12.0%) — Sequoia Capital XVIII, a16z Crypto II, Khosla Ventures
- Real Estate: $480M (19.9%) — 432 Park Ave NYC ($85M), Mayfair London ($42M), Austin Tech Campus ($35M), Marina Bay Singapore ($78M)
- Private Credit: $130M (5.4%) — Apollo Global Credit, Pimco Income Fund
- Hedge Funds: $220M (9.1%) — Citadel Wellington, Renaissance Medallion II
- Cash & T-Bills: $290M (12.0%) — primarily 3-6 month T-bills

FAMILY ENTITY STRUCTURE:
- Whitmore Dynasty Trust (SD): $680M
- Shrack IDGT (NV): $210M → owns Shrack Real Estate LP: $320M
- Park Avenue Holdings LLC (DE): $85M
- Asia HoldCo Pte Ltd (SG): $78M
- Shrack Ventures LLC (DE): $290M
- Whitmore Family Foundation (IN): $120M

KEY METRICS:
- YTD Return: +14.7% (vs S&P 500 +11.2%)
- Income (YTD): $18.4M (dividends + rent + interest)
- Unrealized Gains: $284M (taxable accounts)
- Estate Tax Exposure: $347M at current exemption ($13.61M)
- Annual Lifestyle Budget: $18.4M
"""


@router.post("/ask-portfolio")
async def ask_portfolio(request: AskPortfolioRequest, db: Session = Depends(get_db)):
    question = request.question.strip()
    if not question:
        raise HTTPException(status_code=400, detail="Question is required")

    system = f"""You are a senior fiduciary wealth advisor at Kincaid RMC, serving Jeremiah Shrack exclusively. You have deep knowledge of his complete financial picture.

{PORTFOLIO_CONTEXT}

Answer questions about his portfolio with precision and insight. Reference specific positions, structures, and figures where relevant. Be direct and actionable. Never hedge with 'I don't have access to real-time data' — use the portfolio data above as the ground truth."""

    messages = []
    for h in request.history[-6:]:
        messages.append({"role": h.get("role", "user"), "content": h.get("content", "")})
    messages.append({"role": "user", "content": question})

    answer = await call_openai_with_system(system, messages)

    log = models.Log(prompt=f"[Ask Portfolio] {question}", provider="openai", response=answer)
    db.add(log)
    db.commit()
    return {"answer": answer, "question": question}


@router.post("/market-briefing")
async def market_briefing(db: Session = Depends(get_db)):
    from datetime import date
    today = date.today().strftime("%B %d, %Y")

    system = f"""You are a senior market strategist at Kincaid RMC, delivering a personalized morning briefing to Jeremiah Shrack.

{PORTFOLIO_CONTEXT}

Today is {today}. Generate a comprehensive morning market briefing that:
1. Covers macro themes (Fed policy, rates, equity markets, geopolitics)
2. Highlights implications for Jeremiah's specific portfolio (reference actual positions)
3. Notes any relevant sector/geographic developments  
4. Flags any risk or opportunity in his specific holdings
5. Includes 3-5 actionable talking points

Format as a professional morning brief with sections: Macro Overview, Portfolio Implications, Key Watchpoints, Action Items. Be specific, data-driven, and fiduciary-grade."""

    briefing = await call_openai_with_system(system, [{"role": "user", "content": f"Generate today's ({today}) personalized market briefing for Jeremiah Shrack."}])

    log = models.Log(prompt=f"[Market Briefing] {today}", provider="openai", response=briefing)
    db.add(log)
    db.commit()
    return {"briefing": briefing, "date": today}


@router.post("/deal-memo")
async def deal_memo(request: DealMemoRequest, db: Session = Depends(get_db)):
    system = f"""You are a senior private equity and venture capital deal analyst at Kincaid RMC, writing investment memos for Jeremiah Shrack.

{PORTFOLIO_CONTEXT}

Write professional, fiduciary-grade investment memos that:
- Lead with a clear investment thesis (3-4 sentences)
- Cover market opportunity, competitive positioning, management team assessment
- Analyze financial profile and return expectations (IRR, MOIC, time horizon)
- Assess portfolio fit and diversification impact relative to Jeremiah's existing book
- Quantify key risks with mitigants
- End with a clear recommendation (Invest/Pass/Monitor) with rationale

Format with bold section headers. Be analytical, direct, and conviction-driven."""

    user_prompt = f"""Write a full investment memo for the following deal:

Company/Fund: {request.name}
Sector: {request.sector}
Stage: {request.stage}
Proposed Check Size: {request.check_size}
{f"Co-Investors: {request.co_investors}" if request.co_investors else ""}
{f"Valuation / Entry: {request.valuation}" if request.valuation else ""}
{f"Additional Context: {request.notes}" if request.notes else ""}

Generate a complete investment memo with all standard sections."""

    memo = await call_anthropic_with_system(system, user_prompt)

    log = models.Log(prompt=f"[Deal Memo] {request.name}", provider="anthropic", response=memo)
    db.add(log)
    db.commit()
    return {"memo": memo, "name": request.name}


class CompanyAnalyzeRequest(BaseModel):
    ticker: str
    company_name: str = ""


class NewsGenerateRequest(BaseModel):
    holdings: list[str] = []


@router.post("/company/analyze")
async def company_analyze(request: CompanyAnalyzeRequest, db: Session = Depends(get_db)):
    ticker = request.ticker.upper()
    name = request.company_name or ticker
    system = f"""You are a senior equity research analyst at Kincaid RMC, writing a company deep-dive for Jeremiah Shrack (UHNW client, $2.41B portfolio).

Analyze {name} ({ticker}) with the depth of a Bloomberg Intelligence or Goldman Sachs initiation report. Cover:
1. Business overview (2-3 sentences — what they do, market position, moat)
2. Key products/services and revenue drivers
3. Geographic revenue breakdown (approximate %)
4. Financial summary (revenue trend, margins, balance sheet strength, free cash flow)
5. Valuation context (P/E, EV/EBITDA vs sector)
6. Analyst consensus (approximate bear/base/bull price targets)
7. Competitive position and moat assessment
8. Bull case (3 bullets)
9. Bear case (3 bullets)
10. Key risks (regulatory, competitive, macro)
11. Investment conclusion for Jeremiah's UHNW portfolio (1 paragraph)

Be specific, data-driven, and professional. Use real-world knowledge through your training cutoff."""

    analysis = await call_openai_with_system(
        system,
        [{"role": "user", "content": f"Generate a complete company deep-dive for {name} ({ticker})."}],
        max_tokens=2000,
    )

    log = models.Log(prompt=f"[Company Deep Dive] {ticker}", provider="openai", response=analysis)
    db.add(log)
    db.commit()
    return {"ticker": ticker, "company_name": name, "analysis": analysis}


@router.post("/news/generate")
async def news_generate(request: NewsGenerateRequest, db: Session = Depends(get_db)):
    today = datetime.now().strftime("%B %d, %Y")
    holdings_str = ", ".join(request.holdings) if request.holdings else "SPY, QQQ, AAPL, MSFT, NVDA, GLD, TLT"

    system = f"""You are a Bloomberg Intelligence AI for Kincaid RMC, generating a personalized AI news feed for Jeremiah Shrack.

{PORTFOLIO_CONTEXT}

Today is {today}. Generate exactly 10 highly relevant news items in JSON array format. Each item must be a JSON object with these exact fields:
- headline: (string) compelling headline
- summary: (string) 2-sentence summary of what happened and why it matters
- source: (string) realistic news source (Bloomberg, FT, WSJ, Reuters, etc.)
- publishedAt: (string) realistic time like "2h ago", "4h ago", "6h ago", etc.
- category: (string) one of: Market Moving, Portfolio Impact, Macro, Geopolitical, Earnings, Fed/Rates
- sentiment: (string) one of: Positive, Negative, Neutral
- impactedHoldings: (array of strings) 0-3 tickers from Jeremiah's holdings that this news impacts
- portfolioImpact: (string) one of: High, Medium, Low

Return ONLY the JSON array. No markdown, no explanation, just the raw JSON array starting with [ and ending with ]."""

    news_json = await call_anthropic_with_system(system, f"Generate today's ({today}) personalized AI news feed for Jeremiah Shrack based on his portfolio holdings: {holdings_str}", max_tokens=3000)

    try:
        start = news_json.find("[")
        end = news_json.rfind("]") + 1
        items = json_lib.loads(news_json[start:end])
    except Exception:
        items = []

    log = models.Log(prompt=f"[News Feed] {today}", provider="anthropic", response=news_json)
    db.add(log)
    db.commit()
    return {"items": items, "date": today, "count": len(items)}


@router.post("/pull-code")
async def pull_code(request: schemas.PromptRequest, db: Session = Depends(get_db)):
    prompt = request.prompt.strip()
    if not prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")

    try:
        response = await openai_client.chat.completions.create(
            model="gemini-2.5-flash",
            messages=[
                {"role": "system", "content": "You are a code generation assistant. Return ONLY the code, no markdown, no explanations."},
                {"role": "user", "content": prompt},
            ],
        )
        code = response.choices[0].message.content or ""
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"OpenAI error: {str(e)}")

    log = models.Log(prompt=prompt, provider="openai-codex", response=code)
    db.add(log)
    db.commit()

    return {"code": code}
