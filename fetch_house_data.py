"""
제주 단독/다가구 매매 실거래 데이터 수집기 v1
- 기간: 2024년 1월 ~ 2026년 8월 (32개월)
- 지역: 제주시(50110) + 서귀포시(50130)
- 저장: jeju_house_trades.db (SQLite, 아파트 DB와 별도)
- API: 국토교통부 단독/다가구 매매 실거래가 자료 (신규 API, 영문 태그)
  endpoint: getRTMSDataSvcSHTrade
  태그: umdNm, houseType, totalFloorAr, plottageAr, dealYear/Month/Day, dealAmount 등

실행 방법:
  pip install requests
  python fetch_house_data.py
"""

import requests
import sqlite3
import xml.etree.ElementTree as ET
import time
import os
from datetime import datetime

# ─── 설정 ───────────────────────────────────────────────────
API_KEY   = "NPZLvMh4GeHcihxwk2DxXDLdchkDBEgdMeIxwZDVHbbXtRMPhsGqpzHBT9LqpaBGYOgZYZqQH8YdHNI1UEg0KQ=="
# 단독/다가구 전용 엔드포인트
BASE_URL  = "https://apis.data.go.kr/1613000/RTMSDataSvcSHTrade/getRTMSDataSvcSHTrade"
LAWD_CDS  = {"50110": "제주시", "50130": "서귀포시"}
START_YM  = "202401"
END_YM    = "202608"
DB_PATH   = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jeju_house_trades.db")
DELAY_SEC = 0.6
MAX_RETRY = 3
RETRY_DELAY = 5.0
# ────────────────────────────────────────────────────────────

# 실제 오류 코드 (03=데이터없음은 정상)
ERROR_CODES = {"01","02","04","05","10","11","12","20","22","30","31","32"}


def get_year_months(start: str, end: str) -> list:
    result = []
    sy, sm = int(start[:4]), int(start[4:])
    ey, em = int(end[:4]), int(end[4:])
    y, m = sy, sm
    while (y, m) <= (ey, em):
        result.append(f"{y}{m:02d}")
        m += 1
        if m > 12:
            m = 1
            y += 1
    return result


