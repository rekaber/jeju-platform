"""
건축인허가(arch_permits) 수집 + 카카오 지오코딩 → Supabase
필수 환경변수: MOLIT_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, KAKAO_REST_KEY

실행:
  python scripts/fetch_arch.py
  python scripts/fetch_arch.py --days 730
  python scripts/fetch_arch.py --geocode-only   # DB 기존 행만 좌표 채움
"""
from __future__ import annotations

import json, os, sys, time, urllib.error, urllib.parse, urllib.request
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

DAYS = 400
GEOCODE_ONLY = False
args = sys.argv[1:]
for i, arg in enumerate(args):
    if arg == '--days' and i + 1 < len(args):
        DAYS = max(30, int(args[i + 1]))
    elif arg == '--geocode-only':
        GEOCODE_ONLY = True

MOLIT_KEY = os.environ.get('MOLIT_API_KEY', '')
SUPABASE_URL = os.environ.get('SUPABASE_URL', 'https://boukipzpoapqotvauzrj.supabase.co')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY', '')
KAKAO_REST_KEY = os.environ.get('KAKAO_REST_KEY', '')

HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal',
}
ARCH_SIGUNGU = [('50110', '제주시'), ('50130', '서귀포시')]
JEJU_LAT = (33.10, 33.62)
JEJU_LNG = (126.08, 126.98)
_geo_cache: dict = {}


def text(item, tag):
    el = item.find(tag)
    return el.text.strip() if el is not None and el.text else ''


def text_any(item, *tags):
    for t in tags:
        v = text(item, t)
        if v:
            return v
    return ''


def float_or_none(s):
    try:
        return float(str(s).strip())
    except Exception:
        return None


def int_or_none(s):
    try:
        return int(str(s).strip())
    except Exception:
        return None


def fmt_day(s):
    s = (s or '').replace('-', '').strip()
    return f'{s[:4]}-{s[4:6]}-{s[6:8]}' if len(s) >= 8 else None


def preflight():
    need = []
    if not SUPABASE_KEY:
        need.append('SUPABASE_SERVICE_KEY')
    if not KAKAO_REST_KEY:
        need.append('KAKAO_REST_KEY')
    if not GEOCODE_ONLY and not MOLIT_KEY:
        need.append('MOLIT_API_KEY')
    if need:
        print(f'[ERROR] 환경변수 누락: {", ".join(need)}')
        sys.exit(1)
    print('✓ 환경변수 확인')


def arch_fetch(sigungu_cd, start_date, end_date):
    """세움터 건축인허가 이력 API (시군구 단위)."""
    endpoints = [
        'https://apis.data.go.kr/1613000/ArchPmsHstService_v2/getApBasisOulnInfo',
        'https://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo',
    ]
    all_items = []
    for base in endpoints:
        page = 1
        got = []
        while True:
            params = urllib.parse.urlencode({
                'sigunguCd': sigungu_cd,
                'bjdongCd': '00000',
                'startDate': start_date,
                'endDate': end_date,
                'numOfRows': 1000,
                'pageNo': page,
            })
            key = urllib.parse.quote(urllib.parse.unquote(MOLIT_KEY), safe='')
            url = f'{base}?serviceKey={key}&{params}'
            try:
                with urllib.request.urlopen(url, timeout=45) as r:
                    xml_str = r.read().decode('utf-8')
            except Exception as e:
                print(f'  API 오류 ({base.split("/")[-1]} p{page}): {e}')
                break
            try:
                root = ET.fromstring(xml_str)
            except ET.ParseError as e:
                print(f'  XML 오류: {e}')
                break
            code = (root.findtext('.//resultCode') or '').strip()
            if code not in ('00', '000', '0', ''):
                print(f'  API code {code}: {root.findtext(".//resultMsg")}')
                break
            items = root.findall('.//item')
            got.extend(items)
            total_el = root.find('.//totalCount')
            total = int(total_el.text) if total_el is not None and total_el.text else 0
            if not items or page * 1000 >= total:
                break
            page += 1
            time.sleep(0.25)
        if got:
            print(f'  ✓ {base.split("/")[-2]}/{base.split("/")[-1]} → {len(got)}건')
            all_items = got
            break
        print(f'  · {base.split("/")[-1]} 결과 없음, 다음 엔드포인트 시도')
    return all_items


