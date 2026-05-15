# 🛒 LocalCart — 예산 맞춤형 지역상권 장보기 추천 플랫폼

> **물가 대응형 PGIS 참여형 지도 기반 로컬 장바구니 추천 서비스**  
> 공공 농축수산물 가격 데이터 × 지역 상점 데이터 × 사용자 예산 조건을 결합하여  
> "내 예산 안에서, 동네 안에서" 최적의 장보기 경로를 제안합니다.

---

## 📌 프로젝트 개요

| 항목 | 내용 |
|---|---|
| 서비스명 | LocalCart (동네장보기) |
| 플랫폼 | Streamlit 웹 애플리케이션 |
| 지도 엔진 | Folium + streamlit-folium (PGIS 참여형) |
| 데이터 출처 | 농림축산식품부 aT · 소상공인진흥공단 · 공공데이터포털 |
| 추천 알고리즘 | 선형 계획법(LP) 기반 품목 최적화 + Haversine 거리 가중 상점 추천 |
| 개발 언어 | Python 3.10+ |

### 핵심 차별점

- **실시간 개별 매장 가격 수집 없이 구현 가능** — 공공 평균가격 데이터 기반 예산 시뮬레이션
- **PGIS 참여형 지도** — 사용자가 직접 마커를 그리고 가격을 제보하여 데이터에 기여
- **지역상권 우선 추천** — 전통시장·착한가격업소·로컬푸드 직매장에 가중치 부여
- **GIS 공간 분석** — Haversine 거리 기반 반경 필터링 + 상점 추천 점수 산정

---

## 🗂️ 프로젝트 구조

```
localcart/
├── app.py                  # Streamlit 메인 진입점 (단일 파일 구성)
├── requirements.txt        # 의존 패키지 목록
├── README.md               # 이 파일
│
├── pages/                  # (선택) 다중 페이지 확장 시
│   ├── 1_data_explorer.py  # 품목별 가격 추이 탐색
│   ├── 2_report_board.py   # 시민 제보 현황판
│   └── 3_about.py          # 프로젝트 소개 · 데이터 출처
│
├── core/                   # (선택) 모듈 분리 시
│   ├── data_loader.py      # 공공 API 호출 + 캐싱
│   ├── recommender.py      # 품목 선정 · 상점 추천 로직
│   ├── geo_utils.py        # Haversine · 반경 필터
│   └── chart_builder.py    # Plotly · Folium 차트
│
├── data/
│   ├── stores.csv          # 상점 정적 데이터 (전통시장 등)
│   └── items_seed.csv      # 품목 메타 (코드 · 단위 · 카테고리)
│
└── .streamlit/
    ├── config.toml         # 테마 · 서버 설정
    └── secrets.toml        # API 키 (Git 제외 필수)
```

---

## ⚙️ 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/your-username/localcart.git
cd localcart
```

### 2. 가상환경 생성 (권장)

```bash
python -m venv .venv
source .venv/bin/activate        # macOS / Linux
.venv\Scripts\activate           # Windows
```

### 3. 패키지 설치

```bash
pip install -r requirements.txt
```

### 4. 환경변수 설정 (선택 — API 연동 시)

`.streamlit/secrets.toml` 파일을 생성하고 아래 키를 입력합니다.

```toml
# .streamlit/secrets.toml
KAKAO_API_KEY = "your_kakao_rest_api_key"
AT_API_KEY    = "your_at_open_api_key"
DATA_GO_KEY   = "your_data_go_kr_api_key"
```

> **주의:** `secrets.toml`은 반드시 `.gitignore`에 추가하세요.

### 5. 앱 실행

```bash
streamlit run app.py
```

브라우저에서 `http://localhost:8501` 접속.

---

## 🗺️ 주요 기능

### PGIS 참여형 지도

| 기능 | 설명 |
|---|---|
| 지도 클릭으로 위치 설정 | 클릭한 좌표가 즉시 탐색 기준점으로 반영 |
| Draw 도구 | 마커·폴리곤·원을 직접 그려 탐색 구역 설정 및 가격 제보 연동 |
| GPS 자동 위치 | LocateControl로 현재 위치 자동 탐지 |
| 거리 측정 | MeasureControl로 상점까지 실거리 측정 |
| 마커 클러스터 | 밀집 지역 자동 클러스터링, 줌인 시 개별 마커 분리 |
| 시민 제보 포인트 | 등록된 가격 제보를 지도에 노란 마커로 시각화 |

