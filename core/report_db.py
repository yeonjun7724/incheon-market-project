"""
core/report_db.py
시민 가격 제보 영속화 — 세션 메모리 → 실제 DB

백엔드 2종 (자동 선택):
  - Supabase  : secrets.toml 에 SUPABASE_URL/KEY 있으면 클라우드 영속 (REST)
  - SQLite    : 기본값. 로컬 파일(reports.db) — 새로고침에도 보존
세션 state 와 달리 새로고침/재접속 후에도 제보가 남는다.
"""

import os
import sqlite3
from datetime import datetime
import requests
import streamlit as st

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_DB = os.path.join(_ROOT, "data", "reports.db")

SEED_REPORTS = [
    {"lat":37.4738,"lng":126.6216,"item":"배추","price":3500,"store":"신기시장","date":"2026-05-14"},
    {"lat":37.4419,"lng":126.7015,"item":"계란","price":6800,"store":"모래내시장","date":"2026-05-13"},
    {"lat":37.4862,"lng":126.7218,"item":"두부","price":1100,"store":"부평깡시장","date":"2026-05-12"},
]


def _supabase_cfg():
    try:
        return st.secrets["SUPABASE_URL"], st.secrets["SUPABASE_KEY"]
    except Exception:
        return None, None


# ── SQLite 백엔드 ──────────────────────────────────────────────
def _conn():
    return sqlite3.connect(_DB)


def _init_sqlite():
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS reports(
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            lat REAL, lng REAL, item TEXT, price INTEGER,
            store TEXT, date TEXT)""")
        n = c.execute("SELECT COUNT(*) FROM reports").fetchone()[0]
        if n == 0:                                   # 최초 1회 시드 주입
            for r in SEED_REPORTS:
                c.execute("INSERT INTO reports(lat,lng,item,price,store,date) VALUES(?,?,?,?,?,?)",
                          (r["lat"],r["lng"],r["item"],r["price"],r["store"],r["date"]))


def _sqlite_load():
    _init_sqlite()
    with _conn() as c:
        rows = c.execute("SELECT lat,lng,item,price,store,date FROM reports ORDER BY id DESC").fetchall()
    return [dict(zip(["lat","lng","item","price","store","date"], r)) for r in rows]


def _sqlite_add(rep):
    _init_sqlite()
    with _conn() as c:
        c.execute("INSERT INTO reports(lat,lng,item,price,store,date) VALUES(?,?,?,?,?,?)",
                  (rep["lat"],rep["lng"],rep["item"],rep["price"],rep["store"],rep["date"]))


# ── Supabase 백엔드 (REST) ────────────────────────────────────
def _sb_headers(key):
    return {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}


def _supabase_load(url, key):
    r = requests.get(f"{url}/rest/v1/reports?select=*&order=id.desc",
                     headers=_sb_headers(key), timeout=8)
    r.raise_for_status()
    return r.json()


def _supabase_add(url, key, rep):
    requests.post(f"{url}/rest/v1/reports", headers=_sb_headers(key),
                  json=rep, timeout=8).raise_for_status()


# ── 공개 API ──────────────────────────────────────────────────
def load_reports() -> list:
    url, key = _supabase_cfg()
    if url and key:
        try:
            return _supabase_load(url, key)
        except Exception:
            pass                                     # 실패 시 SQLite 폴백
    return _sqlite_load()


def add_report(item: str, price: int, store: str, lat: float, lng: float) -> dict:
    rep = {"lat": float(lat), "lng": float(lng), "item": item,
           "price": int(price), "store": store,
           "date": datetime.now().strftime("%Y-%m-%d")}
    url, key = _supabase_cfg()
    if url and key:
        try:
            _supabase_add(url, key, rep); return rep
        except Exception:
            pass
    _sqlite_add(rep)
    return rep


def backend_name() -> str:
    url, key = _supabase_cfg()
    return "Supabase (클라우드 영속)" if (url and key) else "SQLite (로컬 영속)"
