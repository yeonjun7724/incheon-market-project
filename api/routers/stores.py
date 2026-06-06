"""GET /stores — 반경/구 필터 점포 목록."""
import math
from fastapi import APIRouter
from core.data_loader import load_stores

router = APIRouter(prefix="/stores", tags=["stores"])
_STORES = load_stores()


def _haversine(la1, lo1, la2, lo2):
    R = 6371000
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = math.radians(la2 - la1), math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


@router.get("")
def stores(lat: float | None = None, lng: float | None = None,
           radius: int = 3000, gu: str | None = None):
    df = _STORES.copy()
    if gu:
        df = df[df["gu"].str.contains(gu, na=False)]
    if lat is not None and lng is not None:
        df["distance_m"] = df.apply(
            lambda r: round(_haversine(lat, lng, r["lat"], r["lng"])), axis=1)
        df = df[df["distance_m"] <= radius].sort_values("distance_m")
    return df.to_dict(orient="records")


@router.get("/center")
def center():
    from core.data_loader import map_center
    la, ln = map_center(_STORES)
    return {"lat": la, "lng": ln}


@router.get("/{store_id}/items")
def store_items(store_id: str, store_name: str = "", store_type: str = ""):
    """상점 취급 품목 조회 — 영수증 학습 → AI 추론 순."""
    from core.recipes import get_store_items, infer_store_items_ai

    # 영수증으로 학습된 데이터 우선
    learned = get_store_items(store_id)
    if learned:
        return {"items": list(learned.keys()), "prices": learned, "source": "영수증 확인"}

    # AI 추론
    inferred = infer_store_items_ai(store_name or store_id, store_type)
    return {"items": inferred, "prices": {}, "source": "AI 추론"}
