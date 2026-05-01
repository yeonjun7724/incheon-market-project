import streamlit as st
import pandas as pd
import json
import os
from anthropic import Anthropic

# ── 페이지 설정 ──────────────────────────────────────────────
st.set_page_config(
    page_title="절약 장보기 추천",
    page_icon="🛒",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ── 커스텀 CSS ───────────────────────────────────────────────
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;700&display=swap');

    html, body, [class*="css"] {
        font-family: 'Noto Sans KR', sans-serif;
    }
    .stApp { background-color: #f8f9fb; }

    [data-testid="stSidebar"] {
        background-color: #ffffff;
        border-right: 1px solid #e5e7eb;
    }

    .page-header {
        padding: 16px 0 14px 0;
        border-bottom: 2px solid #10b981;
        margin-bottom: 20px;
    }
    .page-title { font-size: 24px; font-weight: 700; color: #111827; }
    .page-subtitle { font-size: 14px; color: #6b7280; margin-top: 4px; }

    .store-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 14px 16px;
        margin-bottom: 10px;
        transition: border-color 0.2s;
    }
    .store-card:hover { border-color: #10b981; }
    .store-name { font-size: 15px; font-weight: 700; color: #111827; }
    .store-meta { font-size: 12px; color: #6b7280; margin-top: 3px; }
    .store-items { font-size: 13px; color: #374151; margin-top: 6px; }

    .badge {
        display: inline-block;
        padding: 3px 10px;
        border-radius: 20px;
        font-size: 11px;
        font-weight: 600;
    }
    .badge-green   { background: #d1fae5; color: #065f46; }
    .badge-blue    { background: #dbeafe; color: #1e40af; }
    .badge-orange  { background: #ffedd5; color: #9a3412; }
    .badge-purple  { background: #ede9fe; color: #5b21b6; }
    .badge-yellow  { background: #fef9c3; color: #854d0e; }

    .item-tag {
        display: inline-block;
        background: #f3f4f6;
        color: #374151;
        border-radius: 8px;
        padding: 4px 10px;
        font-size: 13px;
        margin: 3px;
    }

    .result-card {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 16px 18px;
        margin-bottom: 12px;
    }
    .result-store { font-size: 16px; font-weight: 700; color: #059669; }
    .result-reason { font-size: 13px; color: #6b7280; margin-top: 2px; }
    .result-items { font-size: 13px; color: #111827; margin-top: 8px; }

    .tip-box {
        background: #fffbeb;
        border-left: 4px solid #f59e0b;
        border-radius: 0 8px 8px 0;
        padding: 10px 14px;
        margin-bottom: 8px;
        font-size: 13px;
        color: #374151;
    }

    .plan-row {
        display: flex;
        justify-content: space-between;
        padding: 8px 0;
        border-bottom: 1px solid #f3f4f6;
        font-size: 14px;
    }

    .stButton > button {
        background-color: #10b981;
        color: white;
        border: none;
        border-radius: 10px;
        font-family: 'Noto Sans KR', sans-serif;
        font-weight: 600;
        width: 100%;
    }
    .stButton > button:hover { background-color: #059669; }

    div[data-testid="stMetric"] {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px;
        padding: 12px 16px;
    }
    div[data-testid="stMetric"] label { color: #6b7280 !important; }
    div[data-testid="stMetric"] [data-testid="stMetricValue"] { color: #111827 !important; }

    .chat-msg-user {
        background: #f0fdf4;
        border: 1px solid #bbf7d0;
        border-radius: 12px 12px 2px 12px;
        padding: 10px 14px;
        font-size: 14px;
        color: #111827;
        margin-bottom: 8px;
        max-width: 85%;
        margin-left: auto;
    }
    .chat-msg-ai {
        background: #ffffff;
        border: 1px solid #e5e7eb;
        border-radius: 12px 12px 12px 2px;
        padding: 10px 14px;
        font-size: 14px;
        color: #111827;
        margin-bottom: 8px;
        max-width: 85%;
    }
</style>
""", unsafe_allow_html=True)

# ── 지역 가게 데이터 ─────────────────────────────────────────
@st.cache_data
def load_stores():
    return pd.DataFrame([
        {
            "id": 1, "이름": "정자동 전통시장", "유형": "전통시장",
            "거리": "0.3km", "평점": 4.7, "태그": "최저가",
            "badge": "badge-green",
            "주요품목": "채소, 육류, 생선, 과일, 두부",
            "특징": "오전 일찍 갈수록 싱싱하고 저렴 · 현금 할인 가능",
            "영업시간": "06:00~18:00 (일요일 휴무)",
            "lat": 37.3595, "lon": 127.1085,
        },
        {
            "id": 2, "이름": "수내 한살림", "유형": "생협·친환경",
            "거리": "0.5km", "평점": 4.5, "태그": "친환경",
            "badge": "badge-blue",
            "주요품목": "유기농 채소, 두부, 달걀, 잡곡, 발효식품",
            "특징": "조합원 가입 시 5% 할인 · 무농약 인증 제품",
            "영업시간": "09:00~20:00 (월요일 휴무)",
            "lat": 37.3810, "lon": 127.1225,
        },
        {
            "id": 3, "이름": "야탑 농협하나로마트", "유형": "협동조합마트",
            "거리": "1.2km", "평점": 4.3, "태그": "산지직송",
            "badge": "badge-orange",
            "주요품목": "쌀, 감자, 양파, 계란, 고구마, 잡곡",
            "특징": "산지 직접 조달 · 대용량 구매 시 더 저렴",
            "영업시간": "09:00~21:00 (연중무휴)",
            "lat": 37.4120, "lon": 127.1268,
        },
        {
            "id": 4, "이름": "분당 로컬푸드직매장", "유형": "로컬푸드",
            "거리": "0.8km", "평점": 4.6, "태그": "지역농산",
            "badge": "badge-purple",
            "주요품목": "제철 채소·과일, 두부, 된장, 쌀",
            "특징": "경기 남부 농가 직거래 · 당일 수확 상품 판매",
            "영업시간": "10:00~19:00 (월·화 휴무)",
            "lat": 37.3785, "lon": 127.1140,
        },
        {
            "id": 5, "이름": "성남 새벽 공판장", "유형": "도매시장",
            "거리": "2.1km", "평점": 4.2, "태그": "도매가",
            "badge": "badge-yellow",
            "주요품목": "채소류, 과일류, 수산물 (박스 단위)",
            "특징": "새벽 4~8시 운영 · 소매 구매도 가능하지만 대용량",
            "영업시간": "04:00~08:00 (연중무휴)",
            "lat": 37.4350, "lon": 127.1380,
        },
    ])

STORES_DF = load_stores()

QUICK_ITEMS = [
    "쌀 2kg", "달걀 10개", "두부 2모", "양파 3개", "감자 4개",
    "닭가슴살 500g", "김치 1포기", "대파 1단", "당근 2개", "고구마 500g",
    "돼지고기 300g", "콩나물 1봉", "시금치 1단", "토마토 4개",
]

# ── 세션 초기화 ──────────────────────────────────────────────
def init_session():
    defaults = {
        "budget": 50000,
        "items": [],
        "ai_result": None,
        "chat_history": [],
        "chat_input": "",
        "tab": "장보기 추천",
    }
    for k, v in defaults.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_session()

# ── Anthropic 클라이언트 ─────────────────────────────────────
@st.cache_resource
def get_client():
    api_key = os.getenv("ANTHROPIC_API_KEY", "")
    if not api_key:
        return None
    return Anthropic(api_key=api_key)

client = get_client()

# ── AI 추천 함수 ─────────────────────────────────────────────
def get_ai_recommendation(budget: int, items: list[dict]) -> dict | None:
    if not client:
        st.error("🔑 ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")
        return None

    item_str = ", ".join([f"{i['name']} {i['qty']}개" for i in items]) if items else "자유 장보기"
    store_str = "\n".join([
        f"- {row['이름']} ({row['유형']}, {row['거리']}, 특징: {row['특징']}, 주요품목: {row['주요품목']})"
        for _, row in STORES_DF.iterrows()
    ])

    prompt = f"""당신은 물가 절약 전문가이자 지역 경제 활성화 지역 장보기 코치입니다.
아래 조건을 분석해서 반드시 JSON만 응답하세요. 마크다운 코드블록 없이 순수 JSON만 출력하세요.

예산: {budget:,}원
필요 식재료: {item_str}
근처 지역 가게 목록:
{store_str}

다음 JSON 구조로 응답하세요:
{{
  "summary": "한 줄 장보기 전략 요약 (40자 이내)",
  "estimated_total": 예상총금액(숫자),
  "saved": 마트 대비 절약 예상금액(숫자),
  "stores": [
    {{
      "name": "가게명",
      "priority": "1순위/2순위/3순위",
      "reason": "이 가게를 추천하는 이유 (30자 이내)",
      "items": "여기서 살 품목들",
      "tip": "이 가게 활용 꿀팁"
    }}
  ],
  "plan": [
    {{"item": "식재료명", "qty": "수량", "where": "가게명", "price": 예상가격(숫자)}}
  ],
  "tips": [
    "절약 팁 1",
    "절약 팁 2",
    "절약 팁 3"
  ],
  "local_economy_note": "지역 경제 기여 측면에서 한 마디 (30자 이내)"
}}"""

    with st.spinner("🤖 AI가 최적 장보기 루트를 분석 중..."):
        try:
            response = client.messages.create(
                model="claude-opus-4-5",
                max_tokens=1500,
                messages=[{"role": "user", "content": prompt}]
            )
            text = response.content[0].text.strip()
            return json.loads(text)
        except json.JSONDecodeError:
            st.error("AI 응답 파싱 오류. 다시 시도해주세요.")
            return None
        except Exception as e:
            st.error(f"오류 발생: {e}")
            return None

# ── AI 채팅 함수 ─────────────────────────────────────────────
def chat_with_ai(user_msg: str) -> str:
    if not client:
        return "ANTHROPIC_API_KEY가 설정되지 않았습니다."

    system_prompt = """당신은 물가 절약과 지역 경제 활성화를 돕는 친근한 장보기 어시스턴트입니다.
사용자가 장보기, 식재료 가격, 조리법, 보관법, 제철 식재료, 지역 시장 정보 등을 물어보면 
친절하고 실용적으로 답변해주세요. 한국어로만 답변하고, 답변은 300자 이내로 간결하게 해주세요."""

    messages_payload = []
    for msg in st.session_state.chat_history[-10:]:
        messages_payload.append({"role": msg["role"], "content": msg["content"]})
    messages_payload.append({"role": "user", "content": user_msg})

    try:
        response = client.messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=600,
            system=system_prompt,
            messages=messages_payload,
        )
        return response.content[0].text.strip()
    except Exception as e:
        return f"오류: {e}"

# ── 사이드바 ─────────────────────────────────────────────────
with st.sidebar:
    st.markdown("### 🛒 절약 장보기 추천")
    st.markdown("<small style='color:#6b7280'>물가 상승 속 지역 상점 현명하게 이용하기</small>", unsafe_allow_html=True)
    st.divider()

    # 예산 설정
    st.markdown("#### 💰 예산 설정")
    budget = st.slider(
        "장보기 예산",
        min_value=10000,
        max_value=200000,
        step=5000,
        value=st.session_state.budget,
        format="%d원",
    )
    st.session_state.budget = budget

    preset_cols = st.columns(4)
    for i, (label, val) in enumerate([(3, 30000), (5, 50000), (8, 80000), (10, 100000)]):
        with preset_cols[i]:
            if st.button(f"{label}만", key=f"preset_{val}", use_container_width=True):
                st.session_state.budget = val
                st.rerun()

    st.markdown(f"**현재 예산: {st.session_state.budget:,}원**")
    st.divider()

    # 식재료 추가
    st.markdown("#### 🥬 식재료 목록")
    col_name, col_qty = st.columns([3, 1])
    with col_name:
        item_name = st.text_input("식재료", placeholder="예: 양파", label_visibility="collapsed")
    with col_qty:
        item_qty = st.number_input("수량", min_value=1, value=1, label_visibility="collapsed")

    if st.button("➕ 추가", use_container_width=True):
        if item_name.strip():
            st.session_state.items.append({"name": item_name.strip(), "qty": item_qty})
            st.rerun()

    # 빠른 선택
    st.markdown("<small style='color:#6b7280'>빠른 선택:</small>", unsafe_allow_html=True)
    quick_cols = st.columns(2)
    for i, quick in enumerate(QUICK_ITEMS[:8]):
        name = quick.split(" ")[0]
        qty_str = " ".join(quick.split(" ")[1:])
        with quick_cols[i % 2]:
            if st.button(quick, key=f"quick_{i}", use_container_width=True):
                if not any(it["name"] == name for it in st.session_state.items):
                    st.session_state.items.append({"name": name, "qty": 1})
                    st.rerun()

    # 현재 목록
    if st.session_state.items:
        st.divider()
        st.markdown(f"**담은 식재료 ({len(st.session_state.items)}개)**")
        for i, item in enumerate(st.session_state.items):
            c1, c2 = st.columns([4, 1])
            with c1:
                st.markdown(f"<span class='item-tag'>{item['name']} ×{item['qty']}</span>", unsafe_allow_html=True)
            with c2:
                if st.button("✕", key=f"remove_{i}"):
                    st.session_state.items.pop(i)
                    st.rerun()

        if st.button("🗑️ 전체 삭제", use_container_width=True):
            st.session_state.items = []
            st.session_state.ai_result = None
            st.rerun()
    else:
        st.info("식재료를 추가해주세요")

    st.divider()
    # API 키 확인 상태
    api_ok = bool(os.getenv("ANTHROPIC_API_KEY"))
    if api_ok:
        st.markdown("🟢 <small>AI 연결됨</small>", unsafe_allow_html=True)
    else:
        st.markdown("🔴 <small>ANTHROPIC_API_KEY 미설정</small>", unsafe_allow_html=True)

# ── 메인 콘텐츠 ──────────────────────────────────────────────
st.markdown("""
<div class='page-header'>
    <div class='page-title'>🛒 물가 절약 장보기 추천</div>
    <div class='page-subtitle'>예산 내에서 동네 가게를 활용한 현명한 장보기 · 지역 경제 함께 살리기</div>
</div>
""", unsafe_allow_html=True)

tab1, tab2, tab3 = st.tabs(["📋 장보기 추천", "🏪 동네 가게 정보", "💬 AI 장보기 상담"])

# ── 탭1: 장보기 추천 ─────────────────────────────────────────
with tab1:
    # 요약 메트릭
    m1, m2, m3, m4 = st.columns(4)
    with m1: st.metric("💰 예산", f"{st.session_state.budget:,}원")
    with m2: st.metric("🥬 식재료", f"{len(st.session_state.items)}종")
    with m3: st.metric("🏪 추천 가게", f"{len(STORES_DF)}곳")
    with m4:
        saved = st.session_state.ai_result.get("saved", 0) if st.session_state.ai_result else 0
        st.metric("💚 예상 절약", f"{saved:,}원" if saved else "-")

    st.markdown("<br>", unsafe_allow_html=True)

    if st.button("🤖 AI 맞춤 장보기 추천 받기", use_container_width=True):
        result = get_ai_recommendation(st.session_state.budget, st.session_state.items)
        if result:
            st.session_state.ai_result = result

    # AI 결과 표시
    if st.session_state.ai_result:
        res = st.session_state.ai_result
        st.divider()

        # 전략 요약
        if res.get("summary"):
            st.markdown(f"""
            <div style='background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:14px 18px;margin-bottom:16px;'>
                <span style='font-size:13px;color:#065f46;font-weight:600;'>📌 AI 장보기 전략</span><br>
                <span style='font-size:16px;color:#111827;font-weight:500;'>{res.get('summary','')}</span>
            </div>
            """, unsafe_allow_html=True)

        # 절약 정보
        c1, c2 = st.columns(2)
        with c1:
            total = res.get("estimated_total", 0)
            st.metric("🧾 예상 총액", f"{total:,}원",
                      delta=f"-{res.get('saved',0):,}원 절약" if res.get('saved') else None,
                      delta_color="inverse")
        with c2:
            note = res.get("local_economy_note", "")
            if note:
                st.markdown(f"""
                <div style='background:#ede9fe;border-radius:8px;padding:10px 14px;font-size:13px;color:#5b21b6;'>
                    🏘️ {note}
                </div>
                """, unsafe_allow_html=True)

        st.markdown("---")

        # 추천 가게
        left_col, right_col = st.columns([3, 2])

        with left_col:
            st.markdown("#### 🏪 추천 가게 순서")
            for store in res.get("stores", []):
                priority_color = {"1순위": "#10b981", "2순위": "#3b82f6", "3순위": "#f59e0b"}.get(
                    store.get("priority", ""), "#6b7280"
                )
                st.markdown(f"""
                <div class='result-card'>
                    <div style='display:flex;justify-content:space-between;align-items:center;'>
                        <span class='result-store'>{store.get('name','')}</span>
                        <span style='font-size:12px;font-weight:600;color:{priority_color};'>{store.get('priority','')}</span>
                    </div>
                    <div class='result-reason'>{store.get('reason','')}</div>
                    <div class='result-items'>🛍️ {store.get('items','')}</div>
                    <div style='font-size:12px;color:#f59e0b;margin-top:6px;'>💡 {store.get('tip','')}</div>
                </div>
                """, unsafe_allow_html=True)

        with right_col:
            # 품목별 구매 플랜
            st.markdown("#### 📝 품목별 구매 플랜")
            plan = res.get("plan", [])
            if plan:
                plan_df = pd.DataFrame(plan)
                plan_df.columns = ["식재료", "수량", "구매처", "예상가격(원)"]
                plan_df["예상가격(원)"] = plan_df["예상가격(원)"].apply(lambda x: f"{int(x):,}")
                st.dataframe(plan_df, use_container_width=True, hide_index=True)

        # 절약 팁
        st.markdown("#### 💡 절약 팁")
        tips_cols = st.columns(len(res.get("tips", [])) or 1)
        for i, tip in enumerate(res.get("tips", [])):
            with tips_cols[i]:
                st.markdown(f"<div class='tip-box'>✅ {tip}</div>", unsafe_allow_html=True)

    else:
        # 첫 화면 안내
        st.markdown("---")
        st.markdown("#### 🏪 근처 지역 가게")
        cols = st.columns(3)
        for i, (_, row) in enumerate(STORES_DF.iterrows()):
            with cols[i % 3]:
                st.markdown(f"""
                <div class='store-card'>
                    <div class='store-name'>{row['이름']}</div>
                    <div class='store-meta'>{row['유형']} · {row['거리']} · ★{row['평점']}</div>
                    <span class='badge {row["badge"]}'>{row['태그']}</span>
                    <div class='store-items'>🛒 {row['주요품목']}</div>
                </div>
                """, unsafe_allow_html=True)

# ── 탭2: 가게 정보 ────────────────────────────────────────────
with tab2:
    st.markdown("#### 🗺️ 동네 지역 가게 상세 정보")
    st.markdown("<small style='color:#6b7280'>지역 상점 이용 시 중간 유통 마진 없이 더 저렴하고 신선한 상품을 구매할 수 있습니다.</small>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)

    filter_type = st.multiselect(
        "가게 유형 필터",
        options=STORES_DF["유형"].unique().tolist(),
        default=STORES_DF["유형"].unique().tolist(),
    )
    filtered_stores = STORES_DF[STORES_DF["유형"].isin(filter_type)]

    for _, row in filtered_stores.iterrows():
        with st.expander(f"🏪 {row['이름']} — {row['유형']} · {row['거리']} · ★{row['평점']}"):
            c1, c2 = st.columns([2, 1])
            with c1:
                st.markdown(f"**주요 품목:** {row['주요품목']}")
                st.markdown(f"**특징:** {row['특징']}")
                st.markdown(f"**영업시간:** {row['영업시간']}")
            with c2:
                st.markdown(f"<span class='badge {row[\"badge\"]}'>{row['태그']}</span>", unsafe_allow_html=True)
                st.metric("거리", row['거리'])
                st.metric("평점", f"★ {row['평점']}")

    st.divider()
    st.markdown("""
    <div style='background:#f0fdf4;border-radius:10px;padding:16px 18px;'>
        <span style='font-size:14px;font-weight:600;color:#065f46;'>🏘️ 왜 지역 상점을 이용해야 할까요?</span><br><br>
        <span style='font-size:13px;color:#374151;line-height:1.8;'>
        • 대형마트 대비 <b>10~30% 저렴</b> (유통 단계 축소)<br>
        • 당일 수확·입하로 <b>신선도 우수</b><br>
        • 지역 농가·소상공인 수익 직접 기여 → <b>지역 경제 순환</b><br>
        • 포장재 줄어 <b>친환경</b>적 소비<br>
        • 단골이 되면 덤·할인 등 <b>추가 혜택</b> 가능
        </span>
    </div>
    """, unsafe_allow_html=True)

# ── 탭3: AI 채팅 ──────────────────────────────────────────────
with tab3:
    st.markdown("#### 💬 AI 장보기 상담")
    st.markdown("<small style='color:#6b7280'>제철 식재료, 가격 비교, 보관법, 조리법 등 무엇이든 물어보세요!</small>", unsafe_allow_html=True)
    st.markdown("<br>", unsafe_allow_html=True)

    # 빠른 질문
    st.markdown("**자주 묻는 질문:**")
    quick_q_cols = st.columns(3)
    quick_qs = [
        "지금 제철 채소는 뭐야?",
        "달걀 신선도 확인하는 법",
        "두부 오래 보관하는 방법",
        "전통시장 장보기 꿀팁",
        "식비 절약하는 방법",
        "냉동 보관 잘 되는 식재료",
    ]
    for i, q in enumerate(quick_qs):
        with quick_q_cols[i % 3]:
            if st.button(q, key=f"quickq_{i}", use_container_width=True):
                st.session_state.chat_history.append({"role": "user", "content": q})
                reply = chat_with_ai(q)
                st.session_state.chat_history.append({"role": "assistant", "content": reply})
                st.rerun()

    st.markdown("---")

    # 채팅 기록
    chat_container = st.container()
    with chat_container:
        if not st.session_state.chat_history:
            st.markdown("<div style='text-align:center;color:#9ca3af;padding:20px;font-size:14px;'>아직 대화 내용이 없습니다. 위 버튼이나 직접 입력으로 시작해보세요!</div>", unsafe_allow_html=True)
        else:
            for msg in st.session_state.chat_history:
                if msg["role"] == "user":
                    st.markdown(f"<div class='chat-msg-user'>🙋 {msg['content']}</div>", unsafe_allow_html=True)
                else:
                    st.markdown(f"<div class='chat-msg-ai'>🤖 {msg['content']}</div>", unsafe_allow_html=True)

    # 입력
    with st.form("chat_form", clear_on_submit=True):
        user_input = st.text_input("메시지 입력", placeholder="예: 오늘 저녁 2만원으로 4인분 만들 수 있는 메뉴 추천해줘", label_visibility="collapsed")
        submitted = st.form_submit_button("전송 →", use_container_width=True)
        if submitted and user_input.strip():
            st.session_state.chat_history.append({"role": "user", "content": user_input.strip()})
            reply = chat_with_ai(user_input.strip())
            st.session_state.chat_history.append({"role": "assistant", "content": reply})
            st.rerun()

    if st.session_state.chat_history:
        if st.button("🗑️ 대화 초기화", use_container_width=True):
            st.session_state.chat_history = []
            st.rerun()
