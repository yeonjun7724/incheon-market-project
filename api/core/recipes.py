"""
core/recipes.py
LocalCart 확장 로직 — AI 에이전트(요리→재료) · 가게별 가격 합성 · 추천경로 · 구매 팁

설계 의도
  - RECIPE_DB     : 요리명 → 재료 리스트 (룰 기반 "AI 에이전트" 폴백).
                    나중에 LLM 호출로 교체 시 ask_agent() 만 갈아끼우면 됨.
  - EXTRA_ITEMS   : 메인 20개 품목에 없는 레시피 재료(당면·마늘 등) 보강.
  - store_item_price : (가게, 품목) 결정론적 가격 — 같은 입력이면 항상 같은 값.
                    공공 평균가(market~supermarket) 범위 안에서 가게 유형·시드로 분산.
  - recommend_routes : 최저예산 / 최소거리 / 최소경유 3가지 전략 경로 추출.
  - buying_tip    : 품목별 "좋은 거 고르는 법" 팁 (img1 ? 버튼).
"""

from __future__ import annotations
import hashlib
import math
import pandas as pd


# ──────────────────────────────────────────────────────────────
# 1) 레시피 DB (요리 → 재료)  ※ LLM 폴백용 룰 기반
# ──────────────────────────────────────────────────────────────
RECIPE_DB = {
    "찜닭":     ["닭가슴살", "감자", "양파", "대파", "간장", "당면"],
    "닭볶음탕": ["닭가슴살", "감자", "양파", "대파", "고추장", "고춧가루"],
    "김치찌개": ["돼지앞다리", "두부", "대파", "양파", "고춧가루", "마늘"],
    "된장찌개": ["두부", "애호박", "양파", "대파", "된장", "감자"],
    "제육볶음": ["돼지앞다리", "양파", "대파", "고추장", "고춧가루", "마늘"],
    "비빔밥":   ["계란", "콩나물", "시금치", "쌀", "고추장", "참기름"],
    "잡채":     ["당면", "양파", "대파", "시금치", "간장", "참기름"],
    "미역국":   ["미역", "돼지앞다리", "마늘", "참기름", "간장"],
    "계란찜":   ["계란", "대파", "간장"],
    "샐러드":   ["시금치", "사과", "바나나", "두유"],
    "카레":     ["감자", "양파", "닭가슴살", "쌀"],
    "콩나물국밥":["콩나물", "계란", "대파", "쌀", "고춧가루"],
}

# 메인 20품목에 없는 재료 보강 (가격은 공공 소매가 참고 근사치)
EXTRA_ITEMS = {
    # name        category    unit     avg    market  super  emoji
    "당면":      ("탄수화물", "300g",  3500,  3200,  3900,  "🍜"),
    "마늘":      ("양념",     "100g",  1200,  1000,  1400,  "🧄"),
    "고춧가루":  ("양념",     "100g",  3800,  3400,  4200,  "🌶️"),
    "미역":      ("채소",     "50g",   2000,  1700,  2300,  "🌿"),
}


def ask_agent(query: str) -> tuple[str | None, list[str]]:
    """
    요리명(또는 일부)을 받아 (매칭된요리명, 재료리스트) 반환.
    룰 기반 폴백 — 부분일치 지원. 매칭 실패 시 (None, []).
    ※ 추후 LLM 연결 시 이 함수 본문만 교체.
    """
    if not query:
        return None, []
    q = query.strip().replace(" ", "")
    # 1) 정확/부분 일치
    for dish, ings in RECIPE_DB.items():
        if dish in q or q in dish:
            return dish, ings
    # 2) 재료 역검색 (재료명으로 검색해도 그 재료 포함 요리 첫 매칭)
    for dish, ings in RECIPE_DB.items():
        if any(q in ing or ing in q for ing in ings):
            return dish, ings
    return None, []


# ──────────────────────────────────────────────────────────────
# 2) 가게별 가격 합성 (결정론적)
# ──────────────────────────────────────────────────────────────
# 가게 유형별 가격 계수 — 전통시장이 싸고 대형유통이 비싼 경향 반영
_TYPE_FACTOR = {"전통시장": 0.90, "골목상권": 0.96, "동네식품점": 1.00, "대형유통": 1.08}


