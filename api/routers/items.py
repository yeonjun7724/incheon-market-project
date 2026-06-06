"""GET /items — DB 기반 품목. items_seed.csv 제거됨."""
import pandas as pd
from fastapi import APIRouter
from core.items import load_items

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
def items():
    """DB(daily_prices)에서 품목 반환. DB 없으면 빈 리스트."""
    df = load_items()
    if df.empty:
        return []
    return df.to_dict(orient="records")


@router.get("/db")
def items_db():
    """
    daily_prices DB에서 item_key 기준 품목 목록.
    소매가 우선, 없으면 도매중앙값.
    """
    try:
        from core.db import get_engine
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            df = pd.read_sql(text("""
                SELECT DISTINCT ON (item_key)
                    item_key,
                    gds_lclsf_nm  AS category,
                    소매가,
                    kamis_unit,
                    중앙값
                FROM daily_prices
                WHERE item_key IS NOT NULL AND item_key != ''
                ORDER BY item_key,
                    CASE WHEN 소매가 IS NOT NULL THEN 0 ELSE 1 END,
                    소매가 ASC NULLS LAST
            """), conn)
    except Exception:
        return []

    if df.empty:
        return []

    df["price"]      = df["소매가"].where(df["소매가"].notna(), df["중앙값"])
    df["unit"]       = df["kamis_unit"].fillna("원/kg")
    df["price_type"] = df["소매가"].apply(lambda x: "소매가" if pd.notna(x) else "도매중앙값")
    df = df.dropna(subset=["price"]).sort_values("category")

    return [
        {
            "item_key":   row["item_key"],
            "name":       row["item_key"],
            "category":   row["category"] or "",
            "price":      round(float(row["price"]), 0),
            "unit":       row["unit"],
            "price_type": row["price_type"],
        }
        for _, row in df.iterrows()
    ]
