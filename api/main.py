"""LocalCart API — 기존 파이썬 로직(core/*)을 REST로 노출."""
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import stores, items, recipes, basket, routes, prices, reports
from routers import admin
import scheduler as sched


@asynccontextmanager
async def lifespan(app: FastAPI):
    sched.start()
    yield
    sched.stop()


app = FastAPI(title="LocalCart API", version="0.1.0", lifespan=lifespan)

_origins = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]
if os.getenv("WEB_ORIGIN"):
    _origins += os.getenv("WEB_ORIGIN").split(",")

app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_methods=["*"],
    allow_headers=["*"],
)

for r in (stores, items, recipes, basket, routes, prices, reports, admin):
    app.include_router(r.router)


@app.get("/health")
def health():
    return {"ok": True, "service": "localcart-api"}
