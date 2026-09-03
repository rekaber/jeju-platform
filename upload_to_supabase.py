"""
제주 부동산 플랫폼 — Supabase 데이터 업로드 스크립트
실행: python upload_to_supabase.py
필요: pip install requests
"""
import json, requests, os, time

SUPABASE_URL  = "https://boukipzpoapqotvauzrj.supabase.co"
SERVICE_KEY   = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJvdWtpcHpwb2FwcW90dmF1enJqIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4NzYzOTQyNywiZXhwIjoyMTAzMjE1NDI3fQ.PTvhyzG6qzV0aF4tNNcQdL2qNbP9MsUTefPqvDpCtSk"

HEADERS = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

def batch_insert(table, rows, batch_size=400):
    total = len(rows)
    ok = 0
    for i in range(0, total, batch_size):
        batch = rows[i:i+batch_size]
        r = requests.post(
            f"{SUPABASE_URL}/rest/v1/{table}",
            headers=HEADERS,
            json=batch,
            timeout=30
        )
        if r.status_code in (200, 201):
            ok += len(batch)
            print(f"  [{table}] {ok}/{total} 업로드됨")
        else:
            print(f"  오류 ({r.status_code}): {r.text[:200]}")
        time.sleep(0.3)
    return ok

# ── 1. 아파트 실거래 ──────────────────────────────────────
apt_path = os.path.join(SCRIPT_DIR, "trade_data.json")
if os.path.exists(apt_path):
    with open(apt_path, "r", encoding="utf-8") as f:
        apt_raw = json.load(f)

    # 기존 데이터 삭제 (재업로드 시 중복 방지)
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/apt_trades?id=gte.0",
                        headers={**HEADERS, "Prefer": "return=minimal"})
    print(f"기존 아파트 데이터 삭제: {r.status_code}")

    apt_rows = []
    for d in apt_raw:
        apt_rows.append({
            "name":     d.get("name", ""),
            "addr":     d.get("addr", ""),
            "sigungu":  d.get("sigungu", ""),
            "dong":     d.get("dong", ""),
            "roadaddr": d.get("roadAddr", ""),
            "type":     d.get("type", ""),
            "area":     d.get("area"),
            "price":    d.get("price"),
            "date":     d.get("date"),
            "floor":    d.get("floor"),
            "built":    d.get("built"),
            "lat":      d.get("lat"),
            "lng":      d.get("lng"),
        })

    print(f"\n아파트 실거래 {len(apt_rows)}건 업로드 시작...")
    batch_insert("apt_trades", apt_rows)
else:
    print("trade_data.json 파일 없음 — 스킵")

# ── 2. 토지 실거래 ──────────────────────────────────────
land_path = os.path.join(SCRIPT_DIR, "land_data.json")
if os.path.exists(land_path):
    with open(land_path, "r", encoding="utf-8") as f:
        land_raw = json.load(f)

    # 기존 데이터 삭제
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/land_trades?id=gte.0",
                        headers={**HEADERS, "Prefer": "return=minimal"})
    print(f"\n기존 토지 데이터 삭제: {r.status_code}")

    land_rows = []
    for d in land_raw:
        land_rows.append({
            "addr":       d.get("addr", ""),
            "sigungu":    d.get("sigungu", ""),
            "dong":       d.get("dong", ""),
            "jibun":      d.get("jibun", ""),
            "jimok":      d.get("jimok", ""),
            "yongdo":     d.get("yongdo", ""),
            "doro":       d.get("doro", ""),
            "area":       d.get("area"),
            "price":      d.get("price"),
            "per_m2":     d.get("perM2"),
            "date":       d.get("date"),
            "jibun_type": d.get("jibunType", ""),
            "trade_type": d.get("tradeType", ""),
            "lat":        d.get("lat"),
            "lng":        d.get("lng"),
        })

    print(f"토지 실거래 {len(land_rows)}건 업로드 시작...")
    batch_insert("land_trades", land_rows)
else:
    print("land_data.json 파일 없음 — 스킵")

print("\n✅ 업로드 완료!")

# ── 3. 인구이동 데이터 ──────────────────────────────────────
mig_path = os.path.join(SCRIPT_DIR, "migration_data.json")
if os.path.exists(mig_path):
    with open(mig_path, "r", encoding="utf-8") as f:
        mig_raw = json.load(f)

    # 기존 삭제
    r = requests.delete(f"{SUPABASE_URL}/rest/v1/migration_data?id=gte.0",
                        headers={**HEADERS, "Prefer": "return=minimal"})
    print(f"\n기존 인구이동 데이터 삭제: {r.status_code}")

    months = mig_raw.get("months", [])
    mig_rows = []
    for direction, key in [("out", "outflow"), ("in", "inflow")]:
        for region_data in mig_raw.get(key, []):
            for i, month in enumerate(months):
                mig_rows.append({
                    "year_month": month,
                    "direction":  direction,
                    "region":     region_data["region"],
                    "count":      region_data["counts"][i] if i < len(region_data["counts"]) else 0,
                    "net_count":  region_data["nets"][i]   if i < len(region_data["nets"])   else 0,
                    "lat":        region_data.get("lat"),
                    "lng":        region_data.get("lng"),
                })

    print(f"인구이동 {len(mig_rows)}건 업로드 시작...")
    batch_insert("migration_data", mig_rows)
else:
    print("migration_data.json 파일 없음 — 스킵")
