# 🛒 절약 장보기 추천 앱

물가 상승 속 지역 상점을 활용한 예산 장보기 AI 추천 플랫폼

## 주요 기능

- **AI 맞춤 장보기 추천** — 예산·식재료 목록을 입력하면 최적 쇼핑 루트 생성
- **지역 상점 연계** — 전통시장, 한살림, 농협, 로컬푸드 등 동네 가게 우선 추천
- **AI 장보기 상담** — 제철 식재료, 보관법, 가격 비교 등 실시간 채팅

## 로컬 실행

```bash
pip install -r requirements.txt
export ANTHROPIC_API_KEY=sk-ant-...
streamlit run app.py
```

## Railway 배포

1. GitHub에 이 레포 push
2. Railway → New Project → Deploy from GitHub
3. 환경변수 설정:
   - `ANTHROPIC_API_KEY` = `sk-ant-...`
4. `railway.toml` 자동 인식 → 배포 완료

## 환경변수

| 변수명 | 설명 | 필수 |
|--------|------|------|
| `ANTHROPIC_API_KEY` | Anthropic API 키 | ✅ |

## 디렉토리 구조

```
budget_mart/
├── app.py              # 메인 Streamlit 앱
├── requirements.txt
├── railway.toml        # Railway 배포 설정
└── README.md
```

## 다음 단계 (Phase 2)

- [ ] 실제 위치 기반 가게 검색 (카카오맵 API)
- [ ] 시민 물가 제보 기능 (식재료별 가격 공유)
- [ ] 주간 장보기 리스트 저장/공유
- [ ] 가게별 오늘의 특가 게시판
- [ ] PostgreSQL 연동 (물가 트렌드 데이터 축적)
