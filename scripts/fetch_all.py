"""
제주 부동산 실거래 데이터 자동 수집 및 Supabase 업로드
국토교통부 실거래가 API → Supabase (apt_trades, land_trades, house_trades, rht_trades, comm_trades)
국토교통부 건축인허가 API → Supabase (arch_permits)

환경변수:
  MOLIT_API_KEY      - 국토교통부 공공데이터포털 API 서비스키
  SUPABASE_URL       - Supabase 프로젝트 URL
  SUPABASE_SERVICE_KEY - Supabase 서비스롤 키
"""

import os, time, json, urllib.request, urllib.parse
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

# ── 설정 ────────────────────────────────────────────────
MOLIT_KEY      = os.environ.get('MOLIT_API_KEY', '')
SUPABASE_URL   = os.environ.get('SUPABASE_URL', 'https://boukipzpoapqotvauzrj.supabase.co')
SUPABASE_KEY   = os.environ.get('SUPABASE_SERVICE_KEY', '')

REGIONS = [('50110', '제주시'), ('50130', '서귀포시')]
MONTHS_BACK = 3   # 최근 N개월 데이터 갱신

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
    base = f'https://apis.data.go.kr/1613000/RTMSOBJSvc/{service}'
    params = urllib.parse.urlencode({
        'serviceKey': MOLIT_KEY,
        'LAWD_CD': lawd_cd,
        'DEAL_YMD': deal_ymd,
        'numOfRows': rows,
        'pageNo': page,
    }, quote_via=urllib.parse.quote)
    url = f'{base}?{params}'
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.read().decode('utf-8')
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
    """Supabase 배치 삽입"""
    total, ok = len(rows), 0
    for i in range(0, total, batch):
        chunk = rows[i:i+batch]
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

# ── 데이터 파서 ─────────────────────────────────────────
def parse_apt(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        rows.append({
            'name':     text(it, '아파트'),
            'addr':     f"{sigungu} {text(it, '법정동')}",
            'sigungu':  sigungu,
            'dong':     text(it, '법정동'),
            'roadaddr': text(it, '도로명'),
            'type':     'apt',
            'area':     float_or_none(text(it, '전용면적')),
            'price':    price_int(text(it, '거래금액')),
            'date':     f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':    int_or_none(text(it, '층')),
            'built':    int_or_none(text(it, '건축년도')),
            'lat':      None, 'lng': None,
        })
    return rows

def parse_house(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        rows.append({
            'sigungu':    sigungu,
            'dong':       text(it, '법정동'),
            'addr':       f"{sigungu} {text(it, '법정동')}",
            'house_type': text(it, '주택유형'),
            'build_use':  text(it, '건물주용도'),
            'area':       float_or_none(text(it, '연면적')),
            'land_area':  float_or_none(text(it, '대지면적')),
            'price':      price_int(text(it, '거래금액')),
            'date':       f'{년}-{int(월):02d}-{int(일):02d}',
            'built':      int_or_none(text(it, '건축년도')),
            'lat':        None, 'lng': None,
        })
    return rows

def parse_rht(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        rows.append({
            'name':     text(it, '연립다세대'),
            'sigungu':  sigungu,
            'dong':     text(it, '법정동'),
            'addr':     f"{sigungu} {text(it, '법정동')}",
            'roadaddr': text(it, '도로명'),
            'area':     float_or_none(text(it, '전용면적')),
            'price':    price_int(text(it, '거래금액')),
            'date':     f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':    int_or_none(text(it, '층')),
            'built':    int_or_none(text(it, '건축년도')),
            'lat':      None, 'lng': None,
        })
    return rows

def parse_land(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        area = float_or_none(text(it, '지분거래구분') or text(it, '면적'))
        # 토지면적 필드명이 API 버전마다 다를 수 있음
        for tag in ['면적', '토지면적', '지분거래구분']:
            v = float_or_none(text(it, tag))
            if v: area = v; break
        price = price_int(text(it, '거래금액'))
        per_m2 = round(price / area, 1) if price and area else None
        rows.append({
            'addr':       f"{sigungu} {text(it, '법정동')}",
            'sigungu':    sigungu,
            'dong':       text(it, '법정동'),
            'jibun':      text(it, '지번'),
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
        })
    return rows

def parse_comm(items, sigungu):
    rows = []
    for it in items:
        년 = text(it, '년'); 월 = text(it, '월'); 일 = text(it, '일')
        if not (년 and 월 and 일): continue
        rows.append({
            'sigungu':   sigungu,
            'dong':      text(it, '법정동'),
            'addr':      f"{sigungu} {text(it, '법정동')}",
            'name':      text(it, '건물명'),
            'build_use': text(it, '건물주용도'),
            'area':      float_or_none(text(it, '전용면적')),
            'land_area': float_or_none(text(it, '대지면적')),
            'price':     price_int(text(it, '거래금액')),
            'date':      f'{년}-{int(월):02d}-{int(일):02d}',
            'floor':     int_or_none(text(it, '층')),
            'built':     int_or_none(text(it, '건축년도')),
            'lat':       None, 'lng': None,
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
        params = urllib.parse.urlencode({
            'serviceKey': MOLIT_KEY,
            'sigunguCd':  sigungu_cd[:5],
            'bjdongCd':   '00000',
            'startDate':  start_date,
            'endDate':    end_date,
            'numOfRows':  1000,
            'pageNo':     page,
        }, quote_via=urllib.parse.quote)
        url = f'{base}?{params}'
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

# ── 메인 ────────────────────────────────────────────────
def main():
    months = get_months(MONTHS_BACK)
    print(f'조회 기간: {months}')
    print(f'지역: {[r[1] for r in REGIONS]}')

    tasks = [
        ('getRTMSDataSvcAptTradeDev', 'apt_trades',   parse_apt),
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

        print(f'  총 {len(all_rows)}건 → Supabase 업로드')
        sb_delete_by_months(table, months)
        sb_insert(table, all_rows)

    fetch_arch()

    print('\n✅ 완료!')

if __name__ == '__main__':
    main()
