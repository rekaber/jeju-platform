/* js/arch.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   건축인허가 레이어
═══════════════════════════════════════════════ */
window.ARCH_DATA = [];
var archVisible = false;
var archStatus  = 'all';
var archType    = 'all';
var archYear    = '2026';
var archOverlays = [];
var archPopupOv  = null;

var ARCH_STATUS_COLOR = { '허가':'#7B1FA2', '착공':'#E65100', '준공':'#2E7D32' };

function toggleArch(btn) {
  archVisible = btn.classList.toggle('on');
  document.getElementById('arch-controls').style.display = archVisible ? 'block' : 'none';
  if (archVisible) {
    if (!window._archLoaded && !window._archLoading) loadArchData();
    else renderArchMarkers();
  } else {
    clearArchMarkers();
  }
  updateActiveLayerCount();
}

function setArchStatus(s, btn) {
  archStatus = s;
  document.querySelectorAll('#arch-controls .arch-filter-btn').forEach(b => { if(['전체','허가','착공','준공'].some(x=>b.textContent===x)) b.classList.remove('active'); });
  btn.classList.add('active');
  if (archVisible) renderArchMarkers();
}

function setArchType(t, btn) {
  archType = t;
  const typeBtns = ['전체','주거','상업','업무','기타'];
  document.querySelectorAll('#arch-controls .arch-filter-btn').forEach(b => { if(typeBtns.includes(b.textContent)) b.classList.remove('active'); });
  btn.classList.add('active');
  if (archVisible) renderArchMarkers();
}

function setArchYear(y, btn) {
  archYear = y;
  ['2024','2025','2026'].forEach(yr => {
    document.querySelectorAll('#arch-controls .arch-filter-btn').forEach(b => { if(b.textContent===yr) b.classList.remove('active'); });
  });
  btn.classList.add('active');
  if (archVisible) renderArchMarkers();
}

function getArchStatus(d) {
  if (d.useAprDay && d.useAprDay.length >= 8) return '준공';
  if (d.stcnsDay  && d.stcnsDay.length  >= 8) return '착공';
  return '허가';
}

function getArchTypeGroup(cdNm) {
  if (!cdNm) return '기타';
  if (/단독|공동|다가구|다세대|아파트|기숙사|주거/.test(cdNm)) return '주거';
  if (/판매|상업|숙박|위락|근린/.test(cdNm)) return '상업';
  if (/업무|오피스/.test(cdNm)) return '업무';
  return '기타';
}

function getFilteredArch() {
  return (window.ARCH_DATA || []).filter(d => {
    if (archStatus !== 'all' && d._status !== archStatus) return false;
    if (archType   !== 'all' && d._typeGroup !== archType) return false;
    // 연도 필터: 허가일 또는 사용승인일 기준
    if (archYear && archYear !== 'all') {
      const pms = d.pmsDay    || '';
      const apr = d.useAprDay || '';
      if (!pms.startsWith(archYear) && !apr.startsWith(archYear)) return false;
    }
    return true;
  });
}

function clearArchMarkers() {
  archOverlays.forEach(o => o.setMap(null));
  archOverlays = [];
  if (archPopupOv) { archPopupOv.setMap(null); archPopupOv = null; }
}

function renderArchMarkers() {
  clearArchMarkers();
  const list = getFilteredArch();
  document.getElementById('arch-cnt-badge').textContent = list.length;
  const token = {};
  window._archToken = token;
  let i = 0;
  function chunk() {
    if (window._archToken !== token) return;
    const end = Math.min(i + 80, list.length);
    for (; i < end; i++) {
      const d = list[i];
      if (!d.lat || !d.lng || !isInJeju(d.lat, d.lng)) continue;
      const color = ARCH_STATUS_COLOR[d._status] || '#607D8B';
      const el = document.createElement('div');
      const iconMap = { '허가':'📋', '착공':'🏗', '준공':'✅' };
      const icon = iconMap[d._status] || '📋';
      const name = (d.bldNm || d._typeGroup || '건축물').slice(0, 10);
      el.className = 'arch-marker';
      el.innerHTML = `
        <div class="arch-marker-badge" style="background:${color};">
          <span class="arch-icon">${icon}</span>
          <span class="arch-marker-name">${name}</span>
        </div>
        <div class="arch-marker-tail" style="border-top:6px solid ${color};"></div>`;
      el.onclick = () => showArchPopup(d);
      const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(d.lat, d.lng), content: el, yAnchor: 1.1, zIndex: 5 });
      ov.setMap(map);
      archOverlays.push(ov);
    }
    if (i < list.length) setTimeout(chunk, 20);
  }
  chunk();
}

