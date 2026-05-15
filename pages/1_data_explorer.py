"""
LocalCart — 데이터 탐색 페이지
품목별 가격 추이 · 지역별 가격 비교 차트
"""

import streamlit as st
import pandas as pd
import numpy as np
import plotly.express as px
import plotly.graph_objects as go

st.set_page_config(page_title="가격 탐색 | LocalCart", page_icon="📈", layout="wide")

st.markdown("## 📈 품목별 가격 탐색")
st.caption("공공 농축수산물 가격 데이터 기반 · 기준: 전국 소매 평균가")

# ── 더미 주간 가격 데이터 ──
np.random.seed(7)
items = ["계란", "배추", "돼지고기앞다리", "양파", "두부", "사과", "대파", "감자"]
base  = {"계란":7200,"배추":3800,"돼지고기앞다리":1500,"양파":2200,"두부":1500,"사과":6500,"대파":2500,"감자":3000}
weeks = [f"2026-W{str(i).zfill(2)}" for i in range(14, 22)]

rows = []
for item in items:
    b = base[item]
    for w in weeks:
        rows.append({
            "주차": w, "품목": item,
            "전국평균": int(b * (1 + np.random.uniform(-0.1, 0.12))),
            "전통시장": int(b * 0.88 * (1 + np.random.uniform(-0.07, 0.07))),
            "대형마트": int(b * 1.08 * (1 + np.random.uniform(-0.05, 0.08))),
        })
df = pd.DataFrame(rows)

col1, col2 = st.columns([1, 2])

with col1:
    sel_items = st.multiselect("품목 선택", items, default=["계란", "배추", "양파"])
    price_type = st.radio("가격 기준", ["전국평균", "전통시장", "대형마트"])

with col2:
    if sel_items:
        sub = df[df["품목"].isin(sel_items)]
        fig = px.line(sub, x="주차", y=price_type, color="품목",
                      markers=True,
                      color_discrete_sequence=px.colors.qualitative.Set2)
        fig.update_layout(
            paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(20,25,40,0.4)",
            font=dict(color="#c0c8d8"), height=320,
            margin=dict(t=20,b=20,l=10,r=10),
            xaxis=dict(gridcolor="#2a3048"), yaxis=dict(gridcolor="#2a3048", ticksuffix="원"),
            legend=dict(bgcolor="rgba(0,0,0,0)"),
        )
        st.plotly_chart(fig, use_container_width=True, config={"displayModeBar": False})

st.divider()

# ── 전통시장 vs 대형마트 비교 ──
st.markdown("### 🏪 전통시장 vs 대형마트 가격 비교 (최근 기준)")
latest = df[df["주차"] == weeks[-1]].copy()
latest["절감액"] = latest["대형마트"] - latest["전통시장"]
latest["절감률"] = (latest["절감액"] / latest["대형마트"] * 100).round(1)

fig2 = go.Figure()
fig2.add_bar(x=latest["품목"], y=latest["전통시장"], name="전통시장", marker_color="#5ba4e8")
fig2.add_bar(x=latest["품목"], y=latest["대형마트"], name="대형마트", marker_color="#e8605a")
fig2.update_layout(
    barmode="group", paper_bgcolor="rgba(0,0,0,0)", plot_bgcolor="rgba(20,25,40,0.4)",
    font=dict(color="#c0c8d8"), height=300,
    margin=dict(t=10,b=10,l=10,r=10),
    xaxis=dict(gridcolor="#2a3048"), yaxis=dict(gridcolor="#2a3048", ticksuffix="원"),
    legend=dict(bgcolor="rgba(0,0,0,0)"),
)
st.plotly_chart(fig2, use_container_width=True, config={"displayModeBar": False})

# 절감액 테이블
st.markdown("**전통시장 이용 시 절감 효과**")
display = latest[["품목","전통시장","대형마트","절감액","절감률"]].copy()
display.columns = ["품목","전통시장(원)","대형마트(원)","절감액(원)","절감률(%)"]
st.dataframe(display.set_index("품목"), use_container_width=True)
