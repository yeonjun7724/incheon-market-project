import requests
from datetime import datetime, timedelta

from collections import Counter
import csv

SERVICE_KEY = "/GV+xpNIXRXlTr3a7s91B/R9XYOghZmUJnJHXwIE7dUZ9SV12lee0Lg3kly8eEZZVCqYM8ts4quBtMDi8Ffvpw=="  # 일반 인증키 입력

BASE_URL = "https://apis.data.go.kr/B552845/katRealTime2/trades2"


def call_api(date_str: str, page_no: int = 1, page_size: int = 1000) -> dict:
    params = {
        "serviceKey": SERVICE_KEY,
        "cond[trd_clcln_ymd::EQ]": date_str,
        "cond[whsl_mrkt_nm::LIKE]": "인천",
        "pageNo": page_no,
        "pageSize": page_size,
    }
    res = requests.get(BASE_URL, params=params, timeout=30)
    res.raise_for_status()
    return res.json()


def parse_items(body: dict) -> tuple:
    b = body.get("response", {}).get("body", {})
    total = b.get("totalCount", 0)
    items = b.get("items", {}).get("item", [])
    if isinstance(items, dict):
        items = [items]
    return items, total


def find_latest_date(days_back: int = 14) -> str:
    for i in range(days_back):
        date_str = (datetime.today() - timedelta(days=i)).strftime("%Y-%m-%d")
        items, _ = parse_items(call_api(date_str, page_size=1))
        if items:
            print(f"최근 경매일자: {date_str}")
            return date_str
        print(f"{date_str} 데이터 없음, 하루 전으로 이동...")
    raise RuntimeError("최근 14일 내 인천 경매 데이터 없음")


def fetch_all(date_str: str) -> list:
    all_items, page_no = [], 1
    while True:
        items, total = parse_items(call_api(date_str, page_no=page_no))
        if not items:
            break
        all_items.extend(items)
        print(f"페이지 {page_no} 수집 ({len(all_items)} / {total}건)")
        if len(all_items) >= total:
            break
        page_no += 1
    return all_items


def print_prices(items: list):
    if not items:
        print("데이터 없음")
        return

    # 낙찰일시 기준 정렬 (최신순)
    items_sorted = sorted(
        items,
        key=lambda x: x.get("scsbd_dt") or "",
        reverse=True
    )

    # 도매시장별 건수 요약
    print("\n[도매시장별 건수]")
    for nm, cnt in Counter(i.get("whsl_mrkt_nm", "") for i in items).most_common():
        print(f"  {nm}: {cnt}건")

    # 시간대별 건수 요약 (시간 단위)
    hour_counts = Counter(
        (i.get("scsbd_dt") or "")[:13]  # "2026-05-15 09" 형태
        for i in items
        if i.get("scsbd_dt")
    )
    print("\n[시간대별 거래 건수]")
    for hour_str, cnt in sorted(hour_counts.items()):
        bar = "█" * (cnt // 5)
        print(f"  {hour_str}시  {cnt:>5}건  {bar}")

    print(f"\n{'='*90}")
    print(f"  {'낙찰일시':<20} {'도매시장':<10} {'품목':<14} {'품종':<16} {'거래유형':<8} {'수량':>7} {'단위':<5} {'낙찰가':>10}")
    print(f"{'='*90}")

    for item in items_sorted:
        print(
            f"  {item.get('scsbd_dt', ''):<20}"
            f"  {item.get('whsl_mrkt_nm', ''):<10}"
            f"  {item.get('gds_mclsf_nm', ''):<14}"
            f"  {item.get('corp_gds_vrty_nm', ''):<16}"
            f"  {item.get('trd_se', ''):<8}"
            f"  {float(item.get('qty') or 0):>7.1f}"
            f"  {item.get('unit_nm', ''):<5}"
            f"  {float(item.get('scsbd_prc') or 0):>10,.0f}원"
        )

    print(f"{'='*90}")
    print(f"  총 {len(items)}건\n")

def save_to_csv(items: list, filename: str = None):
    if not items:
        print("저장할 데이터 없음")
        return

    if filename is None:
        filename = f"auction_incheon_{datetime.today().strftime('%Y%m%d')}.csv"

    with open(filename, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=items[0].keys())
        writer.writeheader()
        writer.writerows(items)

    print(f"저장 완료: {filename} ({len(items)}건)")

if __name__ == "__main__":
    print("=" * 50)
    print("  인천 공영도매시장 경매정보 조회")
    print("=" * 50)

    date_str = find_latest_date()
    items = fetch_all(date_str)
    print_prices(items)
    save_to_csv(items)
