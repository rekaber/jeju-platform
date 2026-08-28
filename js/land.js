/* js/land.js - 제주 부동산 플랫폼 */
let landJimok    = 'all';
let landPeriod   = 'year';
let landOverlays = [];

const FARM_JIMOK = ['전','답','과수원'];

function toggleLand(btn) {
  landVisible = btn.classList.toggle('on');
  document.getElementById('land-filter-wrap').style.display = landVisible ? 'block' : 'none';
  document.getElementById('land-popup').style.display = 'none';
  if (landVisible) renderLandMarkers();
  else clearLandMarkers();
}

function setLandJimok(type, btn) {
  landJimok = type;
  document.querySelectorAll('.land-jimok-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (landVisible) { clearLandMarkers(); renderLandMarkers(); }
}

function setLandPeriod(p, btn) {
  landPeriod = p;
  document.querySelectorAll('.land-pd-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (landVisible) { clearLandMarkers(); renderLandMarkers(); }
}

function getFilteredLands() {
  if (!window.LAND_DATA) return [];
  const now = new Date('2026-08-25');
  const cutoff = new Date(now);
  if      (landPeriod === 'year')  cutoff.setFullYear(now.getFullYear(), 0, 1);
  else if (landPeriod === '6m')    cutoff.setMonth(now.getMonth() - 6);
  else if (landPeriod === '3m')    cutoff.setMonth(now.getMonth() - 3);
  else if (landPeriod === 'month') cutoff.setMonth(now.getMonth() - 1);
  return window.LAND_DATA.filter(t => {
    if (!t.lat || !t.lng) return false;
    if (t.date && new Date(t.date) < cutoff) return false;
    if (landJimok === 'dae'  && t.jimok !== '대') return false;
    if (landJimok === 'farm' && !FARM_JIMOK.includes(t.jimok)) return false;
    if (landJimok === 'imya' && t.jimok !== '임야') return false;
    if (landJimok === 'etc'  && (t.jimok === '대' || FARM_JIMOK.includes(t.jimok) || t.jimok === '임야')) return false;
    return true;
  });
}

function getLandClass(jimok) {
  if (jimok === '대') return 'lm-dae';
  if (FARM_JIMOK.includes(jimok)) return 'lm-farm';
  if (jimok === '임야') return 'lm-imya';
  return 'lm-etc';
}

function clearLandMarkers() {
  renderLandMarkers._token = (renderLandMarkers._token || 0) + 1; // 진행 중 렌더링 취소
  landOverlays.forEach(o => o.setMap(null));
  landOverlays = [];
}

function renderLandMarkers() {
  clearLandMarkers();
  const lands = getFilteredLands();
  if (!lands.length) return;

  // 로딩 상태 표시
  let statusEl = document.getElementById('land-render-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'land-render-status';
    statusEl.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,0.72);color:#fff;font-size:13px;padding:6px 18px;border-radius:20px;z-index:9999;pointer-events:none;';
    document.body.appendChild(statusEl);
  }
  statusEl.style.display = 'block';

  const CHUNK = 300;
  let i = 0;
  const token = ++renderLandMarkers._token; // 취소 토큰

  function renderChunk() {
    if (token !== renderLandMarkers._token) { statusEl.style.display = 'none'; return; } // 취소
    const end = Math.min(i + CHUNK, lands.length);
    for (; i < end; i++) {
      const t = lands[i];
      const cls = getLandClass(t.jimok);
      const perM2str = t.perM2 >= 100
        ? Math.round(t.perM2).toLocaleString() + '만'
        : t.perM2.toFixed(1) + '만';
      const el = document.createElement('div');
      el.className = 'land-marker ' + cls;
      el.textContent = perM2str + '/㎡';
      el.addEventListener('click', (function(td){ return function(e) {
        e.stopPropagation();
        showLandPopup(td, this);
      }; })(t));
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(t.lat, t.lng),
        content: el, yAnchor: 1.35, zIndex: 3
      });
      ov.setMap(map);
      landOverlays.push(ov);
    }
    if (i < lands.length) {
      statusEl.textContent = `토지 마커 로딩 중… ${i} / ${lands.length}`;
      setTimeout(renderChunk, 0);
    } else {
      statusEl.style.display = 'none';
    }
  }

  statusEl.textContent = `토지 마커 로딩 중… 0 / ${lands.length}`;
  setTimeout(renderChunk, 0);
}
renderLandMarkers._token = 0;

