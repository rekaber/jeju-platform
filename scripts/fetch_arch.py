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

# scripts/ 에서 jeju_bjdong 임포트
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

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


def load_dong_codes():
    """공식 법정동코드 (읍면동). data-dong.js 지도용 코드와 다름."""
    from jeju_bjdong import JEJU_BJDONG
    return list(JEJU_BJDONG)


ARCH_TIMEOUT = 60
ARCH_RETRIES = 4
ARCH_TIMEOUT_ABORT = 8  # 연속 실패 시에만 시군구 순회 중단
ARCH_CHUNK_DAYS = 62    # 긴 기간은 잘라서 호출 (Hub 타임아웃 완화)


def _service_key():
    raw_key = urllib.parse.unquote(MOLIT_KEY)
    if '%' in MOLIT_KEY:
        return MOLIT_KEY.strip()
    return urllib.parse.quote(raw_key, safe='')


def _date_chunks(start_ymd, end_ymd, chunk_days=ARCH_CHUNK_DAYS):
    start = datetime.strptime(start_ymd, '%Y%m%d')
    end = datetime.strptime(end_ymd, '%Y%m%d')
    cur = start
    while cur <= end:
        chunk_end = min(cur + timedelta(days=chunk_days - 1), end)
        yield cur.strftime('%Y%m%d'), chunk_end.strftime('%Y%m%d')
        cur = chunk_end + timedelta(days=1)


def arch_fetch_page(sigungu_cd, start_date, end_date, bjdong_cd, page):
    """한 페이지 호출. 타임아웃 시 재시도."""
    base = 'https://apis.data.go.kr/1613000/ArchPmsHubService/getApBasisOulnInfo'
    params = urllib.parse.urlencode({
        'sigunguCd': sigungu_cd,
        'bjdongCd': bjdong_cd,
        'startDate': start_date,
        'endDate': end_date,
        'numOfRows': 1000,
        'pageNo': page,
    })
    url = f'{base}?serviceKey={_service_key()}&{params}'
    last_err = None
    for attempt in range(1, ARCH_RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'jeju-platform-arch/1.0'})
            with urllib.request.urlopen(req, timeout=ARCH_TIMEOUT) as r:
                return r.read().decode('utf-8'), None
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')[:400]
            if 'SERVICE_KEY_IS_NOT_REGISTERED' in body:
                return '', 'key_not_registered'
            if 'NO_OPENAPI_SERVICE' in body:
                return '', 'service_gone'
            return '', 'error'
        except Exception as e:
            last_err = e
            err = str(e).lower()
            if 'timed out' in err or 'timeout' in err:
                if attempt < ARCH_RETRIES:
                    wait = attempt * 2
                    print(f'    retry {attempt}/{ARCH_RETRIES} timeout → {wait}s ({bjdong_cd} {start_date})')
                    time.sleep(wait)
                    continue
                print(f'  API timeout ({bjdong_cd} {start_date}~{end_date} p{page}): {e}')
                return '', 'timeout'
            print(f'  API 오류 ({bjdong_cd} p{page}): {e}')
            return '', 'error'
    print(f'  API 실패: {last_err}')
    return '', 'timeout'


def arch_fetch(sigungu_cd, start_date, end_date, bjdong_cd='00000'):
    """건축HUB 건축인허가 API. 긴 기간은 청크로 나눠 조회."""
    got = []
    last_status = 'empty'
    for c_start, c_end in _date_chunks(start_date, end_date):
        page = 1
        while True:
            xml_str, err = arch_fetch_page(sigungu_cd, c_start, c_end, bjdong_cd, page)
            if err:
                return got, err  # 부분 수집분이 있으면 상위에서 활용
            try:
                root = ET.fromstring(xml_str)
            except ET.ParseError as e:
                print(f'  XML 오류: {e}')
                return got, 'error'
            if 'SERVICE_KEY_IS_NOT_REGISTERED' in xml_str:
                print('  API: SERVICE_KEY_IS_NOT_REGISTERED_ERROR')
                return [], 'key_not_registered'
            if 'NO_OPENAPI_SERVICE' in xml_str:
                print('  API: NO_OPENAPI_SERVICE_ERROR')
                return [], 'service_gone'
            code = (root.findtext('.//resultCode') or '').strip()
            if code not in ('00', '000', '0', ''):
                msg = root.findtext('.//resultMsg') or ''
                print(f'  API code {code}: {msg}')
                return got, 'error'
            items = root.findall('.//item')
            got.extend(items)
            total_el = root.find('.//totalCount')
            total = int(total_el.text) if total_el is not None and total_el.text else 0
            if not items or page * 1000 >= total:
                last_status = 'ok' if got else 'empty'
                break
            page += 1
            time.sleep(0.25)
        time.sleep(0.2)
    return got, last_status


