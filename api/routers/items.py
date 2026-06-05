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
    - name: item_key 사용 (소분류 원문 대신 정제된 품목명)
    - 소매가 우선, 없으면 중앙값
    - 소매가 기준 오름차순 정렬 후 item_key별 첫 행 선택 → 소매(소량) 가격 선택
    DB 없거나 비어있으면 빈 리스트 반환.
    """
    try:
        from core.db import get_engine
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            # DISTINCT ON으로 item_key별 소매가 가장 작은 행 1개만 선택
            # 소매가 ASC → 소량(소매) 단위 데이터가 대량(도매) 단위보다 먼저 선택됨
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

    df["price"] = df["소매가"].where(df["소매가"].notna(), df["중앙값"])
    df["unit"] = df["kamis_unit"].where(df["kamis_unit"].notna(), "원/kg")
    df["price_type"] = df["소매가"].apply(lambda x: "소매가" if pd.notna(x) else "도매중앙값")
    df = df.dropna(subset=["price"])
    df = df.sort_values("category")

    return [
        {
            "item_key":   row["item_key"],
            "name":       row["item_key"],   # 정제된 품목명 사용
            "category":   row["category"] or "",
            "price":      round(float(row["price"]), 0),
            "unit":       row["unit"],
            "price_type": row["price_type"],
        }
        for _, row in df.iterrows()
    ]
