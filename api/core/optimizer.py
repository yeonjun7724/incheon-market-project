"""
core/optimizer.py
예산 제약 장바구니 최적화 — 선형계획법(LP)

기존 그리디 휴리스틱을 scipy.optimize.linprog 기반 진짜 LP로 교체.
고전 'Stigler 식단 문제' 변형:
  결정변수  x_i : 품목 i 구매 수량 (연속, 0 ≤ x_i ≤ q_max)
  목적함수  max  Σ util_i · x_i      (linprog는 최소화 → -util 부호 반전)
  제약 1    Σ price_i · x_i ≤ budget   (예산)
  제약 2    카테고리별 최소 효용 확보   (영양 균형 — 단백질·채소 편식 방지)
"""

import numpy as np
import pandas as pd
from scipy.optimize import linprog

# 식단 선호별 카테고리 효용 가중치
PREF_WEIGHTS = {
    "균형":     {"단백질":1.2,"채소":1.2,"탄수화물":1.0,"과일":0.8,"양념":0.6,"가공식품":0.5},
    "채소":     {"채소":1.8,"단백질":0.8,"탄수화물":1.0,"과일":1.0,"양념":0.6,"가공식품":0.4},
    "단백질":   {"단백질":1.8,"채소":0.8,"탄수화물":0.8,"과일":0.6,"양념":0.5,"가공식품":0.5},
    "저탄수화물":{"단백질":1.5,"채소":1.5,"탄수화물":0.3,"과일":0.8,"양념":0.5,"가공식품":0.4},
}
HOUSEHOLD_SCALE = {1:1.0, 2:1.6, 3:2.3, 4:3.0}

# 선호별 카테고리 제약 프로파일 (예산 대비 min/max 비율)
# 식단 선호가 효용 가중치뿐 아니라 제약 구조를 직접 바꿔 결과가 명확히 갈리게 함
PREF_CONSTRAINTS = {
    "균형":     {"min":{"단백질":0.15,"채소":0.15},
                 "max":{"단백질":0.40,"채소":0.40,"탄수화물":0.30,"과일":0.25,"양념":0.15,"가공식품":0.15}},
    "채소":     {"min":{"채소":0.40,"단백질":0.10},
                 "max":{"단백질":0.25,"채소":0.60,"탄수화물":0.25,"과일":0.25,"양념":0.15,"가공식품":0.15}},
    "단백질":   {"min":{"단백질":0.40,"채소":0.10},
                 "max":{"단백질":0.60,"채소":0.25,"탄수화물":0.20,"과일":0.20,"양념":0.15,"가공식품":0.15}},
    "저탄수화물":{"min":{"단백질":0.30,"채소":0.30},
                 "max":{"단백질":0.50,"채소":0.50,"탄수화물":0.08,"과일":0.20,"양념":0.15,"가공식품":0.10}},
}


def optimize_basket(items_df: pd.DataFrame, budget: int, household: int,
                    pref: str, use_market: bool, q_max: float = 2.0) -> pd.DataFrame:
    """
    예산 내 효용 최대화 장바구니를 LP로 산출.
    반환: 선택 품목 DF (qty, unit_price, line_total 포함). 해 없으면 빈 DF.
    """
    df = items_df.copy().reset_index(drop=True)
    scale = HOUSEHOLD_SCALE.get(household, 3.0)
    pcol = "market_price" if use_market else "avg_price"
    df["unit_price"] = (df[pcol] * scale).astype(int)

    w = PREF_WEIGHTS.get(pref, PREF_WEIGHTS["균형"])
    df["pw"] = df["category"].map(w).fillna(0.6)
    # 단위가격 대비 효용 (싸고 선호 높을수록 ↑) — 그리디와 동일 척도, 해석 일관성 유지
    df["util"] = df["pw"] / (df["unit_price"] / 1000 + 0.1)

    n = len(df)
    prices = df["unit_price"].to_numpy(dtype=float)
    util = df["util"].to_numpy(dtype=float)

    # 목적함수: max Σ util·x  →  min Σ (-util)·x
    c = -util

    # 부등식 제약 A_ub · x ≤ b_ub
    A_ub, b_ub = [], []
    # (1) 예산
    A_ub.append(prices); b_ub.append(float(budget))
    # (2) 카테고리 최소 — Σ_{i∈cat} price·x ≥ ratio·budget  →  -Σ price·x ≤ -ratio·budget
    cons = PREF_CONSTRAINTS.get(pref, PREF_CONSTRAINTS["균형"])
    for cat, ratio in cons["min"].items():
        mask = (df["category"] == cat).to_numpy(dtype=float)
        if mask.sum() > 0:
            A_ub.append(-prices * mask)
            b_ub.append(-ratio * budget)
    # (3) 카테고리 최대 — Σ_{i∈cat} price·x ≤ ratio·budget (쏠림 방지, 선호 반영)
    for cat, ratio in cons["max"].items():
        mask = (df["category"] == cat).to_numpy(dtype=float)
        if mask.sum() > 0:
            A_ub.append(prices * mask)
            b_ub.append(ratio * budget)

    bounds = [(0, q_max)] * n   # 품목당 0~q_max 단위 (한 품목 몰빵 방지)

    res = linprog(c, A_ub=np.array(A_ub), b_ub=np.array(b_ub),
                  bounds=bounds, method="highs")

    if not res.success:
        return pd.DataFrame()

    df["qty"] = np.floor(res.x * 100) / 100   # 내림 → 예산 초과 방지
    df = df[df["qty"] >= 0.05].copy()           # 미미한 수량 제거
    df["line_total"] = (df["unit_price"] * df["qty"]).astype(int)
    df = df.sort_values("line_total", ascending=False).reset_index(drop=True)
    return df


def basket_summary(basket: pd.DataFrame) -> dict:
    """총액·예산사용·카테고리 배분 요약."""
    if basket.empty:
        return {"total": 0, "n_items": 0, "by_category": {}}
    return {
        "total": int(basket["line_total"].sum()),
        "n_items": len(basket),
        "by_category": basket.groupby("category")["line_total"].sum().to_dict(),
    }
