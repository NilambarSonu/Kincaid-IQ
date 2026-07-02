from fastapi import APIRouter, Request
from fastapi.responses import StreamingResponse
import httpx
import asyncio
import json
import time

router = APIRouter(prefix="/api/market", tags=["market"])

TICKERS = ["SPY", "QQQ", "GLD", "TLT", "BTC-USD", "^VIX"]

FALLBACK_PRICES = {
    "SPY":    {"price": 563.42, "change": 2.18,  "changePct": 0.39,  "name": "S&P 500 ETF"},
    "QQQ":    {"price": 487.90, "change": 3.44,  "changePct": 0.71,  "name": "Nasdaq 100 ETF"},
    "GLD":    {"price": 234.15, "change": 0.88,  "changePct": 0.38,  "name": "Gold ETF"},
    "TLT":    {"price": 88.74,  "change": -0.32, "changePct": -0.36, "name": "20yr Treasury ETF"},
    "BTC-USD":{"price": 92450,  "change": 1240,  "changePct": 1.36,  "name": "Bitcoin"},
    "^VIX":   {"price": 13.82,  "change": -0.44, "changePct": -3.08, "name": "VIX Index"},
}


async def fetch_ticker(client: httpx.AsyncClient, ticker: str) -> dict:
    try:
        url = f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}?interval=1d&range=1d"
        headers = {"User-Agent": "Mozilla/5.0"}
        r = await client.get(url, headers=headers, timeout=4.0)
        data = r.json()
        meta = data["chart"]["result"][0]["meta"]
        price = meta.get("regularMarketPrice", 0)
        prev = meta.get("previousClose", price)
        change = price - prev
        change_pct = (change / prev * 100) if prev else 0
        return {
            "ticker": ticker,
            "price": round(price, 2),
            "change": round(change, 2),
            "changePct": round(change_pct, 2),
            "name": FALLBACK_PRICES.get(ticker, {}).get("name", ticker),
            "live": True,
        }
    except Exception:
        fb = FALLBACK_PRICES.get(ticker, {})
        return {
            "ticker": ticker,
            "price": fb.get("price", 0),
            "change": fb.get("change", 0),
            "changePct": fb.get("changePct", 0),
            "name": fb.get("name", ticker),
            "live": False,
        }


@router.get("/quotes")
async def get_quotes():
    async with httpx.AsyncClient() as client:
        results = await asyncio.gather(*[fetch_ticker(client, t) for t in TICKERS])
    return {"quotes": results}


@router.get("/stream")
async def stream_quotes(request: Request, interval: int = 5):
    """
    Server-Sent Events (SSE) live market tick feed. Pushes a fresh quote
    snapshot for every TICKER every `interval` seconds (min 2s) until the
    client disconnects. Consume on the client with `new EventSource(...)`
    and listen for the `quotes` event.
    """
    tick = max(2, min(int(interval or 5), 60))

    async def gen():
        # Prime the stream immediately so the UI has data before the first tick.
        yield ": kincaid-iq live market feed\n\n"
        while True:
            if await request.is_disconnected():
                break
            try:
                async with httpx.AsyncClient() as client:
                    results = await asyncio.gather(*[fetch_ticker(client, t) for t in TICKERS])
                payload = {
                    "quotes": results,
                    "ts": int(time.time() * 1000),
                    "live": any(q.get("live") for q in results),
                }
                yield f"event: quotes\ndata: {json.dumps(payload)}\n\n"
            except Exception as e:
                yield f"event: error\ndata: {json.dumps({'error': str(e)[:160]})}\n\n"
            await asyncio.sleep(tick)

    return StreamingResponse(
        gen(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


PERIOD_MAP = {
    "1d":  ("5m",  "1d"),
    "5d":  ("30m", "5d"),
    "1mo": ("1d",  "1mo"),
    "3mo": ("1d",  "3mo"),
    "6mo": ("1d",  "6mo"),
    "1y":  ("1d",  "1y"),
    "5y":  ("1wk", "5y"),
}


@router.get("/history/{ticker}")
async def get_history(ticker: str, period: str = "3mo"):
    interval, range_ = PERIOD_MAP.get(period, ("1d", "3mo"))
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{ticker}"
        f"?interval={interval}&range={range_}"
    )
    headers = {"User-Agent": "Mozilla/5.0"}
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get(url, headers=headers, timeout=8.0)
        data = r.json()
        result = data["chart"]["result"][0]
        meta = result["meta"]
        timestamps = result.get("timestamp", [])
        quote = result["indicators"]["quote"][0]
        opens   = quote.get("open",   [])
        highs   = quote.get("high",   [])
        lows    = quote.get("low",    [])
        closes  = quote.get("close",  [])
        volumes = quote.get("volume", [])
        candles = []
        for i, ts in enumerate(timestamps):
            o = opens[i]   if i < len(opens)   else None
            h = highs[i]   if i < len(highs)   else None
            l = lows[i]    if i < len(lows)    else None
            c = closes[i]  if i < len(closes)  else None
            v = volumes[i] if i < len(volumes) else None
            if None in (o, h, l, c):
                continue
            candles.append({
                "t": ts * 1000,
                "o": round(o, 4),
                "h": round(h, 4),
                "l": round(l, 4),
                "c": round(c, 4),
                "v": v or 0,
            })
        return {
            "ticker": ticker.upper(),
            "currency": meta.get("currency", "USD"),
            "exchange": meta.get("exchangeName", ""),
            "regularMarketPrice": meta.get("regularMarketPrice", 0),
            "previousClose": meta.get("previousClose", 0),
            "candles": candles,
        }
    except Exception as e:
        return {"ticker": ticker.upper(), "candles": [], "error": str(e)}
