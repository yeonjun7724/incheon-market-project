"""
core/kat_auction.py
한국농수산식품유통공사 전국 공영도매시장 실시간 경매정보 (katRealTime2/trades2)

처리 순서:
  1. 당일 전체 데이터 수집 (페이지네이션)
  2. 정규화 단가 계산: scsbd_prc / (qty × unit_qty)
  3. 정오(12:00) 기준 필터링 - 정오 데이터 없으면 가장 가까운 시간대 사용
  4. 단가 오류 보정: 정규화 단가 20원/kg 미만 행은 scsbd_prc / unit_qty로 재계산
     (scsbd_prc가 총액 대신 단위당 가격으로 잘못 기록된 케이스 대응)
     보정 후에도 범위를 벗어나면 제거
  5. 품목(gds_mclsf_nm) 기준 IQR 상하위 10% 극단값 제거
  6. 소분류(gds_sclsf_nm) 기준 집계 (최저가/중앙값/평균가/최고가)
  7. 대분류(gds_lclsf_nm) 기준으로 테이블 분리
"""

import os
import requests
import pandas as pd
from datetime import date, time as dtime

KAT_URL = "https://apis.data.go.kr/B552845/katRealTime2/trades2"
KAT_KEY = os.environ.get(
    "KAT_SERVICE_KEY",
    "/GV+xpNIXRXlTr3a7s91B/R9XYOghZmUJnJHXwIE7dUZ9SV12lee0Lg3kly8eEZZVCqYM8ts4quBtMDi8Ffvpw=="
)
PAGE_SIZE = 1000


def _fetch_all(target_date: str) -> list[dict]:
    """전체 페이지 수집. target_date = 'YYYY-MM-DD'"""
    rows = []
    page = 1
    while True:
        r = requests.get(KAT_URL, params={
            "serviceKey": KAT_KEY,
            "returnType": "json",
            "pageNo": page,
            "numOfRows": PAGE_SIZE,
            "cond[trd_clcln_ymd::EQ]": target_date,
        }, timeout=30)
        r.raise_for_status()
        body = r.json()["response"]["body"]
        items = body.get("items", {}).get("item", [])
        if not items:
            break
        rows.extend(items)
        total = int(body.get("totalCount", 0))
        if len(rows) >= total:
            break
        page += 1
    return rows


def _normalize(df: pd.DataFrame) -> pd.DataFrame:
    """정규화 단가 = scsbd_prc / (qty × unit_qty)"""
    df = df.copy()
    df["scsbd_prc"] = pd.to_numeric(df["scsbd_prc"], errors="coerce")
    df["qty"]       = pd.to_numeric(df["qty"],       errors="coerce")
    df["unit_qty"]  = pd.to_numeric(df["unit_qty"],  errors="coerce")

    denominator = df["qty"] * df["unit_qty"]
    df["정규화 단가"] = df["scsbd_prc"] / denominator.replace(0, float("nan"))
    return df


def _filter_noon(df: pd.DataFrame) -> pd.DataFrame:
    """
    scsbd_dt 기준 정오(12:00:00) 필터링.
    - 품목(gds_mclsf_nm)별로 정오와의 초 단위 차이를 계산
    - 차이가 가장 작은 시간대의 거래만 남김
    - 동점일 경우(같은 최소 차이) 해당 시간대 전체를 포함
    """
    df = df.copy()
    df["_scsbd_dt"] = pd.to_datetime(df["scsbd_dt"], errors="coerce")

    noon = pd.Timestamp("today").normalize() + pd.Timedelta(hours=12)
    # 날짜 무관하게 시간(초)만 비교
    df["_noon_diff"] = (
        df["_scsbd_dt"]
          .apply(lambda t: abs((t.hour * 3600 + t.minute * 60 + t.second) - 43200)
                 if pd.notna(t) else float("inf"))
    )

    # 품목별 최소 정오 차이
    min_diff = df.groupby("gds_mclsf_nm")["_noon_diff"].transform("min")
    df = df[df["_noon_diff"] == min_diff].copy()

    return df.drop(columns=["_scsbd_dt", "_noon_diff"]).reset_index(drop=True)


