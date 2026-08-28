/* js/data-modal.js - 제주 부동산 플랫폼 */

function openDataModal() {
  document.getElementById('data-modal-backdrop').classList.add('open');
}
function closeDataModal() {
  document.getElementById('data-modal-backdrop').classList.remove('open');
}
function switchDmTab(tab, btn) {
  dmActiveTab = tab;
  document.querySelectorAll('.dm-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dm-section').forEach(s => s.classList.remove('active'));
  document.getElementById('dm-' + tab).classList.add('active');
}

// ── CSV 처리 ──
function handleCsvDrop(e) {
  e.preventDefault();
  document.getElementById('csv-dropzone').classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) handleCsvFile(file);
}
function handleCsvFile(file) {
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    const text = e.target.result;
    const parsed = parseCsvToTrade(text, file.name);
    csvParsedData = parsed;
    const preview = document.getElementById('csv-preview');
    if (parsed.length > 0) {
      const withCoord = parsed.filter(r => r.lat).length;
      preview.innerHTML =
        `<div class="cp-ok">✓ ${parsed.length}건 인식</div>` +
        `<div>위경도 있음 ${withCoord}건 / 주소 변환 필요 ${parsed.length - withCoord}건</div>` +
        `<div style="color:#555;margin-top:4px;">샘플: ${parsed[0].name} · ${parsed[0].price}억 · ${parsed[0].date}</div>`;
      preview.style.display = 'block';
    } else {
      preview.innerHTML = '<div class="cp-warn">⚠ 인식된 데이터가 없습니다. 컬럼명을 확인해 주세요.</div>';
      preview.style.display = 'block';
    }
  };
  reader.readAsText(file, 'UTF-8');
}

function parseCsvToTrade(text, filename) {
  const lines = text.trim().split('\n').map(l => l.replace(/\r/g,''));
  if (lines.length < 2) return [];
  // BOM 제거
  if (lines[0].charCodeAt(0) === 0xFEFF) lines[0] = lines[0].slice(1);
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g,'').toLowerCase());

  const colMap = {
    sigungu: find(headers,['시군구','시군구명']),
    name:    find(headers,['단지명','건물명','아파트','단지']),
    area:    find(headers,['전용면적','면적']),
    price:   find(headers,['거래금액','금액']),
    year:    find(headers,['계약년도','년도','거래년도']),
    month:   find(headers,['계약월','월','거래월']),
    day:     find(headers,['계약일','일','거래일']),
    road:    find(headers,['도로명','도로명주소','주소']),
    lat:     find(headers,['위도','lat','latitude']),
    lng:     find(headers,['경도','lng','longitude']),
  };

  const result = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    if (cols.length < 3) continue;
    const g = idx => idx >= 0 ? (cols[idx]||'').trim().replace(/"/g,'') : '';
    const priceRaw = g(colMap.price).replace(/,/g,'').replace(/\s/g,'');
    const priceMan = parseInt(priceRaw);
    if (isNaN(priceMan) || priceMan <= 0) continue;
    const priceEok = Math.round(priceMan / 1000) / 100; // 만원 → 억
    const year = g(colMap.year) || '2026';
    const month = (g(colMap.month)||'1').padStart(2,'0');
    const day = (g(colMap.day)||'1').padStart(2,'0');
    const addr = g(colMap.sigungu) + ' ' + g(colMap.road);
    const latV = parseFloat(g(colMap.lat));
    const lngV = parseFloat(g(colMap.lng));
    result.push({
      id: 10000 + i,
      name: g(colMap.name) || g(colMap.sigungu) || '거래건',
      addr: addr.trim(),
      lat: isNaN(latV) ? null : latV,
      lng: isNaN(lngV) ? null : lngV,
      type: '아파트',
      area: parseFloat(g(colMap.area)) || 84,
      price: priceEok,
      date: `${year}-${month}-${day}`
    });
  }
  return result;
}
function find(headers, candidates) {
  for (const c of candidates) {
    const i = headers.findIndex(h => h.includes(c));
    if (i >= 0) return i;
  }
  return -1;
}
function splitCsvLine(line) {
  const result = []; let cur = ''; let inQ = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === '"') { inQ = !inQ; continue; }
    if (line[i] === ',' && !inQ) { result.push(cur); cur = ''; continue; }
    cur += line[i];
  }
  result.push(cur);
  return result;
}

// ── API 처리 ──
const API_ENDPOINTS = {
  apt:   'getRTMSDataSvcAptTradeDev',
  offi:  'getRTMSDataSvcOffiTradeDev',
  house: 'getRTMSDataSvcSHTradeDev',
};

