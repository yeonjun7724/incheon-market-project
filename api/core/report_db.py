"""
core/report_db.py
소비자 가격 제보 — Railway PostgreSQL 영속 저장.
(item_key, store) UNIQUE: 동일 조합이면 최신 건으로 교체, 이전 건 버림.
"""
from datetime import datetime
from sqlalchemy import text


def _engine():
    from core.db import get_engine
    return get_engine()


def _normalize(item: str) -> str:
    try:
        from core.items import normalize_ingredient
        return normalize_ingredient(item)
    except Exception:
        return item.strip()


def load_reports() -> list:
    try:
        with _engine().connect() as conn:
            rows = conn.execute(text("""
                SELECT item_key AS item, price, store, lat, lng,
                       TO_CHAR(reported_at, 'YYYY-MM-DD') AS date
                FROM price_reports
                ORDER BY reported_at DESC
            """)).fetchall()
        return [dict(r._mapping) for r in rows]
    except Exception:
        return []


def add_report(item: str, price: int, store: str, lat: float, lng: float,
               unit: str = "") -> dict:
    item_key = _normalize(item)
    now = datetime.now()
    try:
        with _engine().connect() as conn:
            conn.execute(text("""
                INSERT INTO price_reports (item_key, store, price, unit, lat, lng, reported_at)
                VALUES (:item_key, :store, :price, :unit, :lat, :lng, :reported_at)
                ON CONFLICT (item_key, store) DO UPDATE SET
                    price       = EXCLUDED.price,
                    unit        = EXCLUDED.unit,
                    lat         = EXCLUDED.lat,
                    lng         = EXCLUDED.lng,
                    reported_at = EXCLUDED.reported_at
            """), {
                "item_key":    item_key,
                "store":       store or "",
                "price":       int(price),
                "unit":        unit or None,
                "lat":         float(lat),
                "lng":         float(lng),
                "reported_at": now,
            })
            conn.commit()
    except Exception:
        pass
    return {
        "item":  item_key,
        "price": int(price),
        "store": store or "",
        "unit":  unit or None,
        "lat":   float(lat),
        "lng":   float(lng),
        "date":  now.strftime("%Y-%m-%d"),
    }


def backend_name() -> str:
    return "PostgreSQL (Railway 영속)"
