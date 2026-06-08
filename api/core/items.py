"""
core/items.py
품목 로더 — items_seed.csv 제거, DB 전용으로 전환.
DB 없을 때 빈 DataFrame 반환 (앱은 항상 동작).
"""
import os
import pandas as pd

# 이모지 매핑 (item_key 기준)
EMOJI_MAP: dict[str, str] = {
    "계란": "🥚", "두부": "🧊", "돼지고기앞다리": "🥩", "돼지/앞다리": "🥩",
    "닭가슴살": "🍗", "닭/닭가슴살": "🍗", "닭/육계": "🍗",
    "콩나물": "🌱", "애호박": "🥒", "호박/애호박": "🥒",
    "양파": "🧅", "양파/양파": "🧅",
    "대파": "🌿", "파/대파": "🌿",
    "배추": "🥬", "시금치": "🍃",
    "쌀": "🍚", "감자": "🥔", "고구마": "🍠",
    "사과": "🍎", "바나나": "🍌",
    "참기름": "🫙", "고추장": "🌶️", "된장": "🟤", "간장": "🍶", "두유": "🥛",
    "당면": "🍜", "마늘": "🧄", "고춧가루": "🌶️", "미역": "🌿",
    "된장찌개": "🍲",
}

# DB item_key → 앱 재료명 별칭 (AI가 뱉는 한국어 재료명 → DB item_key 역매핑)
# 여러 표현 → 하나의 item_key
ALIAS_TO_KEY: dict[str, str] = {
    # 돼지고기 계열
    "돼지앞다리": "돼지고기앞다리",
    "돼지고기": "돼지고기앞다리",
    "삼겹살": "돼지고기앞다리",
    "돼지": "돼지고기앞다리",
    # 닭고기 계열
    "닭가슴살": "닭가슴살",
    "닭고기": "닭가슴살",
    "닭": "닭가슴살",
    # 채소
    "파": "대파",
    "쪽파": "대파",
    "호박": "애호박",
    "고구마": "고구마",
    "감자": "감자",
    "양배추": "배추",
    # 양념
    "고추가루": "고춧가루",
    "고추 가루": "고춧가루",
    "들기름": "참기름",
    # 공통 표현
    "콩나물": "콩나물",
    "시금치": "시금치",
    "대파": "대파",
    "양파": "양파",
    "쌀": "쌀",
    "계란": "계란",
    "달걀": "계란",
    "두부": "두부",
    "사과": "사과",
    "바나나": "바나나",
    "두유": "두유",
    "간장": "간장",
    "된장": "된장",
    "고추장": "고추장",
    "참기름": "참기름",
    "배추": "배추",
    "당면": "당면",
    "마늘": "마늘",
    "미역": "미역",
    "고춧가루": "고춧가루",
    "애호박": "애호박",
}


def normalize_ingredient(name: str) -> str:
    """
    AI가 반환한 재료명 → DB item_key 정규화.
    직접 매핑 우선, 없으면 원문 반환.
    """
    n = name.strip()
    if n in ALIAS_TO_KEY:
        return ALIAS_TO_KEY[n]
    # 부분일치 (예: '닭가슴살(200g)' → '닭가슴살')
    for alias, key in ALIAS_TO_KEY.items():
        if alias in n:
            return key
    return n


