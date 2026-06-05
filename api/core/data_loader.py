"""
core/data_loader.py
인천 점포 공공데이터 → 앱 표준 스키마(STORES_DF) 로더

원본 컬럼: 점포명 · 유형(13종) · 위치 · 위도 · 경도
표준 스키마: id · name · type · gu · lat · lng · certified · desc
"""

import os
import re
import pandas as pd
from core import _compat as st  # streamlit 제거 (FastAPI 환경)

# 프로젝트 루트 기준 경로 (core/ 의 상위)
_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CSV = os.path.join(_ROOT, "data", "incheon_stores.csv")

# ──────────────────────────────────────────────────────────────
# 유형 재분류: 원본 13종 → 장보기 서사 4종
#   전통시장   : 전통시장·시장            (지역상권 최우선)
#   골목상권   : 상점가/골목형상점가      (지역상권)
#   동네식품점 : 식육판매업·식자재마트    (장보기 직접 관련 동네 점포)
#   대형유통   : 마트·백화점·쇼핑센터 등  (지역상권 기여도 낮음)
# ──────────────────────────────────────────────────────────────
TYPE_MAP = {
    "전통시장": "전통시장", "시장": "전통시장",
    "상점가": "골목상권",
    "식육판매업": "동네식품점", "식자재마트": "동네식품점",
    "대형마트": "대형유통", "백화점": "대형유통", "쇼핑센터": "대형유통",
    "준대규모 점포": "대형유통", "그밖의 대규모점포": "대형유통",
    "그 밖의 대규모점포": "대형유통", "전문점": "대형유통", "기타": "대형유통",
}
LOCAL_TYPES = ["전통시장", "골목상권", "동네식품점"]  # 지역상권 기여 점포


def _extract_gu(addr: str) -> str:
    """주소 문자열에서 시군구 추출. '인천광역시 연수구 ...' / '연수구 ...' / '옹진군 ...' 모두 대응."""
    if not isinstance(addr, str):
        return "기타"
    cleaned = addr.replace("인천광역시", "").strip()
    m = re.search(r"(\S+?[구군])", cleaned)
    return m.group(1) if m else "기타"


@st.cache_data(ttl=3600)
def load_stores(path: str = _CSV) -> pd.DataFrame:
    """인천 점포 CSV를 앱 표준 스키마로 로드. cp949/utf-8 모두 대응."""
    try:
        df = pd.read_csv(path, encoding="utf-8-sig")
    except UnicodeDecodeError:
        df = pd.read_csv(path, encoding="cp949")

    df = df.drop(columns=["Unnamed: 0"], errors="ignore")
    df = df.rename(columns={
        "점포명": "name", "유형": "raw_type", "위치": "address",
        "위도": "lat", "경도": "lng",
    })

    df["type"] = df["raw_type"].map(TYPE_MAP).fillna("대형유통")
    df["gu"] = df["address"].apply(_extract_gu)
    df["certified"] = df["type"].isin(LOCAL_TYPES)
    df["desc"] = df["raw_type"]                       # 원본 세부 유형을 설명으로 노출
    df["id"] = [f"I{i:03d}" for i in range(1, len(df) + 1)]

    df = df.dropna(subset=["lat", "lng"]).reset_index(drop=True)
    return df[["id", "name", "type", "gu", "lat", "lng", "certified", "desc", "address"]]


def map_center(df: pd.DataFrame) -> tuple[float, float]:
    """데이터 centroid를 지도 초기 중심으로."""
    return round(df["lat"].mean(), 4), round(df["lng"].mean(), 4)
