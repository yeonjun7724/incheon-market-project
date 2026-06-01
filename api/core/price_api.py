"""
core/price_api.py
KAMIS(농수산식품유통공사) 일별 소매가격 OpenAPI 연동 + 시드 폴백

표준 패턴:
  - secrets.toml 에 KAMIS 인증키(cert_key/cert_id)가 있으면 → 실시간 소매가 반영
  - 키가 없거나 호출 실패 → 시드 가격으로 자동 폴백 (앱은 항상 동작)
캐시: @st.cache_data(ttl=86400) — 일 1회 갱신 (KAMIS 소매가 일 단위 조사)

※ 이 코드는 KAMIS dailySalesList 스펙대로 작성됨. 실제 실시간 전환은
  secrets.toml 에 발급키를 넣고 배포 환경에서 검증 필요(샌드박스는 외부망 차단).
"""

import requests
import pandas as pd
from core import _compat as st  # streamlit 제거 (FastAPI 환경)

KAMIS_URL = "https://www.kamis.or.kr/service/price/xml.do"

# 앱 품목명 → KAMIS 응답 품목명 매칭 (부분일치 키워드)
# KAMIS dailySalesList 의 item_name 과 우리 20개 품목을 잇는다.
KAMIS_ITEM_MATCH = {
    "계란": ["계란", "달걀"], "두부": ["두부"], "돼지앞다리": ["돼지", "앞다리"],
    "닭가슴살": ["닭", "닭고기"], "콩나물": ["콩나물"], "애호박": ["애호박", "호박"],
    "양파": ["양파"], "대파": ["대파", "파"], "배추": ["배추"], "시금치": ["시금치"],
    "쌀": ["쌀"], "감자": ["감자"], "고구마": ["고구마"], "사과": ["사과"],
    "바나나": ["바나나"], "참기름": ["참기름"], "고추장": ["고추장"],
    "된장": ["된장"], "간장": ["간장"], "두유": ["두유"],
}


def _get_keys():
    """secrets.toml 에서 KAMIS 인증정보 조회. 없으면 (None, None)."""
    try:
        return st.secrets["KAMIS_CERT_KEY"], st.secrets["KAMIS_CERT_ID"]
    except Exception:
        return None, None


def _match_item(kamis_name: str):
    """KAMIS 품목명을 앱 품목명으로 역매칭."""
    for app_name, kws in KAMIS_ITEM_MATCH.items():
        if any(kw in kamis_name for kw in kws):
            return app_name
    return None


@st.cache_data(ttl=86400)
def fetch_kamis_prices() -> dict:
    """
    KAMIS 일별 소매가 조회 → {앱품목명: 소매가(int)} 딕셔너리.
    키 없음/실패 시 빈 dict 반환(→ 시드 유지).
    """
    cert_key, cert_id = _get_keys()
    if not cert_key or not cert_id:
        return {}

    params = {
        "action": "dailySalesList",
        "p_cert_key": cert_key,
        "p_cert_id": cert_id,
        "p_returntype": "json",
    }
    try:
        r = requests.get(KAMIS_URL, params=params, timeout=8)
        r.raise_for_status()
        data = r.json()
    except Exception:
        return {}

    # dailySalesList 응답: {"price":[{"item_name":..,"dpr1":"소매가",..}, ...]}
    rows = data.get("price", []) if isinstance(data, dict) else []
    out = {}
    for row in rows:
        name = str(row.get("item_name", "")).strip()
        app_name = _match_item(name)
        if not app_name:
            continue
        raw = str(row.get("dpr1", "")).replace(",", "").strip()
        try:
            price = int(float(raw))
            if price > 0:
                out[app_name] = price
        except (ValueError, TypeError):
            continue
    return out


def apply_live_prices(items_df: pd.DataFrame) -> tuple[pd.DataFrame, str]:
    """
    시드 ITEMS_DF 에 KAMIS 실시간 소매가를 덮어쓴다.
    반환: (갱신된 DF, 상태문자열). avg_price/market_price 동기 갱신.
    """
    df = items_df.copy()
    live = fetch_kamis_prices()
    if not live:
        return df, "🔸 시드 가격 (KAMIS 키 미설정 또는 호출 실패)"

    matched = 0
    for i, row in df.iterrows():
        if row["name"] in live:
            p = live[row["name"]]
            df.at[i, "avg_price"] = p
            df.at[i, "market_price"] = int(p * 0.92)        # 전통시장 약 8% 저렴 가정
            df.at[i, "supermarket_price"] = int(p * 1.05)
            matched += 1
    return df, f"🟢 KAMIS 실시간 소매가 반영 ({matched}/{len(df)} 품목)"
