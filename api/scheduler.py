"""scheduler.py — APScheduler, 수동 트리거 전용"""
import logging
from apscheduler.schedulers.background import BackgroundScheduler
from core.price_merge import build_price_table, save_price_table
from core.db import get_engine, ensure_postgis

logger = logging.getLogger("localcart.scheduler")

_engine = None


def get_db_engine():
    global _engine
    if _engine is None:
        _engine = get_engine()
        ensure_postgis(_engine)
    return _engine


def run_price_sync(target_date=None):
    """실제 동기화 작업 — 라우터에서 직접 호출"""
    logger.info(f"[sync] 시작 target_date={target_date}")
    try:
        df = build_price_table(target_date)
        save_price_table(df, get_db_engine())
        logger.info(f"[sync] 완료 — {len(df)}행 저장")
        return {"ok": True, "rows": len(df)}
    except Exception as e:
        logger.error(f"[sync] 실패: {e}")
        return {"ok": False, "error": str(e)}


scheduler = BackgroundScheduler(timezone="Asia/Seoul")
# 매일 새벽 6시 자동 실행 원하면 아래 주석 해제
# scheduler.add_job(run_price_sync, "cron", hour=6, minute=0)


def start():
    scheduler.start()


def stop():
    scheduler.shutdown()
