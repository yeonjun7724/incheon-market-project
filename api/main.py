"""LocalCart API — 기존 파이썬 로직(core/*)을 REST로 노출."""
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import stores, items, recipes, basket, routes, prices, reports

app = FastAPI(title="LocalCart API", version="0.1.0")

# 허용 오리진: 로컬 + Vercel 배포 도메인 (환경변수로 추가)
_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.getenv("WEB_ORIGIN"):
    _origins += os.getenv("WEB_ORIGIN").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",  # 프리뷰 배포까지 허용
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (stores, items, recipes, basket, routes, prices, reports):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"ok": True, "service": "localcart-api"}
