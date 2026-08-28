/* js/supabase.js - DB 연결 및 데이터 로더 */
function loadGeoCache() {
  try { return JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}'); } catch(e) { return {}; }
}
function saveGeoCache(cache) {
  try { localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache)); } catch(e) {}
}


async function sbFetchAll(table, select='*', extraParams='') {
  const pageSize = 1000;
  // 1) count 먼저 조회해서 전체 페이지 수 파악
  const countUrl = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=1${extraParams}`;
  let totalCount = 0;
  try {
    const countR = await fetch(countUrl, {
      headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON, 'Prefer': 'count=exact' }
    });
    const cr = countR.headers.get('content-range');
    totalCount = parseInt((cr || '').split('/')[1]) || 0;
  } catch(_) {}

  if (totalCount === 0) {
    // fallback: 순차 방식
    let rows = [], offset = 0, done = false;
    while (!done) {
      const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${offset}${extraParams}`;
      const r = await fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON } });
      if (!r.ok) throw new Error(await r.text());
      const batch = await r.json();
      rows = rows.concat(batch);
      if (batch.length < pageSize) done = true;
      else offset += pageSize;
    }
    return rows;
  }

  // 2) 전체 페이지를 병렬로 동시 fetch
  const pages = Math.ceil(totalCount / pageSize);
  const promises = Array.from({ length: pages }, (_, i) => {
    const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${i * pageSize}${extraParams}`;
    return fetch(url, { headers: { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON } })
      .then(r => { if (!r.ok) throw new Error(r.statusText); return r.json(); });
  });
  const results = await Promise.all(promises);
  return results.flat();
}

// 아파트 실거래 로드
(function loadRealTradeData() {
  function normalizeApt(data) {
    data.forEach(d => {
      d.roadAddr = d.roadaddr || d.roadAddr || '';
      d.price    = parseFloat(d.price) || 0;
      d.area     = parseFloat(d.area)  || 0;
    });
  }
  function applyAptData(data, source) {
    const geoCache = loadGeoCache();
    data.forEach(d => {
      const hit = d.roadAddr && geoCache[d.roadAddr];
      if (hit) { d.lat = hit.lat; d.lng = hit.lng; }
    });
    window.TRADE_DATA = data;
    document.getElementById('trade-data-source').textContent =
      `실거래 데이터 · ${data.length.toLocaleString()}건 (${source})`;
    if (typeof tradeVisible !== 'undefined' && tradeVisible) {
      clearTradeMarkers(); renderTradeMarkers(); renderTradeChart();
    }
    if (typeof bubbleVisible !== 'undefined' && bubbleVisible) renderBubbles();
    console.log(`[실거래] ${source} 로드 완료: ${data.length}건`);
    return { data, geoCache };
  }
  function startGeocoding(data, geoCache) {
    const gc = new kakao.maps.services.Geocoder();
    const todo = [...new Set(
      data.filter(d => d.roadAddr && !geoCache[d.roadAddr]).map(d => d.roadAddr)
    )];
    if (!todo.length) return;
    let idx = 0, newEntries = 0;
    function geocodeNext() {
      if (idx >= todo.length) {
        if (newEntries > 0) {
          saveGeoCache(geoCache);
          if (typeof tradeVisible !== 'undefined' && tradeVisible) {
            clearTradeMarkers(); renderTradeMarkers();
          }
          if (typeof bubbleVisible !== 'undefined' && bubbleVisible) renderBubbles();
        }
        return;
      }
      const addr = todo[idx++];
      gc.addressSearch('제주특별자치도 ' + addr, function(result, status) {
        if (status === kakao.maps.services.Status.OK && result.length) {
          const lat = parseFloat(result[0].y), lng = parseFloat(result[0].x);
          geoCache[addr] = { lat, lng };
          data.forEach(d => { if (d.roadAddr === addr) { d.lat = lat; d.lng = lng; } });
          newEntries++;
        }
        setTimeout(geocodeNext, 250);
      });
    }
    geocodeNext();
  }

  // 1단계: 로컬 JSON 즉시 로드
  fetch('./trade_data.json')
    .then(r => r.json())
    .then(data => {
      normalizeApt(data);
      const { data: d, geoCache } = applyAptData(data, '로컬');
      startGeocoding(d, geoCache);
    })
    .catch(e => console.log('[실거래] 로컬 JSON 로드 실패:', e.message));

  // 2단계: Supabase 백그라운드 갱신
  sbFetchAll('apt_trades')
    .then(data => {
      normalizeApt(data);
      const { data: d, geoCache } = applyAptData(data, 'Supabase');
      startGeocoding(d, geoCache);
    })
    .catch(e => console.log('[실거래] Supabase 로드 실패:', e.message));
})();

// 토지 실거래 로드 — 로컬 JSON 우선(빠름), 이후 Supabase로 백그라운드 갱신
(function loadLandData() {
  function normalizeLand(d) {
    d.perM2     = parseFloat(d.per_m2 ?? d.perM2)  || 0;
    d.jibunType = d.jibun_type  || d.jibunType || '';
    d.tradeType = d.trade_type  || d.tradeType || '';
    d.price     = parseFloat(d.price) || 0;
    d.area      = parseFloat(d.area)  || 0;
    return d;
  }
  function applyLandData(data, source) {
    window.LAND_DATA = data;
    const el = document.getElementById('land-data-source');
    if (el) el.textContent = `토지 데이터 · ${data.length.toLocaleString()}건 (${source})`;
    if (typeof landVisible !== 'undefined' && landVisible) {
      clearLandMarkers(); renderLandMarkers();
    }
    console.log(`[토지] ${source} 로드: ${data.length}건`);
  }

  // 1단계: 로컬 JSON 즉시 로드
  fetch('./land_data.json')
    .then(r => r.json())
    .then(data => {
      data.forEach(normalizeLand);
      applyLandData(data, '로컬');
    })
    .catch(e => console.log('[토지] 로컬 JSON 로드 실패:', e.message));

  // 2단계: Supabase 백그라운드 갱신 (최신 데이터로 조용히 교체)
  sbFetchAll('land_trades')
    .then(data => {
      data.forEach(normalizeLand);
      applyLandData(data, 'Supabase');
    })
    .catch(e => console.log('[토지] Supabase 로드 실패:', e.message));
})();

