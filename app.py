import streamlit as st
import pandas as pd
import json
import os
from anthropic import Anthropic

st.set_page_config(
    page_title="동네장보기 — 예산 절약 추천",
    page_icon="🧺",
    layout="wide",
    initial_sidebar_state="expanded",
)

st.markdown("""
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@300;400;500;700&family=Playfair+Display:wght@600&display=swap');

html, body, [class*="css"] { font-family: 'Noto Sans KR', sans-serif; }
.stApp { background-color: #FAF7F2; }

[data-testid="stSidebar"] { background-color: #1C1917 !important; border-right: none; }
[data-testid="stSidebar"] * { color: #E7E5E4 !important; }
[data-testid="stSidebar"] hr { border-color: #44403C !important; }
[data-testid="stSidebar"] .stButton > button {
    background: #292524 !important; color: #D6D3D1 !important;
    border: 1px solid #44403C !important; border-radius: 8px !important;
    font-size: 12px !important; padding: 6px 10px !important;
}
[data-testid="stSidebar"] .stButton > button:hover {
    background: #44403C !important; border-color: #C8A97A !important; color: #F5F5F4 !important;
}
[data-testid="stSidebar"] .stTextInput input,
[data-testid="stSidebar"] .stNumberInput input {
    background: #292524 !important; border: 1px solid #44403C !important;
    color: #F5F5F4 !important; border-radius: 8px !important;
}

.stTabs [data-baseweb="tab-list"] { background: transparent; gap: 4px; border-bottom: 2px solid #E7E5E4; }
.stTabs [data-baseweb="tab"] {
    background: transparent; border: none; color: #78716C; font-size: 14px;
    font-weight: 500; padding: 10px 20px; border-bottom: 2px solid transparent; margin-bottom: -2px;
}
.stTabs [aria-selected="true"] {
    background: transparent !important; color: #1C1917 !important; border-bottom: 2px solid #C8A97A !important;
}

.stButton > button {
    background: #1C1917; color: #FAF7F2; border: none; border-radius: 12px;
    font-family: 'Noto Sans KR', sans-serif; font-weight: 500; font-size: 14px;
    padding: 12px 24px; letter-spacing: 0.02em; transition: all 0.2s; width: 100%;
}
.stButton > button:hover {
    background: #44403C; transform: translateY(-1px); box-shadow: 0 4px 20px rgba(28,25,23,0.15);
}

div[data-testid="stMetric"] {
    background: #FFFFFF; border: 1px solid #E7E5E4; border-radius: 16px;
    padding: 20px 24px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}
div[data-testid="stMetric"] label { color: #78716C !important; font-size: 12px !important; letter-spacing: 0.06em; text-transform: uppercase; }
div[data-testid="stMetric"] [data-testid="stMetricValue"] { color: #1C1917 !important; font-size: 28px !important; font-weight: 700 !important; }

.hero-banner {
    background: linear-gradient(135deg, #1C1917 0%, #44403C 60%, #292524 100%);
    border-radius: 20px; padding: 44px 52px; margin-bottom: 32px; position: relative; overflow: hidden;
}
.hero-banner::after {
    content: '🧺'; position: absolute; right: 48px; top: 50%; transform: translateY(-50%);
    font-size: 90px; opacity: 0.12;
}
.hero-title {
    font-family: 'Playfair Display', serif; font-size: 38px; font-weight: 600;
    color: #FAF7F2; margin: 0 0 10px; letter-spacing: -0.02em; line-height: 1.2;
}
.hero-gold { color: #C8A97A; }
.hero-sub { font-size: 15px; color: #A8A29E; margin: 0; line-height: 1.7; }

.section-label {
    font-size: 11px; font-weight: 600; color: #A8A29E; letter-spacing: 0.1em;
    text-transform: uppercase; margin-bottom: 16px; margin-top: 32px;
}

.store-card {
    background: #FFFFFF; border: 1px solid #E7E5E4; border-radius: 16px;
    padding: 20px; margin-bottom: 12px; transition: all 0.2s;
}
.store-card:hover { border-color: #C8A97A; box-shadow: 0 4px 20px rgba(200,169,122,0.12); transform: translateY(-2px); }
.store-name { font-size: 16px; font-weight: 700; color: #1C1917; letter-spacing: -0.01em; }
.store-type { font-size: 11px; color: #78716C; margin-top: 2px; }
.store-dist { font-size: 12px; color: #78716C; text-align: right; }
.store-rating { font-size: 13px; font-weight: 600; color: #C8A97A; }
.store-items-text { font-size: 13px; color: #57534E; line-height: 1.6; margin-top: 10px; padding-top: 10px; border-top: 1px solid #F5F5F4; }

.badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: 0.04em; }
.badge-green  { background: #DCFCE7; color: #166534; }
.badge-blue   { background: #DBEAFE; color: #1E3A5F; }
.badge-orange { background: #FEF3C7; color: #92400E; }
.badge-purple { background: #EDE9FE; color: #4C1D95; }
.badge-yellow { background: #FEF9C3; color: #713F12; }

.strategy-box { background: #1C1917; border-radius: 16px; padding: 26px 30px; margin-bottom: 24px; }
.strategy-label { font-size: 11px; font-weight: 600; color: #C8A97A; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
.strategy-text { font-size: 19px; font-weight: 500; color: #FAF7F2; line-height: 1.5; }

.result-card { background: #FFFFFF; border: 1px solid #E7E5E4; border-radius: 16px; padding: 22px 24px; margin-bottom: 14px; transition: all 0.2s; }
.result-card:hover { box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
.priority-pill { font-size: 11px; font-weight: 700; padding: 4px 12px; border-radius: 20px; letter-spacing: 0.06em; }
.priority-1 { background: #1C1917; color: #C8A97A; }
.priority-2 { background: #F5F5F4; color: #44403C; }
.priority-3 { background: #F5F5F4; color: #78716C; }

.tip-card { background: #FFFBEB; border: 1px solid #FDE68A; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #44403C; line-height: 1.6; }

.eco-note { background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 12px; padding: 14px 18px; font-size: 13px; color: #166534; font-weight: 500; }

.chat-bubble-user {
    background: #1C1917; color: #FAF7F2; border-radius: 18px 18px 4px 18px;
    padding: 12px 18px; font-size: 14px; line-height: 1.6; margin-bottom: 10px;
    max-width: 78%; margin-left: auto;
}
.chat-bubble-ai {
    background: #FFFFFF; border: 1px solid #E7E5E4; color: #1C1917;
    border-radius: 18px 18px 18px 4px; padding: 12px 18px; font-size: 14px;
    line-height: 1.6; margin-bottom: 10px; max-width: 78%; box-shadow: 0 2px 8px rgba(0,0,0,0.04);
}

.local-reason-box { background: #FAF7F2; border: 1px solid #E7E5E4; border-radius: 16px; padding: 26px; margin-top: 28px; }
.local-reason-title { font-size: 17px; font-weight: 700; color: #1C1917; margin-bottom: 16px; }
.lri { display: flex; gap: 12px; align-items: flex-start; margin-bottom: 12px; font-size: 13px; color: #44403C; line-height: 1.6; }
.lrd { width: 6px; height: 6px; background: #C8A97A; border-radius: 50%; margin-top: 7px; flex-shrink: 0; }

.api-ok  { display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#4ADE80;background:#052e16;padding:4px 12px;border-radius:20px; }
.api-err { display:inline-flex;align-items:center;gap:6px;font-size:12px;color:#F87171;background:#2d0a0a;padding:4px 12px;border-radius:20px; }

.budget-display {
    background: #292524; border-radius: 12px; padding: 14px 18px; margin: 10px 0 14px; text-align: center;
}
</style>
""", unsafe_allow_html=True)

