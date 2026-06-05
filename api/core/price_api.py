"""
core/price_api.py
KAMIS(농수산식품유통공사) 일별 소매가격 OpenAPI 연동 + 시드 폴백

표준 패턴:
  - secrets.toml 에 KAMIS 인증키(cert_key/cert_id)가 있으면 → 실시간 소매가 반영
  - 키가 없거나 호출 실패 → 시드 가격으로 자동 폴백 (앱은 항상 동작)
캐시: @st.cache_data(ttl=86400) — 일 1회 갱신 (KAMIS 소매가 일 단위 조사)
"""

import requests
import pandas as pd
from core import _compat as st  # streamlit 제거 (FastAPI 환경)

KAMIS_URL = "https://www.kamis.or.kr/service/price/xml.do"

# seed name → KAMIS item_name 부분일치 키워드
# 키가 seed의 name 컬럼과 정확히 일치해야 apply_live_prices에서 매칭됨
KAMIS_ITEM_MATCH = {
    "계란":         ["계란", "달걀"],
    "두부":         ["두부"],
    "돼지고기앞다리": ["돼지/앞다리"],
    "닭가슴살":     ["닭/닭가슴살", "닭/육계"],
    "콩나물":       ["콩나물"],
    "애호박":       ["애호박", "호박/애호박"],
    "양파":         ["양파/양파", "양파"],
    "대파":         ["파/대파"],
    "배추":         ["배추/봄", "배추"],
    "시금치":       ["시금치/시금치", "시금치"],
    "쌀":           ["쌀/20kg", "쌀/10kg", "쌀"],
    "감자":         ["감자/수미(노지)", "감자/수미", "감자"],
    "고구마":       ["고구마/밤", "고구마"],
    "사과":         ["사과/후지", "사과"],
    "바나나":       ["바나나/수입", "바나나"],
    "참기름":       ["참기름"],
    "고추장":       ["고추장"],
    "된장":         ["된장"],
    "간장":         ["간장"],
    "두유":         ["두유"],
}


def _get_keys():
    """secrets.toml 에서 KAMIS 인증정보 조회. 없으면 (None, None)."""
    try:
        return st.secrets["KAMIS_CERT_KEY"], st.secrets["KAMIS_CERT_ID"]
    except Exception:
        return None, None


def _match_item(kamis_name: str) -> str | None:
    """KAMIS item_name을 seed name으로 역매칭. 정확히 포함하는 키워드 우선."""
    for app_name, kws in KAMIS_ITEM_MATCH.items():
        if any(kw in kamis_name for kw in kws):
            return app_name
    return None


@st.cache_data(ttl=86400)
def fetch_kamis_prices() -> dict:
    """
    KAMIS 일별 소매가 조회 → {seed품목명: {"price": int, "unit": str}} 딕셔너리.
    키 없음/실패 시 빈 dict 반환(→ 시드 유지).
    """
    cert_key, cert_id = _get_keys()
    if not cert_key or not cert_id:
        return {}

    try:
        r = requests.get(KAMIS_URL, params={
            "action": "dailySalesList",
            "p_cert_key": cert_key,
            "p_cert_id": cert_id,
            "p_returntype": "json",
        }, timeout=8)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return {}

    rows = data.get("price", []) if isinstance(data, dict) else []
    out: dict[str, dict] = {}
    for row in rows:
        kamis_name = str(row.get("item_name", "")).strip()
        app_name = _match_item(kamis_name)
        if not app_name or app_name in out:  # 첫 번째 매칭만 사용
            continue
        raw = str(row.get("dpr1", "")).replace(",", "").strip()
        unit = str(row.get("unit", "")).strip()
        try:
            price = int(float(raw))
            if price > 0:
                out[app_name] = {"price": price, "unit": unit}
        except (ValueError, TypeError):
            continue
    return out


def apply_live_prices(items_df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """
    시드 ITEMS_DF 에 KAMIS 실시간 소매가와 단위를 덮어쓴다.
    가격과 단위 모두 KAMIS 기준으로 갱신 (예: 대파 3023원/1kg).
    """
    df = items_df.copy()
    live = fetch_kamis_prices()
    if not live:
        return df, "🔸 시드 가격 (KAMIS 키 미설정 또는 호출 실패)"

    matched = 0
    for i, row in df.iterrows():
        entry = live.get(row["name"])
        if not entry:
            continue
        p = entry["price"]
        u = entry["unit"]
        df.at[i, "avg_price"]        = p
        df.at[i, "market_price"]     = int(p * 0.92)
        df.at[i, "supermarket_price"] = int(p * 1.05)
        df.at[i, "unit"]             = u   # KAMIS 단위로 갱신
        matched += 1
    return df, f"🟢 KAMIS 실시간 소매가 반영 ({matched}/{len(df)} 품목)"