def parse_arch(items, sigungu):
    rows = []
    for it in items:
        addr = text_any(it, 'platPlc', 'newPlatPlc', 'platPlcNm')
        pms = fmt_day(text_any(it, 'pmsDay', 'pmsDay'))
        if not addr and not pms:
            continue
        tot = float_or_none(text_any(it, 'totArea', 'totArea'))
        rows.append({
            'sigungu': sigungu,
            'dong': text_any(it, 'bjdongCdNm', 'dongNm', 'umdNm') or '',
            'bld_nm': text_any(it, 'bldNm'),
            'addr': addr,
            'purps': text_any(it, 'mainPurpsCdNm', 'mainPurpsCd'),
            'arch_gb': text_any(it, 'archGbCdNm', 'archGbCd'),
            'jimok': text_any(it, 'jimokCdNm', 'jimok'),
            'yongdo': text_any(it, 'jiyukCdNm', 'yongdoRegionNm', 'landUse'),
            'tot_area': tot,
            'plat_area': float_or_none(text_any(it, 'platArea')),
            'arch_area': float_or_none(text_any(it, 'archArea')),
            'bc_rat': float_or_none(text_any(it, 'bcRat')),
            'vl_rat': float_or_none(text_any(it, 'vlRat')),
            'hhld_cnt': int_or_none(text_any(it, 'hhldCnt')),
            'ho_cnt': int_or_none(text_any(it, 'hoCnt')),
            'pms_day': pms,
            'use_apr_day': fmt_day(text_any(it, 'useAprDay')) or '',
            'lat': None,
            'lng': None,
        })
    return rows


def kakao_geocode(addr):
    if not addr or not KAKAO_REST_KEY:
        return None
    clean = addr.replace('번지', '').replace('제주특별자치도 ', '').strip()
    if clean in _geo_cache:
        return _geo_cache[clean]
    q = urllib.parse.urlencode({'query': clean})
    url = f'https://dapi.kakao.com/v2/local/search/address.json?{q}'
    req = urllib.request.Request(url, headers={'Authorization': f'KakaoAK {KAKAO_REST_KEY}'})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            docs = json.loads(r.read().decode()).get('documents') or []
        if docs:
            lat, lng = float(docs[0]['y']), float(docs[0]['x'])
            if JEJU_LAT[0] <= lat <= JEJU_LAT[1] and JEJU_LNG[0] <= lng <= JEJU_LNG[1]:
                _geo_cache[clean] = (lat, lng)
                return lat, lng
    except Exception:
        pass
    # keyword fallback
    q2 = urllib.parse.urlencode({'query': '제주 ' + clean, 'x': '126.5292', 'y': '33.3617', 'radius': 50000})
    url2 = f'https://dapi.kakao.com/v2/local/search/keyword.json?{q2}'
    req2 = urllib.request.Request(url2, headers={'Authorization': f'KakaoAK {KAKAO_REST_KEY}'})
    try:
        with urllib.request.urlopen(req2, timeout=15) as r:
            docs = json.loads(r.read().decode()).get('documents') or []
        if docs:
            lat, lng = float(docs[0]['y']), float(docs[0]['x'])
            if JEJU_LAT[0] <= lat <= JEJU_LAT[1] and JEJU_LNG[0] <= lng <= JEJU_LNG[1]:
                _geo_cache[clean] = (lat, lng)
                return lat, lng
    except Exception:
        pass
    _geo_cache[clean] = None
    return None


def geocode_rows(rows):
    todo = [r for r in rows if not r.get('lat') and r.get('addr')]
    print(f'  지오코딩 대상: {len(todo)}건')
    ok = 0
    for i, r in enumerate(todo, 1):
        coord = kakao_geocode(r['addr'])
        if coord:
            r['lat'], r['lng'] = coord
            ok += 1
        if i % 50 == 0:
            print(f'  … {i}/{len(todo)} (성공 {ok})')
        time.sleep(0.05)
    print(f'  지오코딩 완료: {ok}/{len(todo)}')


