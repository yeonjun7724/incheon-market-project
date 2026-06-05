"""
core/db_items.py
daily_prices 테이블 → LP 옵티마이저 호환 DataFrame 변환.

daily_prices 대분류(gds_lclsf_nm)를 optimizer.py의 카테고리 레이블
(과일/채소/단백질/탄수화물/양념/가공식품)로 매핑한다.
unit_price 기준:
  market_price  = 중앙값 (도매 경매가)
  avg_price     = 소매가 (KAMIS 소매가)
  둘 중 하나만 있으면 양쪽에 동일하게 사용. 둘 다 없으면 해당 행 제외.
"""

import pandas as pd
from sqlalchemy import text

_LCLSF_TO_CAT = {
    "과실류":    "과일",
    "채소류":    "채소",
    "엽경채류":  "채소",
    "근채류":    "채소",
    "조미채소류": "양념",
    "버섯류":    "채소",
    "식량작물":  "탄수화물",
    "잡곡류":    "탄수화물",
    "서류":      "탄수화물",
    "두류":      "단백질",
    "수산물":    "단백질",
    "축산물":    "단백질",
    "유가공":    "단백질",
    "수산가공":  "가공식품",
    "특용작물류": "양념",
    "임산물":    "가공식품",
}

_EMOJI = {
    "사과": "🍎", "배": "🍐", "포도": "🍇", "딸기": "🍓", "복숭아": "🍑",
    "방울토마토": "🍅", "멜론": "🍈", "참외": "🍈", "자두": "🟣", "바나나": "🍌",
    "배추": "🥬", "양파": "🧅", "대파": "🌿", "시금치": "🍃", "상추": "🥬",
    "깻잎": "🌿", "고추": "🌶️", "오이": "🥒", "애호박": "🥒", "무": "🫚",
    "당근": "🥕", "감자": "🥔", "고구마": "🍠", "마늘": "🧄", "생강": "🫚",
    "팽이버섯": "🍄", "느타리버섯": "🍄", "새송이버섯": "🍄",
    "쌀": "🍚", "찹쌀": "🍚", "보리": "🌾", "옥수수": "🌽",
    "콩": "🫘", "두부": "🧊", "콩나물": "🌱",
    "돼지고기": "🥩", "소고기": "🥩", "닭고기": "🍗", "계란": "🥚",
    "고등어": "🐟", "갈치": "🐟", "오징어": "🦑", "새우": "🦐",
    "참기름": "🫙", "들기름": "🫙", "고추장": "🌶️", "된장": "🟤", "간장": "🍶",
}


def load_db_items() -> pd.DataFrame:
    """
    daily_prices 테이블을 읽어 LP 옵티마이저 호환 DF 반환.
    DB 연결 실패 또는 빈 테이블이면 빈 DataFrame 반환.
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
                        AVG(중앙값)::float  AS market_price,
                        AVG(소매가)::float  AS avg_price,
                        MAX(kamis_unit)    AS unit
                    FROM daily_prices
                    WHERE item_key IS NOT NULL AND item_key <> ''
                    GROUP BY gds_lclsf_nm, item_key
                """),
                conn,
            )
    except Exception:
        return pd.DataFrame()

    if df.empty:
        return pd.DataFrame()

    # 가격이 둘 다 없는 행 제거
    df = df[df["market_price"].notna() | df["avg_price"].notna()].copy()

    # 한쪽만 있으면 반대쪽을 복사
    df["market_price"] = df["market_price"].fillna(df["avg_price"])
    df["avg_price"]    = df["avg_price"].fillna(df["market_price"])
    df["market_price"] = df["market_price"].astype(int)
    df["avg_price"]    = df["avg_price"].astype(int)

    # LP 카테고리 매핑
    df["category"] = df["gds_lclsf_nm"].map(_LCLSF_TO_CAT).fillna("가공식품")

    df = df.rename(columns={"item_key": "name"})
    df["code"]  = df["name"]
    df["emoji"] = df["name"].map(_EMOJI).fillna("🛒")
    df["unit"]  = df["unit"].fillna("1개")

    return df[["code", "name", "category", "unit", "avg_price", "market_price", "emoji"]].reset_index(drop=True)