# ── 데이터 ──────────────────────────────────────────────────
@st.cache_data
def load_stores():
    return pd.DataFrame([
        {"id":1,"이름":"정자동 전통시장","유형":"전통시장","거리":"0.3km","평점":4.7,"태그":"최저가","badge":"badge-green",
         "주요품목":"채소, 육류, 생선, 과일, 두부","특징":"오전 일찍 갈수록 싱싱하고 저렴 · 현금 할인 가능","영업시간":"06:00~18:00 (일요일 휴무)"},
        {"id":2,"이름":"수내 한살림","유형":"생협·친환경","거리":"0.5km","평점":4.5,"태그":"친환경","badge":"badge-blue",
         "주요품목":"유기농 채소, 두부, 달걀, 잡곡, 발효식품","특징":"조합원 가입 시 5% 할인 · 무농약 인증 제품","영업시간":"09:00~20:00 (월요일 휴무)"},
        {"id":3,"이름":"야탑 농협하나로마트","유형":"협동조합마트","거리":"1.2km","평점":4.3,"태그":"산지직송","badge":"badge-orange",
         "주요품목":"쌀, 감자, 양파, 계란, 고구마, 잡곡","특징":"산지 직접 조달 · 대용량 구매 시 더 저렴","영업시간":"09:00~21:00 (연중무휴)"},
        {"id":4,"이름":"분당 로컬푸드직매장","유형":"로컬푸드","거리":"0.8km","평점":4.6,"태그":"지역농산","badge":"badge-purple",
         "주요품목":"제철 채소·과일, 두부, 된장, 쌀","특징":"경기 남부 농가 직거래 · 당일 수확 상품 판매","영업시간":"10:00~19:00 (월·화 휴무)"},
        {"id":5,"이름":"성남 새벽 공판장","유형":"도매시장","거리":"2.1km","평점":4.2,"태그":"도매가","badge":"badge-yellow",
         "주요품목":"채소류, 과일류, 수산물 (박스 단위)","특징":"새벽 4~8시 운영 · 소매도 가능하지만 대용량 중심","영업시간":"04:00~08:00 (연중무휴)"},
    ])

