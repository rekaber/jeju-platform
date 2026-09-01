"""
DB → JSON 내보내기 스크립트
- jeju_apt_trades.db   → trade_data.json   (아파트)
- jeju_house_trades.db → house_data.json   (단독/다가구)

실행:
  python export_json.py

생성된 JSON 파일을 index.html과 같은 폴더에 두면
자동으로 지도에 실제 데이터가 표시됩니다.
"""

import sqlite3, json, os

BASE = os.path.dirname(os.path.abspath(__file__))

# ── 아파트 ──────────────────────────────────────────────
def export_apt():
    db = os.path.join(BASE, "jeju_apt_trades.db")
    if not os.path.exists(db):
        print("⚠ jeju_apt_trades.db 없음 — fetch_apt_data.py 먼저 실행하세요"); return

    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT sigungu, dong, apt_name, jibun, area, price_eok,
               floor, build_year, deal_type, cancel_yn,
               seller_type, buyer_type, trade_date, year, month, day
        FROM apt_trades
        WHERE cancel_yn = '' OR cancel_yn IS NULL   -- 해제 건 제외
        ORDER BY trade_date DESC
    """).fetchall()
    conn.close()

    out = []
    for r in rows:
        dong = (r["dong"] or "").strip()
        name = (r["apt_name"] or "").strip() or dong + " 아파트"
        # 카카오 지오코더용 주소 (시군구 + 법정동 + 단지명)
        road_addr = f"{r['sigungu']} {dong} {name}".strip()
        out.append({
            "name":       name,
            "dong":       dong,
            "sigungu":    r["sigungu"],
            "area":       r["area"],
            "price":      r["price_eok"],
            "date":       r["trade_date"],
            "year":       r["year"],
            "month":      r["month"],
            "floor":      r["floor"],
            "build_year": r["build_year"],
            "deal_type":  r["deal_type"],
            "roadAddr":   road_addr,
            "_tradeType": "apt",
            "_typeColor":  "#1976D2",
            "_typeLabel":  "아파트",
        })

    out_path = os.path.join(BASE, "trade_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✅ trade_data.json  저장 완료 — {len(out):,}건")

# ── 단독/다가구 ─────────────────────────────────────────
def export_house():
    db = os.path.join(BASE, "jeju_house_trades.db")
    if not os.path.exists(db):
        print("⚠ jeju_house_trades.db 없음 — fetch_house_data.py 먼저 실행하세요"); return

    conn = sqlite3.connect(db)
    conn.row_factory = sqlite3.Row
    rows = conn.execute("""
        SELECT sigungu, dong, house_type, jibun,
               total_floor_ar, plottage_ar, price_eok,
               build_year, deal_type, cancel_yn,
               seller_type, buyer_type, trade_date, year, month, day
        FROM house_trades
        WHERE cancel_yn = '' OR cancel_yn IS NULL
        ORDER BY trade_date DESC
    """).fetchall()
    conn.close()

    out = []
    for r in rows:
        dong = (r["dong"] or "").strip()
        htype = (r["house_type"] or "단독").strip()
        name = f"{dong} {htype}"
        road_addr = f"{r['sigungu']} {dong}".strip()
        out.append({
            "name":        name,
            "dong":        dong,
            "sigungu":     r["sigungu"],
            "house_type":  htype,
            "area":        r["total_floor_ar"],   # 연면적
            "plottage_ar": r["plottage_ar"],       # 대지면적
            "price":       r["price_eok"],
            "date":        r["trade_date"],
            "year":        r["year"],
            "month":       r["month"],
            "build_year":  r["build_year"],
            "deal_type":   r["deal_type"],
            "roadAddr":    road_addr,
            "_tradeType":  "house",
            "_typeColor":  "#00695C",
            "_typeLabel":  "단독/다가구",
        })

    out_path = os.path.join(BASE, "house_data.json")
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, separators=(",", ":"))
    print(f"✅ house_data.json  저장 완료 — {len(out):,}건")

if __name__ == "__main__":
    print("=" * 50)
    print("  제주 부동산 DB → JSON 내보내기")
    print("=" * 50)
    export_apt()
    export_house()
    print("=" * 50)
    print("  완료! trade_data.json, house_data.json을")
    print("  index.html과 같은 폴더에 두세요.")
    print("=" * 50)