async function fetchApiData(apiKey, regionVal, months, type) {
  // regionVal: 'all' | '50110' | '50130' | '50110|노형동' 등
  let lawdCds, dongFilter = null;
  if (regionVal === 'all') {
    lawdCds = ['50110','50130'];
  } else if (regionVal.includes('|')) {
    const [lawd, dong] = regionVal.split('|');
    lawdCds = [lawd]; dongFilter = dong;
  } else {
    lawdCds = [regionVal];
  }
  const endpoint = API_ENDPOINTS[type] || API_ENDPOINTS.apt;
  const now = new Date('2026-08-21');
  const yearMonths = [];
  for (let m = 0; m < months; m++) {
    const d = new Date(now); d.setMonth(d.getMonth() - m);
    yearMonths.push(d.getFullYear() + '' + String(d.getMonth()+1).padStart(2,'0'));
  }
  const results = [];
  let done = 0; const total = codes.length * yearMonths.length;
  for (const lawdCd of lawdCds) {
    for (const ym of yearMonths) {
      const url = `https://apis.data.go.kr/1613000/RTMSDataSvc${endpoint.replace('Dev','')}/${endpoint}` +
        `?serviceKey=${encodeURIComponent(apiKey)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=1`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      try {
        const res = await fetch(proxyUrl);
        const json = await res.json();
        const xml = new DOMParser().parseFromString(json.contents, 'text/xml');
        const items = xml.querySelectorAll('item');
        items.forEach(item => {
          const g = tag => (item.querySelector(tag)||{}).textContent||'';
          const dongName = g('법정동').trim();
          // 법정동 필터 적용
          if (dongFilter && dongName !== dongFilter) return;
          const priceRaw = g('거래금액').replace(/,/g,'').trim();
          const priceMan = parseInt(priceRaw);
          if (isNaN(priceMan)) return;
          const year = g('년'), month = g('월').padStart(2,'0'), day = g('일').padStart(2,'0');
          // 법정동 정보에서 좌표 찾기
          const bjInfo = window.JEJU_BEOPJEONGDONG.find(b => b.dong === dongName && b.lawdCd === lawdCd);
          results.push({
            id: 20000 + results.length,
            name: g('아파트') || g('단지명') || g('건물명') || dongName + ' 거래',
            addr: (lawdCd==='50110'?'제주시 ':'서귀포시 ') + dongName,
            sigungu: lawdCd==='50110'?'제주시':'서귀포시',
            dong: dongName,
            lawdCd,
            lat: bjInfo ? Math.min(33.570, Math.max(33.220, bjInfo.lat + (Math.random()-0.5)*0.006)) : null,
            lng: bjInfo ? bjInfo.lng + (Math.random()-0.5)*0.006 : null,
            type: type === 'apt' ? '아파트' : type === 'offi' ? '오피스텔' : '단독',
            area: parseFloat(g('전용면적')) || 84,
            price: Math.round(priceMan / 1000) / 100,
            date: `${year}-${month}-${day}`
          });
        });
      } catch(e) { /* 개별 요청 실패 무시 */ }
      done++;
      setProgress(done / total * 70, `데이터 수집 중... ${done}/${total}`);
    }
  }
  return results;
}

// ── 지오코딩 (주소 → 위경도) ──
async function geocodeAll(data) {
  const needGeo = data.filter(d => !d.lat);
  if (needGeo.length === 0) return data;
  const addrMap = {};
  // 주소별 중복 제거
  const uniqueAddrs = [...new Set(needGeo.map(d => d.addr).filter(a => a.trim()))];
  let done = 0;
  await new Promise(resolve => {
    let i = 0;
    function next() {
      if (i >= uniqueAddrs.length) { resolve(); return; }
      const addr = uniqueAddrs[i++];
      geocoder.addressSearch(addr, function(result, status) {
        if (status === kakao.maps.services.Status.OK && result[0]) {
          addrMap[addr] = { lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) };
        }
        done++;
        setProgress(70 + done / uniqueAddrs.length * 28, `위경도 변환 중... ${done}/${uniqueAddrs.length}`);
        setTimeout(next, 80); // rate limit
      });
    }
    next();
  });
  return data.map(d => {
    if (d.lat) return d;
    const coord = addrMap[d.addr];
    if (coord) return { ...d, lat: Math.min(33.570, Math.max(33.220, coord.lat + (Math.random()-0.5)*0.003)), lng: coord.lng + (Math.random()-0.5)*0.003 };
    return null;
  }).filter(Boolean);
}

function setProgress(pct, text) {
  document.getElementById('dm-progress-bar').style.width = pct + '%';
  document.getElementById('dm-progress-text').textContent = text;
}

// ── 불러오기 버튼 ──
async function loadTradeData() {
  const btn = document.getElementById('dm-load-btn');
  btn.disabled = true;
  document.getElementById('dm-progress').style.display = 'block';
  setProgress(5, '준비 중...');
  try {
    let raw = [];
    if (dmActiveTab === 'csv') {
      if (!csvParsedData || csvParsedData.length === 0) {
        alert('먼저 CSV 파일을 선택해 주세요.'); btn.disabled = false; return;
      }
      raw = csvParsedData;
    } else {
      const apiKey = document.getElementById('api-key-input').value.trim();
      if (!apiKey) { alert('API 키를 입력해 주세요.'); btn.disabled = false; return; }
      const region = document.getElementById('api-region').value;
      const months = parseInt(document.getElementById('api-period').value);
      const type   = document.getElementById('api-type').value;
      raw = await fetchApiData(apiKey, region, months, type);
    }
    setProgress(70, '위경도 변환 중...');
    const geocoded = await geocodeAll(raw);
    setProgress(99, '완료!');
    window.TRADE_DATA = geocoded;
    const src = dmActiveTab === 'csv' ? 'CSV 업로드' : '공공데이터 API';
    document.getElementById('trade-data-source').textContent =
      `${src} · ${geocoded.length}건 로드됨`;
    if (tradeVisible) { clearTradeMarkers(); renderTradeMarkers(); renderTradeChart(); }
    setTimeout(() => {
      closeDataModal();
      document.getElementById('dm-progress').style.display = 'none';
      btn.disabled = false;
      setProgress(0,'');
      showToast(`✓ 실거래 데이터 ${geocoded.length}건 로드 완료`);
    }, 600);
  } catch(e) {
    alert('오류: ' + e.message);
    btn.disabled = false;
    document.getElementById('dm-progress').style.display = 'none';
  }
}

