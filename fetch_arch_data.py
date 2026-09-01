"""
제주 건축 인허가 기본개요 수집기 v1
- API: 건축HUB 건축인허가정보 서비스 (ArchPmsHubService)
- 기능: getApBasisOulnInfo (건축인허가 기본개요 조회)
- 필터: 사용승인일(useAprDay) 2024년 이후
- 저장: jeju_arch_permits.db (SQLite)

실행:
  pip install requests
  python fetch_arch_data.py
"""

import requests
import sqlite3
import xml.etree.ElementTree as ET
import time
import os
from datetime import datetime

# ─── 설정 ───────────────────────────────────────────────────
API_KEY  = "NPZLvMh4GeHcihxwk2DxXDLdchkDBEgdMeIxwZDVHbbXtRMPhsGqpzHBT9LqpaBGYOgZYZqQH8YdHNI1UEg0KQ=="
BASE_URL = "http://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo"
DB_PATH  = os.path.join(os.path.dirname(os.path.abspath(__file__)), "jeju_arch_permits.db")
FROM_DATE    = "20240101"   # 건축허가일 OR 사용승인일 기준
DELAY_SEC    = 0.5
MAX_RETRY    = 3
# ────────────────────────────────────────────────────────────

# 제주도 시군구 + 법정동 코드
JEJU_DONGS = {
    "50110": {  # 제주시
        # 읍면
        "25000": "한림읍", "31000": "애월읍", "35000": "구좌읍",
        "38000": "조천읍", "45000": "한경면", "46000": "추자면", "47000": "우도면",
        # 동
        "10100": "일도일동", "10200": "일도이동",
        "10300": "이도일동", "10400": "이도이동",
        "10500": "삼도일동", "10600": "삼도이동",
        "10700": "용담일동", "10800": "용담이동",
        "10900": "건입동",
        "11000": "화북일동", "11100": "화북이동",
        "11200": "삼양일동", "11300": "삼양이동", "11400": "삼양삼동",
        "11500": "봉개동",
        "11600": "아라일동", "11700": "아라이동",
        "11800": "오라일동", "11900": "오라이동", "12000": "오라삼동",
        "12100": "연동",   "12200": "노형동",
        "12300": "외도일동", "12400": "외도이동",
        "12500": "이호일동", "12600": "이호이동",
        "12700": "도두일동", "12800": "도두이동",
    },
    "50130": {  # 서귀포시
        # 읍면
        "21000": "대정읍", "26000": "남원읍", "32000": "성산읍",
        "41000": "안덕면", "43000": "표선면",
        # 동
        "51000": "서귀동", "52000": "법환동", "53000": "강정동", "54000": "색달동",
        "55000": "송산동", "56000": "정방동", "57000": "중앙동", "58000": "천지동",
        "59000": "효돈동", "60000": "영천동",
        "61000": "동홍동", "62000": "서홍동",
        "63000": "대륜동", "64000": "대천동", "65000": "중문동",
        "66000": "예래동", "67000": "호근동",
    }
}

SIGUNGU_NAME = {"50110": "제주시", "50130": "서귀포시"}


