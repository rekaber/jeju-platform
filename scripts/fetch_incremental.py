"""
제주 부동산 실거래 증분/백필 스크립트 (자동화용)
- 기본: 최근 3개월 DELETE→INSERT
- --months N: 최근 N개월 수집
- --from YYYYMM: 해당 월부터 당월까지 수집 (예: --from 202401 → 2024-01~오늘)
- --clear: 실거래 테이블 전체 비운 뒤 수집
- 지오코딩: 지번주소 우선 → 도로명 → 단지명 키워드
- 필수 환경변수: MOLIT_API_KEY, SUPABASE_URL, SUPABASE_SERVICE_KEY, KAKAO_REST_KEY

실행 예시:
  python scripts/fetch_incremental.py
  python scripts/fetch_incremental.py --months 1
  python scripts/fetch_incremental.py --from 202401 --clear
"""

import os, sys, time, json, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# ── CLI 옵션 ─────────────────────────────────────────────
MONTHS_BACK = 3  # 기본값: 최근 3개월 (--from 없을 때)
FROM_YM = None   # --from 202401
CLEAR_TABLES = False
args = sys.argv[1:]
for i, arg in enumerate(args):
    if arg == '--months' and i + 1 < len(args):
        try:
            MONTHS_BACK = max(1, int(args[i + 1]))
        except ValueError:
            pass
    elif arg == '--from' and i + 1 < len(args):
        raw = args[i + 1].strip().replace('-', '')
        if len(raw) == 6 and raw.isdigit():
            FROM_YM = raw
        else:
            print(f'[ERROR] --from 형식은 YYYYMM 입니다: {args[i + 1]}')
            sys.exit(1)
    elif arg == '--clear':
        CLEAR_TABLES = True

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

def get_months_from(from_ym):
    """from_ym(YYYYMM) ~ 당월 inclusive, 최신→과거 순"""
    now = datetime.now()
    end_y, end_m = now.year, now.month
    y, m = int(from_ym[:4]), int(from_ym[4:6])
    if y < 2000 or m < 1 or m > 12:
        raise ValueError(f'잘못된 --from: {from_ym}')
    asc = []
    while (y < end_y) or (y == end_y and m <= end_m):
        asc.append(f'{y}{m:02d}')
        m += 1
        if m > 12:
            m = 1
            y += 1
        if len(asc) > 240:  # 안전장치
            break
    if not asc:
        raise ValueError(f'--from {from_ym} 이 당월보다 미래입니다')
    return list(reversed(asc))

def resolve_months():
    if FROM_YM:
        months = get_months_from(FROM_YM)
        label = f'{FROM_YM} ~ {months[0]} ({len(months)}개월)'
        return months, label
    months = get_months(MONTHS_BACK)
    label = f'{months[-1]} ~ {months[0]} ({MONTHS_BACK}개월)'
    return months, label

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
MOLIT_TIMEOUT = 25
MOLIT_RETRIES = 3
# 연속 실패 시 조기 중단 (타임아웃으로 6시간 소모 방지)
_api_fail_streak = 0
API_FAIL_ABORT = 8

def molit_fetch(service, lawd_cd, deal_ymd, page=1, rows=1000):
    global _api_fail_streak
    base = f'https://apis.data.go.kr/1613000/{service[3:]}/{service}'
    params = urllib.parse.urlencode({
        'LAWD_CD': lawd_cd, 'DEAL_YMD': deal_ymd,
        'numOfRows': rows, 'pageNo': page,
    })
    encoded_key = urllib.parse.quote(urllib.parse.unquote(MOLIT_KEY), safe="")
    url = f'{base}?serviceKey={encoded_key}&{params}'
    last_err = None
    for attempt in range(1, MOLIT_RETRIES + 1):
        try:
            with urllib.request.urlopen(url, timeout=MOLIT_TIMEOUT) as r:
                _api_fail_streak = 0
                return r.read().decode('utf-8')
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8', errors='ignore')[:200]
            print(f'  API HTTP 오류: {e.code} | {body}')
            if e.code == 429:
                time.sleep(min(30, 2 ** attempt))
                last_err = e
                continue
            _api_fail_streak += 1
            return None
        except Exception as e:
            last_err = e
            wait = min(20, 2 * attempt)
            print(f'  API 오류({attempt}/{MOLIT_RETRIES}): {e} → {wait}s 후 재시도')
            time.sleep(wait)
    print(f'  API 최종 실패: {last_err}')
    _api_fail_streak += 1
    return None