function showArchPopup(d) {
  if (archPopupOv) { archPopupOv.setMap(null); archPopupOv = null; }
  const color = ARCH_STATUS_COLOR[d._status] || '#607D8B';
  const fmt = s => s && s.length >= 8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : '-';
  const el = document.createElement('div');
  el.className = 'arch-popup';
  el.innerHTML = `
    <div class="arch-popup-header" style="background:${color};">
      <button class="arch-popup-close" onclick="if(window._archPopup){window._archPopup.setMap(null);window._archPopup=null;}">×</button>
      <div class="arch-popup-status">${d._status} · ${d._typeGroup}</div>
      <div class="arch-popup-name">${d.bldNm || '(건물명 없음)'}</div>
    </div>
    <div class="arch-popup-body">
      <div class="arch-popup-row"><span class="arch-popup-label">주소</span><span class="arch-popup-val" style="font-size:9px;">${d.platPlc || '-'}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">용도</span><span class="arch-popup-val">${d.mainPurpsCdNm || '-'}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">구분</span><span class="arch-popup-val">${d.archGbCdNm || '-'}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">연면적</span><span class="arch-popup-val">${d.totArea ? parseFloat(d.totArea).toLocaleString() + '㎡' : '-'}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">세대수</span><span class="arch-popup-val">${d.hhldCnt || '-'}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">허가일</span><span class="arch-popup-val">${fmt(d.pmsDay)}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">착공일</span><span class="arch-popup-val">${fmt(d.stcnsDay)}</span></div>
      <div class="arch-popup-row"><span class="arch-popup-label">준공일</span><span class="arch-popup-val">${fmt(d.useAprDay)}</span></div>
    </div>
    <div class="arch-popup-arrow" style="border-top-color:${color};"></div>`;
  window._archPopup = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(d.lat, d.lng), content: el, yAnchor: 1.1, zIndex: 10 });
  window._archPopup.setMap(map);
  archPopupOv = window._archPopup;
}

async function loadArchData() {
  if (window._archLoading) return;
  window._archLoading = true;
  window._archLoaded  = false;

  const prog = document.getElementById('arch-progress');
  if (prog) { prog.style.display = 'block'; prog.textContent = '데이터 불러오는 중...'; }

  try {
    const raw = await sbFetchAll('arch_permits');
    if (prog) prog.textContent = `${raw.length}건 처리 중...`;

    const geoCache = (typeof loadGeoCache === 'function') ? loadGeoCache() : {};

    raw.forEach(d => {
      // Supabase 컬럼명 → JS 필드명 매핑
      d.bldNm         = d.bld_nm      || '';
      d.platPlc       = d.addr        || '';
      d.mainPurpsCdNm = d.purps       || '';
      d.archGbCdNm    = d.arch_gb     || '';
      d.totArea       = d.tot_area    || 0;
      d.hhldCnt       = d.hhld_cnt    || 0;
      d.pmsDay        = (d.pms_day     || '').replace(/-/g, '');
      d.useAprDay     = (d.use_apr_day || '').replace(/-/g, '');
      d.stcnsDay      = '';

      d.roadAddr = d.platPlc;
      if (!d.lat && d.platPlc && geoCache[d.platPlc]) {
        d.lat = geoCache[d.platPlc].lat;
        d.lng = geoCache[d.platPlc].lng;
      }

      d._status    = getArchStatus(d);
      d._typeGroup = getArchTypeGroup(d.mainPurpsCdNm);
    });

    window.ARCH_DATA   = raw;
    window._archLoaded = true;
    const badge = document.getElementById('arch-cnt-badge');
    if (badge) badge.textContent = raw.length;
    if (prog) {
      prog.textContent = `✓ ${raw.length}건 로드 완료`;
      setTimeout(() => { prog.style.display = 'none'; }, 2000);
    }
    if (archVisible) renderArchMarkers();
    if (typeof showToast === 'function') showToast(`✓ 건축인허가 ${raw.length}건 로드 완료`);

    geocodeArchData(raw, geoCache);

  } catch(e) {
    if (prog) {
      prog.textContent = '오류: ' + e.message;
      setTimeout(() => { prog.style.display = 'none'; }, 5000);
    }
  }
  window._archLoading = false;
}

function geocodeArchData(data, geoCache) {
  if (!window.kakao || !kakao.maps || !kakao.maps.services) return;
  const gc = new kakao.maps.services.Geocoder();
  const todo = [...new Set(
    data.filter(d => d.platPlc && !d.lat).map(d => d.platPlc)
  )];
  if (!todo.length) return;

  const prog = document.getElementById('arch-progress');
  const total = todo.length;
  let idx = 0, newEntries = 0, done = 0;

  // progress 표시 재활성
  if (prog) { prog.style.display = 'block'; prog.textContent = `좌표 변환 중 0/${total}...`; }

  function next() {
    if (idx >= total) {
      if (newEntries > 0) {
        if (typeof saveGeoCache === 'function') saveGeoCache(geoCache);
        if (archVisible) renderArchMarkers();
      }
      if (prog) {
        prog.textContent = `✓ 좌표 변환 완료 (${newEntries}/${total}건)`;
        setTimeout(() => { prog.style.display = 'none'; }, 3000);
      }
      return;
    }
    const addr = todo[idx++];
    // 카카오 지번검색: "번지" 제거 + 앞 행정구역 축약
    const cleanAddr = addr.replace(/번지$/,'').replace('제주특별자치도 ','').trim();
    gc.addressSearch(cleanAddr, function(result, status) {
      done++;
      if (status === kakao.maps.services.Status.OK && result.length) {
        const lat = parseFloat(result[0].y), lng = parseFloat(result[0].x);
        geoCache[addr] = { lat, lng };
        data.forEach(d => { if (d.platPlc === addr && !d.lat) { d.lat = lat; d.lng = lng; } });
        newEntries++;
      }
      if (prog && done % 10 === 0) prog.textContent = `좌표 변환 중 ${done}/${total}...`;
      setTimeout(next, 200);
    });
  }
  next();
}
