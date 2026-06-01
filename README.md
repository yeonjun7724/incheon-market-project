# LocalCart 🛒

예산 맞춤 인천 지역상권 장보기 추천 플랫폼.
전체화면 지도 + 바텀시트 UI + AI 에이전트(요리→재료) + 경로추천.

## 구조 (모노레포)

| 폴더 | 스택 | 배포 |
|------|------|------|
| `web/` | Next.js 15 (App Router) · TypeScript · Tailwind · react-map-gl(Mapbox) · Zustand | **Vercel** |
| `api/` | FastAPI · pandas · scipy(LP) — 기존 파이썬 로직 재사용 | **Railway** |

## 빠른 시작

### 1) 백엔드 (api)
```bash
cd api
python -m venv .venv && source .venv/bin/activate   # win: .venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
# → http://localhost:8000/docs (스웨거로 API 확인)
```

### 2) 프론트 (web)
```bash
cd web
npm install
cp .env.example .env.local        # NEXT_PUBLIC_MAPBOX_TOKEN 채우기
npm run dev
# → http://localhost:3000
```
> Mapbox 토큰: account.mapbox.com → Tokens → Default public token (무료 월 5만 로드)

## API 엔드포인트
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/stores?lat&lng&radius&gu` | 반경/구 점포 |
| GET | `/stores/center` | 지도 초기 중심 |
| GET | `/items` | 품목(+KAMIS 실시간가) |
| GET | `/recipes/{dish}` | 요리→재료 (AI 에이전트) |
| GET | `/recipes/tip/{name}` | 재료 구매 팁 |
| POST | `/basket/optimize` | 예산 맞춤 장바구니 LP |
| POST | `/routes/recommend` | 경로 3전략 |
| GET/POST | `/reports` | 가격 제보 |

## 배포
- **Railway(api)**: Root Directory=`api`, Start=`uvicorn main:app --host 0.0.0.0 --port $PORT`, 환경변수=`.env.example` 참고
- **Vercel(web)**: Root Directory=`web`, 환경변수 `NEXT_PUBLIC_MAPBOX_TOKEN`, `NEXT_PUBLIC_API_BASE`(=Railway URL)
- CORS: api의 `WEB_ORIGIN`에 Vercel 도메인 추가 (vercel.app 프리뷰는 자동 허용)

## 진행 상태
- [x] FastAPI 7개 라우터 (전부 동작 검증)
- [x] Next.js 지도 + 바텀시트 + 네비
- [x] 조건설정 패널 (장바구니 LP 연동)
- [x] 장바구니 · AI 에이전트 패널 (요리검색→재료 ON/OFF→최저~최고가)
- [x] 추천경로 패널 (3전략 A/B/C + 지도 경로 표시)
- [x] 상점별 체크리스트 패널 (순서대로 체크·예상가·진행률)
- [x] 즐겨찾기 패널 (자주 가는 가게 / 자주 사는 품목)
- [x] 가격 제보 패널 (폼 + 최근 제보)
- [x] `npm run build` 프로덕션 빌드 통과 / `tsc --noEmit` 통과

> 다음(선택): 지도 마커 클러스터링, 검색바 실제 동작, 재료 구매팁(?) 팝업, 모바일 제스처(바텀시트 드래그)
