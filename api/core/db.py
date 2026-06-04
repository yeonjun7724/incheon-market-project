"""core/db.py — PostGIS 연결 (SQLAlchemy + psycopg2)"""
import os
from sqlalchemy import create_engine, text
from sqlalchemy.pool import NullPool


def get_engine():
    url = os.environ["DATABASE_URL"]
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg2://", 1)
    return create_engine(url, poolclass=NullPool)


def ensure_postgis(engine):
    """PostGIS 익스텐션 + daily_prices 테이블 초기화"""
    with engine.connect() as conn:
        conn.execute(text("CREATE EXTENSION IF NOT EXISTS postgis"))
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS daily_prices (
                id              SERIAL PRIMARY KEY,
                gds_lclsf_nm    TEXT,
                gds_mclsf_cd    TEXT,
                gds_mclsf_nm    TEXT,
                gds_sclsf_cd    TEXT,
                gds_sclsf_nm    TEXT,
                item_key        TEXT,
                unit_cd         TEXT,
                unit_nm         TEXT,
                최저가           NUMERIC,
                중앙값           NUMERIC,
                평균가           NUMERIC,
                최고가           NUMERIC,
                scsbd_dt        TIMESTAMP,
                소매가           NUMERIC,
                kamis_unit      TEXT,
                updated_at      TIMESTAMP DEFAULT NOW()
            )
        """))
        conn.commit()