def molit_api_reachable():
    """백필 전 국토부 API 생존 확인 (실패 시 clear 금지)."""
    print('\n▶ 국토부 API 연결 확인…')
    # 최근 월·제주시 아파트 1페이지
    ym = datetime.now().strftime('%Y%m')
    xml = molit_fetch('getRTMSDataSvcAptTrade', '50110', ym, page=1, rows=10)
    if not xml:
        # 한 달 전으로 한 번 더
        d = datetime.now().replace(day=1) - timedelta(days=1)
        xml = molit_fetch('getRTMSDataSvcAptTrade', '50110', d.strftime('%Y%m'), page=1, rows=10)
    if xml and ('<item>' in xml or 'resultCode' in xml or 'resultMsg' in xml):
        print('  ✓ 국토부 API 응답 OK')
        return True
    print('  ✗ 국토부 API 응답 없음 (타임아웃/장애)')
    return False

def molit_fetch_all(service, lawd_cd, deal_ymd):
    global _api_fail_streak
    all_items, page = [], 1
    empty_retries = 0
    while True:
        if _api_fail_streak >= API_FAIL_ABORT:
            print(f'  ⚠ API 연속 실패 {_api_fail_streak}회 → 이 구간 중단')
            break
        xml_str = molit_fetch(service, lawd_cd, deal_ymd, page)
        if not xml_str:
            empty_retries += 1
            if empty_retries <= 1 and page == 1 and not all_items:
                time.sleep(3)
                continue
            break
        empty_retries = 0
        try:
            root = ET.fromstring(xml_str)
        except ET.ParseError as e:
            print(f'  XML 파싱 오류: {e}')
            break
        result_msg = root.findtext('.//resultMsg') or ''
        result_code = (root.findtext('.//resultCode') or '').strip()
        if result_code not in ('00', '000', '0', ''):
            print(f'  API 오류코드 {result_code}: {result_msg}')
            break
        items = root.findall('.//item')
        all_items.extend(items)
        total_el = root.find('.//totalCount')
        total = int(total_el.text) if total_el is not None and total_el.text else 0
        if not items or page * 1000 >= total:
            break
        page += 1
        time.sleep(0.35)
    return all_items

# ── Supabase ──────────────────────────────────────────────
TRADE_TABLES = (
    'apt_trades', 'house_trades', 'rht_trades', 'land_trades', 'comm_trades',
)

def sb_clear_table(table):
    """테이블 전체 삭제 (백필 시 3년치만 남기기 위해)."""
    url = f'{SUPABASE_URL}/rest/v1/{table}?id=gte.0'
    req = urllib.request.Request(url, method='DELETE', headers=SUPABASE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=120):
            print(f'  ✓ {table} 전체 삭제')
            return True
    except Exception as e:
        print(f'  [경고] {table} 전체 삭제 실패: {e}')
        return False

def sb_delete_month(table, ym):
    """단일 월 데이터 삭제. 성공/대상없음이면 True."""
    y, m = ym[:4], ym[4:]
    prefix = f'{y}-{m}'
    # PostgREST like 와일드카드는 * 또는 % (URL 인코딩 %25)
    url = f'{SUPABASE_URL}/rest/v1/{table}?date=like.{prefix}%25'
    req = urllib.request.Request(url, method='DELETE', headers=SUPABASE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=60):
            return True
    except urllib.error.HTTPError as e:
        # 404 = 매칭 행 없음 → 삭제할 것 없음 (성공으로 간주)
        if e.code in (404, 204):
            return True
        print(f'  [경고] DELETE 실패 ({table}, {prefix}): HTTP Error {e.code}')
        return False
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
            with urllib.request.urlopen(req, timeout=60):
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

def build_road_addr(sigungu, road, b_main_raw='', b_sub_raw=''):
    b_main = (b_main_raw or '').lstrip('0')
    b_sub  = (b_sub_raw  or '').lstrip('0')
    if not road:
        return None
    if b_main:
        base = f"{sigungu} {road} {b_main}"
        return base + (f"-{b_sub}" if b_sub and b_sub != '0' else '')
    return f"{sigungu} {road}"

def get_jibun(it):
    main = text(it, '본번') or text(it, '법정동본번코드')
    sub  = text(it, '부번') or text(it, '법정동부번코드')
    return main.lstrip('0'), sub.lstrip('0')