STORES_DF = load_stores()
QUICK_ITEMS = ["쌀 2kg","달걀 10개","두부 2모","양파 3개","감자 4개","닭가슴살 500g","김치 1포기","대파 1단","당근 2개","고구마 500g","돼지고기 300g","콩나물 1봉"]

def init_session():
    for k, v in {"budget":50000,"grocery_items":[],"ai_result":None,"chat_history":[]}.items():
        if k not in st.session_state:
            st.session_state[k] = v

init_session()

@st.cache_resource
def get_client():
    key = os.getenv("ANTHROPIC_API_KEY","")
    return Anthropic(api_key=key) if key else None

client = get_client()

def get_ai_recommendation(budget, items):
    if not client:
        st.error("ANTHROPIC_API_KEY 환경변수가 설정되지 않았습니다.")
        return None
    item_str = ", ".join([f"{i['name']} {i['qty']}개" for i in items]) if items else "일반 장보기"
    store_str = "\n".join([f"- {r['이름']}({r['유형']},{r['거리']},특징:{r['특징']},품목:{r['주요품목']})" for _,r in STORES_DF.iterrows()])
    prompt = f"""물가 절약 장보기 전문가로서 JSON만 응답하세요. 마크다운 코드블록 없이 순수 JSON만.

예산: {budget:,}원 / 식재료: {item_str}
가게: {store_str}

JSON 형식:
{{"summary":"전략(40자)","estimated_total":숫자,"saved":숫자,
"stores":[{{"name":"가게명","priority":"1순위","reason":"이유(30자)","items":"품목들","tip":"꿀팁"}}],
"plan":[{{"item":"식재료","qty":"수량","where":"가게명","price":숫자}}],
"tips":["팁1","팁2","팁3"],"local_economy_note":"지역경제 한마디(30자)"}}"""
    with st.spinner("AI가 최적 장보기 루트를 분석하고 있어요..."):
        try:
            res = client.messages.create(model="claude-opus-4-5", max_tokens=1500, messages=[{"role":"user","content":prompt}])
            return json.loads(res.content[0].text.strip())
        except:
            st.error("AI 응답 오류. 다시 시도해주세요.")
            return None

