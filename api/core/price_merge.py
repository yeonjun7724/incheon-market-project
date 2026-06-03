"""
core/price_merge.py
KAT 경매 데이터 + KAMIS 전용 품목을 합쳐 DB 적재용 단일 DataFrame 생성.

처리 순서:
  [KAT]
  1. fetch_auction_prices() 호출 → 대분류별 집계 테이블 (소분류 1행 = 최저가/중앙값/평균가/최고가)
  2. 대분류 dict를 단일 DataFrame으로 병합, gds_lclsf_nm 컬럼 복원
  3. scsbd_dt = target_date 12:00:00 추가
  4. 소매가, kamis_unit = null

  [KAMIS]
  5. fetch_daily_prices() 호출 → 전체 소매가 목록
  6. KAT 소분류 정규화명(괄호 제거)과 KAMIS item_name(/ 이전)을 비교해 매칭
     - 매칭 성공: 해당 KAMIS의 소매가/kamis_unit을 KAT 행에 채워넣음 (첫 번째 매칭 사용)
     - 매칭 실패: KAMIS 전용 행으로 추가
  7. KAMIS 전용 행: category → gds_lclsf_nm, item_name 원문 → gds_sclsf_nm
  8. lastest_day + 12:00:00 → scsbd_dt (price_today 없으면 price_yesterday + 전날 정오)

  [합산]
  9. KAT(소매가 채워진) + KAMIS 전용 행 concat → 단일 DataFrame 반환
"""

import re
import sqlite3
import pandas as pd
from datetime import date, timedelta
from core.kat_auction import fetch_auction_prices
from core.kamis_daily import fetch_daily_prices

# KAT 소분류가 품종명으로 기재된 경우 → 품목 대표명 수동 매핑
_ITEM_KEY_MAP = {
    "미얀마":    "사과",
    "신고":      "배",
    "그린황도":  "복숭아",
    "설향":      "딸기",
    "네트계":    "멜론",
    "금싸라기":  "참외",
    "대추방울":  "방울토마토",
    "진지향":    "만감",
    "홍자두":    "자두",
    "팽이1호":   "팽이버섯",
    "취청":      "오이",
    "청양":      "풋고추",
    "밤고구마":  "고구마",
    "곡실옥수수": "옥수수",
    "녹색":      "아스파라거스",
}

# KAT·KAMIS 대분류명 불일치 통일 매핑
_CATEGORY_MAP = {
    "과일류":      "과실류",
    "특용작물":    "특용작물류",
    "수산가공":    "수산물",
    "신선 해조류": "수산물",
    "활 해면어류": "수산물",
}

_FINAL_COLS = [
    "gds_lclsf_nm",
    "gds_mclsf_cd", "gds_mclsf_nm",
    "gds_sclsf_cd", "gds_sclsf_nm",
    "item_key",
    "unit_cd", "unit_nm",
    "최저가", "중앙값", "평균가", "최고가",
    "scsbd_dt",
    "소매가", "kamis_unit",
]


def _normalize_kat_name(name: str) -> str:
    """'느타리버섯(일반)' → '느타리버섯'"""
    return re.sub(r'\(.*?\)', '', str(name)).strip()


def _normalize_kamis_name(name: str) -> str:
    """'쌀/20kg' → '쌀'"""
    return str(name).split('/')[0].strip()


