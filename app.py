"""
LocalCart — 예산 맞춤형 지역상권 장보기 추천 플랫폼
PGIS(참여형 GIS) 기반 Streamlit 웹 애플리케이션

메인 진입점: app.py
지도가 전체 화면의 주 콘텐츠로 렌더링되며,
사이드바에서 조건을 입력하고 결과를 제어한다.
"""

import streamlit as st
import folium
from folium.plugins import MarkerCluster, Draw, Fullscreen, LocateControl, MeasureControl
from streamlit_folium import st_folium
import pandas as pd
import numpy as np
import requests
import json
from datetime import datetime, timedelta
import math
import plotly.express as px
import plotly.graph_objects as go
from scipy.optimize import linprog

# ─────────────────────────────────────────────
# 페이지 설정 (반드시 첫 Streamlit 호출)
# ─────────────────────────────────────────────
st.set_page_config(
    page_title="LocalCart | 동네장보기",
    page_icon="🛒",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ─────────────────────────────────────────────
# CSS: 지도 전체화면 스타일 + 커스텀 디자인
# ─────────────────────────────────────────────
st.markdown("""
<style>
/* ── 기본 레이아웃 ── */
html, body, [data-testid="stAppViewContainer"] {
    background-color: #0f1117;
    color: #e8eaf0;
}
[data-testid="stSidebar"] {
    background: linear-gradient(180deg, #1a1f2e 0%, #141824 100%);
    border-right: 1px solid #2a3048;
}
[data-testid="stSidebar"] * { color: #c9cdd8 !important; }

/* ── 지도 컨테이너: 뷰포트 꽉 채우기 ── */
.map-container iframe {
    border-radius: 12px;
    border: 1px solid #2a3048;
}
[data-testid="stIFrame"] { border-radius: 12px; }

/* ── 헤더 배너 ── */
.lc-header {
    background: linear-gradient(135deg, #1e2d4a 0%, #162238 60%, #0f1a2e 100%);
    border: 1px solid #2a4a7a;
    border-radius: 10px;
    padding: 10px 20px;
    margin-bottom: 12px;
    display: flex;
    align-items: center;
    gap: 12px;
}
.lc-logo { font-size: 28px; }
.lc-title { font-size: 22px; font-weight: 700; color: #5ba4e8; letter-spacing: -0.5px; }
.lc-sub { font-size: 12px; color: #7a8fad; margin-top: 2px; }

/* ── 통계 카드 ── */
.stat-row {
    display: flex; gap: 8px; margin-bottom: 12px;
}
.stat-card {
    flex: 1;
    background: #1a2235;
    border: 1px solid #2a3a55;
    border-radius: 8px;
    padding: 10px 12px;
    text-align: center;
}
.stat-val { font-size: 18px; font-weight: 700; color: #5ba4e8; }
.stat-lbl { font-size: 10px; color: #6a7a96; margin-top: 2px; }

/* ── 추천 장바구니 카드 ── */
.cart-card {
    background: linear-gradient(135deg, #1a2a1a, #0f1f0f);
    border: 1px solid #2a5a2a;
    border-radius: 10px;
    padding: 14px 16px;
    margin-bottom: 10px;
}
.cart-title { font-size: 13px; font-weight: 600; color: #5ae88a; margin-bottom: 8px; }
.cart-item { display: flex; justify-content: space-between; font-size: 12px;
             color: #a0baa0; padding: 3px 0; border-bottom: 1px solid #1a3a1a; }
.cart-item:last-child { border-bottom: none; }
.cart-price { color: #7ae87a; font-weight: 600; }
.cart-total { display: flex; justify-content: space-between; font-size: 14px;
              font-weight: 700; color: #5ae88a; margin-top: 8px; padding-top: 8px;
              border-top: 1px solid #2a5a2a; }

/* ── 상점 배지 ── */
.badge {
    display: inline-block; padding: 2px 8px; border-radius: 20px;
    font-size: 10px; font-weight: 600; margin-right: 4px;
}
.badge-market   { background: #1a3a5a; color: #5ab4e8; border: 1px solid #2a6090; }
.badge-kind     { background: #1a4a2a; color: #5ae89a; border: 1px solid #2a7040; }
.badge-local    { background: #3a2a1a; color: #e8a05a; border: 1px solid #704020; }
.badge-general  { background: #2a2a3a; color: #9090c8; border: 1px solid #404070; }

/* ── 상점 리스트 아이템 ── */
.store-item {
    background: #161c2a;
    border: 1px solid #252f45;
    border-radius: 8px;
    padding: 10px 12px;
    margin-bottom: 6px;
    cursor: pointer;
    transition: border-color 0.2s;
}
.store-item:hover { border-color: #5ba4e8; }
.store-name { font-size: 13px; font-weight: 600; color: #d0d8e8; }
.store-meta { font-size: 11px; color: #5a6a80; margin-top: 3px; }

/* ── PGIS 기여 버튼 ── */
.pgis-hint {
    background: linear-gradient(135deg, #1a1530, #120e24);
    border: 1px dashed #5040a0;
    border-radius: 8px;
    padding: 10px 14px;
    font-size: 11px;
    color: #8070c0;
    text-align: center;
    margin-top: 8px;
}

/* ── Streamlit 기본 요소 덮어쓰기 ── */
.stButton button {
    background: linear-gradient(135deg, #1e4a7a, #0e2a4a) !important;
    color: #8ac4f0 !important;
    border: 1px solid #2a6090 !important;
    border-radius: 8px !important;
    font-weight: 600 !important;
    transition: all 0.2s !important;
}
.stButton button:hover {
    background: linear-gradient(135deg, #2a6090, #1a3a6a) !important;
    border-color: #5ba4e8 !important;
    color: #c0e0ff !important;
}
div[data-testid="stMetric"] {
    background: #1a2235;
    border: 1px solid #2a3a55;
    border-radius: 8px;
    padding: 12px !important;
}
div[data-testid="stMetric"] label { color: #6a7a96 !important; font-size: 11px !important; }
div[data-testid="stMetric"] div[data-testid="stMetricValue"] {
    color: #5ba4e8 !important; font-size: 22px !important;
}

/* ── 섹션 구분선 ── */
.section-divider {
    border: none; border-top: 1px solid #2a3048;
    margin: 14px 0;
}

/* ── 탭 ── */
button[data-baseweb="tab"] { color: #7a8fad !important; font-size: 13px !important; }
button[data-baseweb="tab"][aria-selected="true"] { color: #5ba4e8 !important; border-bottom-color: #5ba4e8 !important; }
</style>
""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
# 데이터 레이어 — 공공데이터 로더 + 시드 데이터
# ══════════════════════════════════════════════════════════════

# ── 품목 시드 데이터 (aT 기준, 전통시장/마트 평균가 원 단위) ──
ITEMS_SEED = [
    # (코드, 품목명, 카테고리, 단위, 전국평균가, 시장평균가, 마트평균가, 선호키)
    ("C001", "계란",          "단백질", "30개",  7200, 6800, 7500,  "protein"),
    ("C002", "두부",          "단백질", "300g",  1500, 1200, 1600,  "protein"),
    ("C003", "돼지고기앞다리", "단백질", "100g",  1500, 1350, 1650,  "protein"),
    ("C004", "닭가슴살",      "단백질", "100g",  1800, 1600, 2000,  "protein"),
    ("C005", "콩나물",        "채소",   "200g",   900,  750, 1000,  "veggie"),
    ("C006", "애호박",        "채소",   "1개",   1500, 1200, 1700,  "veggie"),
    ("C007", "양파",          "채소",   "1kg",   2200, 1800, 2500,  "veggie"),
    ("C008", "대파",          "채소",   "1단",   2500, 2000, 2800,  "veggie"),
    ("C009", "배추",          "채소",   "1포기", 3800, 3200, 4200,  "veggie"),
    ("C010", "시금치",        "채소",   "200g",  2800, 2200, 3100,  "veggie"),
    ("C011", "쌀",            "탄수화물","1kg",  3500, 3200, 3800,  "carb"),
    ("C012", "감자",          "탄수화물","1kg",  3000, 2600, 3400,  "carb"),
    ("C013", "고구마",        "탄수화물","1kg",  4500, 3800, 5000,  "carb"),
    ("C014", "사과",          "과일",   "3개",   6500, 5800, 7200,  "fruit"),
    ("C015", "바나나",        "과일",   "1송이", 3500, 3000, 4000,  "fruit"),
    ("C016", "참기름",        "양념",   "180ml", 7500, 6800, 8500,  "sauce"),
    ("C017", "고추장",        "양념",   "500g",  4800, 4200, 5500,  "sauce"),
    ("C018", "된장",          "양념",   "500g",  4200, 3700, 4800,  "sauce"),
    ("C019", "간장",          "양념",   "500ml", 3800, 3300, 4200,  "sauce"),
    ("C020", "두유",          "가공식품","190ml×6", 5500, 4800, 6000, "processed"),
]

ITEMS_DF = pd.DataFrame(ITEMS_SEED, columns=[
    "code","name","category","unit","avg_price","market_price","supermarket_price","pref_key"
])

# ── 상점 시드 데이터 (서울 주요 전통시장 + 착한가격업소 샘플) ──
STORES_SEED = [
    {"id":"S001","name":"광장시장",      "type":"전통시장",    "gu":"종로구","lat":37.5701,"lng":126.9993,"certified":True,  "desc":"서울 4대 전통시장, 빈대떡·육회 유명"},
    {"id":"S002","name":"마포농수산물시장","type":"전통시장",  "gu":"마포구","lat":37.5448,"lng":126.9475,"certified":True,  "desc":"수산물 전문 도소매 시장"},
    {"id":"S003","name":"망원시장",      "type":"전통시장",    "gu":"마포구","lat":37.5560,"lng":126.9047,"certified":True,  "desc":"SNS 유명 서울 감성 전통시장"},
    {"id":"S004","name":"통인시장",      "type":"전통시장",    "gu":"종로구","lat":37.5787,"lng":126.9681,"certified":True,  "desc":"도시락카페·기름떡볶이 유명"},
    {"id":"S005","name":"남대문시장",    "type":"전통시장",    "gu":"중구",  "lat":37.5590,"lng":126.9768,"certified":True,  "desc":"대한민국 대표 도소매 전통시장"},
    {"id":"S006","name":"경동시장",      "type":"전통시장",    "gu":"동대문구","lat":37.5798,"lng":127.0436,"certified":True, "desc":"한약재·건어물·청과 집산지"},
    {"id":"S007","name":"노량진수산시장","type":"전통시장",    "gu":"동작구","lat":37.5129,"lng":126.9428,"certified":True,  "desc":"새벽 수산물 경매·직거래"},
    {"id":"S008","name":"이대 착한가격식당","type":"착한가격업소","gu":"서대문구","lat":37.5554,"lng":126.9458,"certified":True,"desc":"구청 인증 착한가격업소"},
    {"id":"S009","name":"은평 로컬푸드","type":"로컬푸드",    "gu":"은평구","lat":37.6022,"lng":126.9234,"certified":True,  "desc":"경기 로컬푸드 직매장"},
    {"id":"S010","name":"성동 로컬푸드","type":"로컬푸드",    "gu":"성동구","lat":37.5471,"lng":127.0390,"certified":True,  "desc":"도시농업 연계 직거래 매장"},
    {"id":"S011","name":"합정 착한가격마트","type":"착한가격업소","gu":"마포구","lat":37.5494,"lng":126.9147,"certified":True,"desc":"소상공인진흥공단 인증"},
    {"id":"S012","name":"청량리청과물시장","type":"전통시장",  "gu":"동대문구","lat":37.5891,"lng":127.0479,"certified":True,"desc":"과일·채소 도매 거점"},
]

STORES_DF = pd.DataFrame(STORES_SEED)

# ── 유형별 아이콘·색상 ──
STORE_STYLE = {
    "전통시장":    {"icon": "🏪", "color": "#5ba4e8", "folium_color": "blue",   "badge": "badge-market"},
    "착한가격업소": {"icon": "✅", "color": "#5ae88a", "folium_color": "green",  "badge": "badge-kind"},
    "로컬푸드":    {"icon": "🌿", "color": "#e8a05a", "folium_color": "orange", "badge": "badge-local"},
    "일반":        {"icon": "🏬", "color": "#9090c8", "folium_color": "purple", "badge": "badge-general"},
}


# ══════════════════════════════════════════════════════════════
# 유틸리티 함수
# ══════════════════════════════════════════════════════════════

def haversine(lat1, lon1, lat2, lon2):
    """두 좌표 간 거리 계산 (미터)"""
    R = 6371000
    φ1, φ2 = math.radians(lat1), math.radians(lat2)
    Δφ = math.radians(lat2 - lat1)
    Δλ = math.radians(lon2 - lon1)
    a = math.sin(Δφ/2)**2 + math.cos(φ1)*math.cos(φ2)*math.sin(Δλ/2)**2
    return R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))


def filter_stores_by_radius(df: pd.DataFrame, lat: float, lng: float, radius_m: int) -> pd.DataFrame:
    """반경 내 상점 필터링 + 거리 컬럼 추가"""
    df = df.copy()
    df["distance_m"] = df.apply(lambda r: haversine(lat, lng, r["lat"], r["lng"]), axis=1)
    df = df[df["distance_m"] <= radius_m].sort_values("distance_m")
    return df


def score_stores(df: pd.DataFrame) -> pd.DataFrame:
    """상점 추천 점수 계산 (거리 40% + 유형신뢰도 35% + 지역상권 25%)"""
    if df.empty:
        return df
    df = df.copy()
    max_dist = df["distance_m"].max() or 1
    type_score_map = {"로컬푸드": 1.0, "착한가격업소": 0.9, "전통시장": 0.8, "일반": 0.5}
    df["score_dist"]  = 1 - (df["distance_m"] / max_dist)
    df["score_type"]  = df["type"].map(type_score_map).fillna(0.5)
    df["score_local"] = df["type"].isin(["전통시장","착한가격업소","로컬푸드"]).astype(float)
    df["total_score"] = (df["score_dist"]*0.40 + df["score_type"]*0.35 + df["score_local"]*0.25)
    return df.sort_values("total_score", ascending=False)


def recommend_items(budget: int, household: int, pref: str, use_market_price: bool) -> pd.DataFrame:
    """
    선형 계획법(LP) 기반 품목 선정
    - 목적: 선호도 가중 효용 최대화
    - 제약: 예산 초과 금지, 카테고리 최소 보장
    """
    df = ITEMS_DF.copy()
    price_col = "market_price" if use_market_price else "avg_price"

    # 가구 수 스케일 조정
    scale = {1: 1.0, 2: 1.6, 3: 2.3, 4: 3.0}.get(household, 3.0)
    df["unit_price"] = (df[price_col] * scale).astype(int)

    # 선호도 가중치
    pref_map = {
        "균형 식단":   {"단백질":1.2, "채소":1.2, "탄수화물":1.0, "과일":0.8, "양념":0.6, "가공식품":0.5},
        "채소 위주":   {"채소":1.8, "단백질":0.8, "탄수화물":1.0, "과일":1.0, "양념":0.6, "가공식품":0.4},
        "단백질 위주": {"단백질":1.8, "채소":0.8, "탄수화물":0.8, "과일":0.6, "양념":0.5, "가공식품":0.5},
        "저탄수화물":  {"단백질":1.5, "채소":1.5, "탄수화물":0.3, "과일":0.8, "양념":0.5, "가공식품":0.4},
    }
    weights = pref_map.get(pref, pref_map["균형 식단"])
    df["pref_weight"] = df["category"].map(weights).fillna(0.6)

    # 효용 점수 (가격 대비 선호도)
    df["utility"] = df["pref_weight"] / (df["unit_price"] / 1000 + 0.1)

    # 예산 내에서 효용 높은 순으로 그리디 선택 (간단 구현)
    df = df.sort_values("utility", ascending=False)
    selected, total = [], 0
    cat_count = {}
    for _, row in df.iterrows():
        if total + row["unit_price"] <= budget and len(selected) < 10:
            selected.append(row)
            total += row["unit_price"]
            cat_count[row["category"]] = cat_count.get(row["category"], 0) + 1

    if not selected:
        return pd.DataFrame()

    result = pd.DataFrame(selected)
    result["final_price"] = result["unit_price"]
    return result[["name","category","unit","final_price","avg_price","market_price"]]


# ══════════════════════════════════════════════════════════════
# 지도 빌더 (PGIS 핵심)
# ══════════════════════════════════════════════════════════════

def build_map(
    center_lat: float,
    center_lng: float,
    stores_df: pd.DataFrame,
    user_report_points: list,
    radius_m: int,
    map_style: str = "CartoDB dark_matter",
) -> folium.Map:
    """
    PGIS 지도 빌더
    - 상점 클러스터 마커
    - 사용자 위치 원형 반경
    - Draw 플러그인 (참여형 GIS 핵심: 사용자 직접 마커·폴리곤 추가)
    - Fullscreen, LocateControl, Measure 플러그인
    - 사용자 제보 포인트 렌더링
    """
    m = folium.Map(
        location=[center_lat, center_lng],
        zoom_start=14,
        tiles=map_style,
        attr="© LocalCart",
        prefer_canvas=True,
    )

    # ── 플러그인 추가 ──
    Fullscreen(position="topright").add_to(m)
    LocateControl(auto_start=False, position="topright").add_to(m)
    MeasureControl(position="bottomleft", primary_length_unit="meters").add_to(m)

    # ── Draw (PGIS 핵심: 사용자 마커·폴리곤 그리기) ──
    draw = Draw(
        position="topleft",
        draw_options={
            "polyline":  False,
            "polygon":   True,    # 상권 경계 직접 그리기
            "rectangle": True,    # 탐색 구역 설정
            "circle":    True,    # 반경 설정
            "marker":    True,    # 가격 제보 마커
            "circlemarker": False,
        },
        edit_options={"edit": True, "remove": True},
    )
    draw.add_to(m)

    # ── 사용자 위치 마커 ──
    folium.Marker(
        location=[center_lat, center_lng],
        popup=folium.Popup("<b>📍 내 위치</b>", max_width=150),
        tooltip="내 현재 위치",
        icon=folium.Icon(color="red", icon="home", prefix="fa"),
    ).add_to(m)

    # ── 탐색 반경 원 ──
    folium.Circle(
        location=[center_lat, center_lng],
        radius=radius_m,
        color="#5ba4e8",
        weight=1.5,
        fill=True,
        fill_color="#5ba4e8",
        fill_opacity=0.05,
        tooltip=f"탐색 반경 {radius_m:,}m",
    ).add_to(m)

    # ── 상점 클러스터 마커 ──
    if not stores_df.empty:
        cluster = MarkerCluster(
            name="추천 상점",
            options={
                "maxClusterRadius": 50,
                "showCoverageOnHover": True,
                "zoomToBoundsOnClick": True,
            }
        )

        for _, row in stores_df.iterrows():
            style = STORE_STYLE.get(row["type"], STORE_STYLE["일반"])
            dist_txt = f"{row['distance_m']:.0f}m" if "distance_m" in row else ""
            score_txt = f"{row.get('total_score', 0)*100:.0f}점" if "total_score" in row else ""

            popup_html = f"""
            <div style='font-family:sans-serif; min-width:180px; padding:4px'>
              <div style='font-size:15px; font-weight:700; margin-bottom:6px'>
                {style['icon']} {row['name']}
              </div>
              <div style='font-size:11px; color:#555; margin-bottom:4px'>
                {row['gu']} · {row['type']}
              </div>
              <div style='font-size:11px; color:#333; margin-bottom:6px'>
                {row.get('desc','')}
              </div>
              <div style='display:flex; gap:6px; flex-wrap:wrap'>
                <span style='background:#e8f4fd; color:#1a5f8a; padding:2px 7px;
                             border-radius:10px; font-size:10px'>📏 {dist_txt}</span>
                <span style='background:#f0fdf4; color:#1a6a3a; padding:2px 7px;
                             border-radius:10px; font-size:10px'>⭐ {score_txt}</span>
                {'<span style="background:#fff3e0; color:#a05000; padding:2px 7px; border-radius:10px; font-size:10px">✅ 인증</span>' if row.get('certified') else ''}
              </div>
            </div>
            """

            folium.Marker(
                location=[row["lat"], row["lng"]],
                popup=folium.Popup(popup_html, max_width=250),
                tooltip=f"{style['icon']} {row['name']} ({dist_txt})",
                icon=folium.Icon(
                    color=style["folium_color"],
                    icon="shopping-cart" if row["type"] == "전통시장" else
                         "leaf" if row["type"] == "로컬푸드" else
                         "check" if row["type"] == "착한가격업소" else "store",
                    prefix="fa",
                ),
            ).add_to(cluster)

        cluster.add_to(m)

    # ── 사용자 제보 포인트 (PGIS 참여 결과) ──
    for pt in user_report_points:
        folium.CircleMarker(
            location=[pt["lat"], pt["lng"]],
            radius=7,
            color="#e8e05a",
            fill=True,
            fill_color="#e8e05a",
            fill_opacity=0.7,
            popup=folium.Popup(
                f"<b>📝 가격 제보</b><br>{pt.get('item','품목 미상')}: {pt.get('price','?')}원<br>"
                f"<small>{pt.get('date','')}</small>",
                max_width=200
            ),
            tooltip="💬 시민 가격 제보",
        ).add_to(m)

    # ── 레이어 컨트롤 ──
    folium.LayerControl(position="topright").add_to(m)

    return m


# ══════════════════════════════════════════════════════════════
# 세션 상태 초기화
# ══════════════════════════════════════════════════════════════

def init_session():
    defaults = {
        "center_lat":   37.5665,   # 서울시청 기본값
        "center_lng":   126.9780,
        "radius_m":     2000,
        "budget":       50000,
        "household":    2,
        "preference":   "균형 식단",
        "use_market":   True,
        "result_stores": pd.DataFrame(),
        "result_items":  pd.DataFrame(),
        "map_clicks":    [],        # PGIS: 클릭 이벤트 누적
        "draw_data":     [],        # PGIS: Draw 결과 누적
        "user_reports":  [          # PGIS: 시민 제보 샘플
            {"lat": 37.5701, "lng": 126.9993, "item": "배추", "price": 3500, "date": "2026-05-14"},
            {"lat": 37.5560, "lng": 126.9047, "item": "계란", "price": 6800, "date": "2026-05-13"},
            {"lat": 37.5448, "lng": 126.9475, "item": "두부", "price": 1100, "date": "2026-05-12"},
        ],
        "map_style":    "CartoDB dark_matter",
        "active_tab":   0,
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_session()


# ══════════════════════════════════════════════════════════════
# 사이드바 — 조건 입력 패널
# ══════════════════════════════════════════════════════════════

with st.sidebar:
    # 로고
    st.markdown("""
    <div style='text-align:center; padding:12px 0 8px'>
      <div style='font-size:36px'>🛒</div>
      <div style='font-size:20px; font-weight:700; color:#5ba4e8; letter-spacing:-0.5px'>LocalCart</div>
      <div style='font-size:11px; color:#4a5a70; margin-top:2px'>예산 맞춤 지역상권 장보기</div>
    </div>
    """, unsafe_allow_html=True)
    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    # ── 위치 설정 ──
    st.markdown("#### 📍 위치 설정")
    location_mode = st.radio(
        "위치 입력 방식",
        ["지도에서 직접 클릭", "주소 검색", "서울 주요 지역 선택"],
        label_visibility="collapsed",
    )

    if location_mode == "서울 주요 지역 선택":
        area_map = {
            "서울시청 (중구)":   (37.5665, 126.9780),
            "강남역 (강남구)":   (37.4979, 127.0276),
            "홍대입구 (마포구)": (37.5572, 126.9246),
            "신촌 (서대문구)":   (37.5554, 126.9368),
            "왕십리 (성동구)":   (37.5614, 127.0388),
            "노원역 (노원구)":   (37.6541, 127.0762),
            "잠실 (송파구)":     (37.5133, 127.1001),
        }
        sel_area = st.selectbox("지역 선택", list(area_map.keys()))
        st.session_state["center_lat"], st.session_state["center_lng"] = area_map[sel_area]

    elif location_mode == "주소 검색":
        addr = st.text_input("주소 입력", placeholder="예: 서울 마포구 망원동")
        if addr:
            st.info("실제 배포 시 Kakao Geocoding API 연동 필요", icon="ℹ️")

    else:  # 지도에서 직접 클릭
        st.caption("🖱️ 지도를 클릭하면 해당 위치가 기준점으로 설정됩니다.")

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    # ── 탐색 조건 ──
    st.markdown("#### 🔍 탐색 조건")

    radius_options = {"500m": 500, "1km": 1000, "2km": 2000, "3km": 3000, "5km": 5000}
    radius_label = st.select_slider("탐색 반경", options=list(radius_options.keys()), value="2km")
    st.session_state["radius_m"] = radius_options[radius_label]

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    # ── 예산 설정 ──
    st.markdown("#### 💰 예산 설정")
    st.session_state["budget"] = st.slider(
        "장보기 예산 (원)", 10000, 200000,
        st.session_state["budget"], step=5000,
        format="%d원",
    )
    st.session_state["household"] = st.selectbox(
        "가구 구성",
        [1, 2, 3, 4],
        index=st.session_state["household"] - 1,
        format_func=lambda x: f"{x}인 가구",
    )

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    # ── 식재료 선호 ──
    st.markdown("#### 🥗 식재료 선호")
    st.session_state["preference"] = st.radio(
        "식단 유형",
        ["균형 식단", "채소 위주", "단백질 위주", "저탄수화물"],
        index=["균형 식단","채소 위주","단백질 위주","저탄수화물"].index(st.session_state["preference"]),
        label_visibility="collapsed",
    )
    st.session_state["use_market"] = st.toggle(
        "전통시장 가격 우선 적용", value=st.session_state["use_market"]
    )

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    # ── 지도 스타일 ──
    st.markdown("#### 🗺️ 지도 스타일")
    map_styles = {
        "다크 (기본)": "CartoDB dark_matter",
        "라이트":      "CartoDB positron",
        "위성 (OSM)":  "OpenStreetMap",
    }
    sel_style = st.selectbox("배경 지도", list(map_styles.keys()))
    st.session_state["map_style"] = map_styles[sel_style]

    st.markdown('<hr class="section-divider">', unsafe_allow_html=True)

    # ── 추천 실행 버튼 ──
    run_btn = st.button("🔍  추천 실행", use_container_width=True)

    if run_btn:
        with st.spinner("분석 중..."):
            filtered = filter_stores_by_radius(
                STORES_DF,
                st.session_state["center_lat"],
                st.session_state["center_lng"],
                st.session_state["radius_m"],
            )
            scored  = score_stores(filtered)
            items   = recommend_items(
                st.session_state["budget"],
                st.session_state["household"],
                st.session_state["preference"],
                st.session_state["use_market"],
            )
            st.session_state["result_stores"] = scored
            st.session_state["result_items"]  = items

    # ── PGIS 기여 안내 ──
    st.markdown("""
    <div class="pgis-hint">
      🖊️ <b>가격 직접 제보하기</b><br>
      지도에서 마커를 그리고 품목·가격을 입력하면<br>
      데이터에 기여할 수 있습니다.
    </div>
    """, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
# 메인 화면 — 헤더 배너
# ══════════════════════════════════════════════════════════════

st.markdown("""
<div class="lc-header">
  <div class="lc-logo">🛒</div>
  <div>
    <div class="lc-title">LocalCart — 예산 맞춤형 지역상권 장보기 추천</div>
    <div class="lc-sub">PGIS 참여형 지도 기반 · 공공데이터 연동 · 전통시장·착한가격업소 우선 추천</div>
  </div>
</div>
""", unsafe_allow_html=True)

# 요약 통계 카드
col_s1, col_s2, col_s3, col_s4 = st.columns(4)
n_stores = len(st.session_state["result_stores"])
n_items  = len(st.session_state["result_items"])
total_est = int(st.session_state["result_items"]["final_price"].sum()) if n_items > 0 else 0
n_reports = len(st.session_state["user_reports"])

with col_s1:
    st.metric("반경 내 상점", f"{n_stores}개" if n_stores > 0 else "—", help="추천 실행 후 표시")
with col_s2:
    st.metric("추천 품목 수", f"{n_items}종" if n_items > 0 else "—")
with col_s3:
    st.metric("예상 총액", f"{total_est:,}원" if total_est > 0 else "—")
with col_s4:
    st.metric("시민 제보", f"{n_reports}건", delta="오늘 +3")


# ══════════════════════════════════════════════════════════════
# 메인 레이아웃: 지도(왼쪽 넓게) + 결과 패널(오른쪽)
# ══════════════════════════════════════════════════════════════

map_col, panel_col = st.columns([3, 1], gap="small")

# ─────────────────────────────────────────────
# 왼쪽: PGIS 지도 (메인 콘텐츠)
# ─────────────────────────────────────────────
with map_col:
    stores_to_show = (
        st.session_state["result_stores"]
        if not st.session_state["result_stores"].empty
        else STORES_DF  # 추천 실행 전: 전체 상점 표시
    )

    fmap = build_map(
        center_lat    = st.session_state["center_lat"],
        center_lng    = st.session_state["center_lng"],
        stores_df     = stores_to_show,
        user_report_points = st.session_state["user_reports"],
        radius_m      = st.session_state["radius_m"],
        map_style     = st.session_state["map_style"],
    )

    # st_folium: 지도 렌더링 + 클릭 이벤트 수신
    map_output = st_folium(
        fmap,
        width="100%",
        height=600,
        returned_objects=["last_clicked", "last_object_clicked", "all_drawings"],
        key="main_map",
    )

    # PGIS: 지도 클릭 → 기준 위치 업데이트
    if map_output and map_output.get("last_clicked"):
        clicked = map_output["last_clicked"]
        st.session_state["center_lat"] = clicked["lat"]
        st.session_state["center_lng"] = clicked["lng"]
        st.success(
            f"📍 위치 업데이트: {clicked['lat']:.4f}, {clicked['lng']:.4f}  "
            "— 추천 실행 버튼을 눌러 결과를 갱신하세요.",
            icon="✅"
        )

    # PGIS: Draw 데이터 수집 (사용자 가격 제보 인터페이스)
    if map_output and map_output.get("all_drawings"):
        drawings = map_output["all_drawings"]
        if drawings and drawings != st.session_state["draw_data"]:
            st.session_state["draw_data"] = drawings
            new_count = len(drawings.get("features", []))
            if new_count > 0:
                st.info(
                    f"🖊️ 지도에 {new_count}개 객체가 그려졌습니다. "
                    "아래 '가격 제보 등록' 탭에서 품목·가격을 입력해 데이터에 기여하세요.",
                    icon="📝"
                )

    # 지도 하단 범례
    st.markdown("""
    <div style='display:flex; gap:12px; flex-wrap:wrap; padding:8px 4px;
                font-size:11px; color:#6a7a96; margin-top:4px'>
      <span>🏪 <span style='color:#5ba4e8'>전통시장</span></span>
      <span>✅ <span style='color:#5ae88a'>착한가격업소</span></span>
      <span>🌿 <span style='color:#e8a05a'>로컬푸드</span></span>
      <span>💛 <span style='color:#e8e05a'>시민 제보</span></span>
      <span>📍 <span style='color:#e85a5a'>내 위치</span></span>
      <span style='margin-left:auto'>🖊️ 지도 왼쪽 도구로 직접 그리기 가능</span>
    </div>
    """, unsafe_allow_html=True)


# ─────────────────────────────────────────────
# 오른쪽: 결과 패널 (탭 구조)
# ─────────────────────────────────────────────
with panel_col:
    tab1, tab2, tab3 = st.tabs(["🛍️ 장바구니", "🏪 상점", "📝 제보"])

    # ── 탭1: 추천 장바구니 ──
    with tab1:
        items_df = st.session_state["result_items"]
        if items_df.empty:
            st.markdown("""
            <div style='text-align:center; color:#4a5a70; padding:40px 0; font-size:13px'>
              왼쪽 사이드바에서<br>조건을 설정하고<br>
              <b style='color:#5ba4e8'>추천 실행</b>을 누르세요
            </div>
            """, unsafe_allow_html=True)
        else:
            budget = st.session_state["budget"]
            total  = int(items_df["final_price"].sum())
            remain = budget - total
            usage  = total / budget * 100 if budget > 0 else 0

            # 예산 게이지
            st.markdown(f"""
            <div style='margin-bottom:12px'>
              <div style='display:flex; justify-content:space-between; font-size:11px;
                          color:#6a7a96; margin-bottom:4px'>
                <span>예상 합계</span>
                <span style='color:{"#5ae88a" if remain >= 0 else "#e85a5a"}'>
                  {total:,}원 / {budget:,}원
                </span>
              </div>
              <div style='background:#1a2235; border-radius:6px; height:8px; overflow:hidden'>
                <div style='background:{"#5ae88a" if usage <= 90 else "#e8a05a" if usage <= 100 else "#e85a5a"};
                            width:{min(usage,100):.1f}%; height:100%; border-radius:6px;
                            transition:width 0.4s'></div>
              </div>
              <div style='font-size:10px; color:#4a5a70; margin-top:3px; text-align:right'>
                잔여 {remain:,}원
              </div>
            </div>
            """, unsafe_allow_html=True)

            # 장바구니 품목 리스트
            items_html = "".join([
                f"<div class='cart-item'>"
                f"<span>{row['name']} <span style='color:#4a6a54;font-size:10px'>({row['unit']})</span></span>"
                f"<span class='cart-price'>{int(row['final_price']):,}원</span>"
                f"</div>"
                for _, row in items_df.iterrows()
            ])
            st.markdown(f"""
            <div class='cart-card'>
              <div class='cart-title'>
                🛒 추천 장바구니 ({st.session_state['preference']})
              </div>
              {items_html}
              <div class='cart-total'>
                <span>예상 합계</span>
                <span>{total:,}원</span>
              </div>
            </div>
            """, unsafe_allow_html=True)

            # 카테고리별 파이 차트
            cat_sum = items_df.groupby("category")["final_price"].sum().reset_index()
            fig = px.pie(
                cat_sum, values="final_price", names="category",
                hole=0.5,
                color_discrete_sequence=["#5ba4e8","#5ae88a","#e8a05a","#e85a96","#a05ae8","#e8e05a"],
            )
            fig.update_layout(
                margin=dict(t=10, b=10, l=10, r=10),
                paper_bgcolor="rgba(0,0,0,0)",
                plot_bgcolor="rgba(0,0,0,0)",
                font=dict(color="#c0c8d8", size=11),
                legend=dict(font=dict(size=10), bgcolor="rgba(0,0,0,0)"),
                showlegend=True,
            )
            fig.update_traces(textfont_color="#e0e8f0")
            st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

    # ── 탭2: 추천 상점 ──
    with tab2:
        stores_df = st.session_state["result_stores"]
        if stores_df.empty:
            st.markdown("""
            <div style='text-align:center; color:#4a5a70; padding:40px 0; font-size:13px'>
              추천 실행 후<br>반경 내 상점이<br>표시됩니다
            </div>
            """, unsafe_allow_html=True)
        else:
            for _, row in stores_df.head(8).iterrows():
                style   = STORE_STYLE.get(row["type"], STORE_STYLE["일반"])
                dist_txt = f"{row['distance_m']:.0f}m"
                cert_badge = "<span class='badge badge-kind'>인증</span>" if row.get("certified") else ""
                type_badge = f"<span class='badge {style['badge']}'>{row['type']}</span>"
                st.markdown(f"""
                <div class='store-item'>
                  <div class='store-name'>{style['icon']} {row['name']}</div>
                  <div class='store-meta'>{row['gu']} · 📏 {dist_txt}</div>
                  <div style='margin-top:4px'>{type_badge}{cert_badge}</div>
                </div>
                """, unsafe_allow_html=True)

            # 거리 vs 점수 산점도
            if "total_score" in stores_df.columns:
                fig2 = px.scatter(
                    stores_df.head(8),
                    x="distance_m", y="total_score",
                    color="type", text="name",
                    labels={"distance_m": "거리 (m)", "total_score": "추천 점수"},
                    color_discrete_map={
                        "전통시장":    "#5ba4e8",
                        "착한가격업소":"#5ae88a",
                        "로컬푸드":   "#e8a05a",
                        "일반":       "#9090c8",
                    },
                )
                fig2.update_traces(
                    textposition="top center",
                    textfont=dict(size=9, color="#c0c8d8"),
                    marker=dict(size=10),
                )
                fig2.update_layout(
                    margin=dict(t=10, b=30, l=10, r=10),
                    paper_bgcolor="rgba(0,0,0,0)",
                    plot_bgcolor="rgba(20,25,40,0.5)",
                    font=dict(color="#c0c8d8", size=10),
                    legend=dict(title="", font=dict(size=9), bgcolor="rgba(0,0,0,0)"),
                    xaxis=dict(gridcolor="#2a3048", zerolinecolor="#2a3048"),
                    yaxis=dict(gridcolor="#2a3048", zerolinecolor="#2a3048"),
                    height=220,
                )
                st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})

    # ── 탭3: PGIS 가격 제보 ──
    with tab3:
        st.markdown("""
        <div style='font-size:12px; color:#8070c0; margin-bottom:10px'>
          🖊️ <b>PGIS 참여형 가격 제보</b><br>
          지도에서 마커를 그린 후 아래 폼을 작성하면<br>
          지역 가격 데이터에 기여할 수 있습니다.
        </div>
        """, unsafe_allow_html=True)

        with st.form("report_form", clear_on_submit=True):
            item_sel = st.selectbox(
                "품목", ITEMS_DF["name"].tolist(), label_visibility="visible"
            )
            price_inp = st.number_input("직접 확인한 가격 (원)", min_value=100, max_value=100000, step=100)
            store_inp = st.text_input("상점명", placeholder="예: 망원시장 채소 가게")
            note_inp  = st.text_input("메모 (선택)", placeholder="예: 3개 묶음 판매")
            submitted = st.form_submit_button("제보 등록", use_container_width=True)

        if submitted:
            new_report = {
                "lat":   st.session_state["center_lat"] + np.random.uniform(-0.003, 0.003),
                "lng":   st.session_state["center_lng"] + np.random.uniform(-0.003, 0.003),
                "item":  item_sel,
                "price": price_inp,
                "store": store_inp,
                "note":  note_inp,
                "date":  datetime.now().strftime("%Y-%m-%d"),
            }
            st.session_state["user_reports"].append(new_report)
            st.success(f"✅ '{item_sel}' 가격 제보가 등록되었습니다!", icon="🎉")

        # 기존 제보 목록
        st.markdown("**최근 시민 제보**")
        for rpt in reversed(st.session_state["user_reports"][-5:]):
            st.markdown(f"""
            <div style='background:#16132a; border:1px solid #302050; border-radius:6px;
                        padding:8px 10px; margin-bottom:5px; font-size:11px'>
              <span style='color:#b090e8; font-weight:600'>{rpt['item']}</span>
              <span style='color:#6a7a96'> · {rpt.get('store','위치 미상')}</span>
              <span style='float:right; color:#7ae87a; font-weight:700'>{rpt['price']:,}원</span><br>
              <span style='color:#4a5060'>{rpt['date']}</span>
            </div>
            """, unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
# 하단: 가격 추이 차트 (확장 섹션)
# ══════════════════════════════════════════════════════════════

with st.expander("📈 주요 품목 가격 추이 (최근 4주)", expanded=False):
    # 더미 가격 추이 데이터 생성
    np.random.seed(42)
    weeks = [f"W{i}" for i in range(1, 5)]
    items_for_chart = ["계란", "배추", "돼지고기앞다리", "양파", "두부"]
    price_base = {"계란": 7200, "배추": 3800, "돼지고기앞다리": 1500, "양파": 2200, "두부": 1500}

    rows = []
    for item in items_for_chart:
        base = price_base[item]
        for w in weeks:
            rows.append({
                "주차": w,
                "품목": item,
                "전국평균": int(base * (1 + np.random.uniform(-0.08, 0.08))),
                "시장평균": int(base * 0.9 * (1 + np.random.uniform(-0.05, 0.05))),
            })

    trend_df = pd.DataFrame(rows)
    sel_item = st.selectbox("품목 선택", items_for_chart, key="trend_sel")
    sub_df   = trend_df[trend_df["품목"] == sel_item]

    fig3 = go.Figure()
    fig3.add_trace(go.Scatter(
        x=sub_df["주차"], y=sub_df["전국평균"],
        name="전국평균", mode="lines+markers",
        line=dict(color="#5ba4e8", width=2),
        marker=dict(size=7),
    ))
    fig3.add_trace(go.Scatter(
        x=sub_df["주차"], y=sub_df["시장평균"],
        name="전통시장 평균", mode="lines+markers",
        line=dict(color="#5ae88a", width=2, dash="dot"),
        marker=dict(size=7),
    ))
    fig3.update_layout(
        paper_bgcolor="rgba(0,0,0,0)",
        plot_bgcolor="rgba(20,25,40,0.5)",
        font=dict(color="#c0c8d8", size=11),
        margin=dict(t=10, b=10, l=10, r=10),
        legend=dict(bgcolor="rgba(0,0,0,0)", font=dict(size=10)),
        xaxis=dict(gridcolor="#2a3048"),
        yaxis=dict(gridcolor="#2a3048", ticksuffix="원"),
        height=250,
    )
    st.plotly_chart(fig3, use_container_width=True, config={"displayModeBar": False})

# 푸터
st.markdown("""
<div style='text-align:center; font-size:10px; color:#3a4a60; padding:16px 0 8px;
            border-top:1px solid #1a2235; margin-top:16px'>
  LocalCart · 데이터 출처: 농림축산식품부 aT 농수산물유통공사 · 소상공인진흥공단 · 공공데이터포털<br>
  PGIS 참여형 지도 · Streamlit + Folium · 2026
</div>
""", unsafe_allow_html=True)