def chat_with_ai(msg):
    if not client:
        return "ANTHROPIC_API_KEY가 설정되지 않았습니다."
    sys = "물가 절약과 지역 경제 활성화를 돕는 장보기 어시스턴트입니다. 장보기, 식재료, 조리법, 보관법에 대해 한국어로 300자 이내로 친절하게 답변하세요."
    msgs = [{"role":m["role"],"content":m["content"]} for m in st.session_state.chat_history[-10:]]
    msgs.append({"role":"user","content":msg})
    try:
        res = client.messages.create(model="claude-haiku-4-5-20251001", max_tokens=600, system=sys, messages=msgs)
        return res.content[0].text.strip()
    except Exception as e:
        return f"오류: {e}"

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 사이드바
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
with st.sidebar:
    st.markdown("""<div style='padding:8px 0 20px;'>
        <div style='font-family:"Playfair Display",serif;font-size:22px;color:#FAF7F2;font-weight:600;letter-spacing:-0.02em;'>동네장보기</div>
        <div style='font-size:11px;color:#78716C;letter-spacing:0.08em;text-transform:uppercase;margin-top:4px;'>Budget Grocery Guide</div>
    </div>""", unsafe_allow_html=True)

    st.markdown("<div style='font-size:11px;color:#78716C;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px;'>예산 설정</div>", unsafe_allow_html=True)
    budget = st.slider("예산", min_value=10000, max_value=200000, step=5000,
                       value=st.session_state.budget, format="%d원", label_visibility="collapsed")
    st.session_state.budget = budget
    st.markdown(f"""<div class='budget-display'>
        <div style='font-size:11px;color:#78716C;letter-spacing:0.06em;text-transform:uppercase;'>현재 예산</div>
        <div style='font-size:28px;font-weight:700;color:#C8A97A;margin-top:2px;'>{st.session_state.budget:,}<span style='font-size:13px;font-weight:400;'> 원</span></div>
    </div>""", unsafe_allow_html=True)

    pc = st.columns(4)
    for i,(lbl,val) in enumerate([(3,30000),(5,50000),(8,80000),(10,100000)]):
        with pc[i]:
            if st.button(f"{lbl}만", key=f"pr_{val}", use_container_width=True):
                st.session_state.budget = val
                st.rerun()

    st.markdown("<hr style='border-color:#44403C;margin:20px 0;'>", unsafe_allow_html=True)
    st.markdown("<div style='font-size:11px;color:#78716C;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:10px;'>식재료 추가</div>", unsafe_allow_html=True)

    cn, cq = st.columns([3,1])
    with cn:
        iname = st.text_input("이름", placeholder="예: 양파", label_visibility="collapsed")
    with cq:
        iqty = st.number_input("수량", min_value=1, value=1, label_visibility="collapsed")
    if st.button("+ 추가하기", use_container_width=True):
        if iname.strip():
            st.session_state.grocery_items.append({"name": iname.strip(), "qty": iqty})
            st.rerun()

    st.markdown("<div style='font-size:11px;color:#78716C;margin:10px 0 6px;'>빠른 선택</div>", unsafe_allow_html=True)
    qc2 = st.columns(2)
    for i, q in enumerate(QUICK_ITEMS[:8]):
        nm = q.split(" ")[0]
        with qc2[i % 2]:
            if st.button(q, key=f"qs_{i}", use_container_width=True):
                if not any(x["name"] == nm for x in st.session_state.grocery_items):
                    st.session_state.grocery_items.append({"name": nm, "qty": 1})
                    st.rerun()

    if st.session_state.grocery_items:
        st.markdown("<hr style='border-color:#44403C;margin:16px 0 10px;'>", unsafe_allow_html=True)
        n = len(st.session_state.grocery_items)
        st.markdown(f"<div style='font-size:11px;color:#A8A29E;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:8px;'>담은 식재료 · {n}종</div>", unsafe_allow_html=True)
        for i, item in enumerate(st.session_state.grocery_items):
            r1, r2 = st.columns([5,1])
            with r1:
                st.markdown(f"<div style='font-size:13px;color:#D6D3D1;padding:3px 0;'>· {item['name']} <span style='color:#78716C;'>×{item['qty']}</span></div>", unsafe_allow_html=True)
            with r2:
                if st.button("✕", key=f"rm_{i}"):
                    st.session_state.grocery_items.pop(i)
                    st.rerun()
        if st.button("전체 삭제", use_container_width=True):
            st.session_state.grocery_items = []
            st.session_state.ai_result = None
            st.rerun()
    else:
        st.markdown("<div style='font-size:12px;color:#57534E;text-align:center;padding:12px 0;'>아직 추가된 식재료가 없어요</div>", unsafe_allow_html=True)

    st.markdown("<hr style='border-color:#44403C;margin:20px 0 12px;'>", unsafe_allow_html=True)
    if os.getenv("ANTHROPIC_API_KEY"):
        st.markdown("<div class='api-ok'>● AI 연결됨</div>", unsafe_allow_html=True)
    else:
        st.markdown("<div class='api-err'>● API 키 미설정</div>", unsafe_allow_html=True)

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
# 메인
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
st.markdown("""<div class='hero-banner'>
    <div class='hero-title'>물가 올라도, 장보기는<br><span class='hero-gold'>동네에서</span></div>
    <div class='hero-sub'>예산을 입력하고 AI 추천을 받아 지역 상점에서 현명하게 장보세요</div>
</div>""", unsafe_allow_html=True)

tab1, tab2, tab3 = st.tabs(["  장보기 추천  ", "  동네 가게  ", "  AI 상담  "])

