"""GET /recipes/{dish} — 요리명 → 재료 리스트 (AI 에이전트)."""
from fastapi import APIRouter
from core.recipes import ask_agent, buying_tip, EXTRA_ITEMS

router = APIRouter(prefix="/recipes", tags=["recipes"])


@router.get("/extra-items")
def extra_items():
    return list(EXTRA_ITEMS.keys())


@router.get("/tip/{name}")
def tip(name: str):
    return {"name": name, "tips": buying_tip(name)}


@router.get("/{dish}")
def recipe(dish: str):
    matched, ings = ask_agent(dish)
    return {"query": dish, "dish": matched, "ingredients": ings}
