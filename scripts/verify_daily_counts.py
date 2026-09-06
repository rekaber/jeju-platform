"""
일일 업데이트 후 건수 검증.
- 실거래 5종 + arch_permits 총건수 / 최근 기간 건수 확인
- 치명적 공백(주요 테이블 0건)이면 exit 1
환경변수: SUPABASE_URL, SUPABASE_SERVICE_KEY
선택: VERIFY_MONTHS (기본 3)
"""
from __future__ import annotations

import os, sys, json, urllib.request
from datetime import datetime, timedelta

SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://boukipzpoapqotvauzrj.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
MONTHS = int(os.environ.get('VERIFY_MONTHS', '3'))

TRADE_TABLES = (
    'apt_trades', 'house_trades', 'rht_trades', 'land_trades', 'comm_trades',
)


def count_query(table, extra=''):
    url = f'{SUPABASE_URL}/rest/v1/{table}?select=id&limit=1{extra}'
    req = urllib.request.Request(url, headers={
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Prefer': 'count=exact',
    }, method='HEAD')
    with urllib.request.urlopen(req, timeout=45) as r:
        cr = r.headers.get('Content-Range') or r.headers.get('content-range') or '*/0'
        total = cr.split('/')[-1]
        return int(total) if total.isdigit() else -1


def recent_start():
    d = datetime.now() - timedelta(days=30 * MONTHS + 5)
    return d.strftime('%Y-%m-%d')


def main():
    if not SUPABASE_KEY:
        print('[ERROR] SUPABASE_SERVICE_KEY 없음')
        sys.exit(1)

    start = recent_start()
    lines = [f'## 일일 데이터 건수 검증', f'- 최근 기간 기준일: `{start}` ~ 오늘', '']
    lines.append('| 테이블 | 전체 | 최근 기간 |')
    lines.append('|--------|------|-----------|')

    fatal = []
    warn = []
    results = {}

    for t in TRADE_TABLES:
        total = count_query(t)
        recent = count_query(t, f'&date=gte.{start}')
        results[t] = (total, recent)
        lines.append(f'| `{t}` | {total:,} | {recent:,} |')
        if total <= 0:
            fatal.append(f'{t} 전체 0건')
        elif recent <= 0:
            fatal.append(f'{t} 최근 {MONTHS}개월 0건')

    arch_total = count_query('arch_permits')
    # pms_day may be YYYY-MM-DD or YYYYMMDD — check ISO first
    arch_recent = count_query('arch_permits', f'&pms_day=gte.{start}')
    if arch_recent <= 0:
        start_compact = start.replace('-', '')
        arch_recent = count_query('arch_permits', f'&pms_day=gte.{start_compact}')
    results['arch_permits'] = (arch_total, arch_recent)
    lines.append(f'| `arch_permits` | {arch_total:,} | {arch_recent:,} |')
    if arch_total <= 0:
        warn.append('arch_permits 전체 0건')
    elif arch_recent <= 0:
        warn.append(f'arch_permits 최근 기간 0건 (API 장애 가능 — 기존 데이터는 유지됐을 수 있음)')

    summary = '\n'.join(lines)
    print(summary)
    if warn:
        print('\n[경고]')
        for w in warn:
            print(' -', w)
    if fatal:
        print('\n[치명]')
        for f in fatal:
            print(' -', f)

    # GitHub Step Summary
    out = os.environ.get('GITHUB_STEP_SUMMARY')
    if out:
        with open(out, 'a', encoding='utf-8') as fh:
            fh.write(summary + '\n')
            if warn:
                fh.write('\n### 경고\n')
                for w in warn:
                    fh.write(f'- {w}\n')
            if fatal:
                fh.write('\n### 치명적 문제\n')
                for f in fatal:
                    fh.write(f'- {f}\n')

    # 실거래 치명만 job 실패. 인허가는 경고(API 불안정 이력)
    if fatal:
        sys.exit(1)
    print('\n✓ 건수 검증 통과')
    sys.exit(0)


if __name__ == '__main__':
    main()
