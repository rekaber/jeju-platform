# scripts/ensure_arch_stcns_day.py
"""arch_permits.stcns_day 컬럼 확인/추가 시도 + 샘플 검증."""
from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def load_env():
    env_path = ROOT / '.env'
    if not env_path.exists():
        return
    raw = env_path.read_bytes()
    if raw.startswith(b'\xef\xbb\xbf'):
        raw = raw[3:]
    for line in raw.decode('utf-8').splitlines():
        line = line.strip()
        if not line or line.startswith('#') or '=' not in line:
            continue
        k, v = line.split('=', 1)
        k, v = k.strip(), v.strip().strip('"').strip("'")
        if k and k not in os.environ:
            os.environ[k] = v
    # 로컬 .env 별칭
    if not os.environ.get('MOLIT_API_KEY') and os.environ.get('MOLIT_KEY'):
        os.environ['MOLIT_API_KEY'] = os.environ['MOLIT_KEY']


def sb_headers(key: str) -> dict:
    return {
        'apikey': key,
        'Authorization': f'Bearer {key}',
        'Content-Type': 'application/json',
    }


def probe_column(url: str, key: str) -> bool:
    req = urllib.request.Request(
        f'{url}/rest/v1/arch_permits?select=stcns_day&limit=1',
        headers=sb_headers(key),
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            r.read()
        return True
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')
        if e.code == 400 and 'stcns_day' in body:
            return False
        print(f'  probe HTTP {e.code}: {body[:200]}')
        return False


def try_add_via_database_url() -> bool:
    db = os.environ.get('DATABASE_URL') or os.environ.get('SUPABASE_DB_URL')
    if not db:
        return False
    try:
        import psycopg2  # type: ignore
    except ImportError:
        try:
            import subprocess
            subprocess.check_call([sys.executable, '-m', 'pip', 'install', 'psycopg2-binary', '-q'])
            import psycopg2  # type: ignore
        except Exception as e:
            print(f'  psycopg2 설치 실패: {e}')
            return False
    try:
        conn = psycopg2.connect(db)
        conn.autocommit = True
        with conn.cursor() as cur:
            cur.execute('ALTER TABLE arch_permits ADD COLUMN IF NOT EXISTS stcns_day TEXT;')
        conn.close()
        print('  OK stcns_day added via DATABASE_URL')
        return True
    except Exception as e:
        print(f'  DATABASE_URL ALTER failed: {e}')
        return False


def main():
    load_env()
    url = (os.environ.get('SUPABASE_URL') or '').rstrip('/')
    key = os.environ.get('SUPABASE_SERVICE_KEY') or ''
    if not url or not key:
        print('[ERROR] SUPABASE_URL / SUPABASE_SERVICE_KEY 필요')
        sys.exit(1)

    print('> stcns_day column check')
    if probe_column(url, key):
        print('  OK stcns_day exists')
        return 0

    print('  MISSING stcns_day — trying to add')
    if try_add_via_database_url() and probe_column(url, key):
        return 0

    # PostgREST로는 DDL 불가. 안내 후 실패 코드
    sql_path = ROOT / 'supabase' / 'migrations' / '20260913_arch_stcns_day.sql'
    print('')
    print('[NEED] Run in Supabase SQL Editor:')
    print('  ALTER TABLE arch_permits ADD COLUMN IF NOT EXISTS stcns_day TEXT;')
    print(f'  (file: {sql_path})')
    print('')
    print('Or set DATABASE_URL in .env and re-run this script.')
    return 2


if __name__ == '__main__':
    sys.exit(main())
