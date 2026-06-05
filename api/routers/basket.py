"""POST /basket/optimize — 예산 맞춤 장바구니 LP 최적화."""
from fastapi import APIRouter
from pydantic import BaseModel
from core.optimizer import optimize_basket, basket_summary
from core.items import load_items
from core.db_items import load_db_items

router = APIRouter(prefix="/basket", tags=["basket"])


class BasketReq(BaseModel):
    budget: int = 50000
    household: int = 2
    pref: str = "균형"
    use_market: bool = True


@router.post("/optimize")
def optimize(req: BasketReq):
    items = load_db_items()
    if items.empty:
        items = load_items()   # DB 미연결 또는 데이터 없을 때 시드 폴백
    basket = optimize_basket(items, req.budget, req.household, req.pref, req.use_market)
    cols = [c for c in ["code", "name", "category", "unit", "emoji",
                        "unit_price", "qty", "line_total"] if c in basket.columns]
    return {
        "summary": basket_summary(basket),
        "items": basket[cols].to_dict(orient="records") if not basket.empty else [],
    }
