/* js/load-trades.js - extracted from index.html */
function formatTradeCount(n) {
  const v = Number(n) || 0;
  return v.toLocaleString('ko-KR') + '건';
}

function setTradeBadge(type, total, filtered) {
  const badge = document.getElementById('trade-badge-' + type);
  if (!badge) return;
  badge.removeAttribute('data-loading');
  // 레이어 OFF면 항상 0건 (지도에 안 올린 상태)
  const visible = window._typeState && window._typeState[type] && window._typeState[type].visible;
  if (!visible) {
    badge.textContent = '0건';
    return;
  }
  if (!total) {
    badge.textContent = '데이터 없음';
    return;
  }
  if (filtered != null && filtered !== total) {
    badge.textContent = formatTradeCount(filtered) + '/' + formatTradeCount(total);
  } else {
    badge.textContent = formatTradeCount(total);
  }
}

function setLandCntBadge(filtered) {
  const badge = document.getElementById('land-cnt-badge');
  if (!badge) return;
  const tog = document.getElementById('toggle-land');
  const on = !!(tog && tog.classList.contains('on'));
  if (!on) {
    badge.textContent = '0건';
    return;
  }
  const total = (window.LAND_DATA && window.LAND_DATA.length) || 0;
  if (!total) {
    badge.textContent = '데이터 없음';
    return;
  }
  const n = filtered != null ? filtered : total;
  badge.textContent = formatTradeCount(n);
}

function setEmptyTradeSource(msg) {
  const el = document.getElementById('trade-data-source');
  if (el) el.textContent = msg || '데이터 없음';
}

function escHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

(function initApiKeyField(){
  const el = document.getElementById('api-key-input');
  if (!el) return;
  try {
    const saved = localStorage.getItem('jeju_molit_api_key') || '';
    if (saved) el.value = saved;
    el.addEventListener('change', () => {
      try { localStorage.setItem('jeju_molit_api_key', el.value.trim()); } catch(_){}
    });
  } catch(_){}
})();