def sb_clear_arch():
    url = f'{SUPABASE_URL}/rest/v1/arch_permits?id=gte.0'
    req = urllib.request.Request(url, method='DELETE', headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120):
            print('  ✓ arch_permits 전체 삭제')
    except Exception as e:
        print(f'  [경고] clear 실패: {e}')


def sb_insert(rows, batch=300):
    ok = 0
    for i in range(0, len(rows), batch):
        chunk = rows[i:i + batch]
        data = json.dumps(chunk).encode('utf-8')
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/arch_permits',
            data=data, method='POST', headers=HEADERS,
        )
        try:
            with urllib.request.urlopen(req, timeout=60):
                ok += len(chunk)
                print(f'  삽입 {ok}/{len(rows)}')
        except urllib.error.HTTPError as e:
            print(f'  INSERT 오류 {e.code}: {e.read()[:200]}')
        time.sleep(0.2)
    return ok


def sb_fetch_missing_coords():
    rows, offset = [], 0
    while True:
        url = (
            f'{SUPABASE_URL}/rest/v1/arch_permits'
            f'?select=id,addr&lat=is.null&addr=neq.&order=id&limit=1000&offset={offset}'
        )
        req = urllib.request.Request(url, headers={
            'apikey': SUPABASE_KEY,
            'Authorization': f'Bearer {SUPABASE_KEY}',
        })
        with urllib.request.urlopen(req, timeout=60) as r:
            chunk = json.loads(r.read().decode())
        if not chunk:
            break
        rows.extend(chunk)
        if len(chunk) < 1000:
            break
        offset += 1000
    return rows


def sb_patch_coords(rows):
    ok = 0
    for r in rows:
        if r.get('lat') is None:
            continue
        body = json.dumps({'lat': r['lat'], 'lng': r['lng']}).encode()
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/arch_permits?id=eq.{r["id"]}',
            data=body, method='PATCH', headers=HEADERS,
        )
        try:
            with urllib.request.urlopen(req, timeout=30):
                ok += 1
        except Exception as e:
            print(f'  patch fail id={r.get("id")}: {e}')
        if ok and ok % 100 == 0:
            print(f'  … patch {ok}')
            time.sleep(0.1)
    return ok


def geocode_only():
    print('\n▶ arch_permits 기존 행 지오코딩')
    missing = sb_fetch_missing_coords()
    print(f'  좌표 없음: {len(missing)}건')
    if not missing:
        return
    for r in missing:
        coord = kakao_geocode(r.get('addr') or '')
        if coord:
            r['lat'], r['lng'] = coord
        time.sleep(0.05)
    n = sb_patch_coords(missing)
    print(f'  ✓ 좌표 갱신 {n}건')


def fetch_and_upload():
    print('\n▶ arch_permits 수집')
    end = datetime.now()
    start = end - timedelta(days=DAYS)
    start_s, end_s = start.strftime('%Y%m%d'), end.strftime('%Y%m%d')
    print(f'  기간: {start_s} ~ {end_s} ({DAYS}일)')

    all_rows = []
    for cd, name in ARCH_SIGUNGU:
        print(f'  {name} ({cd})…')
        items = arch_fetch(cd, start_s, end_s)
        rows = parse_arch(items, name)
        print(f'  → 파싱 {len(rows)}건')
        all_rows.extend(rows)
        time.sleep(0.4)

    if not all_rows:
        print('  데이터 없음')
        return

    # 주소+허가일 기준 중복 제거
    uniq = {}
    for r in all_rows:
        k = (r.get('addr'), r.get('pms_day'), r.get('bld_nm'), r.get('tot_area'))
        uniq[k] = r
    all_rows = list(uniq.values())
    print(f'  중복 제거 후 {len(all_rows)}건')

    geocode_rows(all_rows)
    sb_clear_arch()
    time.sleep(0.5)
    sb_insert(all_rows)
    with_lat = sum(1 for r in all_rows if r.get('lat'))
    print(f'  ✓ 완료: {len(all_rows)}건 (좌표 {with_lat})')


def main():
    preflight()
    if GEOCODE_ONLY:
        geocode_only()
    else:
        fetch_and_upload()


if __name__ == '__main__':
    main()
