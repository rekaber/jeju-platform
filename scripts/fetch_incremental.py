"""
제주 부동산 실거래 증분 업데이트 스크립트 (자동화용)
- 최근 3개월 데이터만 처리 (GitHub Actions 스케줄 실행용)
- 안전한 DELETE → INSERT 패턴: 월별로 삭제 후 바로 삽입 (테이블 전체 삭제 없음)
- 중복 방지: 같은 월을 두 번 실행해도 먼저 해당 월 DELETE 후 INSERT하므로 중복 없음
- 필수 환경변수: MOLIT_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, KAKAO_REST_KEY

실행 예시:
  python scripts/fetch_incremental.py
  python scripts/fetch_incremental.py --months 1   # 당월만
  python scripts/fetch_incremental.py --months 6   # 6개월
"""

import os, sys, time, json, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# ── CLI 옵션 ─────────────────────────────────────────────
MONTHS_BACK = 3  # 기본값: 최근 3개월
args = sys.argv[1:]
for i, arg in enumerate(args):
    if arg == '--months' and i + 1 < len(args):
        try:
            MONTHS_BACK = max(1, int(args[i + 1]))
        except ValueError:
            pass
        break

# ── 설정 ─────────────────────────────────────────────────
MOLIT_KEY      = os.environ.get('MOLIT_API_KEY', '')
SUPABASE_URL   = os.environ.get('SUPABASE_URL', 'https://boukipzpoapqotvauzrj.supabase.co')
SUPABASE_KEY   = os.environ.get('SUPABASE_SERVICE_KEY', '')
KAKAO_REST_KEY = os.environ.get('KAKAO_REST_KEY', '')

REGIONS = [('50110', '제주시'), ('50130', '서귀포시')]

SUPABASE_HEADERS = {
    'apikey':        SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type':  'application/json',
    'Prefer':        'return=minimal',
}

# ── 사전 검증 ─────────────────────────────────────────────
def preflight():
    missing = []
    if not MOLIT_KEY:      missing.append('MOLIT_API_KEY')
    if not SUPABASE_KEY:   missing.append('SUPABASE_SERVICE_KEY')
    if not KAKAO_REST_KEY: missing.append('KAKAO_REST_KEY')
    if missing:
        print(f'[ERROR] 환경변수 누락: {", ".join(missing)}')
        print('  → 지오코딩 불가 또는 DB 접근 불가. 실행 중단.')
        sys.exit(1)
    print(f'✓ 환경변수 확인 완료 (MOLIT, Supabase, Kakao)')

# ── 유틸 ─────────────────────────────────────────────────
def get_months(n):
    """최근 n개월 YYYYMM 리스트 (최신→과거 순)"""
    now = datetime.now()
    result = []
    for i in range(n):
        y, m = now.year, now.month - i
        while m <= 0:
            m += 12; y -= 1
        result.append(f'{y}{m:02d}')
    return result

def price_int(s):
    try: return int(str(s).replace(',', '').strip())
    except: return None

def price_eok(s):
    """만원 단위 문자열 → 억원 float (MOLIT API는 만원 단위로 반환)"""
    v = price_int(s)
    return round(v / 10000, 4) if v else None

def float_or_none(s):
    try: return float(str(s).strip())
    except: return None

def int_or_none(s):
    try: return int(str(s).strip())
    except: return None

def text(item, tag):
    el = item.find(tag)
    return el.text.strip() if el is not None and el.text else ''

# ── API 조회 ──────────────────────────────────────────────
def molit_fetch(service, lawd_cd, deal_ymd, page=1, rows=1000):
    base = f'https://apis.data.go.kr/1613000/{service[3:]}/{service}'
    params = urllib.parse.urlencode({
        'LAWD_CD': lawd_cd, 'DEAL_YMD': deal_ymd,
        'numOfRows': rows, 'pageNo': page,
    })
    encoded_key = urllib.parse.quote(urllib.parse.unquote(MOLIT_KEY), safe="")
    url = f'{base}?serviceKey={encoded_key}&{params}'
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        print(f'  API HTTP 오류: {e.code} | {e.read().decode("utf-8", errors="ignore")[:200]}')
        return None
    except Exception as e:
        print(f'  API 오류: {e}')
        return None

