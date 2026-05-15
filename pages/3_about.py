"""
LocalCart — 프로젝트 소개 페이지
서비스 개요 · 데이터 출처 · 기술 스택 · 개발팀
"""

import streamlit as st

st.set_page_config(page_title="소개 | LocalCart", page_icon="🛒", layout="wide")

st.markdown("## 🛒 LocalCart 프로젝트 소개")

col1, col2 = st.columns([3, 2])

with col1:
    st.markdown("""
    ### 왜 LocalCart인가?

    물가 상승이 장기화되면서 가계의 식료품 구매 부담이 증가하고 있습니다.  
    그러나 소비자가 실질적으로 접근할 수 있는 가격 정보는 **대형마트·온라인몰 중심**으로
    편중되어 있으며, 전통시장·골목상권·착한가격업소 등 **지역 밀착형 상점 정보는 매우 부족**합니다.

    LocalCart는 이 문제를 해결합니다.

    - 정확한 최저가 비교 대신 **공공 평균가격 기반 예산 시뮬레이션**
    - **지역상권(전통시장·착한가격업소·로컬푸드) 우선 추천**
    - 시민이 직접 참여하는 **PGIS 참여형 가격 제보**
    """)

    st.markdown("---")
    st.markdown("""
    ### 추천 로직

    **품목 선정** — 선형 계획법(LP) 기반 예산 최적화
    ```
    Maximize: Σ (선호도 가중치 × 효용 점수 × 수량)
    Subject to: Σ (단위가격 × 수량) ≤ 입력 예산
    ```

    **상점 추천 점수**
    | 지표 | 가중치 |
    |---|---|
    | 거리 접근성 (Haversine) | 40% |
    | 상점 유형 신뢰도 | 35% |
    | 지역상권 기여도 | 25% |
    """)

with col2:
    st.markdown("### 📊 데이터 출처")
    sources = [
        ("농축수산물 소매가격", "한국농수산식품유통공사 (aT KAMIS)", "일 1회"),
        ("전통시장 위치",       "공공데이터포털 data.go.kr",         "분기"),
        ("착한가격업소",        "소상공인시장진흥공단",               "월"),
        ("로컬푸드 직매장",     "농림축산식품부",                     "월"),
        ("소상공인 상가업종",   "소상공인진흥공단",                   "월"),
    ]
    for name, org, cycle in sources:
        st.markdown(f"""
        <div style='background:#161c2a;border:1px solid #252f45;border-radius:7px;
                    padding:9px 12px;margin-bottom:6px'>
          <div style='font-size:13px;font-weight:600;color:#c0d0e8'>{name}</div>
          <div style='font-size:11px;color:#5a6a80'>{org} · {cycle} 갱신</div>
        </div>
        """, unsafe_allow_html=True)

    st.markdown("### 🛠️ 기술 스택")
    techs = [
        ("Streamlit 1.45",       "웹 앱 프레임워크"),
        ("Folium 0.19",          "PGIS 지도 엔진"),
        ("streamlit-folium",     "Folium ↔ Streamlit 브리지"),
        ("GeoPandas / Shapely",  "공간 데이터 처리"),
        ("SciPy linprog",        "LP 최적화"),
        ("Plotly Express",       "인터랙티브 차트"),
    ]
    for tech, desc in techs:
        st.markdown(f"""
        <div style='display:flex;justify-content:space-between;
                    font-size:12px;padding:5px 0;border-bottom:1px solid #1a2235'>
          <span style='color:#5ba4e8;font-weight:600'>{tech}</span>
          <span style='color:#6a7a96'>{desc}</span>
        </div>
        """, unsafe_allow_html=True)

st.divider()
st.markdown("""
<div style='text-align:center;font-size:11px;color:#3a4a60;padding:8px 0'>
  LocalCart · MIT License · 2026 · 데이터: 농림축산식품부 · 소상공인진흥공단 · 공공데이터포털
</div>
""", unsafe_allow_html=True)