function showLandPopup(t, el) {
  const popup = document.getElementById('land-popup');
  const colorMap = { '대':'#C62828', '전':'#2E7D32', '답':'#2E7D32', '과수원':'#2E7D32', '임야':'#5D4037' };
  const hdrColor = colorMap[t.jimok] || '#1565C0';
  popup.style.borderTopColor = hdrColor;
  const jimokEl = document.getElementById('lp-jimok');
  jimokEl.textContent = t.jimok + (t.yongdo ? ' · ' + t.yongdo : '');
  jimokEl.style.color = hdrColor;
  document.getElementById('lp-addr').textContent  = t.addr + ' ' + (t.jibun || '');
  document.getElementById('lp-price').textContent = t.price + '억원';
  document.getElementById('lp-meta').innerHTML =
    '면적: ' + t.area.toLocaleString() + '㎡ &nbsp;|&nbsp; ㎡당 ' + t.perM2.toLocaleString() + '만원<br>' +
    '도로: ' + (t.doro || '-') + ' &nbsp;|&nbsp; ' + (t.tradeType || '') + '<br>' +
    '계약일: ' + t.date + (t.jibunType ? ' · ' + t.jibunType : '');
  const elRect = el.getBoundingClientRect();
  const popW = 240, popH = 130;
  let left = elRect.left + elRect.width/2 - popW/2;
  let top  = elRect.top - popH - 10;
  if (left < 4) left = 4;
  if (left + popW > window.innerWidth - 4) left = window.innerWidth - popW - 4;
  if (top < 4) top = elRect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.style.display = 'block';
}

let zoningVisible = false;
let zoningOpacity = 0.6;

function toggleZoning(btn) {
  zoningVisible = btn.classList.toggle('on');
  const legend = document.getElementById('zoning-legend');
  if (zoningVisible) {
    map.addOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
    legend.style.display = 'block';
  } else {
    map.removeOverlayMapTypeId(kakao.maps.MapTypeId.USE_DISTRICT);
    legend.style.display = 'none';
  }
  updateActiveLayerCount();
}

function setZoningOpacity(val) {
  zoningOpacity = val / 100;
  document.querySelectorAll('#zoning-overlay img').forEach(img => img.style.opacity = zoningOpacity);
}

let cadastralOpen = false;
function toggleCadastralPanel() {
  cadastralOpen = !cadastralOpen;
  const panel = document.getElementById('cadastral-panel');
  const toggle = document.getElementById('toggle-cadastral');
  const iframe = document.getElementById('cadastral-iframe');
  if (cadastralOpen) {
    panel.classList.add('open');
    toggle.classList.add('on');
    if (!iframe.src || iframe.src === window.location.href) {
      iframe.src = 'https://cadastralboundaryapp.vercel.app/';
    }
  } else {
    panel.classList.remove('open');
    toggle.classList.remove('on');
  }
  updateActiveLayerCount();
}
function closeCadastralPanel() {
  cadastralOpen = false;
  document.getElementById('cadastral-panel').classList.remove('open');
  document.getElementById('toggle-cadastral').classList.remove('on');
  updateActiveLayerCount();
}

function setZoningOpacity(val) {
  zoningOpacity = val / 100;
}

// 지도 이동 시 아무 작업 없음 (카카오 내장 레이어는 자동 갱신)
function updateZoningWMS() {}

/* ═══════════════════════════════════════════════
   미분양 마커
═══════════════════════════════════════════════ */
let unsoldVisible = false;
let unsoldOpacity = 1.0;
const unsoldOverlays = [];

// 배지 초기화
