"""
routers/receipts.py
POST /receipts/scan — 영수증 이미지(base64) → 품목/가격 추출 (ChatGPT Vision)
POST /receipts/reward — 포인트 적립 시뮬레이션
GET  /receipts/store/{store_id}/items — 학습된 가게 취급 품목 조회
"""
import os
import json
import re
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from core.recipes import learn_store_from_receipt, get_store_items

router = APIRouter(prefix="/receipts", tags=["receipts"])

_OPENAI_KEY   = os.getenv("OPENAI_API_KEY", "")
_OPENAI_MODEL = "gpt-4o-mini"


class ReceiptScanReq(BaseModel):
    image_base64: str
    store_id:   str = ""
    store_name: str = ""

class ReceiptItem(BaseModel):
    name:  str
    price: int
    qty:   int = 1

class ReceiptScanResp(BaseModel):
    store_name:    str
    store_id:      str
    items:         list[ReceiptItem]
    total:         int
    reward_points: int
    message:       str

class RewardReq(BaseModel):
    store_id:     str
    total_amount: int
    user_id:      str = "anonymous"

class RewardResp(BaseModel):
    user_id:      str
    points_earned: int
    total_message: str


def _scan_with_openai(image_b64: str) -> dict:
    """ChatGPT Vision으로 영수증 분석."""
    if not _OPENAI_KEY:
        # API키 없을 때 데모 데이터
        return {
            "store_name": "인천종합식품마트",
            "items": [
                {"name": "양파", "price": 2500, "qty": 1},
                {"name": "대파", "price": 1800, "qty": 1},
                {"name": "계란", "price": 3200, "qty": 1},
                {"name": "두부", "price": 1500, "qty": 2},
                {"name": "돼지고기앞다리", "price": 4500, "qty": 1},
            ],
            "total": 15000,
        }

    try:
        import openai
        client = openai.OpenAI(api_key=_OPENAI_KEY)
        resp = client.chat.completions.create(
            model=_OPENAI_MODEL,
            max_tokens=800,
            messages=[{
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                            "detail": "low",
                        },
                    },
                    {
                        "type": "text",
                        "text": (
                            "이 영수증을 분석해서 JSON으로만 응답하세요. "
                            '형식: {"store_name":"가게명","items":[{"name":"품목명","price":가격,"qty":수량}],"total":합계} '
                            "품목명은 간결하게, 가격은 원 단위 숫자만. "
                            "영수증이 아니면: {\"store_name\":\"\",\"items\":[],\"total\":0}"
                        ),
                    },
                ],
            }],
            response_format={"type": "json_object"},
        )
        return json.loads(resp.choices[0].message.content)
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"영수증 분석 실패: {e}")


@router.post("/scan", response_model=ReceiptScanResp)
def scan_receipt(req: ReceiptScanReq):
    result     = _scan_with_openai(req.image_base64)
    store_name = req.store_name or result.get("store_name", "알 수 없는 가게")
    store_id   = req.store_id or f"receipt_{abs(hash(store_name)) % 100000:05d}"
    items_raw  = result.get("items", [])
    total      = result.get("total") or sum(
        i.get("price", 0) * i.get("qty", 1) for i in items_raw)

    if store_id and items_raw:
        learn_store_from_receipt(store_id, store_name,
                                 [{"name": i["name"], "price": i["price"]} for i in items_raw])

    reward_points = (total // 1000) * 10
    return ReceiptScanResp(
        store_name=store_name, store_id=store_id,
        items=[ReceiptItem(**i) for i in items_raw],
        total=total, reward_points=reward_points,
        message=f"영수증 등록 완료! {reward_points}P 적립 🎉",
    )


@router.post("/reward", response_model=RewardResp)
def reward(req: RewardReq):
    points = (req.total_amount // 1000) * 10
    return RewardResp(
        user_id=req.user_id, points_earned=points,
        total_message=f"총 {points}P 적립. 10,000P 시 500원 쿠폰!",
    )


@router.get("/store/{store_id}/items")
def store_items(store_id: str, store_name: str = ""):
    info = get_store_items(store_id, store_name)
    return {
        "store_id": store_id, "store_name": store_name,
        "items": info["items"], "prices": info["prices"],
        "source": info["source"], "learned": info["source"] == "receipt",
    }