def arch_fetch_all_regions(start_date, end_date):
    """Hub는 시군구(bjdongCd=00000)만으로는 비는 경우가 많아 읍면동 단위 순회."""
    all_rows = []
    api_down = False
    for cd, name in ARCH_SIGUNGU:
        dongs = [d for d in load_dong_codes() if d[0] == cd]
        print(f'  {name} ({cd}) 법정동 {len(dongs)}개 순회…')
        timeout_streak = 0
        got_any = False
        for i, (sgg, bjd, dong) in enumerate(dongs, 1):
            items, st = arch_fetch(sgg, start_date, end_date, bjd)
            if st in ('key_not_registered', 'service_gone'):
                print(f'  → {st} — 순회 중단')
                api_down = True
                break
            if st in ('timeout', 'error'):
                # 부분 성공분이 있으면 반영 후 다음 동으로 (전체 중단은 연속 실패 시)
                if items:
                    rows = parse_arch(items, name)
                    for r in rows:
                        if not r.get('dong'):
                            r['dong'] = dong
                    all_rows.extend(rows)
                    got_any = True
                    print(f'    {dong}({bjd}): 부분 {len(rows)}건 ({st})')
                timeout_streak += 1
                if timeout_streak >= ARCH_TIMEOUT_ABORT:
                    print(f'  ⚠ 연속 {st} {timeout_streak}회 → {name} 순회 중단')
                    api_down = True
                    break
                time.sleep(1.5)
                continue
            timeout_streak = 0
            rows = parse_arch(items, name) if items else []
            if rows:
                got_any = True
                for r in rows:
                    if not r.get('dong'):
                        r['dong'] = dong
                all_rows.extend(rows)
                print(f'    {dong}({bjd}): {len(rows)}건')
            if i % 10 == 0:
                print(f'    … {i}/{len(dongs)} (누적 {len(all_rows)}건)')
            time.sleep(0.3)
        if not got_any and not api_down:
            print(f'  → {name} 0건')
    return all_rows, api_down


def fetch_and_upload():
    print('\n▶ arch_permits 수집')
    end = datetime.now()
    start = end - timedelta(days=DAYS)
    start_s, end_s = start.strftime('%Y%m%d'), end.strftime('%Y%m%d')
    print(f'  기간: {start_s} ~ {end_s} ({DAYS}일)')

    all_rows, api_down = arch_fetch_all_regions(start_s, end_s)

    if not all_rows:
        print('  데이터 없음 — 기존 DB 유지, 좌표만 보강')
        if api_down:
            print('  ⚠ 건축인허가 API 장애/타임아웃 — 기간 삭제·재삽입 생략')
        geocode_only()
        return

    uniq = {}
    for r in all_rows:
        k = r.get('mgm_pk') or (r.get('addr'), r.get('pms_day'), r.get('bld_nm'), r.get('tot_area'))
        uniq[k] = r
    all_rows = list(uniq.values())
    print(f'  중복 제거 후 {len(all_rows)}건')

    # API가 불안정한데 일부만 오면 기간 DELETE 하면 구멍 → 보류
    if api_down and len(all_rows) < 50:
        print(f'  ⚠ API 불안정 + 수집 {len(all_rows)}건뿐 → 기간 교체 생략, 기존 유지')
        geocode_only()
        return

    geocode_rows(all_rows)
    # 전체 clear 금지 — 수집 기간만 삭제 후 INSERT (기간 upsert)
    sb_delete_arch_period(start_s, end_s)
    time.sleep(0.5)
    sb_insert(all_rows)
    with_lat = sum(1 for r in all_rows if r.get('lat'))
    print(f'  ✓ 완료: {len(all_rows)}건 (좌표 {with_lat}) · 기간 {start_s}~{end_s}만 교체')


def parse_arch(items, sigungu):
    rows = []
    for it in items:
        addr = text_any(it, 'platPlc', 'newPlatPlc', 'platPlcNm')
        # Hub: archPmsDay / 구 API: pmsDay
        pms = fmt_day(text_any(it, 'archPmsDay', 'pmsDay', 'pmsDay'))
        if not addr and not pms:
            continue
        tot = float_or_none(text_any(it, 'totArea', 'totArea'))
        pk = text_any(it, 'mgmPmsrgstPk', 'mgmPmsRegstPk')
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
            'mgm_pk': pk or None,
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
    """(레거시) 전체 삭제 — 일일 수집에서는 사용하지 않음."""
    url = f'{SUPABASE_URL}/rest/v1/arch_permits?id=gte.0'
    req = urllib.request.Request(url, method='DELETE', headers=HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120):
            print('  ✓ arch_permits 전체 삭제')
    except Exception as e:
        print(f'  [경고] clear 실패: {e}')


def sb_delete_arch_period(start_ymd, end_ymd):
    """수집 기간(pms_day)만 삭제. YYYY-MM-DD / YYYYMMDD 혼재 대응."""
    start_iso = f'{start_ymd[:4]}-{start_ymd[4:6]}-{start_ymd[6:8]}'
    end_iso = f'{end_ymd[:4]}-{end_ymd[4:6]}-{end_ymd[6:8]}'
    queries = [
        f'pms_day=gte.{start_iso}&pms_day=lte.{end_iso}',
        f'pms_day=gte.{start_ymd}&pms_day=lte.{end_ymd}',
    ]
    ok = True
    for q in queries:
        url = f'{SUPABASE_URL}/rest/v1/arch_permits?{q}'
        req = urllib.request.Request(url, method='DELETE', headers=HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=120):
                print(f'  ✓ 기간 삭제: {q}')
        except urllib.error.HTTPError as e:
            if e.code in (404, 204):
                print(f'  · 기간 삭제 대상 없음: {q}')
            else:
                print(f'  [경고] 기간 삭제 실패 {e.code}: {e.read()[:150]}')
                ok = False
        except Exception as e:
            print(f'  [경고] 기간 삭제 실패: {e}')
            ok = False
        time.sleep(0.2)
    return ok


def sb_insert(rows, batch=300):
    ok = 0
    for i in range(0, len(rows), batch):
        chunk = []
        for r in rows[i:i + batch]:
            row = {k: v for k, v in r.items() if k != 'mgm_pk' and not k.startswith('_')}
            chunk.append(row)
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


def main():
    preflight()
    if GEOCODE_ONLY:
        geocode_only()
    else:
        fetch_and_upload()


if __name__ == '__main__':
    main()