def _correct_unit_price_errors(df: pd.DataFrame,
                                min_price: float = 20.0,
                                max_price: float = 200000.0) -> pd.DataFrame:
    """scsbd_prc가 총액 대신 단위당 가격으로 잘못 기록된 행을 탐지·보정.

    탐지: 정규화 단가 < min_price(원/kg)
    보정: scsbd_prc / unit_qty 로 재계산
    보정 후 [min_price, max_price] 범위를 벗어나면 제거.
    """
    df = df.copy()
    error_mask = df["정규화 단가"] < min_price

    if error_mask.any():
        corrected = df.loc[error_mask, "scsbd_prc"] / df.loc[error_mask, "unit_qty"]
        valid_idx = corrected[(corrected >= min_price) & (corrected <= max_price)].index
        df.loc[valid_idx, "정규화 단가"] = corrected[valid_idx]

    return df[df["정규화 단가"] >= min_price].reset_index(drop=True)


def _remove_iqr_outliers(df: pd.DataFrame, group_col: str = "gds_mclsf_nm",
                          lower: float = 0.10, upper: float = 0.90) -> pd.DataFrame:
    """품목별 IQR 상하위 10% 극단값 제거"""
    quantiles = (
        df.groupby(group_col)["정규화 단가"]
          .quantile([lower, upper])
          .unstack()
          .rename(columns={lower: "_q_low", upper: "_q_high"})
          .reset_index()
    )
    df = df.merge(quantiles, on=group_col, how="left")
    mask = (df["정규화 단가"] >= df["_q_low"]) & (df["정규화 단가"] <= df["_q_high"])
    return df[mask].drop(columns=["_q_low", "_q_high"]).reset_index(drop=True)


_META_COLS = [
    "gds_lclsf_nm",
    "gds_mclsf_cd", "gds_mclsf_nm",
    "gds_sclsf_cd", "gds_sclsf_nm",
    "unit_cd", "unit_nm",
]


def _aggregate(df: pd.DataFrame) -> pd.DataFrame:
    """소분류별 최저가/중앙값/평균가/최고가 집계 후 메타 컬럼만 남김
    소분류가 '기타' 또는 '-'인 행은 중분류명으로 대체 후 집계.
    """
    df = df.copy()
    mask = df["gds_sclsf_nm"].isin(["기타", "-"])
    df.loc[mask, "gds_sclsf_nm"] = df.loc[mask, "gds_mclsf_nm"]

    stats = (
        df.groupby("gds_sclsf_nm")["정규화 단가"]
          .agg(최저가="min", 중앙값="median", 평균가="mean", 최고가="max")
          .round(1)
          .reset_index()
    )
    meta = df[_META_COLS].drop_duplicates(subset="gds_sclsf_nm")
    return meta.merge(stats, on="gds_sclsf_nm", how="left").reset_index(drop=True)


def fetch_auction_prices(target_date: str | None = None) -> dict[str, pd.DataFrame]:
    """
    경매 데이터 수집 → 정규화 → 극단값 제거 → 소분류 집계 → 대분류별 테이블 분리.

    Args:
        target_date: 'YYYY-MM-DD' (기본: 오늘)

    Returns:
        대분류명(gds_lclsf_nm)을 키로 하는 DataFrame dict.
        각 DataFrame은 소분류 1행 = 최저가/중앙값/평균가/최고가(원/kg) 구조.
    """
    if target_date is None:
        target_date = date.today().strftime("%Y-%m-%d")

    rows = _fetch_all(target_date)
    if not rows:
        return {}

    df = pd.DataFrame(rows)
    df = _normalize(df)
    df = _filter_noon(df)
    df = _correct_unit_price_errors(df)
    df = _remove_iqr_outliers(df)
    df = _aggregate(df)

    return {
        lclsf: group.drop(columns="gds_lclsf_nm").reset_index(drop=True)
        for lclsf, group in df.groupby("gds_lclsf_nm")
    }