def init_db(conn):
    conn.execute("""
        CREATE TABLE IF NOT EXISTS arch_permits (
            id              INTEGER PRIMARY KEY AUTOINCREMENT,
            sigungu         TEXT,       -- 제주시 / 서귀포시
            sigungu_cd      TEXT,       -- 50110 / 50130
            dong            TEXT,       -- 법정동명
            bjdong_cd       TEXT,       -- 법정동코드
            plat_plc        TEXT,       -- 대지위치 (주소)
            bld_nm          TEXT,       -- 건물명
            arch_gb_cd_nm   TEXT,       -- 건축구분 (신축/증축/용도변경 등)
            main_purps_cd_nm TEXT,      -- 주용도
            plat_area       REAL,       -- 대지면적(㎡)
            arch_area       REAL,       -- 건축면적(㎡)
            tot_area        REAL,       -- 연면적(㎡)
            bc_rat          REAL,       -- 건폐율(%)
            vl_rat          REAL,       -- 용적률(%)
            hhld_cnt        INTEGER,    -- 세대수
            ho_cnt          INTEGER,    -- 호수
            arch_pms_day    TEXT,       -- 건축허가일 (YYYYMMDD)
            use_apr_day     TEXT,       -- 사용승인일 (YYYYMMDD)
            jimok_cd_nm     TEXT,       -- 지목
            jiyuk_cd_nm     TEXT,       -- 지역코드명 (용도지역)
            mgm_pmsrgst_pk  TEXT,       -- 관리허가대장PK
            fetched_at      TEXT
        )
    """)
    conn.execute("CREATE INDEX IF NOT EXISTS idx_use_apr_day ON arch_permits(use_apr_day)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_dong        ON arch_permits(dong)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_arch_gb     ON arch_permits(arch_gb_cd_nm)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_purps       ON arch_permits(main_purps_cd_nm)")
    conn.commit()


def fetch_dong(sigungu_cd, bjdong_cd, page=1):
    encoded_key = requests.utils.quote(API_KEY, safe="")
    url = (f"{BASE_URL}"
           f"?serviceKey={encoded_key}"
           f"&sigunguCd={sigungu_cd}"
           f"&bjdongCd={bjdong_cd}"
           f"&numOfRows=1000"
           f"&pageNo={page}")
    try:
        resp = requests.get(url, timeout=30)
    except requests.RequestException as e:
        return None, 0

    if resp.status_code != 200:
        return None, 0

    try:
        root = ET.fromstring(resp.text)
    except ET.ParseError:
        return None, 0

    result_code = root.findtext(".//resultCode", "").strip()
    if result_code not in ("", "00", "000", "0000"):
        result_msg = root.findtext(".//resultMsg", "").strip()
        if "No" in result_msg or result_code == "03":
            return [], 0
        return None, 0

    try:
        total_count = int(root.findtext(".//totalCount", "0"))
    except ValueError:
        total_count = 0

    rows = []
    for item in root.findall(".//item"):
        def g(tag, _i=item):
            el = _i.find(tag)
            return (el.text or "").strip() if el is not None else ""
        def f(tag, _i=item):
            try: return float(g(tag, _i) or 0)
            except: return 0.0
        def n(tag, _i=item):
            try: return int(g(tag, _i) or 0)
            except: return 0

        rows.append({
            "plat_plc":        g("platPlc"),
            "bld_nm":          g("bldNm"),
            "arch_gb_cd_nm":   g("archGbCdNm"),
            "main_purps_cd_nm":g("mainPurpsCdNm"),
            "plat_area":       f("platArea"),
            "arch_area":       f("archArea"),
            "tot_area":        f("totArea"),
            "bc_rat":          f("bcRat"),
            "vl_rat":          f("vlRat"),
            "hhld_cnt":        n("hhldCnt"),
            "ho_cnt":          n("hoCnt"),
            "arch_pms_day":    g("archPmsDay"),
            "use_apr_day":     g("useAprDay"),
            "jimok_cd_nm":     g("jimokCdNm"),
            "jiyuk_cd_nm":     g("jiyukCdNm"),
            "mgm_pmsrgst_pk":  g("mgmPmsrgstPk"),
        })
    return rows, total_count


