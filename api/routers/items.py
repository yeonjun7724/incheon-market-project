"""GET /items — 품목 시드(+KAMIS 실시간가)."""
from fastapi import APIRouter
from core.items import load_items

router = APIRouter(prefix="/items", tags=["items"])


@router.get("")
def items():
    return load_items().to_dict(orient="records")
