"""GET /prices — KAMIS 실시간 소매가 상태."""
import pandas as pd
from fastapi import APIRouter
from sqlalchemy import text
from core.items import load_items

router = APIRouter(prefix="/prices", tags=["prices"])


@router.get("")
def prices():
    df = load_items()
    return df[["code", "name", "unit", "avg_price",
              "market_price", "supermarket_price"]].to_dict(orient="records")


@router.get("/daily")
def daily_prices():
    """
    daily_prices 테이블에서 gds_lclsf_nm·item_key 기준으로 집계된 가격 목록 반환.
    같은 item_key가 여러 소분류에 걸쳐 있으면 AVG로 합산.
    """
    try:
        from scheduler import get_db_engine
        engine = get_db_engine()
        with engine.connect() as conn:
            df = pd.read_sql(
                text("""
                    SELECT
                        gds_lclsf_nm,
                        item_key,
                        ROUND(AVG(중앙값)::numeric, 0)  AS 중앙값,
                        ROUND(AVG(소매가)::numeric, 0)  AS 소매가,
                        MAX(kamis_unit)                AS kamis_unit
                    FROM daily_prices
                    WHERE item_key IS NOT NULL AND item_key <> ''
                    GROUP BY gds_lclsf_nm, item_key
                    ORDER BY gds_lclsf_nm, item_key
                """),
                conn,
            )
        return df.where(pd.notnull(df), None).to_dict(orient="records")
    except Exception:
        return []