# ── 탭1 ──────────────────────────────────────────────────────
with tab1:
    m1, m2, m3, m4 = st.columns(4)
    with m1: st.metric("예산", f"{st.session_state.budget:,}원")
    with m2: st.metric("식재료", f"{len(st.session_state.grocery_items)}종")
    with m3: st.metric("근처 가게", f"{len(STORES_DF)}곳")
    with m4:
        sv = st.session_state.ai_result.get("saved",0) if st.session_state.ai_result else 0
        st.metric("예상 절약", f"{sv:,}원" if sv else "—")

    st.markdown("<br>", unsafe_allow_html=True)
    if st.button("✦  AI 맞춤 장보기 추천 받기", use_container_width=True):
        r = get_ai_recommendation(st.session_state.budget, st.session_state.grocery_items)
        if r: st.session_state.ai_result = r

    if st.session_state.ai_result:
        res = st.session_state.ai_result
        st.markdown("<br>", unsafe_allow_html=True)

        if res.get("summary"):
            st.markdown(f"""<div class='strategy-box'>
                <div class='strategy-label'>AI 장보기 전략</div>
                <div class='strategy-text'>{res['summary']}</div>
            </div>""", unsafe_allow_html=True)

        ca, cb = st.columns(2)
        with ca:
            tot = res.get("estimated_total", 0)
            st.metric("예상 총액", f"{tot:,}원",
                      delta=f"-{res.get('saved',0):,}원 절약" if res.get("saved") else None,
                      delta_color="inverse")
        with cb:
            note = res.get("local_economy_note","")
            if note:
                st.markdown(f"<div class='eco-note'>🌱 {note}</div>", unsafe_allow_html=True)

        st.markdown("<div class='section-label'>추천 가게 순서</div>", unsafe_allow_html=True)
        lc, rc = st.columns([3, 2])

        with lc:
            for s in res.get("stores", []):
                p = s.get("priority","")
                pcls = "priority-1" if "1" in p else ("priority-2" if "2" in p else "priority-3")
                st.markdown(f"""<div class='result-card'>
                    <div style='display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;'>
                        <span style='font-size:16px;font-weight:700;color:#1C1917;'>{s.get('name','')}</span>
                        <span class='priority-pill {pcls}'>{p}</span>
                    </div>
                    <div style='font-size:13px;color:#78716C;margin-bottom:10px;'>{s.get('reason','')}</div>
                    <div style='font-size:13px;color:#44403C;padding:10px 0;border-top:1px solid #F5F5F4;border-bottom:1px solid #F5F5F4;margin-bottom:10px;'>🛍 {s.get('items','')}</div>
                    <div style='font-size:12px;color:#92400E;background:#FEF3C7;padding:6px 12px;border-radius:8px;display:inline-block;'>💡 {s.get('tip','')}</div>
                </div>""", unsafe_allow_html=True)

        with rc:
            st.markdown("<div class='section-label' style='margin-top:0;'>품목별 구매 플랜</div>", unsafe_allow_html=True)
            plan = res.get("plan", [])
            if plan:
                df_plan = pd.DataFrame(plan)
                df_plan.columns = ["식재료","수량","구매처","예상가격(원)"]
                df_plan["예상가격(원)"] = df_plan["예상가격(원)"].apply(lambda x: f"{int(x):,}")
                st.dataframe(df_plan, use_container_width=True, hide_index=True, height=300)

        tips = res.get("tips", [])
        if tips:
            st.markdown("<div class='section-label'>절약 팁</div>", unsafe_allow_html=True)
            tc = st.columns(len(tips))
            for i, tip in enumerate(tips):
                with tc[i]:
                    st.markdown(f"<div class='tip-card'>✦ {tip}</div>", unsafe_allow_html=True)

    else:
        st.markdown("<div class='section-label'>근처 지역 가게</div>", unsafe_allow_html=True)
        gc = st.columns(3)
        for i, (_, row) in enumerate(STORES_DF.iterrows()):
            with gc[i % 3]:
                bc = row["badge"]
                bt = row["태그"]
                st.markdown(f"""<div class='store-card'>
                    <div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;'>
                        <div><div class='store-name'>{row['이름']}</div><div class='store-type'>{row['유형']}</div></div>
                        <div><div class='store-dist'>{row['거리']}</div><div class='store-rating'>★ {row['평점']}</div></div>
                    </div>
                    <span class='badge {bc}'>{bt}</span>
                    <div class='store-items-text'>🛒 {row['주요품목']}</div>
                </div>""", unsafe_allow_html=True)