def get_road_bun(it):
    main = text(it, '도로명건물본번호코드') or text(it, 'roadNmBonbun')
    sub  = text(it, '도로명건물부번호코드') or text(it, 'roadNmBubun')
    return main, sub

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

def geo_priority_jibun_first(jibun_full, road_full, place_name, sigungu, dong):
    """지번 → 도로명 → 단지명 키워드 순 (물건 위치 정확도 우선)."""
    geo_addrs = []
    seen = set()
    def add(addr, mode):
        if not addr or addr in seen:
            return
        seen.add(addr)
        geo_addrs.append((addr, mode))
    if jibun_full and any(c.isdigit() for c in jibun_full):
        add(jibun_full, 'addr')
    if road_full:
        add(road_full, 'addr')
        if place_name:
            add(f"{road_full} {place_name}", 'keyword')
    if place_name and dong:
        add(f"{sigungu} {dong} {place_name}", 'keyword')
    if jibun_full:
        add(jibun_full, 'addr')
    if place_name:
        add(place_name, 'keyword')
    return geo_addrs

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
        b_main, b_sub = get_road_bun(it)
        road_full = build_road_addr(sigungu, road, b_main, b_sub)
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = geo_priority_jibun_first(jibun_full, road_full, apt_name, sigungu, dong)
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
        b_main, b_sub = get_road_bun(it)
        road_full = build_road_addr(sigungu, road, b_main, b_sub)
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = geo_priority_jibun_first(jibun_full, road_full, None, sigungu, dong)
        if not geo_addrs:
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
        b_main, b_sub = get_road_bun(it)
        road_full = build_road_addr(sigungu, road, b_main, b_sub)
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = geo_priority_jibun_first(jibun_full, road_full, rht_name, sigungu, dong)
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
        for tag in ['거래면적', '면적', '토지면적', 'landAr', 'dealArea', 'officialLandPriceAr']:
            v = float_or_none(text(it, tag))
            if v: area = v; break
        price = price_eok(text(it, '거래금액') or text(it, 'dealAmount'))
        per_m2 = round(price * 10000 / area, 1) if price and area else None  # 만원/㎡
        dong  = text(it, '법정동') or text(it, 'umdNm')
        jibun = text(it, '지번') or text(it, 'jibun')
        jibun_addr = f"{sigungu} {dong} {jibun}" if jibun else f"{sigungu} {dong}"
        rows.append({
            'addr':       jibun_addr,
            'sigungu':    sigungu,
            'dong':       dong,
            'jibun':      jibun,
            'jimok':      text(it, '지목') or text(it, 'lndcgrCodeNm'),
            'yongdo':     text(it, '용도지역') or text(it, 'zoning'),
            'doro':       text(it, '도로명') or text(it, 'roadNm'),
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
        b_main, b_sub = get_road_bun(it)
        road_full = build_road_addr(sigungu, road, b_main, b_sub)
        jibun_full, _, _ = parse_jibun_field(it, sigungu, dong)
        geo_addrs = geo_priority_jibun_first(jibun_full, road_full, bld_name, sigungu, dong)
        rows.append({
            'sigungu':   sigungu,
            'dong':      dong,
            'addr':      jibun_full or f"{sigungu} {dong}",
            'name':      bld_name,
            'roadaddr':  road_full or '',
            'type':      'comm',
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
        with urllib.request.urlopen(req, timeout=15) as r:
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
        with urllib.request.urlopen(req, timeout=15) as r:
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
        time.sleep(0.03)
    return False

def geocode_all(rows):
    # 동일 주소는 캐시로 공유 — 단지/지번 단위로 묶이면 호출 수 대폭 감소
    todo = [r for r in rows if not r.get('lat')]
    print(f'  지오코딩 대상: {len(todo)}건 (캐시 {len(_geo_cache)}건)')
    ok = 0
    for i, r in enumerate(todo, 1):
        if geocode_row(r):
            ok += 1
        if i % 200 == 0:
            print(f'  … 지오코딩 진행 {i}/{len(todo)} (성공 {ok}, 캐시 {len(_geo_cache)})')
        time.sleep(0.03)
    print(f'  지오코딩 완료: {ok}/{len(todo)}건 성공')

# ── 월별 안전 업로드 (핵심 로직) ─────────────────────────
def safe_upload_by_month(table, month_rows_map, skip_delete=False):
    """
    월별로 DELETE → INSERT 순서로 처리.
    skip_delete=True 이면 (--clear 후) DELETE 생략.
    """
    total_inserted = 0
    for ym, rows in month_rows_map.items():
        y, m = ym[:4], ym[4:]
        date_prefix = f'{y}-{m}'
        print(f'  [{table}] {date_prefix} → {len(rows)}건 처리 중...')

        if not skip_delete:
            del_ok = sb_delete_month(table, ym)
            if not del_ok:
                # DELETE 실패해도 INSERT는 시도 (빈 테이블 404로 데이터 유실 방지)
                print(f'  [{table}] {date_prefix} DELETE 경고 → INSERT는 계속 진행')

        if rows:
            inserted = sb_insert(table, rows)
            total_inserted += inserted
            print(f'  [{table}] {date_prefix} → {inserted}/{len(rows)}건 삽입 완료')
        else:
            print(f'  [{table}] {date_prefix} → API 데이터 없음')

        time.sleep(0.2)

    return total_inserted

# ── 메인 ─────────────────────────────────────────────────
def main():
    global _api_fail_streak
    preflight()

    months, period_label = resolve_months()
    now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
    print(f'\n{"="*50}')
    print(f'제주 부동산 데이터 업데이트 ({now_str})')
    print(f'처리 기간: {period_label}')
    print(f'지역: {[r[1] for r in REGIONS]}')
    print(f'전체 초기화(--clear): {CLEAR_TABLES}')
    print(f'{"="*50}')

    # clear 전에 API 생존 확인 — 장애 시 빈 DB로 두지 않음
    if not molit_api_reachable():
        print('\n❌ 국토부 API 장애로 백필을 중단합니다. 기존 DB를 유지하세요.')
        print('   (--clear 요청이 있어도 테이블을 비우지 않습니다)')
        sys.exit(2)

    if CLEAR_TABLES:
        print('\n▶ 실거래 테이블 전체 삭제 (재적재용)')
        for t in TRADE_TABLES:
            sb_clear_table(t)
            time.sleep(0.3)

    tasks = [
        ('getRTMSDataSvcAptTrade',  'apt_trades',   parse_apt,   'roadaddr'),
        ('getRTMSDataSvcSHTrade',   'house_trades',  parse_house, 'addr'),
        ('getRTMSDataSvcRHTrade',   'rht_trades',    parse_rht,   'roadaddr'),
        ('getRTMSDataSvcLandTrade', 'land_trades',   parse_land,  'addr'),
        ('getRTMSDataSvcNrgTrade',  'comm_trades',   parse_comm,  'roadaddr'),
    ]

    for service, table, parser, _ in tasks:
        print(f'\n▶ {table}')
        _api_fail_streak = 0
        total_inserted = 0
        consecutive_empty = 0

        # 월 단위로 수집→지오코딩→업로드 (중간에 끊겨도 이미 넣은 월은 보존)
        for ym in months:
            if _api_fail_streak >= API_FAIL_ABORT:
                print(f'  ⚠ {table}: API 연속 실패로 남은 월 스킵')
                break

            month_rows = []
            for lawd_cd, sigungu in REGIONS:
                items = molit_fetch_all(service, lawd_cd, ym)
                rows = parser(items, sigungu)
                print(f'  {sigungu} {ym[:4]}년 {ym[4:]}월 → {len(rows)}건')
                month_rows.extend(rows)
                time.sleep(0.35)

            if not month_rows:
                consecutive_empty += 1
                # 빈 월은 DELETE 하지 않음 (clear 모드가 아닐 때 기존 유지)
                if CLEAR_TABLES:
                    # clear 후에는 빈 월도 그대로 두면 됨 (이미 전체 삭제됨)
                    pass
                if consecutive_empty >= 6 and _api_fail_streak >= 4:
                    print(f'  ⚠ {table}: 연속 빈 결과+API 실패 → 테이블 중단')
                    break
                continue

            consecutive_empty = 0
            geocode_all(month_rows)
            inserted = safe_upload_by_month(
                table, {ym: month_rows}, skip_delete=CLEAR_TABLES
            )
            total_inserted += inserted

        print(f'  ✓ {table} 완료: 총 {total_inserted}건 삽입')

    print(f'\n{"="*50}')
    print(f'✅ 업데이트 완료! ({datetime.now().strftime("%H:%M:%S")})')
    print(f'{"="*50}')

if __name__ == '__main__':
    main()
