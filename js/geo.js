/* js/geo.js - extracted from index.html */
// ── 도로명주소 → 좌표 캐시 (localStorage 영속) ──────────────────────────
var GEOCACHE_KEY = 'jeju_geocache_v2';  // v2: 제주 범위 밖 항목 자동 제거
function loadGeoCache() {
  try {
    const raw = JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}');
    // 제주 범위 밖 캐시 항목 제거 (이전 버전 잘못된 좌표 청소)
    const clean = {};
    for (const [k, v] of Object.entries(raw)) {
      if (v && isInJeju(v.lat, v.lng)) clean[k] = v;
    }
    return clean;
  } catch(e) { return {}; }
}
function saveGeoCache(cache) {
  try { localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache)); } catch(e) {}
}

// ── 제주도 읍면동 중심 좌표 테이블 (Kakao API 없이 즉시 좌표 할당) ──
var DONG_COORDS = {
  // 제주시 동지역
  '제주시 일도일동': { lat:33.5107, lng:126.5220 },
  '제주시 일도이동': { lat:33.5132, lng:126.5246 },
  '제주시 이도일동': { lat:33.5067, lng:126.5244 },
  '제주시 이도이동': { lat:33.5023, lng:126.5160 },
  '제주시 삼도일동': { lat:33.5121, lng:126.5162 },
  '제주시 삼도이동': { lat:33.5087, lng:126.5155 },
  '제주시 용담일동': { lat:33.5194, lng:126.5056 },
  '제주시 용담이동': { lat:33.5200, lng:126.5070 },
  '제주시 건입동':   { lat:33.5147, lng:126.5417 },
  '제주시 화북일동': { lat:33.5234, lng:126.5637 },
  '제주시 화북이동': { lat:33.5243, lng:126.5650 },
  '제주시 삼양일동': { lat:33.5320, lng:126.5824 },
  '제주시 삼양이동': { lat:33.5330, lng:126.5840 },
  '제주시 삼양삼동': { lat:33.5345, lng:126.5855 },
  '제주시 봉개동':   { lat:33.4947, lng:126.5844 },
  '제주시 아라일동': { lat:33.4754, lng:126.5296 },
  '제주시 아라이동': { lat:33.4774, lng:126.5316 },
  '제주시 오라일동': { lat:33.4896, lng:126.4887 },
  '제주시 오라이동': { lat:33.4910, lng:126.4900 },
  '제주시 오라삼동': { lat:33.4840, lng:126.4784 },
  '제주시 이호일동': { lat:33.5107, lng:126.4650 },
  '제주시 이호이동': { lat:33.5117, lng:126.4660 },
  '제주시 도두일동': { lat:33.5089, lng:126.4531 },
  '제주시 도두이동': { lat:33.5095, lng:126.4545 },
  '제주시 노형동':   { lat:33.4837, lng:126.4674 },
  '제주시 외도일동': { lat:33.4886, lng:126.4383 },
  '제주시 외도이동': { lat:33.4896, lng:126.4393 },
  '제주시 이호동':   { lat:33.5107, lng:126.4650 },
  '제주시 도남동':   { lat:33.4791, lng:126.4986 },
  '제주시 용강동':   { lat:33.4699, lng:126.4784 },
  '제주시 회천동':   { lat:33.4597, lng:126.5016 },
  '제주시 영평동':   { lat:33.4532, lng:126.5212 },
  '제주시 월평동':   { lat:33.4586, lng:126.4882 },
  '제주시 도련일동': { lat:33.4765, lng:126.5647 },
  '제주시 도련이동': { lat:33.4775, lng:126.5657 },
  '제주시 화도동':   { lat:33.4730, lng:126.5700 },
  '제주시 이도동':   { lat:33.5023, lng:126.5160 },
  '제주시 삼도동':   { lat:33.5087, lng:126.5155 },
  // 제주시 읍면
  '제주시 한림읍':   { lat:33.4150, lng:126.2760 },
  '제주시 애월읍':   { lat:33.4650, lng:126.3165 },
  '제주시 구좌읍':   { lat:33.5275, lng:126.7568 },
  '제주시 조천읍':   { lat:33.5423, lng:126.6478 },
  '제주시 한경면':   { lat:33.3466, lng:126.2178 },
  '제주시 추자면':   { lat:33.9618, lng:126.3010 },
  '제주시 우도면':   { lat:33.5066, lng:126.9511 },
  // 서귀포시 동지역
  '서귀포시 송산동': { lat:33.2502, lng:126.5623 },
  '서귀포시 정방동': { lat:33.2458, lng:126.5667 },
  '서귀포시 중앙동': { lat:33.2477, lng:126.5611 },
  '서귀포시 천지동': { lat:33.2450, lng:126.5630 },
  '서귀포시 효돈동': { lat:33.2345, lng:126.6010 },
  '서귀포시 영천동': { lat:33.2310, lng:126.6050 },
  '서귀포시 동홍동': { lat:33.2570, lng:126.5741 },
  '서귀포시 서홍동': { lat:33.2560, lng:126.5590 },
  '서귀포시 대륜동': { lat:33.2550, lng:126.5800 },
  '서귀포시 대천동': { lat:33.2540, lng:126.5780 },
  '서귀포시 중문동': { lat:33.2530, lng:126.4132 },
  '서귀포시 예래동': { lat:33.2441, lng:126.3850 },
  '서귀포시 강정동': { lat:33.2630, lng:126.5192 },
  '서귀포시 호근동': { lat:33.2620, lng:126.5180 },
  '서귀포시 도순동': { lat:33.2580, lng:126.5120 },
  '서귀포시 상효동': { lat:33.2823, lng:126.5984 },
  '서귀포시 하효동': { lat:33.2655, lng:126.6197 },
  '서귀포시 신효동': { lat:33.2640, lng:126.6250 },
  '서귀포시 토평동': { lat:33.2700, lng:126.5600 },
  '서귀포시 보목동': { lat:33.2450, lng:126.5900 },
  '서귀포시 서귀동': { lat:33.2477, lng:126.5611 },
  // 서귀포시 읍면
  '서귀포시 남원읍': { lat:33.2810, lng:126.6995 },
  '서귀포시 성산읍': { lat:33.4447, lng:126.9175 },
  '서귀포시 표선면': { lat:33.3243, lng:126.8347 },
  '서귀포시 대정읍': { lat:33.2323, lng:126.2498 },
  '서귀포시 안덕면': { lat:33.2540, lng:126.3600 },
};

