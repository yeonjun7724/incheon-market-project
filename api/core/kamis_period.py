"""
core/kamis_period.py
KAMIS periodProductList API - 기간별 품목 가격 조회

환경변수:
  KAMIS_CERT_KEY  - 발급받은 인증키
  KAMIS_CERT_ID   - 발급받은 인증 ID (보통 이메일)

사용 예:
  from core.kamis_period import fetch_period_prices
  rows = fetch_period_prices(start_day="2025-01-01", end_day="2025-01-31")
"""

import os
import requests
from datetime import date, timedelta

KAMIS_URL = "https://www.kamis.or.kr/service/price/xml.do"

# 인천 지역 코드
INCHEON_CODE = "2100"

# 주요 품목 코드 (KAMIS 채소·과일·축산)
# 카테고리: 100=양곡, 200=채소, 300=과일, 400=축산, 500=수산
ITEM_CODES = {
    "배추":   ("200", "211"),
    "시금치": ("200", "231"),
    "콩나물": ("200", "252"),
    "애호박": ("200", "214"),
    "양파":   ("200", "221"),
    "대파":   ("200", "226"),
    "감자":   ("200", "213"),
    "고구마": ("200", "215"),
    "사과":   ("300", "411"),
    "바나나": ("300", "424"),
}


def _get_keys() -> tuple[str | None, str | None]:
    return os.environ.get("KAMIS_CERT_KEY"), os.environ.get("KAMIS_CERT_ID")


def fetch_period_prices(
    start_day: str | None = None,
    end_day: str | None = None,
    item_category_code: str = "200",
    item_code: str = "211",
    country_code: str = INCHEON_CODE,
) -> list[dict]:
    """
    KAMIS periodProductList 호출.

    Args:
        start_day: 조회 시작일 "YYYY-MM-DD" (기본: 30일 전)
        end_day:   조회 종료일 "YYYY-MM-DD" (기본: 오늘)
        item_category_code: 품목 대분류 코드
        item_code: 품목 코드
        country_code: 지역 코드 (기본: 인천 2100)

    Returns:
        [{"item_name": ..., "unit": ..., "day": ..., "price": ...}, ...]
    """
    cert_key, cert_id = _get_keys()
    if not cert_key or not cert_id:
        raise EnvironmentError(
            "KAMIS_CERT_KEY / KAMIS_CERT_ID 환경변수를 설정하세요."
        )

    today = date.today()
    if end_day is None:
        end_day = today.strftime("%Y-%m-%d")
    if start_day is None:
        start_day = (today - timedelta(days=30)).strftime("%Y-%m-%d")

    params = {
        "action": "periodProductList",
        "p_cert_key": cert_key,
        "p_cert_id": cert_id,
        "p_returntype": "json",
        "p_start_day": start_day,
        "p_end_day": end_day,
        "p_itemcategorycode": item_category_code,
        "p_itemcode": item_code,
        "p_kindcode": "",
        "p_productrankcode": "",
        "p_countrycode": country_code,
        "p_convert_kg_yn": "N",
    }

    r = requests.get(KAMIS_URL, params=params, timeout=10)
    r.raise_for_status()

    data = r.json()

    inner = data.get("data", {})
    if isinstance(inner, list) or inner.get("error_code", "000") != "000":
        return []

    items = inner.get("item", [])

    rows = []
    for item in items:
        price_raw = str(item.get("price", "")).replace(",", "").strip()
        try:
            price = int(float(price_raw))
        except (ValueError, TypeError):
            price = None

        # itemname이 빈 리스트로 올 때 처리
        item_name = item.get("itemname") or ""
        kind_name = item.get("kindname") or ""
        county_name = item.get("countyname") or ""
        market_name = item.get("marketname") or ""

        rows.append({
            "item_name": item_name if isinstance(item_name, str) else "",
            "kind_name": kind_name if isinstance(kind_name, str) else "",
            "county_name": county_name if isinstance(county_name, str) else "",
            "market_name": market_name if isinstance(market_name, str) else "",
            "yyyy": item.get("yyyy", ""),
            "day": item.get("regday", ""),
            "price": price,
        })

    return rows


def fetch_all_items(
    start_day: str | None = None,
    end_day: str | None = None,
    country_code: str = INCHEON_CODE,
) -> dict[str, list[dict]]:
    """
    ITEM_CODES 에 정의된 모든 품목의 기간별 가격을 한 번에 가져온다.
    반환: {"배추": [...], "양파": [...], ...}
    """
    result = {}
    for name, (cat_code, item_code) in ITEM_CODES.items():
        try:
            rows = fetch_period_prices(
                start_day=start_day,
                end_day=end_day,
                item_category_code=cat_code,
                item_code=item_code,
                country_code=country_code,
            )
            result[name] = rows
        except Exception as e:
            result[name] = {"error": str(e)}
    return result
