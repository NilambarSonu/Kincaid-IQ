from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from backend.database import get_db
from backend import models
from backend.auth import get_current_user

router = APIRouter(prefix="/api/watchlist", tags=["watchlist"])


class WatchlistCreate(BaseModel):
    ticker: str
    display_name: str
    target_price: Optional[float] = None
    alert_threshold_pct: Optional[float] = 5.0
    notes: Optional[str] = None


@router.get("")
def list_watchlist(db: Session = Depends(get_db), current_user=Depends(get_current_user)):
    items = db.query(models.WatchlistItem).filter(
        models.WatchlistItem.user_id == current_user.id
    ).order_by(models.WatchlistItem.created_at.desc()).all()
    return [
        {
            "id": i.id,
            "ticker": i.ticker,
            "display_name": i.display_name,
            "target_price": i.target_price,
            "alert_threshold_pct": i.alert_threshold_pct,
            "notes": i.notes,
            "created_at": i.created_at.isoformat() if i.created_at else None,
        }
        for i in items
    ]


@router.post("")
def add_to_watchlist(
    data: WatchlistCreate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    existing = db.query(models.WatchlistItem).filter(
        models.WatchlistItem.user_id == current_user.id,
        models.WatchlistItem.ticker == data.ticker.upper(),
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="Ticker already in watchlist")
    item = models.WatchlistItem(
        user_id=current_user.id,
        ticker=data.ticker.upper(),
        display_name=data.display_name,
        target_price=data.target_price,
        alert_threshold_pct=data.alert_threshold_pct,
        notes=data.notes,
    )
    db.add(item)
    db.commit()
    db.refresh(item)
    return {"id": item.id, "ticker": item.ticker, "display_name": item.display_name}


@router.delete("/{item_id}")
def remove_from_watchlist(
    item_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    item = db.query(models.WatchlistItem).filter(
        models.WatchlistItem.id == item_id,
        models.WatchlistItem.user_id == current_user.id,
    ).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    db.delete(item)
    db.commit()
    return {"deleted": True}
