"""GET /items — 품목 시드(+KAMIS 실시간가)."""
from fastapi import APIRouter, Query
from sqlalchemy import text
from core.items import load_items

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
def items():
    return load_items().to_dict(orient="records")


@router.get("/search")
def search_items(q: str = Query("", min_length=0)):
    """daily_prices item_key 기준 자동완성 검색 (최대 10건)."""
    if not q.strip():
        return []
    try:
        from scheduler import get_db_engine
        engine = get_db_engine()
        with engine.connect() as conn:
            rows = conn.execute(text("""
                SELECT DISTINCT item_key, MAX(gds_lclsf_nm) AS category
                FROM daily_prices
                WHERE item_key ILIKE :q AND item_key <> ''
                GROUP BY item_key
                ORDER BY item_key
                LIMIT 10
            """), {"q": f"%{q.strip()}%"}).fetchall()
        return [{"item_key": r[0], "category": r[1]} for r in rows]
    except Exception:
        return []
