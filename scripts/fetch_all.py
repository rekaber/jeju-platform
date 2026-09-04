"""
제주 부동산 실거래 데이터 자동 수집 및 Supabase 업로드
국토교통부 실거래가 API → Supabase (apt_trades, land_trades, house_trades, rht_trades, comm_trades)
국토교통부 건축인허가 API → Supabase (arch_permits)

환경변수:
  MOLIT_API_KEY        - 국토교통부 공공데이터포털 API 서비스키
  SUPABASE_URL         - Supabase 프로젝트 URL
  SUPABASE_SERVICE_KEY - Supabase 서비스롤 키
  KAKAO_REST_KEY       - 카카오 REST API 키 (지오코딩용)
"""

import os, time, json, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# ── 설정 ────────────────────────────────────────────────
MOLIT_KEY      = os.environ.get('MOLIT_API_KEY', '')
SUPABASE_URL   = os.environ.get('SUPABASE_URL', 'https://boukipzpoapqotvauzrj.supabase.co')
SUPABASE_KEY   = os.environ.get('SUPABASE_SERVICE_KEY', '')
KAKAO_REST_KEY = os.environ.get('KAKAO_REST_KEY', '')

REGIONS = [('50110', '제주시'), ('50130', '서귀포시')]
MONTHS_BACK = 36  # 전체 백필용 (1회 실행 후 3으로 복원)

SUPABASE_HEADERS = {
    'apikey': SUPABASE_KEY,
    'Authorization': f'Bearer {SUPABASE_KEY}',
    'Content-Type': 'application/json',
    'Prefer': 'return=minimal'
}

# ── 유틸 ────────────────────────────────────────────────
def get_months(n):
    """최근 n개월 YYYYMM 리스트 (최신 순)"""
    now = datetime.now()
    months = []
    for i in range(n):
        y = now.year
        m = now.month - i
        while m <= 0:
            m += 12; y -= 1
        months.append(f'{y}{m:02d}')
    return months

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

def molit_fetch(service, lawd_cd, deal_ymd, page=1, rows=1000):
    """국토교통부 API 단일 페이지 조회"""
    base = f'https://apis.data.go.kr/1613000/{service[3:]}/{service}'
    other = urllib.parse.urlencode({
        'LAWD_CD': lawd_cd,
        'DEAL_YMD': deal_ymd,
        'numOfRows': rows,
        'pageNo': page,
    })
    encoded_key = urllib.parse.quote(urllib.parse.unquote(MOLIT_KEY), safe="")
    url = f'{base}?serviceKey={encoded_key}&{other}'
    if page == 1:
        masked = encoded_key[:20] + '...' + encoded_key[-10:]
        print(f'  [DEBUG] URL: {base}?serviceKey={masked}&{other}')
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.read().decode('utf-8')
    except urllib.error.HTTPError as e:
        body = e.read().decode('utf-8', errors='ignore')[:300]
        print(f'  API 오류: {e} | 응답: {body}')
        return None
    except Exception as e:
        print(f'  API 오류: {e}')
        return None

def molit_fetch_all(service, lawd_cd, deal_ymd):
    """페이지네이션 포함 전체 조회"""
    all_items = []
    page = 1
    while True:
        xml_str = molit_fetch(service, lawd_cd, deal_ymd, page)
        if not xml_str:
            break
        try:
            root = ET.fromstring(xml_str)
        except ET.ParseError as e:
            print(f'  XML 파싱 오류: {e}')
            break
        if page == 1:
            print(f'  [DEBUG XML] {xml_str[:800]}')
        items = root.findall('.//item')
        all_items.extend(items)
        total_el = root.find('.//totalCount')
        total = int(total_el.text) if total_el is not None and total_el.text else 0
        if page * 1000 >= total:
            break
        page += 1
        time.sleep(0.2)
    return all_items

# ── Supabase 업로드 ──────────────────────────────────────
def sb_delete_by_months(table, months):
    """특정 월 데이터 삭제 (date like '2025-01%' OR ...)"""
    import urllib.request
    for ym in months:
        y, m = ym[:4], ym[4:]
        prefix = f'{y}-{m}'
        url = f'{SUPABASE_URL}/rest/v1/{table}?date=like.{prefix}%25'
        req = urllib.request.Request(url, method='DELETE', headers=SUPABASE_HEADERS)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                pass
        except Exception as e:
            print(f'  삭제 오류 ({table}, {prefix}): {e}')
    time.sleep(0.3)

