"""GET /items — 품목 시드(+KAMIS 실시간가) / GET /items/db — DB 기반 품목."""
import os
import pandas as pd
from fastapi import APIRouter
from core.items import load_items

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
def items():
    return load_items().to_dict(orient="records")


@router.get("/db")
def items_db():
    """
    daily_prices DB에서 item_key 기준으로 품목 목록 반환.
    소매가 우선, 없으면 중앙값(도매 경매가 원/kg) 사용.
    DB 없거나 비어있으면 빈 리스트 반환.
    """
    try:
        from core.db import get_engine
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            df = pd.read_sql(text("""
                SELECT
                    item_key,
                    gds_lclsf_nm   AS category,
                    gds_sclsf_nm   AS name,
                    소매가,
                    kamis_unit,
                    중앙값,
                    MAX(scsbd_dt)  AS scsbd_dt
                FROM daily_prices
                WHERE item_key IS NOT NULL AND item_key != ''
                GROUP BY item_key, gds_lclsf_nm, gds_sclsf_nm, 소매가, kamis_unit, 중앙값
                ORDER BY gds_lclsf_nm, item_key
            """), conn)
    except Exception:
        return []

    if df.empty:
        return []

    # item_key 기준으로 중복 제거: 소매가 있는 행 우선
    df["price"] = df["소매가"].where(df["소매가"].notna(), df["중앙값"])
    df["unit"] = df["kamis_unit"].where(df["kamis_unit"].notna(), "원/kg")
    df["price_type"] = df["소매가"].apply(lambda x: "소매가" if pd.notna(x) else "도매중앙값")

    # item_key 별 소매가 우선 1행만
    df = df.sort_values("소매가", ascending=False, na_position="last")
    df = df.drop_duplicates(subset="item_key", keep="first")
    df = df.dropna(subset=["price"])

    result = []
    for _, row in df.iterrows():
        result.append({
            "item_key":   row["item_key"],
            "name":       row["name"] or row["item_key"],
            "category":   row["category"] or "",
            "price":      round(float(row["price"]), 0),
            "unit":       row["unit"],
            "price_type": row["price_type"],
        })
    return result
