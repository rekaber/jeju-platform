"""
DATABASE_URL 이 있으면 supabase/schema.sql 을 psycopg로 적용합니다.

사용:
  pip install psycopg[binary]
  set DATABASE_URL=postgresql://postgres....
  python scripts/apply_schema.py
"""
from __future__ import annotations

import os
import sys
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

DATABASE_URL = os.environ.get("DATABASE_URL", "")
SCHEMA = ROOT / "supabase" / "schema.sql"


def main() -> int:
    if not DATABASE_URL:
        print("[INFO] DATABASE_URL 없음 — SQL Editor 수동 실행이 필요합니다.")
        print(f"  파일: {SCHEMA}")
        print("  URL : https://supabase.com/dashboard/project/boukipzpoapqotvauzrj/sql/new")
        return 1
    try:
        import psycopg
    except ImportError:
        print("[ERROR] pip install 'psycopg[binary]' 후 다시 실행하세요.")
        return 2

    sql = SCHEMA.read_text(encoding="utf-8")
    print(f"Applying {SCHEMA} ...")
    with psycopg.connect(DATABASE_URL) as conn:
        conn.execute(sql)
        conn.commit()
    print("✅ 스키마 적용 완료")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
