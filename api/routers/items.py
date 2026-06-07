"""GET /items — DB 기반 품목. 도매가 → 소매가 변환 + 가격 없으면 AI 추론."""
import os
import json
import pandas as pd
from fastapi import APIRouter
from core.items import load_items

router = APIRouter(prefix="/items", tags=["items"])

_OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
_OPENAI_MODEL = "gpt-4o-mini"

# 도매→소매 변환 계수 (카테고리별)
_RETAIL_FACTOR: dict[str, float] = {
    "채소류":   1.55,
    "과실류":   1.50,
    "곡류":     1.40,
    "축산물":   1.50,
    "수산물":   1.60,
    "특용작물류": 1.45,
    "가공식품":  1.30,
}
_RETAIL_FACTOR_DEFAULT = 1.50   # 카테고리 미매핑 시


def _wholesale_to_retail(price: float, category: str) -> int:
    """도매 중앙값 → 소매가 추정."""
    factor = _RETAIL_FACTOR.get(category, _RETAIL_FACTOR_DEFAULT)
    return round(price * factor / 10) * 10   # 10원 단위 반올림


_INFERRED_CACHE: dict[str, dict] = {}   # item_key → {price, unit, category}

def _infer_price_with_ai(item_key: str, category: str, unit: str) -> int | None:
    """OpenAI로 한국 소매가 추론. 실패 시 None."""
    if not _OPENAI_KEY:
        return None
    if item_key in _INFERRED_CACHE:
        return _INFERRED_CACHE[item_key]["price"]
    try:
        import openai
        client = openai.OpenAI(api_key=_OPENAI_KEY)
        resp = client.chat.completions.create(
            model=_OPENAI_MODEL,
            max_tokens=60,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 한국 식품 가격 전문가입니다. "
                        "품목명과 단위를 주면 현재 한국 일반 마트 소매가격을 숫자(원)로만 답하세요. "
                        "숫자만, 단위 없이, 예: 2500"
                    ),
                },
                {
                    "role": "user",
                    "content": f"품목: {item_key}, 분류: {category}, 단위: {unit}",
                },
            ],
            response_format={"type": "text"},
        )
        raw = resp.choices[0].message.content.strip().replace(",", "").replace("원", "")
        price = int(float(raw))
        if 50 <= price <= 500000:
            _INFERRED_CACHE[item_key] = {"price": price, "unit": unit, "category": category}
            return price
    except Exception:
        pass
    return None


@router.get("")
def items():
    """DB 기반 품목 반환. items_seed.csv 미사용."""
    df = load_items()
    if df.empty:
        return []
    return df.to_dict(orient="records")


