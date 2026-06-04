"""routers/admin.py — 가격 동기화 수동 트리거 + GeoJSON 내보내기 + ZIP 다운로드"""
import io
import os
import zipfile
import json
import pandas as pd
from fastapi import APIRouter, Query
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from scheduler import run_price_sync, get_db_engine

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/sync-prices")
def sync_prices(
    target_date: str | None = Query(None, description="YYYY-MM-DD, 기본=오늘")
):
    """PostGIS daily_prices 테이블을 KAT+KAMIS 최신 데이터로 갱신"""
    return run_price_sync(target_date)


@router.get("/prices/geojson")
def prices_geojson(category: str | None = Query(None, description="대분류 필터 (예: 채소류)")):
    """
    daily_prices → GeoJSON FeatureCollection 반환.
    incheon_stores와 item_key 기준 조인해서 상점 좌표 포함.
    프론트 지도에서 직접 소비.
    """
    engine = get_db_engine()
    with engine.connect() as conn:
        q = "SELECT * FROM daily_prices"
        if category:
            q += f" WHERE gds_lclsf_nm = :cat"
            df = pd.read_sql(text(q), conn, params={"cat": category})
        else:
            df = pd.read_sql(text(q), conn)

    # stores CSV 로드해서 좌표 붙이기
    _ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    stores_csv = os.path.join(_ROOT, "data", "incheon_stores.csv")
    stores_df = pd.read_csv(stores_csv, encoding="utf-8-sig")
    stores_df = stores_df.rename(columns={"점포명": "name", "위도": "lat", "경도": "lng", "유형": "type", "위치": "address"})

    features = []
    for _, row in df.iterrows():
        # 품목키로 매장 매칭 (item_key 포함 매장명 검색)
        matched = stores_df[stores_df["name"].str.contains(str(row.get("gds_lclsf_nm", "")), na=False)]
        lat = float(matched.iloc[0]["lat"]) if not matched.empty else 37.4563
        lng = float(matched.iloc[0]["lng"]) if not matched.empty else 126.7052

        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {
                "item_key":     row.get("item_key"),
                "category":     row.get("gds_lclsf_nm"),
                "name":         row.get("gds_sclsf_nm"),
                "최저가":        row.get("최저가"),
                "평균가":        row.get("평균가"),
                "최고가":        row.get("최고가"),
                "소매가":        row.get("소매가"),
                "unit":         row.get("kamis_unit"),
                "scsbd_dt":     str(row.get("scsbd_dt", "")),
            },
        })

    return {"type": "FeatureCollection", "features": features}


@router.get("/prices/download-zip")
def download_zip():
    """
    daily_prices 전체 데이터를 CSV + GeoJSON 두 파일로 묶어 ZIP 다운로드.
    """
    engine = get_db_engine()
    with engine.connect() as conn:
        df = pd.read_sql(text("SELECT * FROM daily_prices"), conn)

    # ── CSV ──────────────────────────────────────────
    csv_buf = io.StringIO()
    df.to_csv(csv_buf, index=False, encoding="utf-8-sig")

    # ── GeoJSON ──────────────────────────────────────
    _ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    stores_csv = os.path.join(_ROOT, "data", "incheon_stores.csv")
    stores_df = pd.read_csv(stores_csv, encoding="utf-8-sig")
    stores_df = stores_df.rename(columns={"점포명": "name", "위도": "lat", "경도": "lng"})

    features = []
    for _, row in df.iterrows():
        matched = stores_df[stores_df["name"].str.contains(str(row.get("gds_lclsf_nm", "")), na=False)]
        lat = float(matched.iloc[0]["lat"]) if not matched.empty else 37.4563
        lng = float(matched.iloc[0]["lng"]) if not matched.empty else 126.7052
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lng, lat]},
            "properties": {k: (None if pd.isna(v) else v) for k, v in row.items()
                           if k not in ("id",)},
        })

    geojson_str = json.dumps(
        {"type": "FeatureCollection", "features": features},
        ensure_ascii=False, indent=2, default=str
    )

    # ── ZIP 묶기 ─────────────────────────────────────
    zip_buf = io.BytesIO()
    with zipfile.ZipFile(zip_buf, "w", zipfile.ZIP_DEFLATED) as zf:
        zf.writestr("daily_prices.csv", csv_buf.getvalue().encode("utf-8-sig"))
        zf.writestr("daily_prices.geojson", geojson_str.encode("utf-8"))
    zip_buf.seek(0)

    return StreamingResponse(
        zip_buf,
        media_type="application/zip",
        headers={"Content-Disposition": "attachment; filename=daily_prices.zip"},
    )
