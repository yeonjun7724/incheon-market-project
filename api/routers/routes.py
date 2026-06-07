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
    budget: int = 0
    household: int = 1
    pref: str = "균형"
    use_market: bool = True


def _store_row(sr) -> dict:
    if isinstance(sr, pd.Series):
        g = lambda k: sr[k] if k in sr.index else None
    elif isinstance(sr, dict):
        g = lambda k: sr.get(k)
    else:
        g = lambda k: getattr(sr, k, None)
    try:
        lat = float(g("lat")) if g("lat") is not None else 0.0
        lng = float(g("lng")) if g("lng") is not None else 0.0
    except (TypeError, ValueError):
        lat, lng = 0.0, 0.0
    return {
        "id":   str(g("id") or ""),
        "name": str(g("name") or ""),
        "type": str(g("type") or ""),
        "gu":   str(g("gu") or ""),
        "lat":  lat,
        "lng":  lng,
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
    try:
        items = load_items()
        plans = recommend_routes(
            req.ingredients, items, _STORES, (req.lat, req.lng),
            radius_m=req.radius,
            budget=req.budget,
            household=req.household,
            pref=req.pref,
            use_market=req.use_market,
        )
        return {strategy: _serialize(plan) for strategy, plan in plans.items()}
    except Exception as e:
        import traceback, logging
        logging.error(f"recommend_routes error: {e}\n{traceback.format_exc()}")
        from fastapi import HTTPException
        raise HTTPException(status_code=500, detail=str(e))
