# scripts/verify_arch_stcns.py — 착공일 반영 검증
from __future__ import annotations
import json, os, urllib.request
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
raw = (ROOT / '.env').read_bytes()
if raw.startswith(b'\xef\xbb\xbf'):
    raw = raw[3:]
for line in raw.decode('utf-8').splitlines():
    line = line.strip()
    if not line or line.startswith('#') or '=' not in line:
        continue
    k, v = line.split('=', 1)
    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))

url = os.environ['SUPABASE_URL'].rstrip('/')
key = os.environ['SUPABASE_SERVICE_KEY']
h = {'apikey': key, 'Authorization': 'Bearer ' + key, 'Prefer': 'count=exact'}


def count(q: str) -> int:
    req = urllib.request.Request(f'{url}/rest/v1/arch_permits?select=id&limit=1{q}', headers=h)
    with urllib.request.urlopen(req, timeout=60) as r:
        cr = r.headers.get('content-range') or ''
    return int(cr.split('/')[1])


def status(d):
    u = (d.get('use_apr_day') or '').replace('-', '')
    s = (d.get('stcns_day') or '').replace('-', '')
    if len(u) >= 8:
        return '준공'
    if len(s) >= 8:
        return '착공'
    return '허가'


total = count('')
with_stc = count('&stcns_day=not.is.null&stcns_day=neq.')
print(f'total={total}')
print(f'with_stcns_day={with_stc}')

# full scan pages for status
headers = {'apikey': key, 'Authorization': 'Bearer ' + key}
rows, offset = [], 0
while True:
    req = urllib.request.Request(
        f'{url}/rest/v1/arch_permits?select=pms_day,stcns_day,use_apr_day&order=id&limit=1000&offset={offset}',
        headers=headers,
    )
    with urllib.request.urlopen(req, timeout=60) as r:
        chunk = json.loads(r.read().decode())
    if not chunk:
        break
    rows.extend(chunk)
    if len(chunk) < 1000:
        break
    offset += 1000

c = Counter(status(d) for d in rows)
print('status_counts=', dict(c))
print('sample_착공=', [d for d in rows if status(d) == '착공'][:3])