def molit_fetch_all(service, lawd_cd, deal_ymd):
    all_items, page = [], 1
    while True:
        xml_str = molit_fetch(service, lawd_cd, deal_ymd, page)
        if not xml_str:
            break
        try:
            root = ET.fromstring(xml_str)
        except ET.ParseError as e:
            print(f'  XML 파싱 오류: {e}')
            break
        # API 에러코드 체크
        result_msg = root.findtext('.//resultMsg') or ''
        result_code = root.findtext('.//resultCode') or ''
        if result_code not in ('00', '0', ''):
            print(f'  API 오류코드 {result_code}: {result_msg}')
            break
        items = root.findall('.//item')
        all_items.extend(items)
        total_el = root.find('.//totalCount')
        total = int(total_el.text) if total_el is not None and total_el.text else 0
        if not items or page * 1000 >= total:
            break
        page += 1
        time.sleep(0.2)
    return all_items

# ── Supabase ──────────────────────────────────────────────
def sb_delete_month(table, ym):
    """단일 월 데이터 삭제. 성공 여부 반환."""
    y, m = ym[:4], ym[4:]
    prefix = f'{y}-{m}'
    url = f'{SUPABASE_URL}/rest/v1/{table}?date=like.{prefix}*'
    req = urllib.request.Request(url, method='DELETE', headers=SUPABASE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30):
            return True
    except Exception as e:
        print(f'  [경고] DELETE 실패 ({table}, {prefix}): {e}')
        return False

def sb_insert(table, rows, batch=400):
    """배치 삽입. 성공한 건수 반환. _로 시작하는 내부 필드는 제외."""
    total, ok = len(rows), 0
    for i in range(0, total, batch):
        chunk = [{k: v for k, v in r.items() if not k.startswith('_')} for r in rows[i:i+batch]]
        data = json.dumps(chunk).encode('utf-8')
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/{table}',
            data=data, method='POST', headers=SUPABASE_HEADERS
        )
        try:
            with urllib.request.urlopen(req, timeout=30):
                ok += len(chunk)
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')[:300]
            print(f'  [경고] INSERT 오류 ({e.code}): {body}')
        time.sleep(0.2)
    return ok

# ── 주소 유틸 ─────────────────────────────────────────────
def build_jibun_addr(sigungu, dong, main_raw, sub_raw):
    main = (main_raw or '').lstrip('0')
    sub  = (sub_raw  or '').lstrip('0')
    if dong and main:
        return f"{sigungu} {dong} {main}" + (f"-{sub}" if sub and sub != '0' else '')
    return f"{sigungu} {dong}" if dong else None

def get_jibun(it):
    main = text(it, '본번') or text(it, '법정동본번코드')
    sub  = text(it, '부번') or text(it, '법정동부번코드')
    return main.lstrip('0'), sub.lstrip('0')

def parse_jibun_field(it, sigungu, dong):
    """신/구 API 모두 지원: jibun 필드(신) 또는 본번/부번(구)"""
    jibun_raw = text(it, 'jibun')
    if jibun_raw:
        parts = jibun_raw.split('-')
        jm = parts[0].lstrip('0')
        js = parts[1].lstrip('0') if len(parts) > 1 else ''
    else:
        jm, js = get_jibun(it)
    return build_jibun_addr(sigungu, dong, jm, js), jm, js