def init_db(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS house_trades (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            sigungu         TEXT,       -- 제주시 / 서귀포시
            lawd_cd         TEXT,       -- 50110 / 50130
            dong            TEXT,       -- umdNm  법정동
            house_type      TEXT,       -- houseType  단독/다가구 구분
            jibun           TEXT,       -- jibun  지번
            total_floor_ar  REAL,       -- totalFloorAr  연면적(㎡)
            plottage_ar     REAL,       -- plottageAr  대지면적(㎡)
            price_man       INTEGER,    -- dealAmount  거래금액(만원)
            price_eok       REAL,       -- 억원 환산
            build_year      TEXT,       -- buildYear  건축년도
            deal_type       TEXT,       -- dealingGbn  거래유형(중개/직거래)
            cancel_yn       TEXT,       -- cdealType  해제여부
            cancel_day      TEXT,       -- cdealDay  해제사유발생일
            seller_type     TEXT,       -- slerGbn  매도자 유형
            buyer_type      TEXT,       -- buyerGbn  매수자 유형
            year            INTEGER,    -- dealYear
            month           INTEGER,    -- dealMonth
            day             INTEGER,    -- dealDay
            trade_date      TEXT,       -- YYYY-MM-DD
            fetched_at      TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_trade_date ON house_trades(trade_date)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dong       ON house_trades(dong)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_type       ON house_trades(house_type)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_price      ON house_trades(price_man)")
    conn.commit()


def fetch_month(lawd_cd: str, ym: str, attempt: int = 1):
    """
    성공: list(records) 반환 (빈 리스트도 성공)
    실패: None 반환
    """
    encoded_key = requests.utils.quote(API_KEY, safe="")
    url = (f"{BASE_URL}"
           f"?serviceKey={encoded_key}"
           f"&LAWD_CD={lawd_cd}"
           f"&DEAL_YMD={ym}"
           f"&numOfRows=1000"
           f"&pageNo=1")

    try:
        resp = requests.get(url, timeout=30)
    except requests.RequestException as e:
        print(f"\n    ↳ 연결 오류 (시도 {attempt}): {e}")
        return None

    if resp.status_code != 200:
        print(f"\n    ↳ HTTP {resp.status_code} (시도 {attempt})")
        return None

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError as e:
        print(f"\n    ↳ XML 파싱 오류 (시도 {attempt}): {e}")
        return None

    result_code = root.findtext(".//resultCode", "").strip()
    result_msg  = root.findtext(".//resultMsg", "").strip()

    # 03 = 데이터없음 → 정상 (0건)
    if result_code == "03":
        return []

    if result_code in ERROR_CODES:
        print(f"\n    ↳ API 오류 [{result_code}] {result_msg} (시도 {attempt})")
        return None

    # 신규 API XML 태그 파싱
    rows = []
    for item in root.findall(".//item"):
        def g(tag, _item=item):
            el = _item.find(tag)
            return (el.text or "").strip() if el is not None else ""

        price_raw = g("dealAmount").replace(",", "").strip()
        try:
            price_man = int(price_raw)
        except ValueError:
            continue  # 금액 없으면 건너뜀

        try:
            total_floor_ar = float(g("totalFloorAr") or 0)
        except ValueError:
            total_floor_ar = 0.0

        try:
            plottage_ar = float(g("plottageAr") or 0)
        except ValueError:
            plottage_ar = 0.0

        yr  = g("dealYear")
        mo  = g("dealMonth").zfill(2)
        day = g("dealDay").zfill(2)

        rows.append({
            "dong":           g("umdNm"),
            "house_type":     g("houseType"),   # 단독 or 다가구
            "jibun":          g("jibun"),
            "total_floor_ar": total_floor_ar,
            "plottage_ar":    plottage_ar,
            "price_man":      price_man,
            "price_eok":      round(price_man / 10000, 4),
            "build_year":     g("buildYear"),
            "deal_type":      g("dealingGbn"),
            "cancel_yn":      g("cdealType"),
            "cancel_day":     g("cdealDay"),
            "seller_type":    g("slerGbn"),
            "buyer_type":     g("buyerGbn"),
            "year":           int(yr) if yr else 0,
            "month":          int(mo) if mo else 0,
            "day":            int(day) if day else 0,
            "trade_date":     f"{yr}-{mo}-{day}" if yr else "",
        })
    return rows


def fetch_with_retry(lawd_cd: str, ym: str):
    for attempt in range(1, MAX_RETRY + 1):
        result = fetch_month(lawd_cd, ym, attempt)
        if result is not None:
            return result
        if attempt < MAX_RETRY:
            print(f"    ↳ {RETRY_DELAY}초 후 재시도...", flush=True)
            time.sleep(RETRY_DELAY)
    return None


def save_rows(conn, rows, sigungu, lawd_cd, fetched_at):
    conn.executemany("""
        INSERT INTO house_trades
            (sigungu, lawd_cd, dong, house_type, jibun, total_floor_ar, plottage_ar,
             price_man, price_eok, build_year, deal_type, cancel_yn, cancel_day,
             seller_type, buyer_type, year, month, day, trade_date, fetched_at)
        VALUES
            (:sigungu, :lawd_cd, :dong, :house_type, :jibun, :total_floor_ar, :plottage_ar,
             :price_man, :price_eok, :build_year, :deal_type, :cancel_yn, :cancel_day,
             :seller_type, :buyer_type, :year, :month, :day, :trade_date, :fetched_at)
    """, [{**r, "sigungu": sigungu, "lawd_cd": lawd_cd, "fetched_at": fetched_at}
          for r in rows])
    conn.commit()


def main():
    year_months = get_year_months(START_YM, END_YM)
    total_calls = len(LAWD_CDS) * len(year_months)

    print(f"{'═'*50}")
    print(f"  제주 단독/다가구 실거래 데이터 수집기 v1")
    print(f"  기간 : {START_YM} ~ {END_YM}  ({len(year_months)}개월)")
    print(f"  지역 : 제주시(50110) + 서귀포시(50130)")
    print(f"  호출 : 총 {total_calls}회")
    print(f"  저장 : {DB_PATH}")
    print(f"{'═'*50}\n")

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("기존 DB 삭제 후 새로 생성\n")

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    fetched_at  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    grand_total = 0
    call_no     = 0
    failed      = []

    for lawd_cd, sigungu in LAWD_CDS.items():
        for ym in year_months:
            call_no += 1
            label = f"{sigungu} {ym[:4]}-{ym[4:]}"
            print(f"[{call_no:>3}/{total_calls}] {label} ... ", end="", flush=True)

            rows = fetch_with_retry(lawd_cd, ym)

            if rows is None:
                print("❌ 최종 실패")
                failed.append((sigungu, ym))
            elif len(rows) == 0:
                print("0건")
            else:
                save_rows(conn, rows, sigungu, lawd_cd, fetched_at)
                print(f"{len(rows):>4}건 저장")
                grand_total += len(rows)

            time.sleep(DELAY_SEC)

    conn.close()

    print(f"\n{'═'*50}")
    print(f"  ✅ 완료!  총 {grand_total:,}건 저장")
    print(f"  DB: {DB_PATH}")
    if failed:
        print(f"\n  ⚠ 실패 목록 ({len(failed)}건):")
        for sigungu, ym in failed:
            print(f"    - {sigungu} {ym[:4]}-{ym[4:]}")
    else:
        print("  실패 없음 — 전체 수집 성공!")
    print(f"{'═'*50}")
    print("""
  저장 컬럼:
    dong(법정동), house_type(단독/다가구),
    jibun(지번), total_floor_ar(연면적㎡),
    plottage_ar(대지면적㎡), price_man(만원),
    price_eok(억), build_year(건축년도),
    deal_type(거래유형), cancel_yn(해제여부),
    seller_type(매도자), buyer_type(매수자),
    trade_date(YYYY-MM-DD)
    """)


if __name__ == "__main__":
    main()
