"""
core/fish_daily.py
KMI 수산물 소매가 API - 어종별 최신 소매가 조회

엔드포인트: http://fish-api.kmi.re.kr:9090/API/openAPI.do
subAction:  rtlsalPrice

어종 코드 KDFSH01~KDFSH14 전체를 조회하며,
가격(pc)이 0인 날을 제외하고 가장 최신 날짜의 소매가를 반환한다.
"""

import requests
from datetime import date, timedelta

FISH_API_URL = "http://fish-api.kmi.re.kr:9090/API/openAPI.do"
FISH_API_KEY = "PmRYn482HNtjQX45hd4qpZ398TnV46"

FISH_CODES = [f"KDFSH{i:02d}" for i in range(1, 15)]  # KDFSH01 ~ KDFSH14


def _fetch_one(code: str, start_dt: str, end_dt: str) -> list[dict]:
    """단일 어종코드 + 기간으로 API 호출. 빈 리스트 반환 가능."""
    try:
        r = requests.get(FISH_API_URL, params={
            "key": FISH_API_KEY,
            "kdfshCode": code,
            "subAction": "rtlsalPrice",
            "startDt": start_dt,
            "endDt": end_dt,
        }, timeout=10)
        r.raise_for_status()
        return r.json().get("data", [])
    except Exception:
        return []


def fetch_latest_prices(lookback_months: int = 3) -> list[dict]:
    """
    KDFSH01~14 전체 어종에 대해 가장 최신 소매가를 반환한다.

    API는 한 요청당 최대 1개월(31건) 데이터를 반환하므로,
    최근 월부터 lookback_months 개월 전까지 역순으로 탐색한다.

    Returns:
        [
          {
            "code":         "KDFSH04",
            "date":         "2026-05-29",
            "price":        3689.0,
            "price_yr_ago": 3678.0,
            "accmlt_price": 4097,
          },
          ...
        ]
    """
    today = date.today()
    results = []

    for code in FISH_CODES:
        found = None

        for m in range(lookback_months):
            # m개월 전 월의 1일~말일
            first_day = (today.replace(day=1) - timedelta(days=m * 28)).replace(day=1)
            # 말일 = 다음달 1일 - 1일
            if first_day.month == 12:
                last_day = first_day.replace(year=first_day.year + 1, month=1, day=1) - timedelta(days=1)
            else:
                last_day = first_day.replace(month=first_day.month + 1) - timedelta(days=1)

            start_dt = first_day.strftime("%Y%m%d")
            end_dt   = min(last_day, today).strftime("%Y%m%d")

            rows = _fetch_one(code, start_dt, end_dt)
            non_zero = [r for r in rows if r.get("pc", 0) != 0]

            if non_zero:
                latest = sorted(non_zero, key=lambda x: x["creatDate"], reverse=True)[0]
                found = {
                    "code":          code,
                    "date":          latest["creatDate"],
                    "price":         latest.get("pc"),
                    "price_yr_ago":  latest.get("yr"),
                    "accmlt_price":  latest.get("accmltPc"),
                }
                break  # 이 코드의 최신 데이터 찾았으면 다음 코드로

        if found:
            results.append(found)
        else:
            results.append({
                "code":         code,
                "date":         None,
                "price":        None,
                "price_yr_ago": None,
                "accmlt_price": None,
            })

    return results
