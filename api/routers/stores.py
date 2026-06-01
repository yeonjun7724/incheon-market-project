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