def sb_insert(table, rows, batch=400):
    """Supabase 배치 삽입 (_geo_addrs 등 내부 필드 자동 제거)"""
    total, ok = len(rows), 0
    for i in range(0, total, batch):
        chunk = [{k: v for k, v in r.items() if not k.startswith('_')} for r in rows[i:i+batch]]
        data = json.dumps(chunk).encode('utf-8')
        req = urllib.request.Request(
            f'{SUPABASE_URL}/rest/v1/{table}',
            data=data, method='POST', headers=SUPABASE_HEADERS
        )
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                ok += len(chunk)
                print(f'  [{table}] {ok}/{total} 업로드됨')
        except urllib.error.HTTPError as e:
            body = e.read().decode('utf-8')[:200]
            print(f'  삽입 오류 ({e.code}): {body}')
        time.sleep(0.2)

# ── 주소 조합 유틸 ───────────────────────────────────────
def build_road_addr(sigungu, road, b_main_raw, b_sub_raw):
    """시군구 + 도로명 + 건물번호 → 카카오 geocode용 완전한 도로명주소"""
    b_main = (b_main_raw or '').lstrip('0')
    b_sub  = (b_sub_raw  or '').lstrip('0')
    if road and b_main:
        base = f"{sigungu} {road} {b_main}"
        return base + (f"-{b_sub}" if b_sub and b_sub != '0' else '')
    return None

def build_jibun_addr(sigungu, dong, main_raw, sub_raw):
    """시군구 + 법정동 + 지번(본번-부번) → 지번주소"""
    main = (main_raw or '').lstrip('0')
    sub  = (sub_raw  or '').lstrip('0')
    if dong and main:
        return f"{sigungu} {dong} {main}" + (f"-{sub}" if sub and sub != '0' else '')
    return f"{sigungu} {dong}" if dong else None

def get_jibun(it):
    """MOLIT API 버전별로 본번/부번 필드명이 다를 수 있어 양쪽 시도"""
    main = text(it, '본번') or text(it, '법정동본번코드')
    sub  = text(it, '부번') or text(it, '법정동부번코드')
    return main.lstrip('0'), sub.lstrip('0')

