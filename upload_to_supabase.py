"""
제주 부동산 플랫폼 — Supabase 데이터 업로드 스크립트
실행: python upload_to_supabase.py
필요: pip install requests  (또는 표준 라이브러리만으로도 scripts/seed_from_json.py 사용)

시크릿은 코드에 넣지 마세요. .env 또는 환경변수를 사용합니다.
  SUPABASE_URL
  SUPABASE_SERVICE_KEY
"""
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent


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

if not os.environ.get("SUPABASE_SERVICE_KEY"):
    print("[ERROR] SUPABASE_SERVICE_KEY 환경변수가 없습니다.")
    print("  .env 예시:")
    print("  SUPABASE_URL=https://boukipzpoapqotvauzrj.supabase.co")
    print("  SUPABASE_SERVICE_KEY=your-service-role-key")
    sys.exit(1)

# 신규 시드 스크립트로 위임 (하드코딩 키 제거)
seed = ROOT / "scripts" / "seed_from_json.py"
raise SystemExit(subprocess.call([sys.executable, str(seed)]))