# ── 탭2 ──────────────────────────────────────────────────────
with tab2:
    st.markdown("<div class='section-label' style='margin-top:16px;'>가게 유형 필터</div>", unsafe_allow_html=True)
    ftypes = st.multiselect("필터", options=STORES_DF["유형"].unique().tolist(),
                            default=STORES_DF["유형"].unique().tolist(), label_visibility="collapsed")
    fdf = STORES_DF[STORES_DF["유형"].isin(ftypes)]

    st.markdown("<div class='section-label'>가게 목록</div>", unsafe_allow_html=True)
    sc = st.columns(3)
    for i, (_, row) in enumerate(fdf.iterrows()):
        with sc[i % 3]:
            bc = row["badge"]
            bt = row["태그"]
            st.markdown(f"""<div class='store-card'>
                <div style='display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;'>
                    <div><div class='store-name'>{row['이름']}</div><div class='store-type'>{row['유형']}</div></div>
                    <div><div class='store-dist'>{row['거리']}</div><div class='store-rating'>★ {row['평점']}</div></div>
                </div>
                <span class='badge {bc}'>{bt}</span>
                <div class='store-items-text'>
                    🛒 {row['주요품목']}<br>
                    <span style='color:#78716C;font-size:12px;'>⏱ {row['영업시간']}</span><br>
                    <span style='color:#57534E;font-size:12px;'>✦ {row['특징']}</span>
                </div>
            </div>""", unsafe_allow_html=True)

    st.markdown("""<div class='local-reason-box'>
        <div class='local-reason-title'>왜 지역 상점을 이용해야 할까요?</div>
        <div class='lri'><div class='lrd'></div><div>대형마트 대비 <b>10~30% 저렴</b> — 유통 단계가 짧아 중간 마진이 없습니다</div></div>
        <div class='lri'><div class='lrd'></div><div>당일 수확·입하로 <b>신선도가 압도적</b>으로 우수합니다</div></div>
        <div class='lri'><div class='lrd'></div><div>지역 농가·소상공인 수익 직접 기여 → <b>지역 경제 선순환</b></div></div>
        <div class='lri'><div class='lrd'></div><div>포장재가 줄어 <b>친환경적</b> 소비가 가능합니다</div></div>
        <div class='lri'><div class='lrd'></div><div>단골이 되면 덤·특가 등 <b>보이지 않는 혜택</b>이 생깁니다</div></div>
    </div>""", unsafe_allow_html=True)

# ── 탭3 ──────────────────────────────────────────────────────
with tab3:
    st.markdown("<div class='section-label' style='margin-top:16px;'>자주 묻는 질문</div>", unsafe_allow_html=True)
    quick_qs = ["지금 제철 채소는?","달걀 신선도 확인법","두부 오래 보관하는 법","전통시장 장보기 꿀팁","식비 절약 방법","냉동 보관 좋은 식재료"]
    qqc = st.columns(3)
    for i, q in enumerate(quick_qs):
        with qqc[i % 3]:
            if st.button(q, key=f"qq_{i}", use_container_width=True):
                st.session_state.chat_history.append({"role":"user","content":q})
                st.session_state.chat_history.append({"role":"assistant","content":chat_with_ai(q)})
                st.rerun()

    st.markdown("<div class='section-label'>대화</div>", unsafe_allow_html=True)
    if not st.session_state.chat_history:
        st.markdown("<div style='text-align:center;padding:48px 24px;color:#A8A29E;font-size:14px;'>💬<br>아직 대화가 없어요<br><span style='font-size:12px;color:#D1D5DB;'>위 버튼이나 직접 입력으로 시작해보세요</span></div>", unsafe_allow_html=True)
    else:
        for msg in st.session_state.chat_history:
            if msg["role"] == "user":
                st.markdown(f"<div class='chat-bubble-user'>{msg['content']}</div>", unsafe_allow_html=True)
            else:
                st.markdown(f"<div class='chat-bubble-ai'>🤖 {msg['content']}</div>", unsafe_allow_html=True)

    with st.form("chat_form", clear_on_submit=True):
        uinput = st.text_input("메시지", placeholder="예: 오늘 저녁 2만원으로 4인분 메뉴 추천해줘", label_visibility="collapsed")
        if st.form_submit_button("전송 →", use_container_width=True) and uinput.strip():
            st.session_state.chat_history.append({"role":"user","content":uinput.strip()})
            st.session_state.chat_history.append({"role":"assistant","content":chat_with_ai(uinput.strip())})
            st.rerun()

    if st.session_state.chat_history:
        if st.button("대화 초기화", use_container_width=True):
            st.session_state.chat_history = []
            st.rerun()
