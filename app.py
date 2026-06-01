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
from core.data_loader import load_stores, map_center
from core.optimizer import optimize_basket, basket_summary
from core.price_api import apply_live_prices
from core import report_db
from core import recipes as rcp

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

/* 외부 래퍼 — 여백 제거 */
[data-testid="stAppViewContainer"],
[data-testid="stAppViewBlockContainer"],
.main {
  padding: 0 !important;
  margin: 0 !important;
  max-width: 100% !important;
  background: transparent !important;
  overflow: hidden !important;
}

/* ★ 핵심 — 위젯이 실제로 그려지는 컨테이너를 패널 위치에 고정
   slide-panel(z-index:998) 위에(z-index:999) 렌더링 → 유리 배경 위에 인터랙티브 위젯
   ※ transform 사용 금지 — 자식 iframe(지도)의 containing block이 바뀌어 지도가 깨짐
      대신 left:max(14px, calc(50vw - 420px)) 으로 중앙 정렬 */
[data-testid="block-container"],
.block-container {
  position: fixed !important;
  bottom: 74px !important;
  left: max(14px, calc(50vw - 420px)) !important;
  width: min(840px, calc(100vw - 28px)) !important;
  max-height: calc(100vh - 130px) !important;
  overflow-y: auto !important;
  overflow-x: hidden !important;
  z-index: 999 !important;
  padding: 60px 20px 22px !important; /* 60px = 패널 헤더 높이 확보 */
  background: transparent !important;
  border-radius: 20px !important;
  margin: 0 !important;
}
/* block-container 내부 래퍼 투명 처리 */
[data-testid="block-container"] > div,
[data-testid="stVerticalBlock"] {
  background: transparent !important;
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

/* ── AI 에이전트 채팅 ── */
.agent-q { background:rgba(99,183,255,.10);border:1px solid rgba(99,183,255,.22);
  border-radius:14px 14px 14px 4px;padding:10px 14px;font-size:13px;color:var(--text-1);
  margin-bottom:8px;line-height:1.6;max-width:88%; }
.agent-a { background:var(--glass-light);border:1px solid var(--border);
  border-radius:14px 14px 4px 14px;padding:10px 14px;font-size:13px;color:var(--text-2);
  margin-left:auto;margin-bottom:10px;line-height:1.7;max-width:88%; }
.agent-a b{ color:var(--accent3); }

/* ── 재료 ON/OFF 칩 (가로 스크롤) ── */
.sec-hint{ font-size:11px;color:var(--text-3);margin:2px 0 8px; }

/* ── 장바구니 가격행 (최저가~최고가) ── */
.cart-row{ background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:11px 14px;display:flex;align-items:center;
  gap:11px;margin-bottom:7px; }
.cart-emoji{ font-size:22px;flex-shrink:0; }
.cart-mid{ flex:1;min-width:0; }
.cart-nm{ font-size:13px;font-weight:700;color:var(--text-1);display:flex;align-items:center;gap:6px; }
.cart-un{ font-size:11px;color:var(--text-3);margin-top:1px; }
.cart-rng{ text-align:right;flex-shrink:0;font-family:'DM Mono',monospace; }
.cart-lo{ font-size:14px;font-weight:700;color:var(--accent3); }
.cart-hi{ font-size:11px;color:var(--text-3); }
.fav-star{ color:#f5c84b;font-size:14px; }

/* ── 추천 경로 카드 ── */
.route-card{ background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius);padding:14px 16px;margin-bottom:9px;transition:all .15s; }
.route-card.sel{ border-color:var(--border-act);background:rgba(99,183,255,.07);
  box-shadow:0 0 0 1px rgba(99,183,255,.25),0 6px 18px rgba(99,183,255,.10); }
.route-head{ display:flex;align-items:center;justify-content:space-between;margin-bottom:9px; }
.route-name{ font-size:15px;font-weight:800;color:var(--text-1);display:flex;align-items:center;gap:8px; }
.route-badge{ font-size:10px;font-weight:700;padding:2px 9px;border-radius:9px;
  background:rgba(99,183,255,.14);color:var(--accent);border:1px solid rgba(99,183,255,.3); }
.route-metrics{ display:grid;grid-template-columns:repeat(3,1fr);gap:8px; }
.route-metric{ text-align:center; }
.route-mval{ font-size:16px;font-weight:700;font-family:'DM Mono',monospace;color:var(--accent2);display:block; }
.route-mlbl{ font-size:10px;color:var(--text-3);margin-top:1px;display:block; }

/* ── 상점별 체크리스트 ── */
.store-acc{ background:var(--glass-light);border:1px solid var(--border);
  border-radius:var(--radius-sm);padding:13px 15px;margin-bottom:9px; }
.store-acc-head{ display:flex;align-items:center;justify-content:space-between;margin-bottom:4px; }
.store-acc-nm{ font-size:14px;font-weight:800;color:var(--text-1);display:flex;align-items:center;gap:8px; }
.store-acc-seq{ width:22px;height:22px;border-radius:7px;background:var(--accent);
  color:#04101f;font-size:12px;font-weight:800;display:inline-flex;align-items:center;justify-content:center; }
.store-acc-sub{ font-size:11px;color:var(--text-3);margin-bottom:9px; }
.chk-row{ display:flex;align-items:center;gap:9px;padding:7px 0;border-top:1px solid var(--border); }
.chk-emoji{ font-size:17px;flex-shrink:0; }
.chk-nm{ flex:1;font-size:13px;color:var(--text-1); }
.chk-nm.done{ color:var(--text-3);text-decoration:line-through; }
.chk-price{ font-size:13px;font-weight:700;font-family:'DM Mono',monospace;color:var(--accent2); }
.tip-box{ background:rgba(74,222,128,.06);border:1px solid rgba(74,222,128,.18);
  border-radius:8px;padding:9px 12px;margin:5px 0 3px;font-size:12px;color:#7fdca0;line-height:1.7; }
.tip-box b{ color:var(--accent3); }

/* ── 자주 사는 품목 ── */
.freq-row{ display:flex;align-items:center;gap:10px;background:var(--glass-light);
  border:1px solid var(--border);border-radius:var(--radius-sm);padding:10px 13px;margin-bottom:6px; }
.freq-nm{ flex:1;font-size:13px;font-weight:700;color:var(--text-1); }
.freq-meta{ font-size:11px;color:var(--text-3);text-align:right;font-family:'DM Mono',monospace; }

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
# KAMIS 실시간 소매가 반영 (키 없으면 시드 유지)
ITEMS_DF, PRICE_STATUS = apply_live_prices(ITEMS_DF)

# 인천 점포 공공데이터 로드 (core/data_loader.py)
STORES_DF = load_stores()
INCHEON_CENTER = map_center(STORES_DF)   # 데이터 centroid → 지도 초기 중심

STORE_STYLE = {
    "전통시장":  {"icon":"🏪","fc":"blue",  "tag":"tag-market","rb":"rgba(99,183,255,.15)","rc":"#63b7ff"},
    "골목상권":  {"icon":"🏘️","fc":"green", "tag":"tag-kind",  "rb":"rgba(74,222,128,.15)","rc":"#4ade80"},
    "동네식품점":{"icon":"🥩","fc":"orange","tag":"tag-local", "rb":"rgba(245,166,35,.15)","rc":"#f5a623"},
    "대형유통":  {"icon":"🏬","fc":"purple","tag":"",          "rb":"rgba(168,130,255,.12)","rc":"#a882ff"},
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
    tm={"전통시장":1.0,"골목상권":0.85,"동네식품점":0.75,"대형유통":0.4}
    df["score_dist"] =1-df["distance_m"]/mx
    df["score_type"] =df["type"].map(tm).fillna(0.4)
    df["score_local"]=df["type"].isin(["전통시장","골목상권","동네식품점"]).astype(float)
    df["total_score"]=df["score_dist"]*.40+df["score_type"]*.35+df["score_local"]*.25
    return df.sort_values("total_score",ascending=False)

def recommend_items(budget,household,pref,use_market):
    # 선형계획법(LP) 기반 — core/optimizer.optimize_basket 위임
    return optimize_basket(ITEMS_DF,budget,household,pref,use_market)


# ══════════════════════════════════════════════════════════════
# 세션
# ══════════════════════════════════════════════════════════════
for k,v in {"lat":INCHEON_CENTER[0],"lng":INCHEON_CENTER[1],"radius_m":3000,"budget":50000,
             "household":2,"pref":"균형","use_market":True,
             "active_panel":None,
             "map_tile":"CartoDB positron","map_zoom":14,   # 우측 툴바 레이어/크게보기 제어
             "result_stores":pd.DataFrame(),"result_items":pd.DataFrame(),
             "user_reports":report_db.load_reports(),
             # ── 신규 기능 상태 ──
             "recipe_dish":None,          # AI 에이전트 매칭 요리명
             "recipe_ings":[],            # 그 요리 재료 리스트
             "picked":[],                 # 장바구니에 담은 재료(순서 유지)
             "fav_items":[],              # ⭐ 자주 사는 재료
             "fav_stores":[],             # 📌 자주 가는 가게 id
             "route_plan":{},             # recommend_routes 결과
             "route_choice":None,         # 선택한 전략(최저예산/최소거리/최소경유)
             "guiding":False,             # 안내(상점별 체크리스트) 단계 진입 여부
             "bought":[],                 # "storeid::품목" 구매 완료 체크
             "report_prefill":None,       # 제보 패널 프리필 품목
             "search_msg":None,           # 상단 검색 결과 안내 토스트
             }.items():
    if k not in st.session_state: st.session_state[k]=v
ss=st.session_state

# ── 신규 기능 헬퍼 ───────────────────────────────────────────
def _nearby_stores():
    """현위치 반경 내 점포 (추천 실행 결과 우선, 없으면 즉석 필터)."""
    if not ss["result_stores"].empty:
        return ss["result_stores"]
    return filter_stores(STORES_DF,ss["lat"],ss["lng"],ss["radius_m"])

def toggle_pick(name):
    if name in ss["picked"]: ss["picked"].remove(name)
    else: ss["picked"].append(name)

def toggle_fav_item(name):
    if name in ss["fav_items"]: ss["fav_items"].remove(name)
    else: ss["fav_items"].append(name)

def toggle_fav_store(sid):
    if sid in ss["fav_stores"]: ss["fav_stores"].remove(sid)
    else: ss["fav_stores"].append(sid)

def rebuild_routes():
    """현재 담긴 재료로 3전략 경로 재계산."""
    nb=_nearby_stores()
    ss["route_plan"]=rcp.recommend_routes(ss["picked"],ITEMS_DF,nb,(ss["lat"],ss["lng"]))

# ── 상단 검색바 동작 (img1 동네/시장/품목 검색) ────────────────
def run_search(q):
    """검색어 1개로 ①요리 ②품목 ③상점/구 순서로 매칭해 적절한 패널로 분기."""
    q=(q or "").strip()
    if not q:
        ss["search_msg"]=None; return
    qn=q.replace(" ","")

    # ① 요리명 → AI 에이전트 재료 → 장바구니
    d,ings=rcp.ask_agent(q)
    if d:
        ss["recipe_dish"]=d; ss["recipe_ings"]=ings
        ss["active_panel"]="cart"; ss["search_msg"]=None; return

    # ② 품목명 → 장바구니에 담기
    names=list(ITEMS_DF["name"])+list(rcp.EXTRA_ITEMS.keys())
    ih=[n for n in names if qn in n.replace(" ","") or n.replace(" ","") in qn]
    if ih:
        if ih[0] not in ss["picked"]: ss["picked"].append(ih[0])
        ss["active_panel"]="cart"; ss["search_msg"]=f"‘{ih[0]}’ 장바구니에 담았어요"; return

    # ③ 상점명/구 → 지도 필터 + 해당 위치로 이동
    sf=STORES_DF[
        STORES_DF["name"].str.replace(" ","",regex=False).str.contains(qn,na=False)
        | STORES_DF["gu"].str.contains(q,na=False)
    ]
    if not sf.empty:
        ss["lat"]=float(sf["lat"].mean()); ss["lng"]=float(sf["lng"].mean())
        ss["result_stores"]=score_stores(filter_stores(sf,ss["lat"],ss["lng"],10**9))
        ss["active_panel"]=None; ss["search_msg"]=f"‘{q}’ 관련 {len(sf)}곳을 지도에 표시했어요"; return

    ss["search_msg"]=f"‘{q}’ 검색 결과가 없어요. 요리·품목·상점명으로 검색해보세요."

def _do_search():
    run_search(ss.get("topsearch",""))


# ══════════════════════════════════════════════════════════════
# 지도 (뷰포트 전체)
# ══════════════════════════════════════════════════════════════
def build_map():
    m=folium.Map(location=[ss["lat"],ss["lng"]],zoom_start=ss["map_zoom"],
                 tiles=ss["map_tile"],prefer_canvas=True)
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

    # ── 자주 가는 가게 📌 (img2/img3) ──
    for sid in ss["fav_stores"]:
        fr=STORES_DF[STORES_DF["id"]==sid]
        if fr.empty: continue
        fr=fr.iloc[0]
        folium.Marker([fr["lat"],fr["lng"]],
                      popup=folium.Popup(f"<b>📌 자주 가는 가게</b><br>{fr['name']}",max_width=170),
                      tooltip=f"📌 {fr['name']}",
                      icon=folium.Icon(color="red",icon="star",prefix="fa")).add_to(m)

    # ── 선택된 추천 경로 폴리라인 (img5) ──
    plan=ss["route_plan"].get(ss["route_choice"]) if ss["route_choice"] else None
    if plan and plan["stops"]:
        pts=[[ss["lat"],ss["lng"]]]+[[s.lat,s.lng] for s in plan["stops"]]
        folium.PolyLine(pts,color="#ff5470",weight=5,opacity=0.85).add_to(m)
        for seq,s in enumerate(plan["stops"],1):
            folium.Marker([s.lat,s.lng],
                          tooltip=f"{seq}. {s.name}",
                          icon=folium.DivIcon(html=(
                              f"<div style='background:#ff5470;color:#fff;width:26px;height:26px;"
                              f"border-radius:50%;display:flex;align-items:center;justify-content:center;"
                              f"font-weight:800;font-size:13px;border:2px solid #fff;"
                              f"box-shadow:0 2px 6px rgba(0,0,0,.4)'>{seq}</div>"))).add_to(m)

    for rpt in ss["user_reports"]:
        folium.CircleMarker([rpt["lat"],rpt["lng"]],radius=7,
                            color="#f5a623",fill=True,fill_color="#f5a623",fill_opacity=0.78,
                            popup=folium.Popup(
                                f"<b>📝 {rpt['item']}</b>: {rpt['price']:,}원<br>"
                                f"<small>{rpt.get('store','')} · {rpt['date']}</small>",max_width=180),
                            tooltip=f"💬 {rpt['item']} {rpt['price']:,}원").add_to(m)
    folium.LayerControl(position="topright").add_to(m)
    return m

# ▼ 지도는 스크립트 맨 마지막에 렌더링 (DOM 순서 최후 → 위젯들 뒤에 그려져서 위젯 가리지 않음)
# map_out = st_folium(...) → 파일 끝 참조


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
  <div class="tool-btn" title="현위치 (지도 좌하단 ◎)">◎</div>
  <div class="tool-btn" title="레이어">🗂</div>
  <div class="tool-btn" title="자주 가는 가게 / 즐겨찾기 → ⭐ 탭">📌</div>
  <div class="tool-btn" title="지도 크게 보기 (좌상단 ⛶)">⛶</div>
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
  <div style="padding:7px 14px;border-radius:30px;font-size:13px;font-weight:600;color:{'#63b7ff' if ac('favorites') else '#8a9bb8'}">
    ⭐ 즐겨찾기
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

bc=st.columns(5)
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
with bc[4]:
    if st.button("⭐ 즐겨찾기", key="bn_fav"):
        ss["active_panel"]=None if ss["active_panel"]=="favorites" else "favorites"; st.rerun()


# ══════════════════════════════════════════════════════════════
# 슬라이드업 패널
# ══════════════════════════════════════════════════════════════

# ── 조건 설정 ────────────────────────────────────────────────
if ss["active_panel"]=="search":
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">⚙️ 장보기 조건 설정</div></div>'
                '<div class="panel-body">', unsafe_allow_html=True)

    # ── 검색 (요리·품목·상점 검색) ─────────────────────────────
    st.markdown('<span class="sec-label">🔍 검색</span>', unsafe_allow_html=True)
    st.text_input("검색", key="topsearch", label_visibility="collapsed",
                  placeholder="요리·품목·상점 검색  (예: 찜닭, 양파, 망원시장)",
                  on_change=_do_search)
    if ss.get("search_msg"):
        st.markdown(f'<div class="sec-hint" style="color:var(--accent);margin-bottom:6px">{ss["search_msg"]}</div>',
                    unsafe_allow_html=True)
        ss["search_msg"]=None
    st.markdown('<div style="height:10px"></div>', unsafe_allow_html=True)

    c1,c2=st.columns(2)
    with c1:
        st.markdown('<span class="sec-label">탐색 반경</span>',unsafe_allow_html=True)
        rc=st.columns(5)
        for i,(lbl,val) in enumerate({"500m":500,"1km":1000,"2km":2000,"3km":3000,"5km":5000}.items()):
            with rc[i]:
                if st.button(lbl,key=f"r{val}"): ss["radius_m"]=val; st.rerun()
        st.markdown('<span class="sec-label" style="margin-top:14px">예산</span>',unsafe_allow_html=True)
        ss["budget"]=st.slider("예산",10000,200000,ss["budget"],5000,format="%d원",key="bslider",label_visibility="collapsed")
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
    if st.button("🔍  이 조건으로 장보기 시작",key="run",use_container_width=True):
        with st.spinner("주변 점포 분석 중..."):
            f=filter_stores(STORES_DF,ss["lat"],ss["lng"],ss["radius_m"])
            ss["result_stores"]=score_stores(f)
            ss["result_items"]=recommend_items(ss["budget"],ss["household"],ss["pref"],ss["use_market"])
            ss["route_plan"]={}; ss["route_choice"]=None; ss["guiding"]=False
            ss["active_panel"]="cart"
        st.rerun()
    st.markdown('</div>',unsafe_allow_html=True)

    st.markdown("</div></div>",unsafe_allow_html=True)


# ── 장바구니 (AI 에이전트 + 재료 담기 + 최저가~최고가) ──────────
elif ss["active_panel"]=="cart":
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">🛍️ 장바구니 · AI 에이전트</div></div>'
                '<div class="panel-body">',unsafe_allow_html=True)

    nb=_nearby_stores()   # 가격범위 산출용 후보 점포

    # ① 자주 사는 품목 (img3 — 자주 사는 품목 내역 페이지) ─────────
    if ss["fav_items"]:
        st.markdown('<span class="sec-label">⭐ 자주 사는 품목</span>',unsafe_allow_html=True)
        fr=""
        for nm in ss["fav_items"]:
            m=rcp.item_meta(nm,ITEMS_DF)
            if not m: continue
            lo,hi=rcp.price_range(m,nb)
            cs,cp=rcp.cheapest_store(m,nb)
            cs_nm=cs["name"] if cs is not None else "주변 점포 없음"
            cp_txt=f"최저 {cp:,}원" if cp is not None else f"평균 {m['avg']:,}원"
            fr+=(f"<div class='freq-row'><span style='font-size:18px'>{m['emoji']}</span>"
                 f"<span class='freq-nm'>{nm}</span>"
                 f"<span class='freq-meta'>{cp_txt}<br><span style='color:var(--accent3)'>{cs_nm}</span></span></div>")
        st.markdown(fr,unsafe_allow_html=True)
        st.markdown('<div style="height:10px"></div>',unsafe_allow_html=True)

    # ② AI 에이전트 — 요리 검색 → 재료 (img4) ────────────────────
    st.markdown('<span class="sec-label">🤖 만들 요리를 검색하세요</span>',unsafe_allow_html=True)
    ac1,ac2=st.columns([4,1])
    with ac1:
        dish_q=st.text_input("요리 검색",value="",placeholder="예: 찜닭, 김치찌개, 잡채...",key="dishq",label_visibility="collapsed")
    with ac2:
        find=st.button("재료 찾기",key="finding")
    if find and dish_q.strip():
        d,ings=rcp.ask_agent(dish_q)
        ss["recipe_dish"]=d; ss["recipe_ings"]=ings
        if not d:
            ss["recipe_dish"]="__none__"
        st.rerun()

    if ss["recipe_dish"]=="__none__":
        st.markdown('<div class="agent-a">음… 아직 그 요리 레시피는 없어요. 다른 요리로 검색하거나 '
                    '아래에서 직접 재료를 담아보세요 🙂</div>',unsafe_allow_html=True)
    elif ss["recipe_dish"]:
        d=ss["recipe_dish"]; ings=ss["recipe_ings"]
        st.markdown(f'<div class="agent-q">{d} 만들 거야. 뭐 필요해?</div>',unsafe_allow_html=True)
        ing_lines="<br>".join(f"{i}. {x}" for i,x in enumerate(ings,1))
        st.markdown(f'<div class="agent-a"><b>{d}</b>엔 다음 재료가 들어가요<br>{ing_lines}<br>'
                    f'<span style="color:var(--text-3)">담을 재료를 눌러 ON/OFF 하세요</span></div>',
                    unsafe_allow_html=True)
        # 재료 ON/OFF 칩 (가로 정렬, 누르면 담기/빼기)
        st.markdown('<div class="sec-hint">↓ 재료 버튼 — 누르면 장바구니 담기/빼기 (가로 스크롤)</div>',
                    unsafe_allow_html=True)
        cols=st.columns(4)
        for i,ing in enumerate(ings):
            with cols[i%4]:
                on=ing in ss["picked"]
                if st.button(("✓ "if on else "+ ")+ing,key=f"chip_{ing}"):
                    toggle_pick(ing); st.rerun()
        st.markdown('<div style="height:8px"></div>',unsafe_allow_html=True)

    # ③ 추가구매 입력 (autocomplete) ─────────────────────────────
    st.markdown('<span class="sec-label" style="margin-top:6px">➕ 추가로 담을 품목</span>',unsafe_allow_html=True)
    all_names=list(ITEMS_DF["name"])+list(rcp.EXTRA_ITEMS.keys())
    addable=[n for n in all_names if n not in ss["picked"]]
    mc1,mc2=st.columns([4,1])
    with mc1:
        man=st.selectbox("추가 품목",["선택…"]+addable,key="manadd",
                         label_visibility="collapsed",index=0)
    with mc2:
        add_clicked=st.button("담기",key="manaddbtn")
    if add_clicked and man!="선택…":
        toggle_pick(man); st.rerun()

    # ④ 장바구니 목록 (최저가~최고가 + ⭐) ────────────────────────
    st.markdown('<span class="sec-label" style="margin-top:14px">🧺 담은 재료</span>',unsafe_allow_html=True)
    if not ss["picked"]:
        st.markdown('<div class="sec-hint">아직 담은 재료가 없어요. 위에서 요리를 검색하거나 직접 담아보세요.</div>',
                    unsafe_allow_html=True)
    else:
        tot_lo=tot_hi=0
        for nm in ss["picked"]:
            m=rcp.item_meta(nm,ITEMS_DF)
            if not m: continue
            lo,hi=rcp.price_range(m,nb); tot_lo+=lo; tot_hi+=hi
            fav=nm in ss["fav_items"]
            rc1,rc2,rc3=st.columns([6,1,1])
            with rc1:
                st.markdown(
                    f"<div class='cart-row'><span class='cart-emoji'>{m['emoji']}</span>"
                    f"<div class='cart-mid'><div class='cart-nm'>"
                    f"{'<span class=\"fav-star\">★</span>' if fav else ''}{nm}</div>"
                    f"<div class='cart-un'>{m['unit']} · {m['category']}</div></div>"
                    f"<div class='cart-rng'><span class='cart-lo'>{lo:,}원</span> "
                    f"<span class='cart-hi'>~ {hi:,}원</span></div></div>",
                    unsafe_allow_html=True)
            with rc2:
                if st.button("★" if fav else "☆",key=f"fav_{nm}"):
                    toggle_fav_item(nm); st.rerun()
            with rc3:
                if st.button("✕",key=f"rm_{nm}"):
                    toggle_pick(nm); st.rerun()

        st.markdown(f"""
        <div class="gauge-wrap" style="margin-top:12px">
          <div class="gauge-nums">
            <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.6px">예상 합계 (최저가 기준)</div>
              <span class="gauge-total">{tot_lo:,}원</span></div>
            <div style="text-align:right"><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.6px">최고가 기준</div>
              <span class="gauge-of">{tot_hi:,}원</span></div>
          </div>
        </div>""",unsafe_allow_html=True)

        st.markdown('<div class="stButton run-btn">',unsafe_allow_html=True)
        if st.button("🧭  추천 경로 보기",key="goroute",use_container_width=True):
            rebuild_routes(); ss["route_choice"]=None; ss["guiding"]=False
            ss["active_panel"]="stores"; st.rerun()
        st.markdown('</div>',unsafe_allow_html=True)

    st.markdown("</div></div>",unsafe_allow_html=True)


# ── 추천 경로 + 상점별 체크리스트 (img5 → img1/6) ──────────────
elif ss["active_panel"]=="stores":
    plan_all=ss["route_plan"]
    ss.setdefault("tip_open",[])
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">🧭 추천 경로 · 장보기</div></div>'
                '<div class="panel-body">',unsafe_allow_html=True)

    if not ss["picked"]:
        st.markdown('<div style="text-align:center;padding:44px 0;color:var(--text-3)">'
                    '<div style="font-size:40px;margin-bottom:12px">🧭</div>'
                    '<div style="font-size:14px;font-weight:600">장바구니에서 재료를 먼저 담아주세요</div></div>',
                    unsafe_allow_html=True)
        if st.button("🛍️ 장바구니로 이동",key="toCart"):
            ss["active_panel"]="cart"; st.rerun()

    elif not plan_all:
        st.markdown('<div class="sec-hint">반경 내 점포로 경로를 만들 수 없어요. 조건설정에서 반경을 넓혀보세요.</div>',
                    unsafe_allow_html=True)
        if st.button("🔄 경로 다시 계산",key="recalc"):
            rebuild_routes(); st.rerun()

    # ── STAGE 1: 추천 경로 선택 ──────────────────────────────
    elif not ss["guiding"]:
        st.markdown('<span class="sec-label">매개변수 — 무엇을 우선할까요?</span>',unsafe_allow_html=True)
        STRAT={"최저예산":("💰","장바구니 총액 최소"),
               "최소거리":("📍","현위치 기준 최단경로"),
               "최소경유":("🏃","들르는 가게 수 최소")}
        for key,(emoji,desc) in STRAT.items():
            p=plan_all.get(key)
            if not p: continue
            sel="sel" if ss["route_choice"]==key else ""
            badge='<span class="route-badge">선택됨</span>' if ss["route_choice"]==key else ""
            st.markdown(f"""
            <div class="route-card {sel}">
              <div class="route-head">
                <div class="route-name">{emoji} {key} {badge}</div>
              </div>
              <div class="sec-hint" style="margin:-4px 0 9px">{desc}</div>
              <div class="route-metrics">
                <div class="route-metric"><span class="route-mval">{p['budget']:,}원</span><span class="route-mlbl">예상 예산</span></div>
                <div class="route-metric"><span class="route-mval">{p['minutes']}분</span><span class="route-mlbl">소요 시간</span></div>
                <div class="route-metric"><span class="route-mval">{p['n_stops']}곳</span><span class="route-mlbl">경유 상점</span></div>
              </div>
            </div>""",unsafe_allow_html=True)
            if st.button("✓ 이 경로 선택됨" if ss["route_choice"]==key else "이 경로 선택",key=f"rt_{key}"):
                ss["route_choice"]=key; st.rerun()

        if ss["route_choice"]:
            st.markdown('<div class="sec-hint" style="margin-top:8px">선택한 경로가 오른쪽 지도에 표시됩니다. 시작하려면 ↓</div>',
                        unsafe_allow_html=True)
            st.markdown('<div class="stButton run-btn">',unsafe_allow_html=True)
            if st.button("🚶  안내하기",key="startGuide",use_container_width=True):
                ss["guiding"]=True; ss["bought"]=[]; st.rerun()
            st.markdown('</div>',unsafe_allow_html=True)

    # ── STAGE 2: 상점별 체크리스트 ────────────────────────────
    else:
        plan=plan_all.get(ss["route_choice"])
        if st.button("← 경로 다시 선택",key="backRoute"):
            ss["guiding"]=False; st.rerun()

        grand=0; bought_cnt=0; total_cnt=0
        for seq,s in enumerate(plan["stops"],1):
            info=plan["by_store"][s.id]
            items=info["items"]
            stype=getattr(s,"type","동네식품점")
            sty=STORE_STYLE.get(stype,{"icon":"🏬"})
            store_total=sum(pr for _,pr,_,_ in items); grand+=store_total
            star='📌 ' if s.id in ss["fav_stores"] else ''
            st.markdown(f"""
            <div class="store-acc">
              <div class="store-acc-head">
                <div class="store-acc-nm"><span class="store-acc-seq">{seq}</span>{star}{sty['icon']} {s.name}</div>
                <div class="chk-price">{store_total:,}원</div>
              </div>
              <div class="store-acc-sub">{getattr(s,'gu','')} · {stype} · 사야할 항목 {len(items)}개</div>
            """,unsafe_allow_html=True)

            for nm,price,emoji,unit in items:
                total_cnt+=1
                bk=f"{s.id}::{nm}"; done=bk in ss["bought"]
                if done: bought_cnt+=1
                cc1,cc2,cc3=st.columns([6,1,1])
                with cc1:
                    st.markdown(
                        f"<div class='chk-row'><span class='chk-emoji'>{emoji}</span>"
                        f"<span class='chk-nm {'done' if done else ''}'>{nm} "
                        f"<span style='color:var(--text-3);font-size:11px'>{unit}</span></span>"
                        f"<span class='chk-price'>{price:,}원</span></div>",unsafe_allow_html=True)
                with cc2:
                    if st.button("✓" if done else "○",key=f"buy_{bk}"):
                        (ss["bought"].remove(bk) if done else ss["bought"].append(bk)); st.rerun()
                with cc3:
                    if st.button("?",key=f"tip_{bk}"):
                        (ss["tip_open"].remove(bk) if bk in ss["tip_open"] else ss["tip_open"].append(bk)); st.rerun()
                if bk in ss["tip_open"]:
                    tips="".join(f"• {t}<br>" for t in rcp.buying_tip(nm))
                    st.markdown(f"<div class='tip-box'><b>💡 좋은 {nm} 고르는 법</b><br>{tips}</div>",
                                unsafe_allow_html=True)
            # 자주 가는 가게 등록 토글
            fav_s=s.id in ss["fav_stores"]
            if st.button("📌 자주 가는 가게 해제" if fav_s else "📌 자주 가는 가게로 등록",key=f"favs_{s.id}"):
                toggle_fav_store(s.id); st.rerun()
            st.markdown("</div>",unsafe_allow_html=True)

        # 진행 게이지 + 예상 총액
        pct=(bought_cnt/total_cnt*100) if total_cnt else 0
        st.markdown(f"""
        <div class="gauge-wrap" style="margin-top:6px">
          <div class="gauge-nums">
            <div><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.6px">담은 항목</div>
              <span class="gauge-total">{bought_cnt}/{total_cnt}</span></div>
            <div style="text-align:right"><div style="font-size:10px;color:var(--text-3);font-weight:600;text-transform:uppercase;letter-spacing:.6px">예상 총액</div>
              <span class="gauge-of">{grand:,}원</span></div>
          </div>
          <div class="gauge-track"><div class="gauge-fill" style="width:{pct:.0f}%;background:#4ade80"></div></div>
        </div>""",unsafe_allow_html=True)

        bb1,bb2=st.columns(2)
        with bb1:
            if st.button("📝 가격 제보하기",key="goReport"):
                ss["report_prefill"]=plan["stops"][0].name if plan["stops"] else None
                ss["active_panel"]="report"; st.rerun()
        with bb2:
            st.markdown('<div class="stButton run-btn">',unsafe_allow_html=True)
            if st.button("✅ 장보기 완료",key="doneShop",use_container_width=True):
                ss["guiding"]=False; ss["bought"]=[]; ss["route_choice"]=None
                st.success("🎉 장보기 완료! 오늘도 알뜰하게 잘 사셨어요.")
                st.rerun()
            st.markdown('</div>',unsafe_allow_html=True)

    st.markdown("</div></div>",unsafe_allow_html=True)


# ── 자주 가는 가게 · 자주 사는 품목 (img6) ───────────────────
elif ss["active_panel"]=="favorites":
    st.markdown('<div class="slide-panel"><div class="panel-drag"></div>'
                '<div class="panel-header"><div class="panel-title">⭐ 자주 가는 가게 · 자주 사는 품목</div></div>'
                '<div class="panel-body">',unsafe_allow_html=True)

    nb=_nearby_stores()

    # ① 자주 가는 가게 — 클릭 시 그 가게 품목 리스트업(자주 사는 품목 먼저) ───
    st.markdown('<span class="sec-label">📌 자주 가는 가게</span>',unsafe_allow_html=True)

    # 주변 점포에서 자주 가는 가게 추가
    cand=nb if not nb.empty else STORES_DF
    addable=[r for _,r in cand.head(40).iterrows() if r["id"] not in ss["fav_stores"]]
    if addable:
        opt_map={f'{STORE_STYLE.get(r["type"],{}).get("icon","🏬")} {r["name"]} · {r["gu"]}':r["id"] for r in addable}
        pick_lbl=st.selectbox("가게 추가",["선택…"]+list(opt_map.keys()),
                              key="favstore_add",label_visibility="collapsed",index=0)
        if st.button("📌 자주 가는 가게로 등록",key="favstore_addbtn",use_container_width=True):
            if pick_lbl!="선택…":
                toggle_fav_store(opt_map[pick_lbl]); st.rerun()

    if not ss["fav_stores"]:
        st.markdown('<div class="sec-hint">아직 자주 가는 가게가 없어요. 위에서 추가하거나, 장보기 안내 화면에서 📌로 등록할 수 있어요.</div>',
                    unsafe_allow_html=True)
    else:
        other_names=list(ITEMS_DF["name"])
        for sid in ss["fav_stores"]:
            fr=STORES_DF[STORES_DF["id"]==sid]
            if fr.empty: continue
            r=fr.iloc[0]
            sty=STORE_STYLE.get(r["type"],{"icon":"🏬"})
            with st.expander(f'{sty["icon"]} {r["name"]} · {r["gu"]}'):
                # 자주 사는 품목 먼저, 그 다음 일반 품목 채우기 (최대 6개)
                ordered=[n for n in ss["fav_items"]]+[n for n in other_names if n not in ss["fav_items"]]
                shown=0; rows=""
                for nm in ordered:
                    if shown>=6: break
                    m=rcp.item_meta(nm,ITEMS_DF)
                    if not m: continue
                    p=rcp.store_item_price(r["id"],r["type"],m)
                    star='<span class="fav-star">★</span> ' if nm in ss["fav_items"] else ''
                    rows+=(f"<div class='freq-row'><span style='font-size:18px'>{m['emoji']}</span>"
                           f"<span class='freq-nm'>{star}{nm}</span>"
                           f"<span class='freq-meta'>{p:,}원<br><span style='color:var(--text-3)'>{m['unit']}</span></span></div>")
                    shown+=1
                st.markdown(rows or '<div class="sec-hint">표시할 품목이 없어요.</div>',unsafe_allow_html=True)
                if st.button("📌 자주 가는 가게 해제",key=f"unfav_{sid}"):
                    toggle_fav_store(sid); st.rerun()

    st.markdown('<div style="height:14px"></div>',unsafe_allow_html=True)

    # ② 자주 사는 품목 — 순서대로 최저가 상점 연결 + 최단경로 ───────────────
    st.markdown('<span class="sec-label">⭐ 자주 사는 품목 — 최저가 상점 연결</span>',unsafe_allow_html=True)
    if not ss["fav_items"]:
        st.markdown('<div class="sec-hint">장바구니에서 품목 옆 ☆ 를 눌러 자주 사는 품목으로 등록하세요.</div>',
                    unsafe_allow_html=True)
    else:
        fr=""
        for nm in ss["fav_items"]:
            m=rcp.item_meta(nm,ITEMS_DF)
            if not m: continue
            cs,cp=rcp.cheapest_store(m,nb)
            cs_nm=cs["name"] if cs is not None else "주변 점포 없음"
            cp_txt=f"최저 {cp:,}원" if cp is not None else f"평균 {m['avg']:,}원"
            fr+=(f"<div class='freq-row'><span style='font-size:18px'>{m['emoji']}</span>"
                 f"<span class='freq-nm'><span class='fav-star'>★</span> {nm}</span>"
                 f"<span class='freq-meta'>{cp_txt}<br><span style='color:var(--accent3)'>{cs_nm}</span></span></div>")
        st.markdown(fr,unsafe_allow_html=True)

        st.markdown('<div class="sec-hint" style="margin-top:8px">자주 사는 품목 전체를 최단경로로 한 번에 사러 갈 수 있어요.</div>',
                    unsafe_allow_html=True)
        st.markdown('<div class="stButton run-btn">',unsafe_allow_html=True)
        if st.button("🧭  자주 사는 품목으로 경로 만들기",key="favroute",use_container_width=True):
            ss["picked"]=list(ss["fav_items"])
            rebuild_routes(); ss["route_choice"]=None; ss["guiding"]=False
            ss["active_panel"]="stores"; st.rerun()
        st.markdown('</div>',unsafe_allow_html=True)

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
        isel=st.selectbox("품목",ITEMS_DF["name"].tolist(),key="ri",label_visibility="collapsed")
        st.markdown('<span class="sec-label" style="margin-top:10px">상점명</span>',unsafe_allow_html=True)
        sinp=st.text_input("상점명",value=ss.get("report_prefill") or "",placeholder="예: 망원시장 2번 골목",key="rs",label_visibility="collapsed")
    with rc2:
        st.markdown('<span class="sec-label">가격 (원)</span>',unsafe_allow_html=True)
        pinp=st.number_input("가격",min_value=100,max_value=100000,step=100,key="rp",label_visibility="collapsed")
        st.markdown('<span class="sec-label" style="margin-top:10px">메모</span>',unsafe_allow_html=True)
        ninp=st.text_input("메모",placeholder="예: 오늘만 특가",key="rn",label_visibility="collapsed")

    if st.button("📝  제보 등록하기",key="rsub",use_container_width=True):
        report_db.add_report(
            item=isel, price=pinp, store=sinp,
            lat=ss["lat"]+np.random.uniform(-0.003,0.003),
            lng=ss["lng"]+np.random.uniform(-0.003,0.003))
        ss["user_reports"]=report_db.load_reports()   # DB에서 재로드 (영속)
        st.success(f"✅ '{isel}' 가격 제보가 등록됐습니다!",icon="🎉")
        st.rerun()

    st.markdown('<span class="sec-label" style="margin-top:16px">최근 제보</span>',unsafe_allow_html=True)
    PA=dict(zip(ITEMS_DF["name"],ITEMS_DF["avg_price"]))
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


# ══════════════════════════════════════════════════════════════
# 지도 렌더링 — DOM 마지막 위치
# 위젯(block-container z-index:999) 뒤에 그려지고,
# 유리패널(z-index:998)·네비(z-index:1001)는 지도 위에 유지됨
# ══════════════════════════════════════════════════════════════
map_out=st_folium(build_map(),width="100%",height=900,
                  returned_objects=["last_clicked","all_drawings"],key="main_map")

if map_out and map_out.get("last_clicked"):
    c=map_out["last_clicked"]
    ss["lat"]=c["lat"]; ss["lng"]=c["lng"]
