"""
LocalCart — 시민 제보 현황판 페이지
PGIS 참여형: 등록된 가격 제보 집계 및 지도 시각화
"""

import streamlit as st
import pandas as pd
import folium
from streamlit_folium import st_folium
from datetime import datetime

st.set_page_config(page_title="제보 현황 | LocalCart", page_icon="📝", layout="wide")

st.markdown("## 📝 시민 가격 제보 현황판")
st.caption("PGIS 참여형 데이터 — 시민이 직접 확인·등록한 실거래 가격")

# ── 제보 데이터 (세션 공유) ──
if "user_reports" not in st.session_state:
    st.session_state["user_reports"] = [
        {"lat":37.5701,"lng":126.9993,"item":"배추","price":3500,"store":"광장시장","date":"2026-05-14"},
        {"lat":37.5560,"lng":126.9047,"item":"계란","price":6800,"store":"망원시장","date":"2026-05-13"},
        {"lat":37.5448,"lng":126.9475,"item":"두부","price":1100,"store":"마포농수산물시장","date":"2026-05-12"},
        {"lat":37.5787,"lng":126.9681,"item":"대파","price":2000,"store":"통인시장","date":"2026-05-11"},
        {"lat":37.5590,"lng":126.9768,"item":"양파","price":1800,"store":"남대문시장","date":"2026-05-10"},
    ]

reports = st.session_state["user_reports"]
df = pd.DataFrame(reports)

# ── 요약 지표 ──
c1, c2, c3, c4 = st.columns(4)
c1.metric("총 제보 건수", f"{len(df)}건")
c2.metric("참여 품목 수", f"{df['item'].nunique()}종")
c3.metric("참여 상점 수", f"{df['store'].nunique()}개")
c4.metric("오늘 제보", f"{sum(1 for r in reports if r['date'] == datetime.now().strftime('%Y-%m-%d'))}건")

st.divider()

map_col, list_col = st.columns([2, 1])

with map_col:
    m = folium.Map(location=[37.5665, 126.9780], zoom_start=12, tiles="CartoDB dark_matter")
    for r in reports:
        folium.CircleMarker(
            location=[r["lat"], r["lng"]], radius=8,
            color="#e8e05a", fill=True, fill_color="#e8e05a", fill_opacity=0.8,
            popup=folium.Popup(
                f"<b>{r['item']}</b> — {r['price']:,}원<br>"
                f"📍 {r.get('store','')}<br><small>{r['date']}</small>",
                max_width=200
            ),
            tooltip=f"💬 {r['item']} {r['price']:,}원",
        ).add_to(m)
    st_folium(m, width="100%", height=420, key="report_map")

with list_col:
    st.markdown("**최근 제보 목록**")
    for r in reversed(reports):
        avg_row = {"배추":3800,"계란":7200,"두부":1500,"대파":2500,"양파":2200}.get(r["item"], None)
        diff_html = ""
        if avg_row:
            diff = r["price"] - avg_row
            color = "#5ae88a" if diff < 0 else "#e85a5a"
            sign  = "▼" if diff < 0 else "▲"
            diff_html = f"<span style='color:{color};font-size:10px'>{sign} {abs(diff):,}원 vs 평균</span>"
        st.markdown(f"""
        <div style='background:#161c2a;border:1px solid #252f45;border-radius:7px;
                    padding:9px 11px;margin-bottom:5px;font-size:12px'>
          <span style='color:#b090e8;font-weight:700'>{r['item']}</span>
          <span style='float:right;color:#7ae87a;font-weight:700'>{r['price']:,}원</span><br>
          <span style='color:#5a6a80'>{r.get('store','위치 미상')}</span><br>
          {diff_html}
          <span style='color:#3a4a60;font-size:10px;float:right'>{r['date']}</span>
        </div>
        """, unsafe_allow_html=True)

st.divider()

# ── 품목별 제보 평균가 vs 공공 평균가 ──
st.markdown("### 📊 제보 가격 vs 공공 평균가 비교")
pub_avg = {"배추":3800,"계란":7200,"두부":1500,"대파":2500,"양파":2200}
report_avg = df.groupby("item")["price"].mean().reset_index()
report_avg.columns = ["품목","제보평균"]
report_avg["공공평균"] = report_avg["품목"].map(pub_avg)
report_avg = report_avg.dropna()

import plotly.graph_objects as go
fig = go.Figure()
fig.add_bar(x=report_avg["품목"], y=report_avg["제보평균"], name="시민 제보 평균", marker_color="#e8e05a")
fig.add_bar(x=report_avg["품목"], y=report_avg["공공평균"],  name="공공 평균가",    marker_color="#5ba4e8")
fig.update_layout(
    barmode="group", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(20,25,40,0.4)",
    font=dict(color="#c0c8d8"), height=280,
    margin=dict(t=10,b=10,l=10,r=10),
    xaxis=dict(gridcolor="#2a3048"), yaxis=dict(gridcolor="#2a3048", ticksuffix="원"),
    legend=dict(bgcolor="rgba(0,0,0,0)"),
)
st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})