// 아파트 실거래 로드
(function loadRealTradeData() {
  function normalizeApt(data) {
    data.forEach(d => {
      const latN = parseFloat(d.lat);
      const lngN = parseFloat(d.lng);
      d.lat = Number.isFinite(latN) ? latN : null;
      d.lng = Number.isFinite(lngN) ? lngN : null;
      // 지번(숫자가 포함된 addr) > 도로명 > 동 — DB 좌표가 있으면 지오코딩 스킵
      const jibun = (d.addr || '').trim();
      const road  = (d.roadaddr || '').trim();
      if (jibun && /\d/.test(jibun)) d.roadAddr = jibun;
      else if (road) d.roadAddr = road;
      else if (d.sigungu && d.dong) d.roadAddr = d.sigungu + ' ' + d.dong;
      else d.roadAddr = jibun || road || '';
      d.price = parseFloat(d.price) || 0;
      d.area  = parseFloat(d.area)  || 0;
    });
    // DB lat/lng 없는 건만 동 대표점으로 임시 표시
    applyDongCoords(data);
  }
  function applyAptData(data, source) {
    const geoCache = loadGeoCache();
    data.forEach(d => {
      if (d.lat) return;  // 이미 좌표 있으면 skip
      const hit = d.roadAddr && geoCache[d.roadAddr];
      if (hit) { d.lat = hit.lat; d.lng = hit.lng; }
    });
    window.TRADE_DATA = data;
    // 타입별 시스템에도 반영
    window.MULTI_DATA = window.MULTI_DATA || {};
    window.MULTI_DATA.apt = data;
    setTradeBadge('apt', data.length);
    const srcEl = document.getElementById('trade-data-source');
    if (srcEl) {
      srcEl.textContent = data.length
        ? `실거래 데이터 · ${data.length.toLocaleString()}건`
        : '데이터 없음';
    }
    if (typeof computeRankCache === 'function') { window._rankCache = null; computeRankCache(); }
    if (typeof renderAreaRank  === 'function') renderAreaRank();
    if (typeof updateInfoPanelApt === 'function') updateInfoPanelApt();
    if (typeof tradeVisible !== 'undefined' && tradeVisible) {
      clearTradeMarkers(); renderTradeMarkers(); renderTradeChart();
    }
    // 새 타입 시스템: apt 토글이 켜져 있으면 갱신
    if (window._typeState && window._typeState.apt && window._typeState.apt.visible) {
      if (typeof renderTradeMarkersForType === 'function') renderTradeMarkersForType('apt');
      if (typeof renderTradeChartForType   === 'function') renderTradeChartForType('apt');
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
          if (isInJeju(lat, lng)) {
            geoCache[addr] = { lat, lng };
            data.forEach(d => { if (d.roadAddr === addr) { d.lat = lat; d.lng = lng; } });
            newEntries++;
          }
        }
        setTimeout(geocodeNext, 250);
      });
    }
    geocodeNext();
  }

  // 건물명 키워드 검색 fallback (아파트·연립 등 이름 있는 건물) — 전역 공유
  window.geocodeByNameFallback = function geocodeByNameFallback(data, geoCache, uiType) {
    if (!window.kakao || !kakao.maps || !kakao.maps.services) return;
    const ps = new kakao.maps.services.Places();
    // 아직 좌표 없고 이름 있는 항목만. 동 이름 포함 키워드로 정확도 향상
    const todo = data.filter(d => (!d.lat || d._approxDong) && d.name);
    // (동+이름) 조합 키 기준으로 그룹화
    const nameMap = {};
    todo.forEach(d => {
      const key = (d.sigungu || '') + ' ' + (d.dong || '') + ' ' + d.name;
      if (!nameMap[key]) nameMap[key] = [];
      nameMap[key].push(d);
    });
    const keys = Object.keys(nameMap);
    if (!keys.length) return;
    let idx = 0, updated = 0;
    function next() {
      if (idx >= keys.length) {
        if (updated > 0) {
          saveGeoCache(geoCache);
          if (uiType && window._typeState && window._typeState[uiType] && window._typeState[uiType].visible) {
            if (typeof renderTradeMarkersForType === 'function') renderTradeMarkersForType(uiType);
          }
        }
        return;
      }
      const key = keys[idx++];
      ps.keywordSearch(key, function(result, status) {
        if (status === kakao.maps.services.Status.OK && result.length) {
          const lat = parseFloat(result[0].y), lng = parseFloat(result[0].x);
          if (isInJeju(lat, lng)) {
            geoCache['kw:' + key] = { lat, lng };
            nameMap[key].forEach(d => { d.lat = lat; d.lng = lng; });
            updated++;
          }
        }
        setTimeout(next, 300);
      }, { location: new kakao.maps.LatLng(33.3617, 126.5292), radius: 50000 });
    }
    next();
  }

  // Supabase만 사용 (로컬 JSON 없음)
  sbFetchAll('apt_trades')
    .then(data => {
      normalizeApt(data);
      const { data: d, geoCache } = applyAptData(data, 'Supabase');
      if (d.length) {
        geocodeTradeData(d, geoCache, 'apt');
        setTimeout(() => window.geocodeByNameFallback && window.geocodeByNameFallback(d, geoCache, 'apt'), 3000);
      }
    })
    .catch(e => {
      console.log('[실거래] Supabase 로드 실패:', e.message);
      applyAptData([], 'Supabase');
      setEmptyTradeSource('데이터 없음');
    });
})();