# ── 파서 ──────────────────────────────────────────────────
def parse_apt(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년') or text(it, 'dealYear')
        월 = text(it, '월') or text(it, 'dealMonth')
        일 = text(it, '일') or text(it, 'dealDay')
        if not (년 and 월 and 일): continue
        dong     = text(it, '법정동') or text(it, 'umdNm')
        road     = text(it, '도로명') or text(it, 'roadNm') or ''
        apt_name = text(it, '아파트') or text(it, 'aptNm')
        road_full = f"{sigungu} {road}" if road else None
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        # 지오코딩 우선순위: 도로명+단지명 > 도로명 > 동+단지명 > 지번
        geo_addrs = []
        if road_full:
            if apt_name: geo_addrs.append((f"{road_full} {apt_name}", 'keyword'))
            geo_addrs.append((road_full, 'addr'))
        if apt_name and dong:
            geo_addrs.append((f"{sigungu} {dong} {apt_name}", 'keyword'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        if apt_name:   geo_addrs.append((apt_name, 'keyword'))
        rows.append({
            'name':     apt_name,
            'addr':     jibun_full or f"{sigungu} {dong}",
            'sigungu':  sigungu,
            'dong':     dong,
            'roadaddr': road_full or '',
            'type':     'apt',
            'area':     float_or_none(text(it, '전용면적') or text(it, 'excluUseAr')),
            'price':    price_eok(text(it, '거래금액') or text(it, 'dealAmount')),
            'date':     f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':    int_or_none(text(it, '층') or text(it, 'floor')),
            'built':    int_or_none(text(it, '건축년도') or text(it, 'buildYear')),
            'lat': None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_house(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년') or text(it, 'dealYear')
        월 = text(it, '월') or text(it, 'dealMonth')
        일 = text(it, '일') or text(it, 'dealDay')
        if not (년 and 월 and 일): continue
        dong = text(it, '법정동') or text(it, 'umdNm')
        road = text(it, '도로명') or text(it, 'roadNm') or ''
        road_full = f"{sigungu} {road}" if road else None
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = []
        if road_full:  geo_addrs.append((road_full, 'addr'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        geo_addrs.append((f"{sigungu} {dong}", 'addr'))
        rows.append({
            'name':        text(it, '주택유형') or text(it, 'buildingType') or dong,
            'sigungu':     sigungu,
            'dong':        dong,
            'addr':        jibun_full or f"{sigungu} {dong}",
            'roadaddr':    road_full or '',
            'house_type':  text(it, '주택유형') or text(it, 'buildingType'),
            'type':        'house',
            'area':        float_or_none(text(it, '연면적') or text(it, 'totalFloorAr') or text(it, 'buildingAr')),
            'plottage_ar': float_or_none(text(it, '대지면적') or text(it, 'plottageAr')),
            'price':       price_eok(text(it, '거래금액') or text(it, 'dealAmount')),
            'date':        f'{년}-{int(월):02d}-{int(일):02d}',
            'built':       int_or_none(text(it, '건축년도') or text(it, 'buildYear')),
            'lat': None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_rht(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년') or text(it, 'dealYear')
        월 = text(it, '월') or text(it, 'dealMonth')
        일 = text(it, '일') or text(it, 'dealDay')
        if not (년 and 월 and 일): continue
        dong     = text(it, '법정동') or text(it, 'umdNm')
        road     = text(it, '도로명') or text(it, 'roadNm') or ''
        rht_name = text(it, '연립다세대') or text(it, 'aptNm') or text(it, 'mhouseNm')
        road_full = f"{sigungu} {road}" if road else None
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = []
        if road_full:
            if rht_name: geo_addrs.append((f"{road_full} {rht_name}", 'keyword'))
            geo_addrs.append((road_full, 'addr'))
        if rht_name and dong: geo_addrs.append((f"{sigungu} {dong} {rht_name}", 'keyword'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        if rht_name:   geo_addrs.append((rht_name, 'keyword'))
        rows.append({
            'name':     rht_name,
            'sigungu':  sigungu,
            'dong':     dong,
            'addr':     jibun_full or f"{sigungu} {dong}",
            'roadaddr': road_full or '',
            'type':     'rht',
            'area':     float_or_none(text(it, '전용면적') or text(it, 'excluUseAr')),
            'price':    price_eok(text(it, '거래금액') or text(it, 'dealAmount')),
            'date':     f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':    int_or_none(text(it, '층') or text(it, 'floor')),
            'built':    int_or_none(text(it, '건축년도') or text(it, 'buildYear')),
            'lat': None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_land(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년') or text(it, 'dealYear')
        월 = text(it, '월') or text(it, 'dealMonth')
        일 = text(it, '일') or text(it, 'dealDay')
        if not (년 and 월 and 일): continue
        area = None
        for tag in ['면적', '토지면적', 'landAr', 'officialLandPriceAr']:
            v = float_or_none(text(it, tag))
            if v: area = v; break
        price = price_eok(text(it, '거래금액') or text(it, 'dealAmount'))
        per_m2 = round(price * 10000 / area, 1) if price and area else None  # 만원/㎡
        dong  = text(it, '법정동')
        jibun = text(it, '지번')
        jibun_addr = f"{sigungu} {dong} {jibun}" if jibun else f"{sigungu} {dong}"
        rows.append({
            'addr':       jibun_addr,
            'sigungu':    sigungu,
            'dong':       dong,
            'jibun':      jibun,
            'jimok':      text(it, '지목'),
            'yongdo':     text(it, '용도지역'),
            'doro':       text(it, '도로명'),
            'area':       area,
            'price':      price,
            'per_m2':     per_m2,
            'date':       f'{년}-{int(월):02d}-{int(일):02d}',
            'jibun_type': text(it, '지분거래구분'),
            'trade_type': text(it, '거래유형'),
            'lat': None, 'lng': None,
            '_geo_addrs': [a for a in [jibun_addr, f"{sigungu} {dong}"] if a],
        })
    return rows

def parse_comm(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년') or text(it, 'dealYear')
        월 = text(it, '월') or text(it, 'dealMonth')
        일 = text(it, '일') or text(it, 'dealDay')
        if not (년 and 월 and 일): continue
        dong     = text(it, '법정동') or text(it, 'umdNm')
        road     = text(it, '도로명') or text(it, 'roadNm') or ''
        bld_name = text(it, '건물명') or text(it, 'bldNm') or ''
        road_full = f"{sigungu} {road}" if road else None
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = []
        if road_full:
            if bld_name: geo_addrs.append((f"{road_full} {bld_name}", 'keyword'))
            geo_addrs.append((road_full, 'addr'))
        if bld_name and dong: geo_addrs.append((f"{sigungu} {dong} {bld_name}", 'keyword'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        if bld_name:   geo_addrs.append((bld_name, 'keyword'))
        rows.append({
            'sigungu':   sigungu,
            'dong':      dong,
            'addr':      jibun_full or f"{sigungu} {dong}",
            'name':      bld_name,
            'build_use': text(it, '건물주용도') or text(it, 'buildingUse'),
            'area':      float_or_none(text(it, '전용면적') or text(it, 'buildingAr')),
            'land_area': float_or_none(text(it, '대지면적') or text(it, 'plottageAr')),
            'price':     price_eok(text(it, '거래금액') or text(it, 'dealAmount')),
            'date':      f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':     int_or_none(text(it, '층') or text(it, 'floor')),
            'built':     int_or_none(text(it, '건축년도') or text(it, 'buildYear')),
            'lat': None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

# ── 지오코딩 ──────────────────────────────────────────────
JEJU_LAT_MIN, JEJU_LAT_MAX = 33.10, 33.62
JEJU_LNG_MIN, JEJU_LNG_MAX = 126.08, 126.98
_geo_cache = {}

def _in_jeju(lat, lng):
    return JEJU_LAT_MIN <= lat <= JEJU_LAT_MAX and JEJU_LNG_MIN <= lng <= JEJU_LNG_MAX

def kakao_geocode(addr):
    if not addr: return None
    key = 'a:' + addr
    if key in _geo_cache: return _geo_cache[key]
    full = addr if ('제주시' in addr or '서귀포시' in addr) else '제주특별자치도 ' + addr
    url = f'https://dapi.kakao.com/v2/local/search/address.json?{urllib.parse.urlencode({"query": full})}'
    req = urllib.request.Request(url, headers={'Authorization': f'KakaoAK {KAKAO_REST_KEY}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            docs = json.loads(r.read().decode())['documents']
        if docs:
            lat, lng = float(docs[0]['y']), float(docs[0]['x'])
            result = {'lat': lat, 'lng': lng} if _in_jeju(lat, lng) else None
            _geo_cache[key] = result
            return result
    except Exception: pass
    _geo_cache[key] = None
    return None

def kakao_keyword(keyword):
    if not keyword or len(keyword) < 2: return None
    key = 'k:' + keyword
    if key in _geo_cache: return _geo_cache[key]
    kw = keyword if ('제주시' in keyword or '서귀포시' in keyword) else '제주 ' + keyword
    params = urllib.parse.urlencode({'query': kw, 'x': '126.5292', 'y': '33.3617', 'radius': 50000})
    url = f'https://dapi.kakao.com/v2/local/search/keyword.json?{params}'
    req = urllib.request.Request(url, headers={'Authorization': f'KakaoAK {KAKAO_REST_KEY}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            docs = json.loads(r.read().decode())['documents']
        if docs:
            lat, lng = float(docs[0]['y']), float(docs[0]['x'])
            result = {'lat': lat, 'lng': lng} if _in_jeju(lat, lng) else None
            _geo_cache[key] = result
            return result
    except Exception: pass
    _geo_cache[key] = None
    return None

def geocode_row(r):
    for entry in (r.get('_geo_addrs') or []):
        addr, mode = (entry if isinstance(entry, tuple) else (entry, 'addr'))
        if not addr: continue
        coord = kakao_keyword(addr) if mode == 'keyword' else kakao_geocode(addr)
        if coord:
            r['lat'], r['lng'] = coord['lat'], coord['lng']
            return True
        time.sleep(0.05)
    return False

def geocode_all(rows):
    todo = [r for r in rows if not r.get('lat')]
    print(f'  지오코딩 대상: {len(todo)}건')
    ok = 0
    for r in todo:
        if geocode_row(r):
            ok += 1
        time.sleep(0.05)
    print(f'  지오코딩 완료: {ok}/{len(todo)}건 성공')

# ── 월별 안전 업로드 (핵심 로직) ─────────────────────────
def safe_upload_by_month(table, month_rows_map):
    """
    월별로 DELETE → INSERT 순서로 처리.
    한 월씩 처리하므로 INSERT 실패해도 다른 월에 영향 없음.
    month_rows_map: {'202409': [row, ...], '202408': [...], ...}
    """
    total_inserted = 0
    for ym, rows in month_rows_map.items():
        y, m = ym[:4], ym[4:]
        date_prefix = f'{y}-{m}'
        print(f'  [{table}] {date_prefix} → {len(rows)}건 처리 중...')

        # 1. 삭제 (해당 월만)
        del_ok = sb_delete_month(table, ym)
        if not del_ok:
            print(f'  [{table}] {date_prefix} DELETE 실패 → 이 월 스킵 (기존 데이터 보존)')
            continue

        # 2. 삽입 (삭제 성공한 경우만)
        if rows:
            inserted = sb_insert(table, rows)
            total_inserted += inserted
            print(f'  [{table}] {date_prefix} → {inserted}/{len(rows)}건 삽입 완료')
        else:
            print(f'  [{table}] {date_prefix} → API 데이터 없음 (삭제 후 빈 상태)')

        time.sleep(0.2)

    return total_inserted

# ── 메인 ─────────────────────────────────────────────────
def main():
    preflight()

    months = get_months(MONTHS_BACK)
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    print(f'\n{"="*50}')
    print(f'제주 부동산 증분 업데이트 ({now_str})')
    print(f'처리 기간: {months[-1]} ~ {months[0]} ({MONTHS_BACK}개월)')
    print(f'지역: {[r[1] for r in REGIONS]}')
    print(f'{"="*50}')

    tasks = [
        ('getRTMSDataSvcAptTrade',  'apt_trades',   parse_apt,   'roadaddr'),
        ('getRTMSDataSvcSHTrade',   'house_trades',  parse_house, 'addr'),
        ('getRTMSDataSvcRHTrade',   'rht_trades',    parse_rht,   'roadaddr'),
        ('getRTMSDataSvcLandTrade', 'land_trades',   parse_land,  'addr'),
        ('getRTMSDataSvcNrgTrade',  'comm_trades',   parse_comm,  'roadaddr'),
    ]

    for service, table, parser, _ in tasks:
        print(f'\n▶ {table}')

        # 월별로 수집 (월→지역 순서로 수집, 이후 월별 분류)
        month_rows_map = {ym: [] for ym in months}

        for ym in months:
            for lawd_cd, sigungu in REGIONS:
                items = molit_fetch_all(service, lawd_cd, ym)
                rows = parser(items, sigungu)
                print(f'  {sigungu} {ym[:4]}년 {ym[4:]}월 → {len(rows)}건')
                month_rows_map[ym].extend(rows)
                time.sleep(0.3)

        # 전체 rows (지오코딩용)
        all_rows = [r for rows in month_rows_map.values() for r in rows]
        if not all_rows:
            print(f'  데이터 없음, 스킵')
            continue

        # 지오코딩 (한 번에 전체 처리 → 캐시 공유로 효율적)
        geocode_all(all_rows)

        # 월별 안전 업로드
        inserted = safe_upload_by_month(table, month_rows_map)
        print(f'  ✓ {table} 완료: 총 {inserted}건 삽입')

    print(f'\n{"="*50}')
    print(f'✅ 증분 업데이트 완료! ({datetime.now().strftime("%H:%M:%S")})')
    print(f'{"="*50}')

if __name__ == '__main__':
    main()
