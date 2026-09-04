"""
제주 부동산 플랫폼 — 로컬 JSON → Supabase 시드 업로드
기존 프로젝트: https://boukipzpoapqotvauzrj.supabase.co

사전 조건:
  1) supabase/schema.sql 을 SQL Editor에서 실행
  2) .env 또는 환경변수에 SUPABASE_SERVICE_KEY 설정

실행:
  python scripts/seed_from_json.py
"""
from __future__ import annotations

import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


load_dotenv(ROOT / ".env")

SUPABASE_URL = os.environ.get("SUPABASE_URL", "https://boukipzpoapqotvauzrj.supabase.co").rstrip("/")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")

if not SUPABASE_KEY:
    print("[ERROR] SUPABASE_SERVICE_KEY 가 필요합니다.")
    print("  → .env 파일에 SUPABASE_SERVICE_KEY=... 를 넣거나 환경변수로 설정하세요.")
    sys.exit(1)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal",
}


def request(method: str, path: str, body=None, extra_headers=None):
    headers = {**HEADERS, **(extra_headers or {})}
    data = None if body is None else json.dumps(body).encode("utf-8")
    req = urllib.request.Request(f"{SUPABASE_URL}{path}", data=data, method=method, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return r.status, r.read().decode("utf-8", errors="ignore")
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode("utf-8", errors="ignore")


def table_exists(table: str) -> bool:
    code, body = request("GET", f"/rest/v1/{table}?select=id&limit=1")
    if code == 200:
        return True
    if code == 404 or "PGRST205" in body:
        return False
    print(f"  [경고] {table} 확인 응답 {code}: {body[:160]}")
    return False


def clear_table(table: str) -> None:
    # id 가 있는 테이블 전부 삭제 (시드 재실행용)
    code, body = request("DELETE", f"/rest/v1/{table}?id=gte.0", extra_headers={"Prefer": "return=minimal"})
    print(f"  기존 {table} 삭제: {code}")


def batch_insert(table: str, rows: list, batch_size: int = 400) -> int:
    total = len(rows)
    ok = 0
    for i in range(0, total, batch_size):
        chunk = rows[i : i + batch_size]
        code, body = request("POST", f"/rest/v1/{table}", chunk)
        if code in (200, 201):
            ok += len(chunk)
            print(f"  [{table}] {ok}/{total}")
        else:
            print(f"  [{table}] INSERT 오류 ({code}): {body[:240]}")
            break
        time.sleep(0.15)
    return ok


def to_int(v):
    try:
        if v is None or v == "":
            return None
        return int(float(str(v).replace(",", "")))
    except Exception:
        return None


def to_float(v):
    try:
        if v is None or v == "":
            return None
        return float(str(v).replace(",", ""))
    except Exception:
        return None


def seed_apt():
    path = ROOT / "trade_data.json"
    if not path.exists():
        print("trade_data.json 없음 — 스킵")
        return
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for d in raw:
        rows.append(
            {
                "name": d.get("name") or "",
                "addr": d.get("addr") or d.get("roadAddr") or "",
                "sigungu": d.get("sigungu") or "",
                "dong": d.get("dong") or "",
                "roadaddr": d.get("roadaddr") or d.get("roadAddr") or "",
                "type": d.get("type") or d.get("_tradeType") or "apt",
                "area": to_float(d.get("area")),
                "price": to_float(d.get("price")),
                "date": d.get("date"),
                "floor": to_int(d.get("floor")),
                "built": to_int(d.get("built") or d.get("build_year")),
                "lat": to_float(d.get("lat")),
                "lng": to_float(d.get("lng")),
            }
        )
    clear_table("apt_trades")
    print(f"아파트 {len(rows)}건 업로드...")
    batch_insert("apt_trades", rows)


def seed_house():
    path = ROOT / "house_data.json"
    if not path.exists():
        print("house_data.json 없음 — 스킵")
        return
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for d in raw:
        rows.append(
            {
                "name": d.get("name") or "",
                "sigungu": d.get("sigungu") or "",
                "dong": d.get("dong") or "",
                "addr": d.get("addr") or d.get("roadAddr") or "",
                "roadaddr": d.get("roadaddr") or d.get("roadAddr") or "",
                "house_type": d.get("house_type") or "",
                "type": d.get("type") or d.get("_tradeType") or "house",
                "area": to_float(d.get("area")),
                "plottage_ar": to_float(d.get("plottage_ar") or d.get("land_area")),
                "price": to_float(d.get("price")),
                "date": d.get("date"),
                "built": to_int(d.get("built") or d.get("build_year")),
                "lat": to_float(d.get("lat")),
                "lng": to_float(d.get("lng")),
            }
        )
    clear_table("house_trades")
    print(f"단독/다가구 {len(rows)}건 업로드...")
    batch_insert("house_trades", rows)


def seed_land():
    path = ROOT / "land_data.json"
    if not path.exists():
        print("land_data.json 없음 — 스킵")
        return
    raw = json.loads(path.read_text(encoding="utf-8"))
    rows = []
    for d in raw:
        rows.append(
            {
                "addr": d.get("addr") or "",
                "sigungu": d.get("sigungu") or "",
                "dong": d.get("dong") or "",
                "jibun": d.get("jibun") or "",
                "jimok": d.get("jimok") or "",
                "yongdo": d.get("yongdo") or "",
                "doro": d.get("doro") or "",
                "area": to_float(d.get("area")),
                "price": to_float(d.get("price")),
                "per_m2": to_float(d.get("per_m2") or d.get("perM2")),
                "date": d.get("date"),
                "jibun_type": d.get("jibun_type") or d.get("jibunType") or "",
                "trade_type": d.get("trade_type") or d.get("tradeType") or "",
                "lat": to_float(d.get("lat")),
                "lng": to_float(d.get("lng")),
            }
        )
    clear_table("land_trades")
    print(f"토지 {len(rows)}건 업로드...")
    batch_insert("land_trades", rows)


def seed_migration():
    path = ROOT / "migration_data.json"
    if not path.exists():
        print("migration_data.json 없음 — 스킵")
        return
    raw = json.loads(path.read_text(encoding="utf-8"))
    months = raw.get("months", [])
    rows = []
    for direction, key in [("out", "outflow"), ("in", "inflow")]:
        for region_data in raw.get(key, []):
            for i, month in enumerate(months):
                rows.append(
                    {
                        "year_month": month,
                        "direction": direction,
                        "region": region_data.get("region", ""),
                        "count": region_data.get("counts", [0] * len(months))[i]
                        if i < len(region_data.get("counts", []))
                        else 0,
                        "net_count": region_data.get("nets", [0] * len(months))[i]
                        if i < len(region_data.get("nets", []))
                        else 0,
                        "lat": region_data.get("lat"),
                        "lng": region_data.get("lng"),
                    }
                )
    clear_table("migration_data")
    print(f"인구이동 {len(rows)}건 업로드...")
    batch_insert("migration_data", rows)


def main():
    required = ["apt_trades", "house_trades", "land_trades", "migration_data", "rht_trades", "comm_trades", "arch_permits"]
    missing = [t for t in required if not table_exists(t)]
    if missing:
        print("[ERROR] 다음 테이블이 없습니다:", ", ".join(missing))
        print("  → supabase/schema.sql 을 Supabase SQL Editor에서 먼저 실행하세요.")
        sys.exit(2)

    only = set()
    for i, arg in enumerate(sys.argv[1:]):
        if arg == "--only" and i + 1 < len(sys.argv) - 1:
            only = {x.strip() for x in sys.argv[i + 2].split(",") if x.strip()}

    print(f"Supabase: {SUPABASE_URL}")
    if not only or "apt" in only:
        seed_apt()
    if not only or "house" in only:
        seed_house()
    if not only or "land" in only:
        seed_land()
    if not only or "migration" in only:
        seed_migration()
    print("\n[OK] seed upload done")


if __name__ == "__main__":
    main()