# ── 데이터 파서 ─────────────────────────────────────────
def parse_apt(items, sigungu):
    rows = []
    for it in items:
        # 구버전(한글) / 신버전(영문) 필드명 모두 지원
        년 = text(it, '년') or text(it, 'dealYear')
        월 = text(it, '월') or text(it, 'dealMonth')
        일 = text(it, '일') or text(it, 'dealDay')
        if not (년 and 월 and 일): continue
        dong     = text(it, '법정동') or text(it, 'umdNm')
        road     = text(it, '도로명') or text(it, 'roadNm') or ''
        apt_name = text(it, '아파트') or text(it, 'aptNm')
        # 도로명 주소 조합
        road_full  = f"{sigungu} {road}" if road else None
        # 지번: 구버전은 본번/부번 분리, 신버전은 jibun 필드(예: "754-4")
        jibun_raw = text(it, 'jibun')
        if jibun_raw:
            parts = jibun_raw.split('-')
            _jm = parts[0].lstrip('0')
            _js = parts[1].lstrip('0') if len(parts) > 1 else ''
        else:
            _jm, _js = get_jibun(it)
        jibun_full = build_jibun_addr(sigungu, dong, _jm, _js)
        # 우선순위: 도로명주소 > 도로명+이름 keyword > 동+이름 keyword > 지번
        geo_addrs = []
        if road_full:
            geo_addrs.append((road_full, 'addr'))
            if apt_name:
                geo_addrs.append((f"{road_full} {apt_name}", 'keyword'))
        if apt_name and dong:
            geo_addrs.append((f"{sigungu} {dong} {apt_name}", 'keyword'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        if apt_name:   geo_addrs.append((apt_name, 'keyword'))
        rows.append({
            'name':       apt_name,
            'addr':       jibun_full or f"{sigungu} {dong}",
            'sigungu':    sigungu,
            'dong':       dong,
            'roadaddr':   road_full or '',
            'type':       'apt',
            'area':       float_or_none(text(it, '전용면적') or text(it, 'excluUseAr')),
            'price':      price_eok(text(it, '거래금액') or text(it, 'dealAmount')),
            'date':       f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':      int_or_none(text(it, '층') or text(it, 'floor')),
            'built':      int_or_none(text(it, '건축년도') or text(it, 'buildYear')),
            'lat':        None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_house(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        dong = text(it, '법정동')
        road = text(it, '도로명')
        road_full  = f"{sigungu} {road}" if road else None
        _jm, _js = get_jibun(it); jibun_full = build_jibun_addr(sigungu, dong, _jm, _js)
        geo_addrs = []
        if road_full:  geo_addrs.append((road_full, 'addr'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        geo_addrs.append((f"{sigungu} {dong}", 'addr'))
        rows.append({
            'sigungu':    sigungu,
            'dong':       dong,
            'addr':       jibun_full or f"{sigungu} {dong}",
            'house_type': text(it, '주택유형'),
            'build_use':  text(it, '건물주용도'),
            'area':       float_or_none(text(it, '연면적')),
            'land_area':  float_or_none(text(it, '대지면적')),
            'price':      price_eok(text(it, '거래금액')),
            'date':       f'{년}-{int(월):02d}-{int(일):02d}',
            'built':      int_or_none(text(it, '건축년도')),
            'lat':        None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_rht(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        dong     = text(it, '법정동')
        road     = text(it, '도로명')
        rht_name = text(it, '연립다세대')
        # 도로명 필드가 이미 건물번호 포함
        road_full  = f"{sigungu} {road}" if road else None
        _jm, _js = get_jibun(it); jibun_full = build_jibun_addr(sigungu, dong, _jm, _js)
        geo_addrs = []
        if road_full:
            geo_addrs.append((road_full, 'addr'))
            if rht_name: geo_addrs.append((f"{road_full} {rht_name}", 'keyword'))
        if rht_name and dong: geo_addrs.append((f"{sigungu} {dong} {rht_name}", 'keyword'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        if rht_name: geo_addrs.append((rht_name, 'keyword'))
        rows.append({
            'name':       rht_name,
            'sigungu':    sigungu,
            'dong':       dong,
            'addr':       jibun_full or f"{sigungu} {dong}",
            'roadaddr':   road_full or '',
            'area':       float_or_none(text(it, '전용면적')),
            'price':      price_eok(text(it, '거래금액')),
            'date':       f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':      int_or_none(text(it, '층')),
            'built':      int_or_none(text(it, '건축년도')),
            'lat':        None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_land(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        area = None
        for tag in ['면적', '토지면적']:
            v = float_or_none(text(it, tag))
            if v: area = v; break
        price = price_eok(text(it, '거래금액'))
        per_m2 = round(price * 10000 / area, 1) if price and area else None  # 만원/m²
        dong  = text(it, '법정동')
        jibun = text(it, '지번')
        # 지번이 "123-4" 형태로 이미 있음 → 가장 정확한 주소
        jibun_addr = f"{sigungu} {dong} {jibun}" if jibun else f"{sigungu} {dong}"
        geo_addrs = [a for a in [jibun_addr, f"{sigungu} {dong}"] if a]
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
            'lat':        None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

def parse_comm(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        dong      = text(it, '법정동')
        road      = text(it, '도로명')
        bld_name  = text(it, '건물명')
        # 도로명 필드가 이미 건물번호 포함
        road_full  = f"{sigungu} {road}" if road else None
        _jm, _js = get_jibun(it); jibun_full = build_jibun_addr(sigungu, dong, _jm, _js)
        geo_addrs = []
        if road_full:
            geo_addrs.append((road_full, 'addr'))
            if bld_name: geo_addrs.append((f"{road_full} {bld_name}", 'keyword'))
        if bld_name and dong: geo_addrs.append((f"{sigungu} {dong} {bld_name}", 'keyword'))
        if jibun_full: geo_addrs.append((jibun_full, 'addr'))
        if bld_name:   geo_addrs.append((bld_name, 'keyword'))
        rows.append({
            'sigungu':   sigungu,
            'dong':      dong,
            'addr':      jibun_full or f"{sigungu} {dong}",
            'name':      bld_name,
            'build_use': text(it, '건물주용도'),
            'area':      float_or_none(text(it, '전용면적')),
            'land_area': float_or_none(text(it, '대지면적')),
            'price':     price_eok(text(it, '거래금액')),
            'date':      f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':     int_or_none(text(it, '층')),
            'built':     int_or_none(text(it, '건축년도')),
            'lat':       None, 'lng': None,
            '_geo_addrs': geo_addrs,
        })
    return rows

# ── 건축인허가 ───────────────────────────────────────────
ARCH_SIGUNGU = [('5011000000', '제주시'), ('5013000000', '서귀포시')]

def arch_fetch_all(sigungu_cd, start_date, end_date):
    """건축인허가 이력 전체 조회 (세움터 API)"""
    base = 'https://apis.data.go.kr/1613000/ArchPmsHstService_v2/getApBasisOulnInfo'
    all_items = []
    page = 1
    while True:
        other2 = urllib.parse.urlencode({
            'sigunguCd':  sigungu_cd[:5],
            'bjdongCd':   '00000',
            'startDate':  start_date,
            'endDate':    end_date,
            'numOfRows':  1000,
            'pageNo':     page,
        })
        url = f'{base}?serviceKey={urllib.parse.quote(urllib.parse.unquote(MOLIT_KEY), safe="")}&{other2}'
        try:
            with urllib.request.urlopen(url, timeout=30) as r:
                xml_str = r.read().decode('utf-8')
        except Exception as e:
            print(f'  건축인허가 API 오류: {e}')
            break
        try:
            root = ET.fromstring(xml_str)
        except ET.ParseError as e:
            print(f'  XML 파싱 오류: {e}')
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

def parse_arch(items, sigungu):
    rows = []
    for it in items:
        bld_nm   = text(it, 'bldNm')
        addr     = text(it, 'platPlc') or text(it, 'newPlatPlc')
        purps    = text(it, 'mainPurpsCdNm')
        arch_gb  = text(it, 'archGbCdNm')
        tot_area = float_or_none(text(it, 'totArea'))
        hhld_cnt = int_or_none(text(it, 'hhldCnt'))
        pms_day  = text(it, 'pmsDay')      # 허가일 YYYYMMDD
        use_day  = text(it, 'useAprDay')   # 사용승인일 YYYYMMDD
        # 날짜 포맷: YYYYMMDD → YYYY-MM-DD
        def fmt_day(s):
            s = (s or '').replace('-','').strip()
            return f'{s[:4]}-{s[4:6]}-{s[6:8]}' if len(s) >= 8 else None
        rows.append({
            'sigungu':     sigungu,
            'bld_nm':      bld_nm,
            'addr':        addr,
            'purps':       purps,
            'arch_gb':     arch_gb,
            'tot_area':    tot_area,
            'hhld_cnt':    hhld_cnt,
            'pms_day':     fmt_day(pms_day),
            'use_apr_day': fmt_day(use_day),
            'lat':         None,
            'lng':         None,
        })
    return rows

def fetch_arch():
    """건축인허가: 최근 1년치 수집 (날짜 기반)"""
    print('\n▶ arch_permits 수집 중...')
    now = datetime.now()
    end_date   = now.strftime('%Y%m%d')
    start_date = (now - timedelta(days=365)).strftime('%Y%m%d')
    print(f'  기간: {start_date} ~ {end_date}')

    all_rows = []
    for sigungu_cd, sigungu in ARCH_SIGUNGU:
        print(f'  {sigungu} 조회 중...')
        items = arch_fetch_all(sigungu_cd, start_date, end_date)
        rows  = parse_arch(items, sigungu)
        print(f'  → {len(rows)}건')
        all_rows.extend(rows)
        time.sleep(0.5)

    if not all_rows:
        print('  데이터 없음, 스킵')
        return

    print(f'  총 {len(all_rows)}건 → Supabase 업로드')
    # 기존 1년치 삭제 후 재삽입
    url = f'{SUPABASE_URL}/rest/v1/arch_permits?pms_day=gte.{(datetime.now()-timedelta(days=365)).strftime("%Y-%m-%d")}'
    req = urllib.request.Request(url, method='DELETE', headers=SUPABASE_HEADERS)
    try:
        with urllib.request.urlopen(req, timeout=30): pass
    except Exception as e:
        print(f'  삭제 오류: {e}')
    time.sleep(0.3)
    sb_insert('arch_permits', all_rows)

# ── 카카오 지오코딩 ──────────────────────────────────────
_geo_cache = {}  # 주소/키워드 → {lat, lng} 세션 캐시

# 제주도 유효 범위
JEJU_LAT_MIN, JEJU_LAT_MAX = 33.10, 33.62
JEJU_LNG_MIN, JEJU_LNG_MAX = 126.08, 126.98

def _in_jeju(lat, lng):
    return JEJU_LAT_MIN <= lat <= JEJU_LAT_MAX and JEJU_LNG_MIN <= lng <= JEJU_LNG_MAX

def kakao_geocode(addr):
    """카카오 주소검색 API → 좌표. 제주 범위 밖이면 None."""
    if not KAKAO_REST_KEY or not addr:
        return None
    cache_key = 'addr:' + addr
    if cache_key in _geo_cache:
        return _geo_cache[cache_key]
    # 시군구 포함 여부에 따라 prefix 결정 (중복 방지)
    full_addr = addr if ('제주시' in addr or '서귀포시' in addr) else '제주특별자치도 ' + addr
    query = urllib.parse.urlencode({'query': full_addr})
    url = f'https://dapi.kakao.com/v2/local/search/address.json?{query}'
    req = urllib.request.Request(url, headers={'Authorization': f'KakaoAK {KAKAO_REST_KEY}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
        docs = data.get('documents', [])
        if docs:
            lat, lng = float(docs[0]['y']), float(docs[0]['x'])
            result = {'lat': lat, 'lng': lng} if _in_jeju(lat, lng) else None
            _geo_cache[cache_key] = result
            return result
    except Exception:
        pass
    _geo_cache[cache_key] = None
    return None

def kakao_keyword_search(keyword):
    """카카오 키워드검색 API → 좌표 (건물명·아파트명 등 POI 검색용)."""
    if not KAKAO_REST_KEY or not keyword or len(keyword) < 2:
        return None
    cache_key = 'kw:' + keyword
    if cache_key in _geo_cache:
        return _geo_cache[cache_key]
    kw_query = keyword if ('제주시' in keyword or '서귀포시' in keyword) else '제주 ' + keyword
    params = urllib.parse.urlencode({'query': kw_query, 'x': '126.5292', 'y': '33.3617', 'radius': 50000})
    url = f'https://dapi.kakao.com/v2/local/search/keyword.json?{params}'
    req = urllib.request.Request(url, headers={'Authorization': f'KakaoAK {KAKAO_REST_KEY}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            data = json.loads(r.read().decode('utf-8'))
        docs = data.get('documents', [])
        if docs:
            lat, lng = float(docs[0]['y']), float(docs[0]['x'])
            result = {'lat': lat, 'lng': lng} if _in_jeju(lat, lng) else None
            _geo_cache[cache_key] = result
            return result
    except Exception:
        pass
    _geo_cache[cache_key] = None
    return None

def geocode_row(r):
    """단일 row를 _geo_addrs 우선순위대로 지오코딩.
    _geo_addrs: [(주소, 'addr'|'keyword'), ...] 형태.
    'keyword'는 카카오 키워드(POI) 검색, 'addr'는 주소 검색."""
    entries = r.get('_geo_addrs') or []
    for entry in entries:
        if isinstance(entry, tuple):
            addr, mode = entry
        else:
            addr, mode = entry, 'addr'
        if not addr:
            continue
        coord = kakao_keyword_search(addr) if mode == 'keyword' else kakao_geocode(addr)
        if coord:
            r['lat'] = coord['lat']
            r['lng'] = coord['lng']
            return True
        time.sleep(0.05)
    return False

def geocode_rows(rows, addr_field='roadaddr'):
    """rows 전체를 지오코딩. _geo_addrs가 있으면 우선 사용, 없으면 addr_field 폴백."""
    if not KAKAO_REST_KEY:
        print('  KAKAO_REST_KEY 없음 → 지오코딩 스킵')
        return
    todo = [r for r in rows if not r.get('lat')]
    print(f'  지오코딩 대상: {len(todo)}건')
    success = 0
    for r in todo:
        if not r.get('_geo_addrs') and r.get(addr_field):
            r['_geo_addrs'] = [r[addr_field]]
        if geocode_row(r):
            success += 1
        time.sleep(0.05)
    print(f'  지오코딩 완료: {success}/{len(todo)}건 성공')

def sb_update_coords(table, rows):
    """lat/lng가 있는 행만 Supabase PATCH로 좌표 업데이트."""
    if not KAKAO_REST_KEY:
        return
    updated = [r for r in rows if r.get('lat') and r.get('lng')]
    print(f'  Supabase 좌표 업데이트: {len(updated)}건')
    ok = 0
    for r in updated:
        # addr 기준으로 PATCH (roadaddr 또는 addr 컬럼)
        addr_val = r.get('roadaddr') or r.get('addr') or r.get('platPlc') or ''
        if not addr_val:
            continue
        addr_col = 'roadaddr' if 'roadaddr' in r else 'addr'
        encoded = urllib.parse.quote(addr_val)
        url = f'{SUPABASE_URL}/rest/v1/{table}?{addr_col}=eq.{encoded}&lat=is.null'
        payload = json.dumps({'lat': r['lat'], 'lng': r['lng']}).encode('utf-8')
        headers = {**SUPABASE_HEADERS, 'Content-Type': 'application/json', 'Prefer': 'return=minimal'}
        req = urllib.request.Request(url, data=payload, method='PATCH', headers=headers)
        try:
            with urllib.request.urlopen(req, timeout=15): ok += 1
        except Exception as e:
            pass
        time.sleep(0.05)
    print(f'  좌표 업데이트 완료: {ok}건')

# ── 메인 ────────────────────────────────────────────────
def main():
    months = get_months(MONTHS_BACK)
    print(f'조회 기간: {months}')
    print(f'지역: {[r[1] for r in REGIONS]}')

    tasks = [
        ('getRTMSDataSvcAptTrade',    'apt_trades',   parse_apt),
        ('getRTMSDataSvcSHTrade',     'house_trades',  parse_house),
        ('getRTMSDataSvcRHTrade',     'rht_trades',    parse_rht),
        ('getRTMSDataSvcLandTrade',   'land_trades',   parse_land),
        ('getRTMSDataSvcNrgTrade',    'comm_trades',   parse_comm),
    ]

    for service, table, parser in tasks:
        print(f'\n▶ {table} 수집 중...')
        all_rows = []
        for lawd_cd, sigungu in REGIONS:
            for ym in months:
                print(f'  {sigungu} {ym[:4]}년 {ym[4:]}월')
                items = molit_fetch_all(service, lawd_cd, ym)
                rows = parser(items, sigungu)
                print(f'  → {len(rows)}건')
                all_rows.extend(rows)
                time.sleep(0.3)

        if not all_rows:
            print(f'  데이터 없음, 스킵')
            continue

        # 주소 필드 결정
        addr_field = 'roadaddr' if table in ('apt_trades','rht_trades','comm_trades') else 'addr'
        # 지오코딩 (주소 → 좌표)
        geocode_rows(all_rows, addr_field)

        print(f'  총 {len(all_rows)}건 → Supabase 업로드')
        sb_delete_by_months(table, months)
        sb_insert(table, all_rows)

    # 토지는 지번주소 기반 (jibun+dong 조합)
    # land_trades 별도 지오코딩: addr = "시군구 법정동"
    # (land의 roadaddr이 없으므로 addr 필드 사용, 이미 geocode_rows에서 처리됨)

    fetch_arch()

    print('\n✅ 완료!')

if __name__ == '__main__':
    main()