@router.get("/db")
def items_db():
    """
    daily_prices DB → 소매가 기준 품목 목록.
    - 소매가(KAMIS) 있으면 그대로 사용
    - 없으면 도매 중앙값 × 1.4~1.6 소매가 변환
    - 둘 다 없으면 OpenAI로 추론
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

    df["unit"]  = df["kamis_unit"].fillna("원/kg")
    df["category"] = df["category"].fillna("기타")

    result = []
    for _, row in df.iterrows():
        item_key = row["item_key"]
        category = row["category"]
        unit     = row["unit"]
        소매가    = row.get("소매가")
        중앙값    = row.get("중앙값")

        # 가격 결정 순서
        if pd.notna(소매가) and 소매가 > 0:
            price      = round(float(소매가), 0)
            price_type = "소매가"
        elif pd.notna(중앙값) and 중앙값 > 0:
            price      = _wholesale_to_retail(float(중앙값), category)
            price_type = "도매→소매추정"
        else:
            # AI 추론
            inferred = _infer_price_with_ai(item_key, category, unit)
            if inferred:
                price      = float(inferred)
                price_type = "AI추론"
            else:
                continue   # 가격 없으면 목록에서 제외

        # 소분 단위/가격 변환
        from core.recipes import cooking_price as _cp
        unit, price = _cp(item_key, int(price), unit)

        result.append({
            "item_key":   item_key,
            "name":       item_key,
            "category":   category,
            "price":      price,
            "unit":       unit,
            "price_type": price_type,
        })

    result.sort(key=lambda x: x["category"])
    return result


# ── POST /items/infer ─────────────────────────────────────────
from pydantic import BaseModel

class InferReq(BaseModel):
    names: list[str]
    household: int = 2


def _infer_ingredient_full(item_key: str) -> dict | None:
    """DB에 없는 재료의 가격·단위·카테고리를 OpenAI로 추론. 실패 시 None."""
    if not _OPENAI_KEY:
        return None
    if item_key in _INFERRED_CACHE:
        cached = _INFERRED_CACHE[item_key]
        return {"price": cached["price"], "unit": cached.get("unit", ""), "category": cached.get("category", "기타"), "price_type": "AI추론"}
    try:
        import openai
        client = openai.OpenAI(api_key=_OPENAI_KEY)
        resp = client.chat.completions.create(
            model=_OPENAI_MODEL,
            max_tokens=100,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "당신은 한국 식품 가격 전문가입니다. "
                        "재료명을 주면 한국 일반 마트/시장 기준의 가격 정보를 JSON으로 답하세요. "
                        "단위는 실제 요리 1~2인분에 사용하는 소량 기준으로 답하세요 "
                        "(예: 꽃게→1마리, 생강→50g, 마늘→100g, 양파→1개, 대파→1/2단). "
                        '형식: {"price": 숫자, "unit": "단위문자열", "category": "카테고리"} '
                        '예: {"price": 8000, "unit": "1마리(500g)", "category": "수산물"}'
                    ),
                },
                {"role": "user", "content": f"재료명: {item_key}"},
            ],
            response_format={"type": "json_object"},
        )
        obj = json.loads(resp.choices[0].message.content.strip())
        price = int(float(str(obj.get("price", 0)).replace(",", "")))
        if 50 <= price <= 500000:
            unit_val = str(obj.get("unit", ""))
            cat_val  = str(obj.get("category", "기타"))
            _INFERRED_CACHE[item_key] = {"price": price, "unit": unit_val, "category": cat_val}
            return {
                "price": price,
                "unit": unit_val,
                "category": cat_val,
                "price_type": "AI추론",
            }
    except Exception:
        pass
    return None


@router.post("/infer")
def infer_items(req: InferReq):
    """재료명 리스트 → 가격 정보 반환 (DB → EXTRA_ITEMS → OpenAI 순)."""
    from core.items import normalize_ingredient, EMOJI_MAP
    from core.recipes import EXTRA_ITEMS

    df = load_items()
    db_by_key: dict[str, dict] = {}
    if not df.empty:
        for _, row in df.iterrows():
            db_by_key[str(row["name"])] = row.to_dict()

    result: dict[str, dict] = {}

    from core.recipes import cooking_price

    for raw_name in req.names:
        key = normalize_ingredient(raw_name)

        if key in db_by_key:
            r = db_by_key[key]
            base_price = int(r.get("avg_price", 0))
            if base_price > 0:
                base_unit = r.get("unit", "원/kg")
                unit, price = cooking_price(key, base_price, base_unit, req.household)
                result[raw_name] = {
                    "item_key": key, "name": key,
                    "category": r.get("category", "기타"), "price": price,
                    "unit": unit, "price_type": "DB",
                    "emoji": r.get("emoji", EMOJI_MAP.get(key, "🛒")),
                }
                continue

        if key in EXTRA_ITEMS:
            ei = EXTRA_ITEMS[key]
            unit, price = cooking_price(key, ei[2], ei[1], req.household)
            result[raw_name] = {
                "item_key": key, "name": key,
                "category": ei[0], "price": price,
                "unit": unit, "price_type": "참조가",
                "emoji": ei[5],
            }
            continue

        info = _infer_ingredient_full(key)
        if info and info["price"] > 0:
            unit, price = cooking_price(key, info["price"], info["unit"], req.household)
            result[raw_name] = {
                "item_key": key, "name": key,
                "category": info["category"], "price": price,
                "unit": unit, "price_type": "AI추론",
                "emoji": EMOJI_MAP.get(key, "🛒"),
            }
        else:
            result[raw_name] = {
                "item_key": key, "name": key,
                "category": "기타", "price": 0,
                "unit": "", "price_type": "미확인", "emoji": "❓",
            }

    return result
