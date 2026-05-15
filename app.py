"""
LocalCart — 예산 맞춤형 지역상권 장보기 추천 플랫폼
거지맵 구조: 지도 100% 뷰포트 + 플로팅 글래스 패널
"""

import streamlit as st
import folium
from folium.plugins import MarkerCluster, Draw, Fullscreen, LocateControl
from streamlit_folium import st_folium
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go
import math
from datetime import datetime

st.set_page_config(
    page_title="LocalCart",
    page_icon="🛒",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# ══════════════════════════════════════════════════════════════
# CSS — 거지맵 스타일
# ══════════════════════════════════════════════════════════════
st.markdown("""
<style>
@import url('https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css');
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap');

:root {
  --bg:          #060b14;
  --glass:       rgba(8, 15, 28, 0.85);
  --glass-light: rgba(255,255,255,0.04);
  --glass-hover: rgba(255,255,255,0.07);
  --border:      rgba(255,255,255,0.08);
  --border-act:  rgba(99,183,255,0.45);
  --accent:      #63b7ff;
  --accent2:     #f5a623;
  --accent3:     #4ade80;
  --text-1:      #f0f4ff;
  --text-2:      #8a9bb8;
  --text-3:      #4a5a72;
  --red:         #ff6b6b;
  --radius:      14px;
  --radius-sm:   8px;
  --shadow:      0 8px 32px rgba(0,0,0,0.65);
  --shadow-sm:   0 4px 16px rgba(0,0,0,0.45);
}

*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

html, body {
  background: var(--bg) !important;
  font-family: 'Pretendard', -apple-system, sans-serif !important;
  overflow: hidden !important;
}

[data-testid="stAppViewContainer"],
[data-testid="stAppViewBlockContainer"],
[data-testid="block-container"],
.main, .block-container {
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100% !important;
  background: transparent !important;
  overflow: hidden !important;
}

[data-testid="stSidebar"],
[data-testid="collapsedControl"],
header[data-testid="stHeader"],
footer { display: none !important; }

::-webkit-scrollbar { width: 3px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: rgba(99,183,255,0.25); border-radius: 2px; }

/* 지도 전체화면 */
[data-testid="stIFrame"], iframe {
  position: fixed !important;
  top: 0 !important; left: 0 !important;
  width: 100vw !important;
  height: 100vh !important;
  border: none !important;
  z-index: 0 !important;
}

/* 상단 바 */
.top-bar {
  position: fixed; top: 16px; left: 50%;
  transform: translateX(-50%);
  width: min(580px, calc(100vw - 110px));
  z-index: 1000;
  display: flex; align-items: center; gap: 8px;
  pointer-events: all;
}
.logo-chip {
  background: var(--glass);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: 40px; padding: 10px 16px;
  display: flex; align-items: center; gap: 7px;
  box-shadow: var(--shadow); white-space: nowrap;
}
.logo-chip .lc-name {
  font-size: 15px; font-weight: 800;
  color: var(--accent); letter-spacing: -0.5px;
}
.search-pill {
  flex: 1;
  background: var(--glass);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: 40px; padding: 11px 20px;
  color: var(--text-3); font-size: 13px;
  font-family: 'Pretendard', sans-serif;
  box-shadow: var(--shadow);
}

/* 우측 도구 */
.right-tools {
  position: fixed; top: 50%; right: 16px;
  transform: translateY(-50%);
  z-index: 1000;
  display: flex; flex-direction: column; gap: 6px;
}
.tool-btn {
  width: 42px; height: 42px;
  background: var(--glass);
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
  border: 1px solid var(--border);
  border-radius: 12px;
  display: flex; align-items: center; justify-content: center;
  font-size: 17px; cursor: pointer;
  box-shadow: var(--shadow-sm);
  color: var(--text-2);
  transition: all 0.15s;
}
.tool-btn:hover { background: var(--glass-hover); border-color: var(--border-act); }

/* 하단 네비 */
.bottom-nav {
  position: fixed; bottom: 20px; left: 50%;
  transform: translateX(-50%);
  z-index: 1000;
  display: flex; gap: 5px;
  background: var(--glass);
  backdrop-filter: blur(28px) saturate(180%);
  -webkit-backdrop-filter: blur(28px) saturate(180%);
  border: 1px solid var(--border);
  border-radius: 40px; padding: 5px;
  box-shadow: var(--shadow);
  pointer-events: all;
}

/* 슬라이드업 패널 */
.slide-panel {
  position: fixed;
  bottom: 74px; left: 50%;
  transform: translateX(-50%);
  width: min(840px, calc(100vw - 28px));
  max-height: calc(100vh - 130px);
  z-index: 998;
  background: var(--glass);
  backdrop-filter: blur(36px) saturate(220%);
  -webkit-backdrop-filter: blur(36px) saturate(220%);
  border: 1px solid var(--border);
  border-top: 1px solid rgba(255,255,255,0.12);
  border-radius: 20px;
  box-shadow: var(--shadow), inset 0 1px 0 rgba(255,255,255,0.05);
  overflow: hidden; display: flex; flex-direction: column;
  animation: panelUp 0.25s cubic-bezier(0.22,1,0.36,1);
}
@keyframes panelUp {
  from { opacity:0; transform:translateX(-50%) translateY(20px); }
  to   { opacity:1; transform:translateX(-50%) translateY(0); }
}
.panel-drag { width:36px;height:4px;background:rgba(255,255,255,0.12);border-radius:2px;margin:10px auto 0; }
.panel-header {
  display:flex;align-items:center;justify-content:space-between;
  padding:12px 20px 11px;
  border-bottom:1px solid var(--border);flex-shrink:0;
}
.panel-title { font-size:15px;font-weight:700;color:var(--text-1);display:flex;align-items:center;gap:8px; }
.panel-body  { flex:1;overflow-y:auto;padding:16px 20px 22px; }

/* 카드/컴포넌트 */
.gauge-wrap {
  background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:14px 16px;margin-bottom:14px;
}
.gauge-nums { display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px; }
.gauge-total { font-size:24px;font-weight:700;color:var(--accent2);font-family:'DM Mono',monospace; }
.gauge-of    { font-size:13px;color:var(--text-2); }
.gauge-track { height:5px;background:rgba(255,255,255,0.06);border-radius:3px;overflow:hidden; }
.gauge-fill  { height:100%;border-radius:3px;transition:width .5s cubic-bezier(.4,0,.2,1); }
.gauge-sub   { font-size:11px;color:var(--text-3);margin-top:5px; }

.items-grid { display:grid;grid-template-columns:1fr 1fr;gap:9px; }
.item-card {
  background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:11px 13px;
  display:flex;align-items:center;gap:10px;
  transition:border-color .15s;
}
.item-card:hover { border-color:rgba(99,183,255,0.22); }
.item-emoji { font-size:22px;flex-shrink:0; }
.item-info  { flex:1;min-width:0; }
.item-name  { font-size:13px;font-weight:600;color:var(--text-1); }
.item-unit  { font-size:11px;color:var(--text-3);margin-top:1px; }
.item-cat   {
  font-size:9px;padding:2px 6px;border-radius:8px;font-weight:700;
  margin-top:4px;display:inline-block;border:1px solid;
}
.item-price { font-size:14px;font-weight:700;color:var(--accent2);font-family:'DM Mono',monospace;white-space:nowrap; }

.cat-단백질  { color:#63b7ff;border-color:rgba(99,183,255,.25);background:rgba(99,183,255,.1); }
.cat-채소    { color:#4ade80;border-color:rgba(74,222,128,.25);background:rgba(74,222,128,.1); }
.cat-탄수화물{ color:#f5a623;border-color:rgba(245,166,35,.25);background:rgba(245,166,35,.1); }
.cat-과일    { color:#fb7185;border-color:rgba(251,113,133,.25);background:rgba(251,113,133,.1); }
.cat-양념    { color:#a78bfa;border-color:rgba(167,139,250,.25);background:rgba(167,139,250,.1); }
.cat-가공식품{ color:#9ca3af;border-color:rgba(156,163,175,.25);background:rgba(156,163,175,.1); }

.store-list { display:flex;flex-direction:column;gap:7px; }
.store-card {
  background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:12px 14px;
  display:flex;align-items:center;gap:11px;
  cursor:pointer;transition:all .15s;
}
.store-card:hover { border-color:rgba(99,183,255,.3);background:var(--glass-hover); }
.store-rank-badge {
  width:30px;height:30px;border-radius:8px;
  display:flex;align-items:center;justify-content:center;
  font-size:13px;font-weight:700;font-family:'DM Mono',monospace;flex-shrink:0;
}
.store-body { flex:1;min-width:0; }
.store-name { font-size:14px;font-weight:700;color:var(--text-1); }
.store-desc { font-size:11px;color:var(--text-3);margin-top:2px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.store-tags { display:flex;gap:4px;margin-top:5px;flex-wrap:wrap; }
.tag {
  font-size:10px;padding:2px 8px;border-radius:9px;font-weight:600;border:1px solid;
}
.tag-market { color:#63b7ff;border-color:rgba(99,183,255,.3);background:rgba(99,183,255,.08); }
.tag-kind   { color:#4ade80;border-color:rgba(74,222,128,.3);background:rgba(74,222,128,.08); }
.tag-local  { color:#f5a623;border-color:rgba(245,166,35,.3);background:rgba(245,166,35,.08); }
.tag-cert   { color:#a78bfa;border-color:rgba(167,139,250,.3);background:rgba(167,139,250,.08); }
.store-right { text-align:right;flex-shrink:0; }
.store-dist  { font-size:13px;font-weight:600;color:var(--text-2);font-family:'DM Mono',monospace; }
.store-score { font-size:11px;color:var(--accent3);font-family:'DM Mono',monospace;margin-top:2px; }

.stat-row { display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px; }
.stat-cell {
  background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:10px 12px;text-align:center;
}
.stat-val { font-size:19px;font-weight:700;color:var(--accent);font-family:'DM Mono',monospace;display:block; }
.stat-lbl { font-size:10px;color:var(--text-3);margin-top:2px;display:block; }

.rpt-card {
  background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:10px 13px;
  display:flex;align-items:center;gap:10px;margin-bottom:6px;
}
.rpt-name  { font-size:13px;font-weight:700;color:var(--text-1); }
.rpt-store { font-size:11px;color:var(--text-3);margin-top:1px; }
.rpt-price { font-size:15px;font-weight:700;color:var(--accent3);font-family:'DM Mono',monospace;margin-left:auto;white-space:nowrap; }

.sec-label {
  font-size:10px;font-weight:700;color:var(--text-3);
  text-transform:uppercase;letter-spacing:.9px;
  display:block;margin-bottom:8px;
}

.summary-strip {
  background:rgba(99,183,255,0.05);
  border:1px solid rgba(99,183,255,0.12);
  border-radius:var(--radius-sm);
  padding:12px 16px;margin-bottom:14px;
  display:flex;gap:24px;flex-wrap:wrap;
}
.summary-item { display:flex;flex-direction:column;gap:2px; }
.summary-label { font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.6px; }
.summary-val   { font-size:15px;font-weight:700;font-family:'DM Mono',monospace; }

/* Streamlit 위젯 오버라이드 */
div[data-testid="stSlider"] > label,
div[data-testid="stSelectbox"] > label,
div[data-testid="stNumberInput"] > label,
div[data-testid="stTextInput"] > label { display:none !important; }

.stButton>button {
  font-family:'Pretendard',sans-serif !important;
  font-weight:600 !important; font-size:13px !important;
  padding:8px 12px !important;
  background:var(--glass-light) !important;
  border:1px solid var(--border) !important;
  border-radius:8px !important;
  color:var(--text-2) !important;
  transition:all .15s !important;
  width:100% !important;
}
.stButton>button:hover {
  background:var(--glass-hover) !important;
  border-color:rgba(99,183,255,.35) !important;
  color:var(--accent) !important;
}

[data-testid="stNumberInput"] input,
[data-testid="stTextInput"] input {
  background:var(--glass-light) !important;
  border:1px solid var(--border) !important;
  border-radius:8px !important;
  color:var(--text-1) !important;
  font-family:'Pretendard',sans-serif !important;
}
[data-testid="stSelectbox"] > div > div {
  background:var(--glass-light) !important;
  border:1px solid var(--border) !important;
  border-radius:8px !important;
  color:var(--text-1) !important;
}

div[data-testid="stSlider"] div[data-baseweb="slider"] div[role="slider"] {
  background:var(--accent) !important; border:2px solid var(--accent) !important;
}

/* 큰 실행 버튼 */
.stButton.run-btn>button {
  background:linear-gradient(135deg,rgba(99,183,255,.2),rgba(99,183,255,.07)) !important;
  border-color:rgba(99,183,255,.35) !important;
  color:var(--accent) !important;
  font-size:15px !important; padding:13px !important;
  letter-spacing:-.2px !important;
}
.stButton.run-btn>button:hover {
  background:linear-gradient(135deg,rgba(99,183,255,.3),rgba(99,183,255,.12)) !important;
  border-color:var(--accent) !important;
  box-shadow:0 0 24px rgba(99,183,255,.18) !important;
}

@media(max-width:600px){
  .items-grid,.stat-row{grid-template-columns:1fr 1fr;}
  .top-bar{width:calc(100vw - 80px);}
}
</style>
""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
# 데이터
# ══════════════════════════════════════════════════════════════
ITEMS_SEED = [
    ("C001","계란",      "단백질","30개",  7200,6800,7500,"🥚"),
    ("C002","두부",      "단백질","300g",  1500,1200,1600,"🧊"),
    ("C003","돼지앞다리","단백질","100g",  1500,1350,1650,"🥩"),
    ("C004","닭가슴살",  "단백질","100g",  1800,1600,2000,"🍗"),
    ("C005","콩나물",    "채소",  "200g",   900, 750,1000,"🌱"),
    ("C006","애호박",    "채소",  "1개",   1500,1200,1700,"🥒"),
    ("C007","양파",      "채소",  "1kg",   2200,1800,2500,"🧅"),
    ("C008","대파",      "채소",  "1단",   2500,2000,2800,"🌿"),
    ("C009","배추",      "채소",  "1포기", 3800,3200,4200,"🥬"),
    ("C010","시금치",    "채소",  "200g",  2800,2200,3100,"🍃"),
    ("C011","쌀",        "탄수화물","1kg", 3500,3200,3800,"🍚"),
    ("C012","감자",      "탄수화물","1kg", 3000,2600,3400,"🥔"),
    ("C013","고구마",    "탄수화물","1kg", 4500,3800,5000,"🍠"),
    ("C014","사과",      "과일",  "3개",   6500,5800,7200,"🍎"),
    ("C015","바나나",    "과일",  "1송이", 3500,3000,4000,"🍌"),
    ("C016","참기름",    "양념",  "180ml", 7500,6800,8500,"🫙"),
    ("C017","고추장",    "양념",  "500g",  4800,4200,5500,"🌶️"),
    ("C018","된장",      "양념",  "500g",  4200,3700,4800,"🟤"),
    ("C019","간장",      "양념",  "500ml", 3800,3300,4200,"🍶"),
    ("C020","두유",      "가공식품","6개", 5500,4800,6000,"🥛"),
]
ITEMS_DF = pd.DataFrame(ITEMS_SEED,
    columns=["code","name","category","unit","avg_price","market_price","supermarket_price","emoji"])

STORES_SEED = [
    {"id":"S001","name":"광장시장",         "type":"전통시장",    "gu":"종로구",  "lat":37.5701,"lng":126.9993,"certified":True, "desc":"빈대떡·육회·마약김밥 유명"},
    {"id":"S002","name":"마포농수산물시장",  "type":"전통시장",    "gu":"마포구",  "lat":37.5448,"lng":126.9475,"certified":True, "desc":"수산물 전문 도소매"},
    {"id":"S003","name":"망원시장",          "type":"전통시장",    "gu":"마포구",  "lat":37.5560,"lng":126.9047,"certified":True, "desc":"SNS 감성 전통시장"},
    {"id":"S004","name":"통인시장",          "type":"전통시장",    "gu":"종로구",  "lat":37.5787,"lng":126.9681,"certified":True, "desc":"도시락카페·기름떡볶이"},
    {"id":"S005","name":"남대문시장",        "type":"전통시장",    "gu":"중구",    "lat":37.5590,"lng":126.9768,"certified":True, "desc":"대표 도소매 전통시장"},
    {"id":"S006","name":"경동시장",          "type":"전통시장",    "gu":"동대문구","lat":37.5798,"lng":127.0436,"certified":True, "desc":"한약재·건어물·청과"},
    {"id":"S007","name":"노량진수산시장",    "type":"전통시장",    "gu":"동작구",  "lat":37.5129,"lng":126.9428,"certified":True, "desc":"새벽 경매·직거래"},
    {"id":"S008","name":"이대 착한가격식당", "type":"착한가격업소","gu":"서대문구","lat":37.5554,"lng":126.9458,"certified":True, "desc":"구청 인증"},
    {"id":"S009","name":"은평 로컬푸드",     "type":"로컬푸드",    "gu":"은평구",  "lat":37.6022,"lng":126.9234,"certified":True, "desc":"경기 직매장"},
    {"id":"S010","name":"성동 로컬푸드",     "type":"로컬푸드",    "gu":"성동구",  "lat":37.5471,"lng":127.0390,"certified":True, "desc":"도시농업 직거래"},
    {"id":"S011","name":"합정 착한가격마트", "type":"착한가격업소","gu":"마포구",  "lat":37.5494,"lng":126.9147,"certified":True, "desc":"소상공인 인증"},
    {"id":"S012","name":"청량리청과물시장",  "type":"전통시장",    "gu":"동대문구","lat":37.5891,"lng":127.0479,"certified":True, "desc":"과일·채소 도매"},
]
STORES_DF = pd.DataFrame(STORES_SEED)

STORE_STYLE = {
    "전통시장":    {"icon":"🏪","fc":"blue",  "tag":"tag-market","rb":"rgba(99,183,255,.15)","rc":"#63b7ff"},
    "착한가격업소":{"icon":"✅","fc":"green", "tag":"tag-kind",  "rb":"rgba(74,222,128,.15)","rc":"#4ade80"},
    "로컬푸드":    {"icon":"🌿","fc":"orange","tag":"tag-local", "rb":"rgba(245,166,35,.15)","rc":"#f5a623"},
}


# ══════════════════════════════════════════════════════════════
# 유틸
# ══════════════════════════════════════════════════════════════
def haversine(la1,lo1,la2,lo2):
    R=6371000; p1,p2=math.radians(la1),math.radians(la2)
    dp,dl=math.radians(la2-la1),math.radians(lo2-lo1)
    a=math.sin(dp/2)**2+math.cos(p1)*math.cos(p2)*math.sin(dl/2)**2
    return R*2*math.atan2(math.sqrt(a),math.sqrt(1-a))

def filter_stores(df,lat,lng,r):
    df=df.copy()
    df["distance_m"]=df.apply(lambda row:haversine(lat,lng,row["lat"],row["lng"]),axis=1)
    return df[df["distance_m"]<=r].sort_values("distance_m")

def score_stores(df):
    if df.empty: return df
    df=df.copy(); mx=df["distance_m"].max() or 1
    tm={"로컬푸드":1.0,"착한가격업소":0.9,"전통시장":0.8,"일반":0.5}
    df["score_dist"] =1-df["distance_m"]/mx
    df["score_type"] =df["type"].map(tm).fillna(0.5)
    df["score_local"]=df["type"].isin(["전통시장","착한가격업소","로컬푸드"]).astype(float)
    df["total_score"]=df["score_dist"]*.40+df["score_type"]*.35+df["score_local"]*.25
    return df.sort_values("total_score",ascending=False)

def recommend_items(budget,household,pref,use_market):
    df=ITEMS_DF.copy()
    scale={1:1.0,2:1.6,3:2.3,4:3.0}.get(household,3.0)
    pc="market_price" if use_market else "avg_price"
    df["unit_price"]=(df[pc]*scale).astype(int)
    W={"균형":{"단백질":1.2,"채소":1.2,"탄수화물":1.0,"과일":0.8,"양념":0.6,"가공식품":0.5},
       "채소":{"채소":1.8,"단백질":0.8,"탄수화물":1.0,"과일":1.0,"양념":0.6,"가공식품":0.4},
       "단백질":{"단백질":1.8,"채소":0.8,"탄수화물":0.8,"과일":0.6,"양념":0.5,"가공식품":0.5},
       "저탄수화물":{"단백질":1.5,"채소":1.5,"탄수화물":0.3,"과일":0.8,"양념":0.5,"가공식품":0.4}}
    w=W.get(pref,W["균형"])
    df["pw"]=df["category"].map(w).fillna(0.6)
    df["util"]=df["pw"]/(df["unit_price"]/1000+0.1)
    df=df.sort_values("util",ascending=False)
    sel,tot=[],0
    for _,r in df.iterrows():
        if tot+r["unit_price"]<=budget and len(sel)<10:
            sel.append(r); tot+=r["unit_price"]
    return pd.DataFrame(sel) if sel else pd.DataFrame()


# ══════════════════════════════════════════════════════════════
# 세션
# ══════════════════════════════════════════════════════════════
for k,v in {"lat":37.5665,"lng":126.9780,"radius_m":3000,"budget":50000,
             "household":2,"pref":"균형","use_market":True,
             "active_panel":None,
             "result_stores":pd.DataFrame(),"result_items":pd.DataFrame(),
             "user_reports":[
                 {"lat":37.5701,"lng":126.9993,"item":"배추","price":3500,"store":"광장시장","date":"2026-05-14"},
                 {"lat":37.5560,"lng":126.9047,"item":"계란","price":6800,"store":"망원시장","date":"2026-05-13"},
                 {"lat":37.5448,"lng":126.9475,"item":"두부","price":1100,"store":"마포농수산물시장","date":"2026-05-12"},
             ]}.items():
    if k not in st.session_state: st.session_state[k]=v
ss=st.session_state


# ══════════════════════════════════════════════════════════════
# 지도 (뷰포트 전체)
# ══════════════════════════════════════════════════════════════
def build_map():
    m=folium.Map(location=[ss["lat"],ss["lng"]],zoom_start=14,
                 tiles="CartoDB dark_matter",prefer_canvas=True)
    Fullscreen(position="topright").add_to(m)
    LocateControl(auto_start=False,position="bottomright").add_to(m)
    Draw(position="topleft",
         draw_options={"marker":True,"circle":True,"polygon":True,
                       "polyline":False,"rectangle":True,"circlemarker":False},
         edit_options={"edit":True,"remove":True}).add_to(m)

    folium.Circle([ss["lat"],ss["lng"]],radius=ss["radius_m"],
                  color="#63b7ff",weight=1.5,fill=True,
                  fill_color="#63b7ff",fill_opacity=0.04).add_to(m)
    folium.Marker([ss["lat"],ss["lng"]],
                  popup=folium.Popup("<b>📍 내 위치</b>",max_width=120),
                  tooltip="내 위치",
                  icon=folium.Icon(color="red",icon="home",prefix="fa")).add_to(m)

    show=ss["result_stores"] if not ss["result_stores"].empty else STORES_DF
    cl=MarkerCluster(options={"maxClusterRadius":55,"showCoverageOnHover":True})
    for _,row in show.iterrows():
        sty=STORE_STYLE.get(row["type"],{"icon":"🏬","fc":"purple"})
        dt=f"{row['distance_m']:.0f}m" if "distance_m" in row else ""
        sc=f"{row.get('total_score',0)*100:.0f}점" if "total_score" in row else ""
        html=f"""<div style='font-family:sans-serif;min-width:185px;padding:3px'>
          <div style='font-size:15px;font-weight:700;margin-bottom:5px'>{sty['icon']} {row['name']}</div>
          <div style='font-size:11px;color:#888;margin-bottom:4px'>{row['gu']} · {row['type']}</div>
          <div style='font-size:11px;color:#555;margin-bottom:7px'>{row.get('desc','')}</div>
          <div style='display:flex;gap:5px;flex-wrap:wrap'>
            {'<span style="background:#e8f4fd;color:#1a5f8a;padding:2px 8px;border-radius:8px;font-size:10px">📏 '+dt+'</span>' if dt else ''}
            {'<span style="background:#f0fdf4;color:#166534;padding:2px 8px;border-radius:8px;font-size:10px">⭐ '+sc+'</span>' if sc else ''}
            {'<span style="background:#fffbeb;color:#92400e;padding:2px 8px;border-radius:8px;font-size:10px">✅ 인증</span>' if row.get("certified") else ''}
          </div></div>"""
        folium.Marker([row["lat"],row["lng"]],
                      popup=folium.Popup(html,max_width=240),
                      tooltip=f"{sty['icon']} {row['name']}"+(f" ({dt})" if dt else ""),
                      icon=folium.Icon(color=sty["fc"],icon="shopping-basket",prefix="fa")).add_to(cl)
    cl.add_to(m)

    for rpt in ss["user_reports"]:
        folium.CircleMarker([rpt["lat"],rpt["lng"]],radius=7,
                            color="#f5a623",fill=True,fill_color="#f5a623",fill_opacity=0.78,
                            popup=folium.Popup(
                                f"<b>📝 {rpt['item']}</b>: {rpt['price']:,}원<br>"
                                f"<small>{rpt.get('store','')} · {rpt['date']}</small>",max_width=180),
                            tooltip=f"💬 {rpt['item']} {rpt['price']:,}원").add_to(m)
    folium.LayerControl(position="topright").add_to(m)
    return m

map_out=st_folium(build_map(),width="100%",height=900,
                   returned_objects=["last_clicked","all_drawings"],key="main_map")

if map_out and map_out.get("last_clicked"):
    c=map_out["last_clicked"]
    ss["lat"]=c["lat"]; ss["lng"]=c["lng"]


# ══════════════════════════════════════════════════════════════
# 고정 UI 레이어
# ══════════════════════════════════════════════════════════════
st.markdown("""
<div class="top-bar">
  <div class="logo-chip">
    <span style="font-size:19px">🛒</span>
    <span class="lc-name">LocalCart</span>
  </div>
  <div class="search-pill">🔍&nbsp;&nbsp;동네, 시장, 품목 검색...</div>
</div>
<div class="right-tools">
  <div class="tool-btn" title="내 위치">📍</div>
  <div class="tool-btn" title="레이어">🗂</div>
  <div class="tool-btn" title="거리측정">📐</div>
  <div class="tool-btn" title="전체화면">⛶</div>
</div>
""", unsafe_allow_html=True)


# ══════════════════════════════════════════════════════════════
# 하단 네비 버튼 (Streamlit 버튼 → invisible, HTML은 시각용)
# ══════════════════════════════════════════════════════════════
ni=len(ss["result_items"]); ns=len(ss["result_stores"]); nr=len(ss["user_reports"])

# 시각용 바텀 네비
def ac(k): return "active" if ss["active_panel"]==k else ""
st.markdown(f"""
<div class="bottom-nav">
  <div style="padding:7px 14px;border-radius:30px;font-size:13px;font-weight:600;color:{'#63b7ff' if ac('search') else '#8a9bb8'}">
    ⚙️ 조건설정
  </div>
  <div style="padding:7px 14px;border-radius:30px;font-size:13px;font-weight:600;color:{'#63b7ff' if ac('cart') else '#8a9bb8'}">
    🛍️ 장바구니{f' <span style="background:rgba(99,183,255,.2);color:#63b7ff;border-radius:8px;padding:1px 6px;font-size:11px">{ni}</span>' if ni else ''}
  </div>
  <div style="padding:7px 14px;border-radius:30px;font-size:13px;font-weight:600;color:{'#63b7ff' if ac('stores') else '#8a9bb8'}">
    🏪 추천상점{f' <span style="background:rgba(74,222,128,.2);color:#4ade80;border-radius:8px;padding:1px 6px;font-size:11px">{ns}</span>' if ns else ''}
  </div>
  <div style="padding:7px 14px;border-radius:30px;font-size:13px;font-weight:600;color:{'#63b7ff' if ac('report') else '#8a9bb8'}">
    📝 제보 <span style="background:rgba(245,166,35,.2);color:#f5a623;border-radius:8px;padding:1px 6px;font-size:11px">{nr}</span>
  </div>
</div>
""", unsafe_allow_html=True)

# 실제 클릭 처리 버튼 (z-index로 바텀 네비 위에 겹침)
st.markdown("""
<style>
div[data-testid="stHorizontalBlock"] {
  position:fixed !important; bottom:20px !important; left:50% !important;
  transform:translateX(-50%) !important;
  z-index:1001 !important; width:min(840px,calc(100vw - 28px)) !important;
  gap:0 !important; background:transparent !important;
}
div[data-testid="stHorizontalBlock"] .stButton>button {
  opacity:0 !important; height:46px !important;
  border-radius:30px !important;
}
</style>
""", unsafe_allow_html=True)

bc=st.columns(4)
with bc[0]:
    if st.button("⚙️ 조건설정", key="bn_search"):
        ss["active_panel"]=None if ss["active_panel"]=="search" else "search"; st.rerun()
with bc[1]:
    if st.button("🛍️ 장바구니", key="bn_cart"):
        ss["active_panel"]=None if ss["active_panel"]=="cart" else "cart"; st.rerun()
with bc[2]:
    if st.button("🏪 추천상점", key="bn_stores"):
        ss["active_panel"]=None if ss["active_panel"]=="stores" else "stores"; st.rerun()
with bc[3]:
    if st.button("📝 제보", key="bn_report"):
        ss["active_panel"]=None if ss["active_panel"]=="report" else "report"; st.rerun()


# ══════════════════════════════════════════════════════════════
# 슬라이드업 패널
# ══════════════════════════════════════════════════════════════

# ── 조건 설정 ────────────────────────────────────────────────
if ss["active_panel"]=="search":
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">⚙️ 장보기 조건 설정</div></div>'
                '<div class="panel-body">', unsafe_allow_html=True)

    c1,c2=st.columns(2)
    with c1:
        st.markdown('<span class="sec-label">탐색 반경</span>',unsafe_allow_html=True)
        rc=st.columns(5)
        for i,(lbl,val) in enumerate({"500m":500,"1km":1000,"2km":2000,"3km":3000,"5km":5000}.items()):
            with rc[i]:
                if st.button(lbl,key=f"r{val}"): ss["radius_m"]=val; st.rerun()
        st.markdown('<span class="sec-label" style="margin-top:14px">예산</span>',unsafe_allow_html=True)
        ss["budget"]=st.slider("",10000,200000,ss["budget"],5000,format="%d원",key="bslider")
        st.markdown(f'<div style="font-size:22px;font-weight:700;color:#f5a623;'
                    f'font-family:\'DM Mono\',monospace;margin-top:-4px">{ss["budget"]:,}원</div>',
                    unsafe_allow_html=True)
    with c2:
        st.markdown('<span class="sec-label">가구 구성</span>',unsafe_allow_html=True)
        hc=st.columns(4)
        for i,n in enumerate([1,2,3,4]):
            with hc[i]:
                lbl2=f"✓ {n}인" if ss["household"]==n else f"{n}인"
                if st.button(lbl2,key=f"h{n}"): ss["household"]=n; st.rerun()
        st.markdown('<span class="sec-label" style="margin-top:14px">식단 선호</span>',unsafe_allow_html=True)
        pc=st.columns(4)
        for i,p in enumerate(["균형","채소","단백질","저탄수화물"]):
            with pc[i]:
                lbl3=f"✓ {p}" if ss["pref"]==p else p
                if st.button(lbl3,key=f"p{p}"): ss["pref"]=p; st.rerun()
        st.markdown('<div style="margin-top:14px"></div>',unsafe_allow_html=True)
        mk=f"{'✅' if ss['use_market'] else '☐'} 전통시장 가격 기준 적용"
        if st.button(mk,key="tmk"): ss["use_market"]=not ss["use_market"]; st.rerun()

    st.markdown(f"""
    <div class="summary-strip">
      <div class="summary-item">
        <span class="summary-label">예산</span>
        <span class="summary-val" style="color:#f5a623">{ss['budget']:,}원</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">가구</span>
        <span class="summary-val" style="color:#63b7ff">{ss['household']}인</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">식단</span>
        <span class="summary-val" style="color:#4ade80">{ss['pref']}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">반경</span>
        <span class="summary-val" style="color:#a78bfa">{ss['radius_m']:,}m</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">가격</span>
        <span class="summary-val" style="color:#fb7185">{"시장가" if ss["use_market"] else "평균가"}</span>
      </div>
      <div class="summary-item">
        <span class="summary-label">위치</span>
        <span class="summary-val" style="color:#9ca3af;font-size:12px">{ss['lat']:.4f}, {ss['lng']:.4f}</span>
      </div>
    </div>
    """,unsafe_allow_html=True)

    st.markdown('<div class="stButton run-btn">',unsafe_allow_html=True)
    if st.button("🔍  추천 실행",key="run",use_container_width=True):
        with st.spinner("분석 중..."):
            f=filter_stores(STORES_DF,ss["lat"],ss["lng"],ss["radius_m"])
            ss["result_stores"]=score_stores(f)
            ss["result_items"]=recommend_items(ss["budget"],ss["household"],ss["pref"],ss["use_market"])
            ss["active_panel"]="cart"
        st.rerun()
    st.markdown('</div>',unsafe_allow_html=True)

    st.markdown("</div></div>",unsafe_allow_html=True)


# ── 장바구니 ─────────────────────────────────────────────────
elif ss["active_panel"]=="cart":
    idf=ss["result_items"]
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">🛍️ 추천 장바구니</div></div>'
                '<div class="panel-body">',unsafe_allow_html=True)

    if idf.empty:
        st.markdown('<div style="text-align:center;padding:44px 0;color:var(--text-3)">'
                    '<div style="font-size:40px;margin-bottom:12px">🛒</div>'
                    '<div style="font-size:14px;font-weight:600">조건 설정 → 추천 실행 후 확인하세요</div>'
                    '</div>',unsafe_allow_html=True)
    else:
        total=int(idf["unit_price"].sum()); budget=ss["budget"]
        pct=min(total/budget*100,100); remain=budget-total
        bc2="#4ade80" if pct<85 else "#f5a623" if pct<=100 else "#ff6b6b"
        st.markdown(f"""
        <div class="gauge-wrap">
          <div class="gauge-nums">
            <div>
              <div style="font-size:10px;color:var(--text-3);margin-bottom:2px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">예상 합계</div>
              <span class="gauge-total">{total:,}원</span>
            </div>
            <div style="text-align:right">
              <div style="font-size:10px;color:var(--text-3);margin-bottom:2px;font-weight:600;text-transform:uppercase;letter-spacing:.6px">예산</div>
              <span class="gauge-of">{budget:,}원</span>
            </div>
          </div>
          <div class="gauge-track">
            <div class="gauge-fill" style="width:{pct:.1f}%;background:{bc2}"></div>
          </div>
          <div class="gauge-sub">잔여 <b style="color:{bc2}">{remain:,}원</b>&nbsp;·&nbsp;예산의 {pct:.1f}% 사용</div>
        </div>
        """,unsafe_allow_html=True)

        cards="<div class='items-grid'>"
        for _,row in idf.iterrows():
            cat=row["category"]
            cards+=(f"<div class='item-card'>"
                    f"<div class='item-emoji'>{row.get('emoji','🛒')}</div>"
                    f"<div class='item-info'>"
                    f"<div class='item-name'>{row['name']}</div>"
                    f"<div class='item-unit'>{row['unit']}</div>"
                    f"<span class='item-cat cat-{cat}'>{cat}</span>"
                    f"</div>"
                    f"<div class='item-price'>{int(row['unit_price']):,}원</div>"
                    f"</div>")
        cards+="</div>"
        st.markdown(cards,unsafe_allow_html=True)
        st.markdown('<div style="height:14px"></div>',unsafe_allow_html=True)

        cs=idf.groupby("category")["unit_price"].sum().reset_index()
        fig=px.pie(cs,values="unit_price",names="category",hole=0.58,
                   color_discrete_sequence=["#63b7ff","#4ade80","#f5a623","#fb7185","#a78bfa","#9ca3af"])
        fig.update_layout(paper_bgcolor="rgba(0,0,0,0)",plot_bgcolor="rgba(0,0,0,0)",
                          font=dict(color="#8a9bb8",family="Pretendard"),height=190,
                          margin=dict(t=0,b=0,l=0,r=0),
                          legend=dict(bgcolor="rgba(0,0,0,0)",font=dict(size=11),
                                      orientation="h",yanchor="bottom",y=-0.35,xanchor="center",x=0.5))
        fig.update_traces(textfont_color="#f0f4ff",textfont_size=11)
        st.plotly_chart(fig,use_container_width=True,config={"displayModeBar":False})

    st.markdown("</div></div>",unsafe_allow_html=True)


# ── 추천 상점 ────────────────────────────────────────────────
elif ss["active_panel"]=="stores":
    sdf=ss["result_stores"]
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">🏪 추천 상점</div></div>'
                '<div class="panel-body">',unsafe_allow_html=True)

    if sdf.empty:
        st.markdown('<div style="text-align:center;padding:44px 0;color:var(--text-3)">'
                    '<div style="font-size:40px;margin-bottom:12px">🏪</div>'
                    '<div style="font-size:14px;font-weight:600">조건 설정 → 추천 실행 후 확인하세요</div>'
                    '</div>',unsafe_allow_html=True)
    else:
        nm=len(sdf[sdf["type"]=="전통시장"])
        nk=len(sdf[sdf["type"]=="착한가격업소"])
        nl=len(sdf[sdf["type"]=="로컬푸드"])
        nd=sdf.iloc[0]["distance_m"] if not sdf.empty else 0
        st.markdown(f"""
        <div class="stat-row">
          <div class="stat-cell"><span class="stat-val">{len(sdf)}</span><span class="stat-lbl">총 상점</span></div>
          <div class="stat-cell"><span class="stat-val" style="color:#63b7ff">{nm}</span><span class="stat-lbl">전통시장</span></div>
          <div class="stat-cell"><span class="stat-val" style="color:#4ade80">{nk+nl}</span><span class="stat-lbl">착한/로컬</span></div>
          <div class="stat-cell"><span class="stat-val" style="color:#f5a623">{nd:.0f}m</span><span class="stat-lbl">최단거리</span></div>
        </div>
        """,unsafe_allow_html=True)

        sl="<div class='store-list'>"
        for rank,(_,row) in enumerate(sdf.head(8).iterrows(),1):
            sty=STORE_STYLE.get(row["type"],{"icon":"🏬","tag":"","rb":"rgba(255,255,255,.05)","rc":"#888"})
            dm=row.get("distance_m",0)
            dt=f"{dm:.0f}m" if dm<1000 else f"{dm/1000:.1f}km"
            sc=row.get("total_score",0)
            cert=f'<span class="tag tag-cert">✅ 인증</span>' if row.get("certified") else ""
            sl+=(f"<div class='store-card'>"
                 f"<div class='store-rank-badge' style='background:{sty['rb']};color:{sty['rc']}'>{rank}</div>"
                 f"<div class='store-body'>"
                 f"<div class='store-name'>{sty['icon']} {row['name']}</div>"
                 f"<div class='store-desc'>{row['gu']} · {row.get('desc','')}</div>"
                 f"<div class='store-tags'><span class='tag {sty['tag']}'>{row['type']}</span>{cert}</div>"
                 f"</div>"
                 f"<div class='store-right'>"
                 f"<div class='store-dist'>{dt}</div>"
                 f"<div class='store-score'>★ {sc*100:.0f}pt</div>"
                 f"</div></div>")
        sl+="</div>"
        st.markdown(sl,unsafe_allow_html=True)
        st.markdown('<div style="height:14px"></div>',unsafe_allow_html=True)

        if "total_score" in sdf.columns:
            fig2=px.scatter(sdf.head(8),x="distance_m",y="total_score",
                            color="type",text="name",
                            labels={"distance_m":"거리 (m)","total_score":"추천 점수"},
                            color_discrete_map={"전통시장":"#63b7ff","착한가격업소":"#4ade80",
                                                "로컬푸드":"#f5a623","일반":"#9ca3af"})
            fig2.update_traces(textposition="top center",textfont=dict(size=9,color="#8a9bb8"),marker=dict(size=10))
            fig2.update_layout(paper_bgcolor="rgba(0,0,0,0)",
                               plot_bgcolor="rgba(255,255,255,0.02)",
                               font=dict(color="#8a9bb8",family="Pretendard"),height=220,
                               margin=dict(t=10,b=10,l=10,r=10),
                               xaxis=dict(gridcolor="rgba(255,255,255,0.04)"),
                               yaxis=dict(gridcolor="rgba(255,255,255,0.04)"),
                               legend=dict(bgcolor="rgba(0,0,0,0)",font=dict(size=10)))
            st.plotly_chart(fig2,use_container_width=True,config={"displayModeBar":False})

    st.markdown("</div></div>",unsafe_allow_html=True)


# ── 가격 제보 ────────────────────────────────────────────────
elif ss["active_panel"]=="report":
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">📝 PGIS 가격 제보</div></div>'
                '<div class="panel-body">',unsafe_allow_html=True)

    st.markdown("""
    <div style="background:rgba(245,166,35,.06);border:1px solid rgba(245,166,35,.18);
                border-radius:8px;padding:10px 14px;margin-bottom:14px;font-size:12px;color:#d4a24a;line-height:1.6">
      🖊️ 지도에서 마커를 그린 후 직접 확인한 가격을 입력하면 데이터에 기여할 수 있습니다.
      시민 제보 데이터는 지도에 <b style="color:#f5a623">황금색 마커</b>로 표시됩니다.
    </div>
    """,unsafe_allow_html=True)

    rc1,rc2=st.columns(2)
    with rc1:
        st.markdown('<span class="sec-label">품목</span>',unsafe_allow_html=True)
        isel=st.selectbox("",ITEMS_DF["name"].tolist(),key="ri")
        st.markdown('<span class="sec-label" style="margin-top:10px">상점명</span>',unsafe_allow_html=True)
        sinp=st.text_input("",placeholder="예: 망원시장 2번 골목",key="rs")
    with rc2:
        st.markdown('<span class="sec-label">가격 (원)</span>',unsafe_allow_html=True)
        pinp=st.number_input("",min_value=100,max_value=100000,step=100,key="rp")
        st.markdown('<span class="sec-label" style="margin-top:10px">메모</span>',unsafe_allow_html=True)
        ninp=st.text_input("",placeholder="예: 오늘만 특가",key="rn")

    if st.button("📝  제보 등록하기",key="rsub",use_container_width=True):
        ss["user_reports"].append({
            "lat":ss["lat"]+np.random.uniform(-0.003,0.003),
            "lng":ss["lng"]+np.random.uniform(-0.003,0.003),
            "item":isel,"price":pinp,"store":sinp,"note":ninp,
            "date":datetime.now().strftime("%Y-%m-%d")})
        st.success(f"✅ '{isel}' 가격 제보가 등록됐습니다!",icon="🎉")
        st.rerun()

    st.markdown('<span class="sec-label" style="margin-top:16px">최근 제보</span>',unsafe_allow_html=True)
    PA={"배추":3800,"계란":7200,"두부":1500,"대파":2500,"양파":2200,"돼지앞다리":1500,"닭가슴살":1800}
    rh=""
    for rpt in reversed(ss["user_reports"][-6:]):
        avg=PA.get(rpt["item"]); diff=""
        if avg:
            d=rpt["price"]-avg; col="#4ade80" if d<0 else "#ff6b6b"; sg="▼" if d<0 else "▲"
            diff=f'<span style="color:{col};font-size:10px;margin-left:6px">{sg} {abs(d):,}원</span>'
        rh+=(f"<div class='rpt-card'>"
             f"<div>"
             f"<div class='rpt-name'>{rpt['item']}{diff}</div>"
             f"<div class='rpt-store'>{rpt.get('store','위치 미상')} · {rpt['date']}</div>"
             f"</div>"
             f"<div class='rpt-price'>{rpt['price']:,}원</div>"
             f"</div>")
    st.markdown(rh,unsafe_allow_html=True)
    st.markdown("</div></div>",unsafe_allow_html=True)