// 단독/다가구 실거래 로드 — Supabase house_trades
(function loadHouseData() {
  function applyHouseData(data, source) {
    data.forEach(d => {
      const latN = parseFloat(d.lat), lngN = parseFloat(d.lng);
      d.lat = Number.isFinite(latN) ? latN : null;
      d.lng = Number.isFinite(lngN) ? lngN : null;
      const jibun = (d.addr || '').trim();
      const road  = (d.roadaddr || '').trim();
      if (jibun && /\d/.test(jibun)) d.roadAddr = jibun;
      else d.roadAddr = road || jibun || ((d.sigungu && d.dong) ? d.sigungu + ' ' + d.dong : '');
      d.price    = parseFloat(d.price) || 0;
      d.area     = parseFloat(d.area)  || 0;
      if (!d._tradeType) { d._tradeType = 'house'; d._typeColor = '#00695C'; d._typeLabel = '단독/다가구'; }
    });
    applyDongCoords(data);  // 동 좌표 즉시 설정
    const geoCache = (typeof loadGeoCache === 'function') ? loadGeoCache() : {};
    data.forEach(d => {
      if (d.lat) return;
      const hit = d.roadAddr && geoCache[d.roadAddr];
      if (hit) { d.lat = hit.lat; d.lng = hit.lng; }
    });
    window.MULTI_DATA = window.MULTI_DATA || {};
    window.MULTI_DATA.house = data;
    setTradeBadge('house', data.length);
    if (window._typeState && window._typeState.house && window._typeState.house.visible) {
      if (typeof renderTradeMarkersForType === 'function') renderTradeMarkersForType('house');
      if (typeof renderTradeChartForType   === 'function') renderTradeChartForType('house');
    }
    console.log(`[단독/다가구] ${source} 로드 완료: ${data.length}건`);
    if (data.length) {
      geocodeTradeData(data, geoCache, 'house');
      setTimeout(() => window.geocodeByNameFallback && window.geocodeByNameFallback(data, geoCache, 'house'), 4000);
    }
  }
  sbFetchAll('house_trades')
    .then(data => applyHouseData(data, 'Supabase'))
    .catch(e => {
      console.log('[단독/다가구] Supabase 로드 실패:', e.message);
      applyHouseData([], 'Supabase');
    });
})();

// 연립/다세대 실거래 로드 — Supabase
(function loadRhtData() {
  function applyRhtData(data, source) {
    data.forEach(d => {
      const latN = parseFloat(d.lat), lngN = parseFloat(d.lng);
      d.lat = Number.isFinite(latN) ? latN : null;
      d.lng = Number.isFinite(lngN) ? lngN : null;
      const jibun = (d.addr || '').trim();
      const road  = (d.roadaddr || '').trim();
      if (jibun && /\d/.test(jibun)) d.roadAddr = jibun;
      else d.roadAddr = road || jibun || ((d.sigungu && d.dong) ? d.sigungu + ' ' + d.dong : '');
      d.price    = parseFloat(d.price) || 0;
      d.area     = parseFloat(d.area)  || 0;
      if (!d._tradeType) { d._tradeType = 'rht'; d._typeColor = '#E65100'; d._typeLabel = '연립/다세대'; }
    });
    applyDongCoords(data);  // 동 좌표 즉시 설정
    const geoCache = loadGeoCache();
    data.forEach(d => {
      if (d.lat) return;
      const hit = d.roadAddr && geoCache[d.roadAddr];
      if (hit) { d.lat = hit.lat; d.lng = hit.lng; }
    });
    window.MULTI_DATA = window.MULTI_DATA || {};
    window.MULTI_DATA.rht = data;
    setTradeBadge('rht', data.length);
    if (window._typeState && window._typeState.rht && window._typeState.rht.visible) {
      if (typeof renderTradeMarkersForType === 'function') renderTradeMarkersForType('rht');
      if (typeof renderTradeChartForType   === 'function') renderTradeChartForType('rht');
    }
    console.log(`[연립/다세대] ${source} 로드 완료: ${data.length}건`);
    if (data.length) {
      geocodeTradeData(data, geoCache, 'rht');
      setTimeout(() => window.geocodeByNameFallback && window.geocodeByNameFallback(data, geoCache, 'rht'), 4000);
    }
  }
  sbFetchAll('rht_trades')
    .then(data => applyRhtData(data, 'Supabase'))
    .catch(e => {
      console.log('[연립/다세대] Supabase 로드 실패:', e.message);
      applyRhtData([], 'Supabase');
    });
})();

