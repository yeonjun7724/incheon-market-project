"""POST /basket/optimize — 예산 맞춤 장바구니 LP 최적화."""
from fastapi import APIRouter
from pydantic import BaseModel
from core.optimizer import optimize_basket, basket_summary
from core.items import load_items
from core.recipes import recommend_meals_ai, lookup_ingredient_info

router = APIRouter(prefix="/basket", tags=["basket"])


class BasketReq(BaseModel):
    budget: int = 50000
    household: int = 2
    pref: str = "균형"
    use_market: bool = True


class MealReq(BaseModel):
    pref: str = "균형"
    budget: int = 50000
    household: int = 2


@router.post("/meal-recommendations")
def meal_recommendations(req: MealReq):
    items = load_items()
    meals_raw = recommend_meals_ai(req.pref, req.budget, req.household)
    result = []
    for m in meals_raw:
        ings = [lookup_ingredient_info(ing, items) for ing in m["ingredients"]]
        result.append({"dish": m["dish"], "ingredients": ings})
    return {"meals": result}


@router.post("/optimize")
def optimize(req: BasketReq):
    items = load_items()
    basket = optimize_basket(items, req.budget, req.household, req.pref, req.use_market)
    cols = [c for c in ["code", "name", "category", "unit", "emoji",
                        "unit_price", "qty", "line_total"] if c in basket.columns]
    return {
        "summary": basket_summary(basket),
        "items": basket[cols].to_dict(orient="records") if not basket.empty else [],
    }