def load_items() -> pd.DataFrame:
    """
    DB(daily_prices)에서 품목 로드.
    DB 없으면 빈 DataFrame 반환.
    컬럼: code, name, category, unit, emoji, avg_price, market_price, supermarket_price
    """
    try:
        from core.db import get_engine
        from sqlalchemy import text
        engine = get_engine()
        with engine.connect() as conn:
            df = pd.read_sql(text("""
                SELECT DISTINCT ON (item_key)
                    item_key,
                    gds_lclsf_nm AS category,
                    소매가,
                    kamis_unit,
                    중앙값,
                    최저가,
                    최고가
                FROM daily_prices
                WHERE item_key IS NOT NULL AND item_key != ''
                ORDER BY item_key,
                    CASE WHEN 소매가 IS NOT NULL THEN 0 ELSE 1 END,
                    소매가 ASC NULLS LAST
            """), conn)
    except Exception:
        return pd.DataFrame(columns=[
            "code", "name", "category", "unit", "emoji",
            "avg_price", "market_price", "supermarket_price",
        ])

    if df.empty:
        return pd.DataFrame(columns=[
            "code", "name", "category", "unit", "emoji",
            "avg_price", "market_price", "supermarket_price",
        ])

    df["unit"]     = df["kamis_unit"].fillna("원/kg")
    df["category"] = df["category"].fillna("기타")

    # 도매→소매 변환 계수
    _FACTOR = {
        "채소류": 1.55, "과실류": 1.50, "곡류": 1.40,
        "축산물": 1.50, "수산물": 1.60, "특용작물류": 1.45,
        "가공식품": 1.30,
    }

    def _retail(row) -> int:
        소매가 = row.get("소매가")
        중앙값 = row.get("중앙값")
        if pd.notna(소매가) and 소매가 > 0:
            return int(소매가)
        if pd.notna(중앙값) and 중앙값 > 0:
            factor = _FACTOR.get(row["category"], 1.50)
            return round(int(중앙값) * factor / 10) * 10
        # 소매가·중앙값 모두 없으면 AI 추론
        try:
            from routers.items import _infer_price_with_ai, _fallback_price
            item_key = row.get("item_key", "")
            inferred = _infer_price_with_ai(item_key, row.get("category", "기타"), row.get("unit", "원/kg"))
            if inferred and inferred > 0:
                return int(inferred)
            return _fallback_price(item_key)
        except Exception:
            return 3000  # 최후 fallback

    df["avg_price"]         = df.apply(_retail, axis=1)
    df["market_price"]      = (df["avg_price"] * 0.92).astype(int)
    df["supermarket_price"] = (df["avg_price"] * 1.08).astype(int)
    df["emoji"]    = df["item_key"].map(EMOJI_MAP).fillna("🛒")
    df["code"]     = df["item_key"]
    df["name"]     = df["item_key"]

    # price_reports 제보 우선 적용 + daily_prices에 없는 제보 품목 추가
    try:
        from core.db import get_engine
        from sqlalchemy import text
        with get_engine().connect() as conn:
            reports = pd.read_sql(text("""
                SELECT DISTINCT ON (item_key)
                    item_key, price AS reported_price, unit AS reported_unit
                FROM price_reports
                ORDER BY item_key, reported_at DESC
            """), conn)
        if not reports.empty:
            existing_keys = set(df["name"].tolist())
            new_rows = []
            for _, row in reports.iterrows():
                item_key  = row["item_key"]
                rep_price = int(row["reported_price"])
                if item_key in existing_keys:
                    mask = df["name"] == item_key
                    df.loc[mask, "avg_price"]         = rep_price
                    df.loc[mask, "market_price"]      = int(rep_price * 0.92)
                    df.loc[mask, "supermarket_price"] = int(rep_price * 1.08)
                else:
                    rep_unit = row.get("reported_unit") or "원/개"
                    new_rows.append({
                        "code":             item_key,
                        "name":             item_key,
                        "category":         "기타",
                        "unit":             rep_unit,
                        "emoji":            EMOJI_MAP.get(item_key, "🛒"),
                        "avg_price":        rep_price,
                        "market_price":     int(rep_price * 0.92),
                        "supermarket_price":int(rep_price * 1.08),
                    })
            if new_rows:
                df = pd.concat([df, pd.DataFrame(new_rows)], ignore_index=True)
    except Exception:
        pass

    return df[["code", "name", "category", "unit", "emoji",
               "avg_price", "market_price", "supermarket_price"]]
