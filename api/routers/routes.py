"""POST /routes/recommend — 재료 리스트 → 3전략 경로(최저예산/최소거리/최소경유)."""
import pandas as pd
from fastapi import APIRouter
from pydantic import BaseModel
from core.recipes import recommend_routes
from core.items import load_items
from core.data_loader import load_stores

router = APIRouter(prefix="/routes", tags=["routes"])
_STORES = load_stores()


class RouteReq(BaseModel):
    ingredients: list[str]
    lat: float
    lng: float
    radius: int = 3000


def _store_row(sr) -> dict:
    # stops 는 namedtuple(itertuples), by_store["row"] 는 pandas Series → 타입별 접근
    if isinstance(sr, pd.Series):
        g = lambda k: sr[k] if k in sr.index else None
    elif isinstance(sr, dict):
        g = lambda k: sr.get(k)
    else:  # namedtuple
        g = lambda k: getattr(sr, k, None)
    return {
        "id": g("id"), "name": g("name"), "type": g("type"),
        "gu": g("gu"), "lat": float(g("lat")), "lng": float(g("lng")),
    }


def _serialize(plan: dict) -> dict:
    if not plan:
        return {}
    stops = [_store_row(s) for s in plan["stops"]]
    by_store = {
        sid: {
            "store": _store_row(v["row"]),
            "items": [
                {"name": n, "price": int(p), "emoji": e, "unit": u}
                for (n, p, e, u) in v["items"]
            ],
        }
        for sid, v in plan["by_store"].items()
    }
    return {
        "stops": stops,
        "by_store": by_store,
        "budget": int(plan["budget"]),
        "distance_m": round(float(plan["distance_m"])),
        "minutes": int(plan["minutes"]),
        "n_stops": int(plan["n_stops"]),
    }


@router.post("/recommend")
def recommend(req: RouteReq):
    items = load_items()
    plans = recommend_routes(req.ingredients, items, _STORES, (req.lat, req.lng))
    # plans: {전략명: plan dict} — pandas row 들을 JSON-friendly 로 변환
    return {strategy: _serialize(plan) for strategy, plan in plans.items()}