def build_price_table(target_date: str | None = None) -> pd.DataFrame:
    """
    KAT 경매 + KAMIS 전용 품목을 합산한 DB 적재용 DataFrame 반환.

    Args:
        target_date: 'YYYY-MM-DD' (기본: 오늘)

    Returns:
        컬럼: gds_lclsf_nm, gds_mclsf_cd, gds_mclsf_nm, gds_sclsf_cd, gds_sclsf_nm,
              unit_cd, unit_nm, 최저가, 중앙값, 평균가, 최고가,
              scsbd_dt, 소매가, kamis_unit
        KAT·KAMIS 중복 시 KAT 행에 소매가 병합.
        KAT 행(KAMIS 매칭): 도매가 + 소매가 둘 다 보유
        KAT 행(KAMIS 미매칭): 소매가·kamis_unit = null
        KAMIS 전용 행: gds_mclsf_*, gds_sclsf_cd, unit_cd, unit_nm, 최저가/중앙값/평균가/최고가 = null
    """
    if target_date is None:
        target_date = date.today().strftime("%Y-%m-%d")

    noon_dt = pd.Timestamp(f"{target_date} 12:00:00")

    # ── KAT ──────────────────────────────────────────────
    kat_tables = fetch_auction_prices(target_date)

    kat_parts = []
    for lclsf, df in kat_tables.items():
        df = df.copy()
        df.insert(0, "gds_lclsf_nm", lclsf)
        kat_parts.append(df)

    if kat_parts:
        kat_df = pd.concat(kat_parts, ignore_index=True)
        kat_df["gds_lclsf_nm"] = kat_df["gds_lclsf_nm"].map(lambda x: _CATEGORY_MAP.get(x, x))
        kat_df["item_key"]   = kat_df["gds_sclsf_nm"].apply(
            lambda x: _ITEM_KEY_MAP.get(x, _normalize_kat_name(x))
        )
        kat_df["scsbd_dt"]   = noon_dt
        kat_df["소매가"]      = None
        kat_df["kamis_unit"] = None
    else:
        kat_df = pd.DataFrame(columns=_FINAL_COLS)

    # ── KAMIS ─────────────────────────────────────────────
    kamis_rows = fetch_daily_prices()

    # norm_name → KAMIS 행 목록 (첫 번째 매칭을 KAT에 병합)
    kamis_lookup: dict[str, list[dict]] = {}
    for row in kamis_rows:
        key = _normalize_kamis_name(row["item_name"])
        kamis_lookup.setdefault(key, []).append(row)

    # KAT 행에 소매가 채워넣기
    matched_keys: set[str] = set()
    for idx, kat_row in kat_df.iterrows():
        kat_key = _normalize_kat_name(kat_row["gds_sclsf_nm"])
        if kat_key not in kamis_lookup:
            continue
        kamis_row = kamis_lookup[kat_key][0]
        matched_keys.add(kat_key)
        p_today = kamis_row.get("price_today")
        p_yest  = kamis_row.get("price_yesterday")
        lastest = kamis_row.get("lastest_day", "")
        try:
            base_dt = pd.Timestamp(f"{lastest} 12:00:00")
        except Exception:
            base_dt = None
        kat_df.loc[idx, "소매가"]      = p_today if p_today is not None else p_yest
        kat_df.loc[idx, "kamis_unit"] = kamis_row.get("unit")

    # KAMIS 전용 행 (KAT와 미매칭)
    kamis_records = []
    for row in kamis_rows:
        if _normalize_kamis_name(row["item_name"]) in matched_keys:
            continue
        price_today = row.get("price_today")
        price_yesterday = row.get("price_yesterday")
        lastest_day = row.get("lastest_day", "")

        try:
            base_dt = pd.Timestamp(f"{lastest_day} 12:00:00")
        except Exception:
            base_dt = None

        if price_today is not None:
            소매가 = price_today
            scsbd_dt = base_dt
        else:
            소매가 = price_yesterday
            scsbd_dt = (base_dt - pd.Timedelta(days=1)) if base_dt else None

        category = row.get("category", "")
        kamis_records.append({
            "gds_lclsf_nm":  _CATEGORY_MAP.get(category, category),
            "gds_mclsf_cd":  None,
            "gds_mclsf_nm":  None,
            "gds_sclsf_cd":  None,
            "gds_sclsf_nm":  row.get("item_name", ""),
            "item_key":       _normalize_kamis_name(row.get("item_name", "")),
            "unit_cd":        None,
            "unit_nm":        None,
            "최저가":          None,
            "중앙값":          None,
            "평균가":          None,
            "최고가":          None,
            "scsbd_dt":       scsbd_dt,
            "소매가":          소매가,
            "kamis_unit":     row.get("unit"),
        })

    kamis_df = (
        pd.DataFrame(kamis_records, columns=_FINAL_COLS)
        if kamis_records
        else pd.DataFrame(columns=_FINAL_COLS)
    )

    # ── 합산 ──────────────────────────────────────────────
    return pd.concat([kat_df[_FINAL_COLS], kamis_df], ignore_index=True)


def save_price_table(df: pd.DataFrame, db_path: str,
                     table: str = "daily_prices") -> None:
    """
    build_price_table() 결과를 SQLite DB에 저장.

    한글 컬럼/데이터 보존을 위해 UTF-8 인코딩 명시.
    기존 테이블은 당일 데이터로 교체(replace).
    """
    conn = sqlite3.connect(db_path, check_same_thread=False)
    try:
        conn.execute("PRAGMA encoding='UTF-8'")
        df.to_sql(table, conn, if_exists="replace", index=False)
        conn.commit()
    finally:
        conn.close()