def save_rows(conn, rows, sigungu, sigungu_cd, dong, bjdong_cd, fetched_at):
    conn.executemany("""
        INSERT INTO arch_permits
            (sigungu, sigungu_cd, dong, bjdong_cd,
             plat_plc, bld_nm, arch_gb_cd_nm, main_purps_cd_nm,
             plat_area, arch_area, tot_area, bc_rat, vl_rat,
             hhld_cnt, ho_cnt, arch_pms_day, use_apr_day,
             jimok_cd_nm, jiyuk_cd_nm, mgm_pmsrgst_pk, fetched_at)
        VALUES
            (:sigungu, :sigungu_cd, :dong, :bjdong_cd,
             :plat_plc, :bld_nm, :arch_gb_cd_nm, :main_purps_cd_nm,
             :plat_area, :arch_area, :tot_area, :bc_rat, :vl_rat,
             :hhld_cnt, :ho_cnt, :arch_pms_day, :use_apr_day,
             :jimok_cd_nm, :jiyuk_cd_nm, :mgm_pmsrgst_pk, :fetched_at)
    """, [{**r,
           "sigungu": sigungu, "sigungu_cd": sigungu_cd,
           "dong": dong, "bjdong_cd": bjdong_cd,
           "fetched_at": fetched_at}
          for r in rows])
    conn.commit()


def main():
    total_dongs = sum(len(v) for v in JEJU_DONGS.values())
    print(f"{'═'*55}")
    print(f"  제주 건축 인허가 기본개요 수집기 v1")
    print(f"  필터: 건축허가일 OR 사용승인일 {FROM_DATE} 이후")
    print(f"  대상: 제주시 + 서귀포시 ({total_dongs}개 법정동)")
    print(f"  저장: {DB_PATH}")
    print(f"{'═'*55}\n")

    if os.path.exists(DB_PATH):
        os.remove(DB_PATH)
        print("기존 DB 삭제 후 새로 생성\n")

    conn = sqlite3.connect(DB_PATH)
    init_db(conn)

    fetched_at  = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    grand_total = 0
    saved_total = 0
    call_no     = 0
    failed      = []

    for sigungu_cd, dongs in JEJU_DONGS.items():
        sigungu = SIGUNGU_NAME[sigungu_cd]
        for bjdong_cd, dong in dongs.items():
            call_no += 1
            label = f"{sigungu} {dong}"
            print(f"[{call_no:>2}/{total_dongs}] {label:<16} ... ", end="", flush=True)

            # 1페이지 조회
            rows, total = fetch_dong(sigungu_cd, bjdong_cd, page=1)

            if rows is None:
                print("❌ 실패")
                failed.append(label)
                time.sleep(DELAY_SEC)
                continue

            if not rows:
                print("0건")
                time.sleep(DELAY_SEC)
                continue

            # 추가 페이지 조회 (1,000건 초과 시)
            all_rows = list(rows)
            if total > 1000:
                extra_pages = (total - 1) // 1000
                for p in range(2, extra_pages + 2):
                    extra, _ = fetch_dong(sigungu_cd, bjdong_cd, page=p)
                    if extra:
                        all_rows.extend(extra)
                    time.sleep(DELAY_SEC)

            grand_total += len(all_rows)

            # 건축허가일 OR 사용승인일 2024년 이후 필터링
            def is_from_2024(r):
                pms = (r["arch_pms_day"] or "").strip()
                apr = (r["use_apr_day"]  or "").strip()
                return (pms and pms >= FROM_DATE) or (apr and apr >= FROM_DATE)

            filtered = [r for r in all_rows if is_from_2024(r)]

            if filtered:
                save_rows(conn, filtered, sigungu, sigungu_cd, dong, bjdong_cd, fetched_at)
                saved_total += len(filtered)
                print(f"전체 {len(all_rows):>5}건 → 필터 {len(filtered):>4}건 저장")
            else:
                print(f"전체 {len(all_rows):>5}건 → 해당 없음")

            time.sleep(DELAY_SEC)

    conn.close()

    print(f"\n{'═'*55}")
    print(f"  ✅ 완료!")
    print(f"  조회 총계  : {grand_total:,}건")
    print(f"  저장 (필터): {saved_total:,}건  (허가일 OR 사용승인 {FROM_DATE} 이후)")
    print(f"  DB: {DB_PATH}")
    if failed:
        print(f"\n  ⚠ 실패 목록:")
        for f in failed:
            print(f"    - {f}")
    print(f"{'═'*55}")


if __name__ == "__main__":
    main()
