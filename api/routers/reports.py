"""GET/POST /reports — 가격 제보."""
from fastapi import APIRouter
from pydantic import BaseModel
from core import report_db

router = APIRouter(prefix="/reports", tags=["reports"])


class ReportIn(BaseModel):
    item: str
    price: int
    store: str = ""
    unit: str = ""
    lat: float
    lng: float


@router.get("")
def list_reports():
    return report_db.load_reports()


@router.post("")
def add_report(r: ReportIn):
    return report_db.add_report(r.item, r.price, r.store, r.lat, r.lng, r.unit)


@router.get("/backend")
def backend():
    return {"backend": report_db.backend_name()}