### 장바구니 추천

- 예산·가구 수·식단 선호를 입력하면 선형 계획법(LP) 기반으로 품목 조합 최적화
- 전통시장 가격 우선 적용 토글로 가격 기준 전환 가능
- 카테고리별 예산 배분 파이 차트 · 예산 사용률 게이지 제공

### 상점 추천

추천 점수 = 거리 접근성(40%) + 상점 유형 신뢰도(35%) + 지역상권 기여도(25%)

| 상점 유형 | 색상 | 신뢰도 가중치 |
|---|---|---|
| 로컬푸드 직매장 | 🟠 주황 | 1.0 |
| 착한가격업소 | 🟢 초록 | 0.9 |
| 전통시장 | 🔵 파랑 | 0.8 |
| 일반 상점 | 🟣 보라 | 0.5 |

### 가격 제보 (PGIS 참여)

사이드바 제보 탭에서 품목·가격·상점명을 입력하면 지도에 즉시 반영됩니다.  
향후 크라우드소싱 DB 연동 시 실시간 가격 갱신 데이터로 활용 가능합니다.

---

## 📊 활용 데이터

| 데이터 | 출처 | 갱신 주기 |
|---|---|---|
| 농축수산물 소매가격 | 한국농수산식품유통공사 (aT) | 일 1회 |
| 전통시장 위치 | 공공데이터포털 (data.go.kr) | 분기 |
| 착한가격업소 현황 | 소상공인시장진흥공단 | 월 |
| 로컬푸드 직매장 | 농림축산식품부 | 월 |
| 소상공인 상가업종 | 소상공인진흥공단 상가업종 API | 월 |

현재 버전은 시드 데이터로 동작하며, API 키 설정 후 실데이터로 전환됩니다.

---

## 🚀 배포

### Streamlit Cloud (무료)

1. GitHub에 레포지토리 푸시
2. [share.streamlit.io](https://share.streamlit.io) 접속 → New app
3. 레포지토리 · 브랜치 · `app.py` 선택
4. Advanced settings → Secrets에 API 키 입력
5. Deploy 클릭

### Hugging Face Spaces (무료 대안)

```
Runtime: Streamlit
Python: 3.10
```

`requirements.txt`와 `app.py`를 Space에 업로드하면 자동 배포됩니다.

---

## 🔧 확장 로드맵

- [ ] **Kakao Geocoding API 연동** — 주소 검색 → 좌표 변환 실사용
- [ ] **aT 공공 API 실시간 연동** — 일 1회 `@st.cache_data(ttl=86400)` 캐싱
- [ ] **영수증 OCR 연동** — 사진 업로드 → 품목·가격 자동 추출 후 제보
- [ ] **크라우드소싱 DB** — Supabase 또는 Firebase로 제보 데이터 영속화
- [ ] **다중 페이지 분리** — `pages/` 구조로 데이터 탐색·소개 화면 분리
- [ ] **사용자 장보기 기록** — 세션 저장 → 주간 지출 분석

---

## 🛠️ 기술 스택

```
Streamlit 1.45      웹 앱 프레임워크
Folium 0.19         지도 렌더링 (Leaflet.js 래퍼)
streamlit-folium    Folium ↔ Streamlit 브리지
GeoPandas 1.0       공간 데이터 처리
Shapely 2.0         기하학 연산
Pandas 2.2          데이터 조작
NumPy 1.26          수치 계산
SciPy 1.13          선형 계획법 (linprog)
Plotly 5.24         인터랙티브 차트
Requests 2.32       공공 API HTTP 클라이언트
```

---

## 📄 라이선스

MIT License © 2026 LocalCart Project

---

## 🙏 데이터 출처 및 감사

- **농림축산식품부 · 한국농수산식품유통공사(aT)** — 농축수산물 가격 공공데이터
- **소상공인시장진흥공단** — 착한가격업소 · 전통시장 데이터
- **행정안전부 · 공공데이터포털** — 행정구역 및 상점 위치 데이터
- **Folium** — Python 기반 Leaflet.js 지도 라이브러리
- **Streamlit** — 데이터 앱 프레임워크