def _seed(*parts) -> float:
    """문자열 조합 → 0~1 안정 난수 (해시 기반, 실행마다 동일)."""
    h = hashlib.md5("|".join(map(str, parts)).encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def item_meta(name: str, items_df: pd.DataFrame) -> dict | None:
    """메인 품목 또는 EXTRA_ITEMS 에서 품목 메타 조회."""
    hit = items_df[items_df["name"] == name]
    if not hit.empty:
        r = hit.iloc[0]
        return {"name": name, "category": r["category"], "unit": r["unit"],
                "avg": int(r["avg_price"]), "market": int(r["market_price"]),
                "super": int(r["supermarket_price"]), "emoji": r["emoji"]}
    if name in EXTRA_ITEMS:
        cat, unit, avg, mk, sp, em = EXTRA_ITEMS[name]
        return {"name": name, "category": cat, "unit": unit,
                "avg": avg, "market": mk, "super": sp, "emoji": em}
    return None


def store_item_price(store_id: str, store_type: str, meta: dict) -> int:
    """(가게, 품목) 결정론적 단가. market~super 범위 안에서 유형·시드로 분산."""
    lo, hi = meta["market"], meta["super"]
    base = lo + (hi - lo) * _seed(store_id, meta["name"])      # 범위 내 위치
    factor = _TYPE_FACTOR.get(store_type, 1.0)
    return max(int(base * factor), int(lo * 0.85))


def price_range(meta: dict, stores_df: pd.DataFrame) -> tuple[int, int]:
    """후보 가게들에서 해당 품목 최저가~최고가."""
    if stores_df.empty:
        return meta["market"], meta["super"]
    ps = [store_item_price(r["id"], r["type"], meta) for _, r in stores_df.iterrows()]
    return min(ps), max(ps)


def cheapest_store(meta: dict, stores_df: pd.DataFrame):
    """해당 품목 최저가 가게 row + 가격 반환. (img2 자주사는품목 → 최저가 상점 연결)"""
    best, best_p = None, None
    for _, r in stores_df.iterrows():
        p = store_item_price(r["id"], r["type"], meta)
        if best_p is None or p < best_p:
            best, best_p = r, p
    return best, best_p


# ──────────────────────────────────────────────────────────────
# 3) 추천 경로 (최저예산 / 최소거리 / 최소경유)
# ──────────────────────────────────────────────────────────────
def _haversine(la1, lo1, la2, lo2) -> float:
    R = 6371000
    p1, p2 = math.radians(la1), math.radians(la2)
    dp, dl = math.radians(la2 - la1), math.radians(lo2 - lo1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _nn_order(home, stores_df):
    """현위치 기준 최근접이웃(NN) 방문순서. 반환: 정렬된 store row 리스트."""
    pool = list(stores_df.itertuples(index=False))
    order, cur = [], home
    while pool:
        nxt = min(pool, key=lambda s: _haversine(cur[0], cur[1], s.lat, s.lng))
        order.append(nxt)
        cur = (nxt.lat, nxt.lng)
        pool.remove(nxt)
    return order


def _route_len_m(home, ordered):
    """home → 순서대로 방문 시 총 이동거리(m)."""
    total, cur = 0.0, home
    for s in ordered:
        total += _haversine(cur[0], cur[1], s.lat, s.lng)
        cur = (s.lat, s.lng)
    return total


def recommend_routes(ingredients, items_df, stores_df, home) -> dict:
    """
    재료 리스트 → 3가지 전략 경로.
    각 전략: {stops:[store row], items_by_store:{id:[(품목,가격)]},
              budget:int, distance_m:float, minutes:int, n_stops:int}
    """
    metas = [m for m in (item_meta(n, items_df) for n in ingredients) if m]
    if not metas or stores_df.empty:
        return {}

    # 각 품목별 (가게 → 가격) 테이블
    price_tbl = {}   # name -> list[(store_row, price)]
    for m in metas:
        rows = [(r, store_item_price(r["id"], r["type"], m)) for _, r in stores_df.iterrows()]
        price_tbl[m["name"]] = sorted(rows, key=lambda x: x[1])

    def build(assign: dict):
        """assign: name -> store_row. → 전략 결과 dict."""
        by_store = {}
        budget = 0
        for m in metas:
            sr = assign[m["name"]]
            p = store_item_price(sr["id"], sr["type"], m)
            by_store.setdefault(sr["id"], {"row": sr, "items": []})
            by_store[sr["id"]]["items"].append((m["name"], p, m["emoji"], m["unit"]))
            budget += p
        ordered = _nn_order(home, pd.DataFrame([v["row"] for v in by_store.values()]))
        dist = _route_len_m(home, ordered)
        return {
            "stops": ordered,
            "by_store": by_store,
            "budget": budget,
            "distance_m": dist,
            "minutes": int(dist / 67) + len(by_store) * 5,   # 도보 4km/h + 가게당 5분
            "n_stops": len(by_store),
        }

    # A) 최저예산 — 품목마다 전체 최저가 가게
    a_assign = {name: tbl[0][0] for name, tbl in price_tbl.items()}

    # B) 최소거리 — 현위치 최근접 가게 중 그 품목 파는 곳(전부 판다고 가정) 최근접
    near = sorted(stores_df.itertuples(index=False),
                  key=lambda s: _haversine(home[0], home[1], s.lat, s.lng))
    near_id = near[0].id if near else None
    b_assign = {}
    for m in metas:
        # 현위치에서 가까운 순으로, 가격표에 있는 가게 중 최근접
        cand = sorted(price_tbl[m["name"]],
                      key=lambda x: _haversine(home[0], home[1], x[0]["lat"], x[0]["lng"]))
        b_assign[m["name"]] = cand[0][0]

    # C) 최소경유 — 1개 가게에서 다 사기(가장 가까운 단일 가게)
    # 경유 수 최소(1곳) + 거리 최소 → 현위치에서 가장 가까운 단일 가게
    best_single = min(
        stores_df.iterrows(),
        key=lambda kv: _haversine(home[0], home[1], kv[1]["lat"], kv[1]["lng"]),
    )[1]
    c_assign = {m["name"]: best_single for m in metas}

    return {
        "최저예산": build(a_assign),
        "최소거리": build(b_assign),
        "최소경유": build(c_assign),
    }


# ──────────────────────────────────────────────────────────────
# 4) 구매 팁 (img1 ? 버튼)
# ──────────────────────────────────────────────────────────────
TIP_DB = {
    "계란":     ["껍데기에 금·균열 없는지 확인", "흔들었을 때 출렁임 적을수록 신선", "표면이 까칠하고 광택 적은 게 신선란"],
    "닭가슴살": ["살이 탄력 있고 눌렀을 때 바로 복원", "분홍빛 도는 선명한 색", "포장 안 핏물 적은 것"],
    "돼지앞다리":["선홍색에 윤기, 지방은 흰색", "눌렀을 때 탄력 있는 것", "이취(냄새) 없는 것"],
    "두부":     ["포장 물이 맑은 것", "유통기한 넉넉한 것", "단단함은 용도에 맞게(찌개=부침용)"],
    "양파":     ["껍질 마르고 단단한 것", "뿌리·싹 안 난 것", "들었을 때 묵직한 것"],
    "대파":     ["흰 대 굵고 단단한 것", "잎끝 시들지 않은 것", "뿌리 살아있는 것이 오래감"],
    "감자":     ["싹·녹색 변색 없는 것", "표면 매끈하고 단단한 것", "주름 없는 것"],
    "배추":     ["겉잎 짙은 초록, 묵직한 것", "밑동 깨끗한 것", "잎 사이 단단히 찬 것"],
    "사과":     ["꼭지 싱싱하고 향 진한 것", "표면 매끈·단단한 것", "들었을 때 무거운 것"],
    "시금치":   ["잎 짙은 녹색, 뿌리 붉은 것", "줄기 짧고 도톰한 것", "무르지 않은 것"],
    "당면":     ["굵기 일정한 것", "고구마 전분 100% 확인", "투명도 높은 것"],
}


def buying_tip(name: str) -> list[str]:
    """품목별 구매 팁 3가지. 없으면 일반 팁."""
    return TIP_DB.get(name, ["신선도·유통기한 먼저 확인", "겉포장 손상 없는지 확인", "단위가격(100g당) 비교 후 구매"])
