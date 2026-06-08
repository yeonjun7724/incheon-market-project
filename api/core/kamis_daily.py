"""
core/kamis_daily.py
KAMIS dailySalesList API - 당일 전체 품목 소매가 조회

한 번 호출로 전체 품목 가격을 반환한다.
periodProductList와 달리 품목 코드 없이 전체를 받아 로컬에서 매칭.

환경변수:
  KAMIS_CERT_KEY
  KAMIS_CERT_ID
"""

import os
import requests
from datetime import date

KAMIS_URL = "https://www.kamis.or.kr/service/price/xml.do"

# items_seed.csv 20개 품목 → dailySalesList item_name 매칭 키워드
# 첫 번째 매칭되는 항목을 사용
ITEM_MATCH = {
    "쌀":        ["쌀/20kg"],
    "계란":      ["계란/특란30구"],
    "두부":      ["두부"],
    "돼지고기앞다리": ["돼지/앞다리"],
    "닭가슴살":  ["닭/닭가슴살", "닭/육계"],
    "콩나물":    ["콩나물"],
    "애호박":    ["호박/애호박"],
    "양파":      ["양파/양파"],
    "대파":      ["파/대파"],
    "배추":      ["배추/봄", "배추/"],
    "시금치":    ["시금치/시금치"],
    "감자":      ["감자/수미(노지)", "감자/수미"],
    "고구마":    ["고구마/밤", "고구마/"],
    "사과":      ["사과/후지", "사과/"],
    "바나나":    ["바나나/수입", "바나나/"],
    "참기름":    ["참기름"],
    "고추장":    ["고추장"],
    "된장":      ["된장"],
    "간장":      ["간장"],
    "두유":      ["두유"],
}


def _get_keys() -> tuple[str | None, str | None]:
    return os.environ.get("KAMIS_CERT_KEY"), os.environ.get("KAMIS_CERT_ID")


def _parse_price(raw) -> int | None:
    if not raw or isinstance(raw, list):
        return None
    try:
        return int(float(str(raw).replace(",", "").strip()))
    except (ValueError, TypeError):
        return None


def fetch_daily_prices(country_code: str = "2100") -> list[dict]:
    """
    KAMIS dailySalesList 호출 → 전체 소매 품목 당일 가격 반환.

    Returns:
        [{"item_name": ..., "unit": ..., "price_today": ...,
          "price_yesterday": ..., "price_1m": ..., "price_1y": ...,
          "category": ..., "lastest_day": ...}, ...]
    """
    cert_key, cert_id = _get_keys()
    if not cert_key or not cert_id:
        raise EnvironmentError("KAMIS_CERT_KEY / KAMIS_CERT_ID 환경변수를 설정하세요.")

    r = requests.get(KAMIS_URL, params={
        "action": "dailySalesList",
        "p_cert_key": cert_key,
        "p_cert_id": cert_id,
        "p_returntype": "json",
        "p_countrycode": country_code,
    }, timeout=10)
    r.raise_for_status()
    data = r.json()

    if data.get("error_code", "000") != "000":
        return []

    rows = []
    for item in data.get("price", []):
        if item.get("product_cls_code") != "01":  # 소매(01)만, 도매(02) 제외
            continue
        rows.append({
            "item_name":       item.get("item_name", ""),
            "unit":            item.get("unit", ""),
            "category":        item.get("category_name", ""),
            "lastest_day":     item.get("lastest_day", ""),
            "price_today":     _parse_price(item.get("dpr1")),
            "price_yesterday": _parse_price(item.get("dpr2")),
            "price_1m":        _parse_price(item.get("dpr3")),
            "price_1y":        _parse_price(item.get("dpr4")),
        })
    return rows


def fetch_matched_prices(country_code: str = "2100") -> dict[str, dict]:
    """
    dailySalesList 결과를 items_seed.csv 20개 품목에 매칭해 반환.

    Returns:
        {
          "배추": {"item_name": "배추/봄", "unit": "1포기",
                   "price_today": 3654, "price_yesterday": ...,
                   "lastest_day": "2026-06-02"},
          ...
        }
    """
    all_items = fetch_daily_prices(country_code)

    # item_name → row 인덱스로 빠른 조회
    name_map: dict[str, dict] = {row["item_name"]: row for row in all_items}

    result = {}
    for our_name, keywords in ITEM_MATCH.items():
        matched = None
        for kw in keywords:
            # 정확한 키로 먼저 시도, 그다음 부분일치
            if kw in name_map:
                matched = name_map[kw]
                break
            for item_name, row in name_map.items():
                if kw in item_name:
                    matched = row
                    break
            if matched:
                break
        result[our_name] = matched  # 매칭 안 되면 None

    return result
