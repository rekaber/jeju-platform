/* js/land.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   토지 실거래 레이어
═══════════════════════════════════════════════ */
var landVisible  = false;
var landJimok    = 'all';
var landPeriod   = 'week';
var landMonth    = 'all';
var landOverlays = [];

var FARM_JIMOK = ['전','답','과수원'];

function toggleLand(btn) {
  landVisible = btn.classList.toggle('on');
  const on = landVisible;
  const periodRow  = document.getElementById('land-period-row');
  const filterWrap = document.getElementById('land-filter-wrap');
  const chartWrap  = document.getElementById('land-chart-wrap');
  const picker     = document.getElementById('land-month-picker');
  periodRow.style.opacity       = on ? '1' : '0.4';
  periodRow.style.pointerEvents = on ? 'auto' : 'none';
  filterWrap.style.display = on ? 'block' : 'none';
  chartWrap.style.display  = on ? 'block' : 'none';
  if (picker) { picker.style.display = (on && landPeriod === 'pick') ? 'block' : 'none'; picker.style.opacity = on ? '1' : '0.4'; picker.style.pointerEvents = on ? 'auto' : 'none'; }
  document.getElementById('land-popup').style.display = 'none';
  if (on) { renderLandMarkers(); renderLandChart(); }
  else {
    clearLandMarkers();
    setLandCntBadge(0);
  }
}

function setLandJimok(type, btn) {
  landJimok = type;
  document.querySelectorAll('.land-jimok-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (landVisible) { clearLandMarkers(); renderLandMarkers(); }
}

function setLandPeriod(p, btn) {
  landPeriod = p;
  document.querySelectorAll('#land-period-row .trade-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const picker = document.getElementById('land-month-picker');
  if (picker) picker.style.display = (p === 'pick' && landVisible) ? 'block' : 'none';
  if (p !== 'pick') { landMonth = 'all'; document.querySelectorAll('.land-tmp-btn').forEach(b => b.classList.remove('active')); const allBtn = document.querySelector('.land-tmp-btn'); if (allBtn) allBtn.classList.add('active'); }
  if (landVisible) { clearLandMarkers(); renderLandMarkers(); renderLandChart(); }
}

function setLandMonth(ym, btn) {
  landMonth = ym;
  document.querySelectorAll('.land-tmp-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (landVisible) { clearLandMarkers(); renderLandMarkers(); renderLandChart(); }
}

function getFilteredLands() {
  if (!window.LAND_DATA) return [];
  const now = new Date();
  const jimokFilter = t => {
    if (landJimok === 'dae'  && t.jimok !== '대') return false;
    if (landJimok === 'farm' && !FARM_JIMOK.includes(t.jimok)) return false;
    if (landJimok === 'imya' && t.jimok !== '임야') return false;
    if (landJimok === 'etc'  && (t.jimok === '대' || FARM_JIMOK.includes(t.jimok) || t.jimok === '임야')) return false;
    return true;
  };
  // 월 선택 모드
  if (landPeriod === 'pick') {
    return window.LAND_DATA.filter(t => {
      if (!t.lat || !t.lng || !isInJeju(t.lat, t.lng)) return false;
      if (!jimokFilter(t)) return false;
      if (landMonth === 'all') return true;
      return t.date && t.date.slice(0,4) + t.date.slice(5,7) === landMonth;
    });
  }
  // 상대 기간 모드
  const cutoff = new Date(now);
  if      (landPeriod === 'year')  cutoff.setFullYear(now.getFullYear(), 0, 1);
  else if (landPeriod === 'week')  cutoff.setDate(now.getDate() - 7);
  else if (landPeriod === 'month') cutoff.setDate(now.getDate() - 30);
  return window.LAND_DATA.filter(t => {
    if (!t.lat || !t.lng || !isInJeju(t.lat, t.lng)) return false;
    if (t.date && new Date(t.date) < cutoff) return false;
    return jimokFilter(t);
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

function renderLandChart() {
  const svg = document.getElementById('land-chart-svg');
  if (!svg || !window.LAND_DATA) return;
  const months = [];
  const now = new Date();
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    const key = d.toISOString().slice(0, 7);
    const label = (d.getMonth() + 1) + '월';
    const trades = window.LAND_DATA.filter(t => t.date && t.date.startsWith(key) && t.perM2 > 0);
    const avg = trades.length ? trades.reduce((s, t) => s + t.perM2, 0) / trades.length : null;
    months.push({ label, avg });
  }
  const vals = months.map(m => m.avg || 0);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals.filter(v => v > 0), maxV);
  const W = 228, H = 80, padL = 22, padB = 16, padR = 6, padT = 6;
  const cW = W - padL - padR, cH = H - padT - padB;

  const points = months.map((m, i) => {
    const x = padL + i * (cW / (months.length - 1));
    const y = m.avg ? padT + cH - ((m.avg - minV + 0.5) / (maxV - minV + 1)) * cH : null;
    return { x, y, label: m.label, avg: m.avg };
  }).filter(p => p.y !== null);

  if (!points.length) { svg.innerHTML = '<text x="114" y="45" text-anchor="middle" font-size="9" fill="#aaa">데이터 없음</text>'; return; }

  const pathD = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
  const areaD = pathD + ` L${points[points.length-1].x.toFixed(1)},${(padT+cH).toFixed(1)} L${points[0].x.toFixed(1)},${(padT+cH).toFixed(1)} Z`;
  const yLabels = [minV.toFixed(0), ((minV+maxV)/2).toFixed(0), maxV.toFixed(0)];
  const yPositions = [padT+cH, padT+cH/2, padT];

  svg.innerHTML = `
    <defs>
      <linearGradient id="landGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#5D4037" stop-opacity="0.28"/>
        <stop offset="100%" stop-color="#5D4037" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${yPositions.map(y => `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1"/>`).join('')}
    <path d="${areaD}" fill="url(#landGrad)"/>
    <path d="${pathD}" fill="none" stroke="#8D6E63" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    ${points.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#5D4037" stroke="#fff" stroke-width="1.2"/>`).join('')}
    ${yLabels.map((l, i) => `<text x="${padL-2}" y="${(yPositions[i]+3).toFixed(1)}" text-anchor="end" font-size="7" fill="#aaa">${l}</text>`).join('')}
    ${points.filter((_, i) => i % 3 === 0 || i === points.length-1).map(p => `<text x="${p.x.toFixed(1)}" y="${H}" text-anchor="middle" font-size="7" fill="#aaa">${p.label}</text>`).join('')}
  `;
}

function renderLandMarkers() {
  clearLandMarkers();
  const lands = getFilteredLands();
  setLandCntBadge(lands.length);
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
      const dongShort = (t.dong || t.sigungu || '').replace(/^제주시\s*|^서귀포시\s*/,'');
      el.innerHTML = '<span class="lm-dong">' + (dongShort || '') + '</span>' +
                     '<span class="lm-price">' + perM2str + '/㎡</span>';
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

var zoningVisible = false;
var zoningOpacity = 0.6;

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

var cadastralOpen = false;
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
