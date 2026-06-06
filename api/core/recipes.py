"""
core/recipes.py
LocalCart AI 로직 — ChatGPT API(gpt-4o-mini) 우선, 룰 기반 폴백
  - ask_agent(): OpenAI Chat Completions API → 재료명을 DB item_key로 정규화
  - infer_store_items(): 가게명 키워드 기반 취급 품목 추론
  - learn_store_from_receipt(): 영수증 학습 데이터 저장
  - recommend_routes(): 3전략 경로 (DB item_key 기반 매핑)
"""

from __future__ import annotations
import hashlib
import math
import os
import json
import re
import pandas as pd

# ── OpenAI 설정 ────────────────────────────────────────────────
_OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
_OPENAI_MODEL = "gpt-4o-mini"

def _call_openai(system: str, user: str, max_tokens: int = 512) -> str | None:
    """OpenAI Chat Completions 동기 호출. 실패 시 None."""
    if not _OPENAI_KEY:
        return None
    try:
        import openai
        client = openai.OpenAI(api_key=_OPENAI_KEY)
        resp = client.chat.completions.create(
            model=_OPENAI_MODEL,
            max_tokens=max_tokens,
            messages=[
                {"role": "system", "content": system},
                {"role": "user",   "content": user},
            ],
            response_format={"type": "json_object"},
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        import logging
        logging.getLogger("localcart").warning(f"OpenAI call failed: {e}")
        return None


# ──────────────────────────────────────────────────────────────
# 1) 레시피 DB (룰 기반 폴백) — item_key 기준으로 통일
# ──────────────────────────────────────────────────────────────
RECIPE_DB: dict[str, list[str]] = {
    "찜닭":       ["닭가슴살", "감자", "양파", "대파", "간장", "당면"],
    "닭볶음탕":   ["닭가슴살", "감자", "양파", "대파", "고추장", "고춧가루"],
    "김치찌개":   ["돼지고기앞다리", "두부", "대파", "양파", "고춧가루", "마늘"],
    "된장찌개":   ["두부", "애호박", "양파", "대파", "된장", "감자"],
    "제육볶음":   ["돼지고기앞다리", "양파", "대파", "고추장", "고춧가루", "마늘"],
    "비빔밥":     ["계란", "콩나물", "시금치", "쌀", "고추장", "참기름"],
    "잡채":       ["당면", "양파", "대파", "시금치", "간장", "참기름"],
    "미역국":     ["미역", "돼지고기앞다리", "마늘", "참기름", "간장"],
    "계란찜":     ["계란", "대파", "간장"],
    "샐러드":     ["시금치", "사과", "바나나", "두유"],
    "카레":       ["감자", "양파", "닭가슴살", "쌀"],
    "콩나물국밥": ["콩나물", "계란", "대파", "쌀", "고춧가루"],
    "순두부찌개": ["두부", "계란", "양파", "대파", "고춧가루", "마늘"],
    "부대찌개":   ["두부", "양파", "대파", "간장", "고춧가루"],
    "떡볶이":     ["양파", "대파", "고추장", "고춧가루"],
    "불고기":     ["양파", "대파", "간장", "참기름", "마늘"],
    "삼겹살구이": ["돼지고기앞다리", "마늘", "양파", "대파"],
    "닭갈비":     ["닭가슴살", "양파", "대파", "고추장", "고춧가루"],
    "오징어볶음": ["양파", "대파", "고추장", "고춧가루", "마늘"],
    "두부김치":   ["두부", "대파", "고춧가루", "마늘", "배추"],
    "계란말이":   ["계란", "대파", "간장"],
    "감자조림":   ["감자", "간장", "마늘"],
    "시금치나물": ["시금치", "마늘", "간장", "참기름"],
    "콩나물무침": ["콩나물", "대파", "마늘", "간장"],
    "잡채밥":     ["당면", "양파", "시금치", "간장", "참기름", "계란"],
}

# DB에서 직접 못 찾는 재료의 대체 데이터 (DB 없을 때 폴백)
EXTRA_ITEMS: dict[str, tuple] = {
    "당면":     ("탄수화물", "300g",  3500,  3200,  3900,  "🍜"),
    "마늘":     ("양념",     "100g",  1200,  1000,  1400,  "🧄"),
    "고춧가루": ("양념",     "100g",  3800,  3400,  4200,  "🌶️"),
    "미역":     ("채소",     "50g",   2000,  1700,  2300,  "🌿"),
    "된장":     ("양념",     "150g",  2500,  2200,  2800,  "🫙"),
    "참기름":   ("양념",     "150ml", 4500,  4000,  5000,  "🫒"),
    "간장":     ("양념",     "200ml", 2000,  1800,  2200,  "🫙"),
    "고추장":   ("양념",     "150g",  3000,  2700,  3300,  "🌶️"),
    "애호박":   ("채소",     "1개",   1500,  1300,  1700,  "🥬"),
}


def _normalize_ingredient(name: str) -> str:
    """AI 재료명 → DB item_key 정규화 (core/items.py의 normalize_ingredient와 동기화)."""
    from core.items import normalize_ingredient
    return normalize_ingredient(name)


# ──────────────────────────────────────────────────────────────
# 2) ask_agent: 요리명 → 재료 리스트 (ChatGPT 우선, 룰 폴백)
# ──────────────────────────────────────────────────────────────
def ask_agent(query: str) -> tuple[str | None, list[str]]:
    """
    요리명 → (요리명, DB item_key 기준 재료리스트).
    1순위: ChatGPT gpt-4o-mini
    2순위: 룰 기반 RECIPE_DB
    """
    if not query:
        return None, []
    q = query.strip()

    # 1) ChatGPT 시도
    ai_result = _call_openai(
        system=(
            "당신은 한국 요리 전문가입니다. "
            "사용자가 요리명을 주면 반드시 JSON 형식으로만 응답하세요. "
            '형식: {"dish": "정확한요리명", "ingredients": ["재료1", "재료2", ...]} '
            "재료는 한국 마트/시장에서 살 수 있는 실제 식재료 이름을 간결하게 써주세요 "
            "(예: 돼지앞다리, 닭가슴살, 대파, 양파, 감자, 두부, 계란, 시금치, 콩나물, "
            "쌀, 배추, 고구마, 사과, 바나나, 간장, 된장, 고추장, 참기름, 고춧가루, 마늘). "
            "소금·물·기름처럼 기본 조미료 제외. 최소 4개, 최대 8개. "
            "요리가 아니면: {\"dish\": null, \"ingredients\": []}"
        ),
        user=q,
        max_tokens=300,
    )

    if ai_result:
        try:
            obj = json.loads(ai_result)
            dish = obj.get("dish")
            raw_ings = obj.get("ingredients", [])
            if dish and isinstance(raw_ings, list) and len(raw_ings) >= 2:
                # DB item_key로 정규화
                ings = [_normalize_ingredient(i) for i in raw_ings]
                return dish, ings
        except Exception:
            pass

    # 2) 룰 기반 폴백
    qn = q.replace(" ", "")
    for dish, ings in RECIPE_DB.items():
        if dish in qn or qn in dish:
            return dish, ings
    for dish, ings in RECIPE_DB.items():
        if any(qn in ing or ing in qn for ing in ings):
            return dish, ings
    return None, []


# ──────────────────────────────────────────────────────────────
# 3) 가게명 → 취급 품목 추론 + 영수증 학습
# ──────────────────────────────────────────────────────────────
_STORE_ITEM_CACHE: dict[str, dict] = {}

# 가게명 키워드 → DB item_key 목록
_NAME_KEYWORD_MAP: list[tuple[list[str], list[str]]] = [
    (["정육", "축산", "한돈", "소고기", "돼지", "육류"],
     ["돼지고기앞다리", "닭가슴살"]),
    (["채소", "야채", "청과"],
     ["양파", "대파", "시금치", "콩나물", "감자", "애호박", "배추"]),
    (["수산", "생선", "횟집"],
     ["미역", "두부"]),
    (["두부", "콩나물"],
     ["두부", "콩나물"]),
    (["계란", "달걀"],
     ["계란"]),
    (["쌀", "곡물", "잡곡"],
     ["쌀", "당면"]),
    (["반찬", "국거리", "식자재"],
     ["두부", "콩나물", "시금치", "계란", "대파", "배추"]),
    (["마트", "슈퍼", "편의점", "유통", "식품"],
     ["양파", "감자", "두부", "계란", "대파", "쌀", "콩나물", "고추장", "된장", "간장"]),
    (["시장", "전통"],
     ["양파", "대파", "감자", "시금치", "돼지고기앞다리", "두부", "계란",
      "콩나물", "배추", "고춧가루", "마늘", "된장"]),
    (["과일", "청과물"],
     ["사과", "바나나", "고구마"]),
    (["양념", "조미"],
     ["간장", "된장", "고추장", "고춧가루", "마늘", "참기름"]),
]


def infer_store_items_by_name(store_name: str) -> list[str]:
    for keywords, items in _NAME_KEYWORD_MAP:
        if any(kw in store_name for kw in keywords):
            return items
    # 기본: 일반 식품점
    return ["양파", "대파", "감자", "두부", "계란", "콩나물"]


def learn_store_from_receipt(store_id: str, store_name: str, items: list[dict]) -> None:
    item_names = [_normalize_ingredient(it["name"]) for it in items if it.get("name")]
    _STORE_ITEM_CACHE[store_id] = {
        "store_name": store_name,
        "items": item_names,
        "prices": {_normalize_ingredient(it["name"]): it.get("price", 0)
                   for it in items if it.get("name")},
        "source": "receipt",
    }


def get_store_items(store_id: str) -> dict:
    if store_id in _STORE_ITEM_CACHE:
        cached = _STORE_ITEM_CACHE[store_id]
        return {"items": cached["items"], "source": cached["source"],
                "prices": cached.get("prices", {})}
    return {}


_STORE_AI_CACHE: dict[str, list[str]] = {}


def infer_store_items_ai(store_name: str, store_type: str = "") -> list[str]:
    """가게명·업종으로 취급 품목 5개를 AI 추론. 캐시 후 반환."""
    cache_key = f"{store_name}:{store_type}"
    if cache_key in _STORE_AI_CACHE:
        return _STORE_AI_CACHE[cache_key]

    raw = _call_openai(
        system=(
            "당신은 한국 소매 유통 전문가입니다. "
            "가게 이름과 업종을 주면 그 가게에서 주로 파는 식재료·식품 품목 5가지를 "
            'JSON 배열로만 답하세요. 형식: {"items": ["품목1", "품목2", ...]} '
            "품목은 한국 마트에서 쓰는 간단한 이름으로(예: 대파, 계란, 돼지고기 등)."
        ),
        user=f"가게명: {store_name}, 업종: {store_type or '일반식품점'}",
        max_tokens=120,
    )
    items: list[str] = []
    if raw:
        try:
            obj = json.loads(raw)
            items = [str(x) for x in obj.get("items", []) if x][:5]
        except Exception:
            pass

    if not items:
        items = infer_store_items_by_name(store_name)[:5]

    _STORE_AI_CACHE[cache_key] = items
    return items


# ──────────────────────────────────────────────────────────────
# 4) 가게별 가격 합성
# ──────────────────────────────────────────────────────────────
_TYPE_FACTOR = {"전통시장": 0.90, "골목상권": 0.96, "동네식품점": 1.00, "대형유통": 1.08}

# DB/EXTRA에 없는 재료 → OpenAI 가격 추론 캐시
_AI_PRICE_CACHE: dict[str, int] = {}


def _infer_item_price_ai(item_name: str) -> int:
    """DB·EXTRA에 없는 재료의 한국 마트 소매가를 OpenAI로 추론. 실패 시 2000원 반환."""
    if item_name in _AI_PRICE_CACHE:
        return _AI_PRICE_CACHE[item_name]
    result = _call_openai(
        system=(
            "당신은 한국 식품 가격 전문가입니다. "
            "품목명을 주면 한국 일반 마트 소매가를 JSON으로 답하세요. "
            '형식: {"price": 숫자, "unit": "단위"} — 숫자는 정수(원), 예: {"price": 2500, "unit": "100g"}'
        ),
        user=f"품목: {item_name}",
        max_tokens=60,
    )
    if result:
        try:
            obj = json.loads(result)
            price = int(obj.get("price", 2000))
            if 100 <= price <= 200000:
                _AI_PRICE_CACHE[item_name] = price
                return price
        except Exception:
            pass
    _AI_PRICE_CACHE[item_name] = 2000
    return 2000


def _seed(*parts) -> float:
    h = hashlib.md5("|".join(map(str, parts)).encode()).hexdigest()
    return int(h[:8], 16) / 0xFFFFFFFF


def store_item_price(store_id: str, store_type: str, item: pd.Series) -> int:
    factor = _TYPE_FACTOR.get(store_type, 1.0)
    lo = int(item.get("market_price", 0))
    hi = int(item.get("supermarket_price", 0))
    noise = 0.85 + _seed(store_id, item.get("name", "")) * 0.30
    price = lo + (hi - lo) * noise * factor
    return max(100, round(price / 100) * 100)


# ──────────────────────────────────────────────────────────────
# 5) 경로 추천
# ──────────────────────────────────────────────────────────────
def _haversine(la1, lo1, la2, lo2) -> float:
    R = 6371000
    p1, p2 = math.radians(la1), math.radians(la2)
    dp = math.radians(la2 - la1)
    dl = math.radians(lo2 - lo1)
    a = math.sin(dp/2)**2 + math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def _assign_items(ingredients: list[str], items_df: pd.DataFrame,
                  stores_df: pd.DataFrame) -> dict[str, dict]:
    """
    각 가게가 커버할 수 있는 재료를 매핑.
    ingredients: DB item_key 기준 재료명 리스트.
    """
    # items_df를 item_key로 인덱싱
    items_by_key: dict[str, pd.Series] = {}
    if not items_df.empty:
        for _, row in items_df.iterrows():
            key = row.get("name", row.get("code", ""))
            if key:
                items_by_key[key] = row

    result: dict[str, dict] = {}
    for _, store in stores_df.iterrows():
        store_id = store["id"]
        store_info = get_store_items(store_id, store["name"])
        carried = store_info["items"]

        matched_ings = []
        for ing in ingredients:
            # 가게 취급 품목에 포함되는지 확인 (정확 또는 부분 일치)
            covered = (
                ing in carried
                or any(ing in c or c in ing for c in carried)
            )
            if not covered:
                continue

            # 가격 결정: 영수증 학습 → DB → EXTRA_ITEMS 순
            price_override = store_info["prices"].get(ing)
            if price_override:
                price = price_override
                emoji = "🛒"
                unit  = ""
            elif ing in items_by_key:
                row = items_by_key[ing]
                price = store_item_price(store_id, store["type"], row)
                emoji = row.get("emoji", "🛒")
                unit  = row.get("unit", "")
            elif ing in EXTRA_ITEMS:
                ei = EXTRA_ITEMS[ing]
                factor = _TYPE_FACTOR.get(store["type"], 1.0)
                price = round(ei[2] * factor / 100) * 100
                emoji = ei[5]
                unit  = ei[1]
            else:
                # DB에도 EXTRA에도 없는 품목: OpenAI로 가격 추론
                base_price = _infer_item_price_ai(ing)
                factor = _TYPE_FACTOR.get(store["type"], 1.0)
                price = max(100, round(base_price * factor / 100) * 100)
                emoji = "🛒"
                unit  = ""

            matched_ings.append((ing, price, emoji, unit))

        if matched_ings:
            result[store_id] = {"row": store, "items": matched_ings}

    return result


def _build_plan(ingredients: list[str], store_assignments: dict,
                origin: tuple[float, float]) -> dict | None:
    if not store_assignments:
        return None
    covered: set[str] = set()
    stops, by_store = [], {}
    total_budget = 0

    for sid, info in store_assignments.items():
        new_ings = [i for i in info["items"] if i[0] not in covered]
        if not new_ings:
            continue
        stops.append(info["row"])
        by_store[sid] = {"row": info["row"], "items": new_ings}
        total_budget += sum(p for _, p, _, _ in new_ings)
        covered.update(i[0] for i in new_ings)

    if not stops:
        return None

    coords = [(origin[0], origin[1])] + [(s["lat"], s["lng"]) for s in stops]
    dist = sum(
        _haversine(coords[i][0], coords[i][1], coords[i+1][0], coords[i+1][1])
        for i in range(len(coords) - 1)
    )
    walk_min = dist / 80
    shop_min = len(stops) * 10
    total_min = round(walk_min + shop_min)

    return {
        "stops": stops,
        "by_store": by_store,
        "budget": total_budget,
        "distance_m": dist,
        "minutes": total_min,
        "n_stops": len(stops),
    }


# 채식 선호 시 제외할 재료 (육류)
_MEAT_KEYS = {"돼지고기앞다리", "닭가슴살", "소고기", "육류", "돼지", "닭"}


def recommend_routes(ingredients: list[str], items_df: pd.DataFrame,
                     stores_df: pd.DataFrame,
                     origin: tuple[float, float],
                     radius_m: int = 3000,
                     budget: int = 0,
                     household: int = 1,
                     pref: str = "균형",
                     use_market: bool = True) -> dict[str, dict]:
    """3전략 경로 반환. ingredients는 DB item_key 기준."""
    # 채식 선호 시 육류 재료 제외
    if pref == "채식":
        ingredients = [i for i in ingredients if i not in _MEAT_KEYS]

    stores_df = stores_df.copy()
    stores_df["_dist"] = stores_df.apply(
        lambda r: _haversine(origin[0], origin[1], r["lat"], r["lng"]), axis=1)
    nearby = stores_df[stores_df["_dist"] <= radius_m].copy()

    # use_market=False 면 전통시장 비선호 (대형유통 우선)
    if not use_market:
        market_stores = nearby[nearby["type"] == "전통시장"]
        other_stores  = nearby[nearby["type"] != "전통시장"]
        nearby = pd.concat([other_stores, market_stores])

    if nearby.empty:
        return {}

    assignments = _assign_items(ingredients, items_df, nearby)
    if not assignments:
        return {}

    # 가구 수에 따라 예산 스케일 (가구원 / 2 배율, 최소 1)
    hh_scale = max(1.0, household / 2.0)

    strategies: dict[str, dict] = {}

    # 최저예산: 전통시장 우선 (use_market=True 시)
    if use_market:
        budget_sort_key = lambda kv: _TYPE_FACTOR.get(kv[1]["row"]["type"], 1.0)
    else:
        budget_sort_key = lambda kv: -_TYPE_FACTOR.get(kv[1]["row"]["type"], 1.0)

    budget_sorted = dict(sorted(assignments.items(), key=budget_sort_key))
    p = _build_plan(ingredients, budget_sorted, origin)
    if p:
        p["budget"] = round(p["budget"] * hh_scale)
        p["household"] = household
        # budget 조건: 초과 여부 표시
        if budget > 0:
            p["over_budget"] = p["budget"] > budget
        strategies["최저예산"] = p

    # 최소거리: 가까운 순
    dist_sorted = dict(sorted(
        assignments.items(),
        key=lambda kv: _haversine(origin[0], origin[1],
                                  float(kv[1]["row"]["lat"]), float(kv[1]["row"]["lng"]))
    ))
    p = _build_plan(ingredients, dist_sorted, origin)
    if p:
        p["budget"] = round(p["budget"] * hh_scale)
        p["household"] = household
        if budget > 0:
            p["over_budget"] = p["budget"] > budget
        strategies["최소거리"] = p

    # 최소경유: 커버리지 큰 순
    cov_sorted = dict(sorted(
        assignments.items(),
        key=lambda kv: -len(kv[1]["items"])
    ))
    p = _build_plan(ingredients, cov_sorted, origin)
    if p:
        p["budget"] = round(p["budget"] * hh_scale)
        p["household"] = household
        if budget > 0:
            p["over_budget"] = p["budget"] > budget
        strategies["최소경유"] = p

    return strategies


# ──────────────────────────────────────────────────────────────
# 6) buying_tip
# ──────────────────────────────────────────────────────────────
_TIPS: dict[str, list[str]] = {
    "양파":         ["껍질이 황금빛이고 단단한 것", "눌렀을 때 물렁거리지 않는 것"],
    "감자":         ["상처·녹색 부위 없는 것", "껍질이 매끈하고 단단한 것"],
    "두부":         ["유통기한 필수 확인", "포장 안 물이 맑은 것"],
    "계란":         ["껍질에 금 없는 것", "흔들면 소리 없는 신선한 것"],
    "대파":         ["잎 끝이 마르지 않은 것", "흰 부분이 두툼한 것"],
    "시금치":       ["잎이 진녹색이고 싱싱한 것", "줄기가 가는 것이 부드러움"],
    "콩나물":       ["콩 머리가 노랗고 통통한 것", "꼬리가 너무 길지 않은 것"],
    "닭가슴살":     ["분홍색 유지, 회색 없는 것", "탄력있고 냄새 없는 것"],
    "돼지고기앞다리":["선홍색이고 기름기 적당한 것", "냄새 없는 신선한 것"],
    "쌀":           ["투명하고 광택 있는 것", "빻린 가루 없는 것"],
    "사과":         ["색이 고르고 무거운 것", "꼭지가 싱싱한 것"],
    "배추":         ["잎이 꽉 차고 무거운 것", "속이 노란빛인 것"],
    "마늘":         ["통통하고 단단한 것", "껍질이 잘 붙어있는 것"],
}


def buying_tip(name: str) -> list[str]:
    key = _normalize_ingredient(name)
    for k, tips in _TIPS.items():
        if k in key or key in k:
            return tips
    return ["신선한 것으로 구매하세요.", "유통기한을 꼭 확인하세요."]