// 동 좌표 테이블로 즉시 lat/lng 설정 (API geocoding 전에 먼저 적용)
function applyDongCoords(data) {
  data.forEach(d => {
    if (d.lat && d.lng) return;
    const key = d.roadAddr || ((d.sigungu && d.dong) ? (d.sigungu + ' ' + d.dong) : '');
    const dongKey = (d.sigungu && d.dong) ? (d.sigungu + ' ' + d.dong) : '';
    const hit = (key && DONG_COORDS[key]) || (dongKey && DONG_COORDS[dongKey]);
    if (hit) {
      d.lat = hit.lat;
      d.lng = hit.lng;
      d._approxDong = true; // 지번 지오코딩 전 임시 좌표
    }
  });
}

// ── 전역 지오코딩 함수 (모든 타입 공용) ────────────────
// type: 'apt' | 'house' | 'rht' | 'comm' (geocoding 완료 후 해당 타입 마커 재렌더)
function geocodeTradeData(data, geoCache, uiType) {
  if (!window.kakao || !kakao.maps || !kakao.maps.services) return;
  const gc   = new kakao.maps.services.Geocoder();
  const todo = [...new Set(
    data.filter(d => d.roadAddr && (!d.lat || d._approxDong) && !geoCache[d.roadAddr])
      .map(d => d.roadAddr)
  )];
  if (!todo.length) return;
  let idx = 0, newEntries = 0;
  function next() {
    if (idx >= todo.length) {
      if (newEntries > 0) {
        saveGeoCache(geoCache);
        // 해당 타입 마커 재렌더
        if (uiType && window._typeState && window._typeState[uiType] && window._typeState[uiType].visible) {
          if (typeof renderTradeMarkersForType === 'function') renderTradeMarkersForType(uiType);
        }
        // 구형 apt 마커도 재렌더
        if (typeof tradeVisible !== 'undefined' && tradeVisible) {
          if (typeof clearTradeMarkers === 'function') clearTradeMarkers();
          if (typeof renderTradeMarkers === 'function') renderTradeMarkers();
        }
        if (typeof bubbleVisible !== 'undefined' && bubbleVisible && typeof renderBubbles === 'function') renderBubbles();
      }
      return;
    }
    const addr = todo[idx++];
    gc.addressSearch('제주특별자치도 ' + addr, function(result, status) {
      if (status === kakao.maps.services.Status.OK && result.length) {
        const lat = parseFloat(result[0].y), lng = parseFloat(result[0].x);
        if (isInJeju(lat, lng)) {
          geoCache[addr] = { lat, lng };
          data.forEach(d => {
            if (d.roadAddr === addr) {
              d.lat = lat; d.lng = lng; delete d._approxDong;
            }
          });
          newEntries++;
        }
      }
      setTimeout(next, 250);
    });
  }
  next();
}

// 제주도 범위 벗어난 좌표 필터 (바다에 뜨는 마커 방지)
function isInJeju(lat, lng) {
  return lat >= 33.10 && lat <= 33.62 && lng >= 126.08 && lng <= 126.98;
}