// 상업업무용 실거래 로드 — Supabase comm_trades
(function loadCommData() {
  function applyCommData(data, source) {
    data.forEach(d => {
      const latN = parseFloat(d.lat), lngN = parseFloat(d.lng);
      d.lat = Number.isFinite(latN) ? latN : null;
      d.lng = Number.isFinite(lngN) ? lngN : null;
      const jibun = (d.addr || '').trim();
      const road  = (d.roadaddr || '').trim();
      if (jibun && /\d/.test(jibun)) d.roadAddr = jibun;
      else d.roadAddr = road || jibun || ((d.sigungu && d.dong) ? d.sigungu + ' ' + d.dong : '');
      d.price    = parseFloat(d.price) || 0;
      d.area     = parseFloat(d.area)  || 0;
      if (!d._tradeType) { d._tradeType = 'offi'; d._typeColor = '#7B1FA2'; d._typeLabel = '상업용'; }
    });
    applyDongCoords(data);  // 동 좌표 즉시 설정
    const geoCache = (typeof loadGeoCache === 'function') ? loadGeoCache() : {};
    data.forEach(d => {
      if (d.lat) return;
      const hit = d.roadAddr && geoCache[d.roadAddr];
      if (hit) { d.lat = hit.lat; d.lng = hit.lng; }
    });
    window.MULTI_DATA = window.MULTI_DATA || {};
    window.MULTI_DATA.offi = data;
    setTradeBadge('comm', data.length);
    if (window._typeState && window._typeState.comm && window._typeState.comm.visible) {
      if (typeof renderTradeMarkersForType === 'function') renderTradeMarkersForType('comm');
      if (typeof renderTradeChartForType   === 'function') renderTradeChartForType('comm');
    }
    console.log(`[상업업무용] ${source} 로드 완료: ${data.length}건`);
    if (data.length) {
      geocodeTradeData(data, geoCache, 'comm');
      setTimeout(() => window.geocodeByNameFallback && window.geocodeByNameFallback(data, geoCache, 'comm'), 4000);
    }
  }
  sbFetchAll('comm_trades')
    .then(data => applyCommData(data, 'Supabase'))
    .catch(e => {
      console.log('[상업업무용] Supabase 로드 실패:', e.message);
      applyCommData([], 'Supabase');
    });
})();

// 토지 실거래 로드 — Supabase land_trades
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
    // lat/lng 없는 레코드에 기존 LAND_DATA 좌표 or DONG_COORDS fallback 적용
    var prevCache = {};
    if (window.LAND_DATA) {
      window.LAND_DATA.forEach(function(d) {
        if (d.lat && d.lng) {
          var k = (d.sigungu||'') + '|' + (d.dong||'') + '|' + (d.jibun||'');
          prevCache[k] = { lat: d.lat, lng: d.lng };
        }
      });
    }
    data.forEach(function(d) {
      if (!d.lat || !d.lng) {
        var k = (d.sigungu||'') + '|' + (d.dong||'') + '|' + (d.jibun||'');
        if (prevCache[k]) {
          d.lat = prevCache[k].lat; d.lng = prevCache[k].lng;
        } else {
          var key = (d.sigungu || '') + ' ' + (d.dong || '');
          var ref = typeof DONG_COORDS !== 'undefined' && DONG_COORDS[key];
          if (ref) { d.lat = ref.lat; d.lng = ref.lng; }
        }
      }
    });
    window.LAND_DATA = data;
    const el = document.getElementById('land-data-source');
    if (el) {
      el.textContent = data.length
        ? `토지 데이터 · ${data.length.toLocaleString()}건`
        : '데이터 없음';
    }
    const badge = document.getElementById('land-cnt-badge');
    if (badge) setLandCntBadge(data.length);
    if (typeof landVisible !== 'undefined' && landVisible) {
      clearLandMarkers(); renderLandMarkers();
    }
    console.log(`[토지] ${source} 로드: ${data.length}건`);
  }

  // Supabase만 사용 (로컬 JSON 없음)
  sbFetchAll('land_trades')
    .then(data => {
      data.forEach(normalizeLand);
      applyLandData(data, 'Supabase');
    })
    .catch(e => {
      console.log('[토지] Supabase 로드 실패:', e.message);
      applyLandData([], 'Supabase');
    });
})();
