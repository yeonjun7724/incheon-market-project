"""GET /prices — KAMIS 실시간 소매가 상태."""
from fastapi import APIRouter
from core.items import load_items

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("")
def prices():
    df = load_items()
    return df[["code", "name", "unit", "avg_price",
              "market_price", "supermarket_price"]].to_dict(orient="records")
