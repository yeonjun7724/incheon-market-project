"""품목 시드 로더 — 기존 app.py 인라인 ITEMS_SEED를 CSV(data/items_seed.csv)에서 로드."""
import os
import pandas as pd
from core.price_api import apply_live_prices

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_CSV = os.path.join(_ROOT, "data", "items_seed.csv")

# 이모지 매핑 (기존 app.py ITEMS_SEED 기준)
_EMOJI = {
    "계란": "🥚", "두부": "🧊", "돼지앞다리": "🥩", "닭가슴살": "🍗",
    "콩나물": "🌱", "애호박": "🥒", "양파": "🧅", "대파": "🌿",
    "배추": "🥬", "시금치": "🍃", "쌀": "🍚", "감자": "🥔",
    "고구마": "🍠", "사과": "🍎", "바나나": "🍌", "참기름": "🫙",
    "고추장": "🌶️", "된장": "🟤", "간장": "🍶", "두유": "🥛",
}


def load_items() -> pd.DataFrame:
    df = pd.read_csv(_CSV, encoding="utf-8-sig")
    df["emoji"] = df["name"].map(_EMOJI).fillna("🛒")
    # KAMIS 실시간가 반영 (키 없으면 시드 유지)
    df, _status = apply_live_prices(df)
    return df
