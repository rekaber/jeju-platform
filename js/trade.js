/* js/trade.js - extracted from index.html */
// ── 다중 유형 데이터 저장소 ──
// 샘플 데이터(apt)가 이미 세팅된 경우 유지하고 나머지 키만 추가
window.MULTI_DATA = Object.assign({ apt: null, offi: null, rht: null, house: null }, window.MULTI_DATA || {});

// 활성 체크박스 기준으로 TRADE_DATA 재조합
function updateMultiTradeData() {
  const typeColors = { apt:'#1976D2', offi:'#7B1FA2', rht:'#E65100', house:'#00695C' };
  const typeLabels = { apt:'아파트', offi:'오피스텔', rht:'연립/다세대', house:'단독/다가구' };
  const merged = [];
  ['apt','offi','rht','house'].forEach(type => {
    const chk = document.getElementById('tc-' + type);
    const data = window.MULTI_DATA[type];
    if (chk && chk.checked && data && data.length > 0) {
      data.forEach(t => {
        if (!t._tradeType) {
          t._tradeType = type;
          t._typeColor = typeColors[type];
          t._typeLabel = typeLabels[type];
        }
      });
      merged.push(...data);
    }
  });
  if (merged.length > 0) {
    window.TRADE_DATA = merged;
    document.getElementById('trade-data-source').textContent =
      `실거래 통합 · ${merged.length.toLocaleString()}건`;
    if (typeof computeRankCache === 'function') { window._rankCache = null; computeRankCache(); }
    if (tradeVisible) { clearTradeMarkers(); renderTradeMarkers(); renderTradeChart(); }
    renderAreaRank();
  }
}

var tradeVisible = false;
var tradePeriod  = 'week';
var tradeMonth   = 'all';   // 'all' 또는 '202601'~'202612'
var tradeOverlays = [];

function toggleTrade(btn) {
  tradeVisible = btn.classList.toggle('on');
  const filterRow  = document.getElementById('trade-filter-row');
  const monthPicker = document.getElementById('trade-month-picker');
  const chartWrap  = document.getElementById('trade-chart-wrap');
  const typeFilter = document.getElementById('trade-type-filter');
  const on = tradeVisible;
  filterRow.style.opacity  = on ? '1' : '0.4';
  filterRow.style.pointerEvents = on ? 'auto' : 'none';
  if (typeFilter) typeFilter.style.display = on ? 'block' : 'none';
  if (monthPicker) {
    monthPicker.style.opacity = on ? '1' : '0.4';
    monthPicker.style.pointerEvents = on ? 'auto' : 'none';
    monthPicker.style.display = (on && tradePeriod === 'pick') ? 'block' : 'none';
  }
  document.getElementById('ml-trade').style.display = on ? 'block' : 'none';
  updateLegendVisibility();
  if (on) { chartWrap.style.display = 'block'; renderTradeMarkers(); renderTradeChart(); }
  else {
    chartWrap.style.display = 'none';
    clearTradeMarkers();
    document.getElementById('trade-popup').style.display = 'none';
  }
  updateActiveLayerCount();
}

function updateLegendVisibility() {
  const lg = document.getElementById('map-legend');
  if (!lg) return;
  const anyVisible = lg.querySelector('.ml-section[style*="block"]');
  lg.style.display = anyVisible ? 'block' : 'none';
}

function setTradePeriod(period, btn) {
  tradePeriod = period;
  document.querySelectorAll('.trade-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  // 월 선택 피커 표시/숨김
  const picker = document.getElementById('trade-month-picker');
  if (picker) picker.style.display = (period === 'pick' && tradeVisible) ? 'block' : 'none';
  if (period !== 'pick') tradeMonth = 'all';
  refreshTradeDisplay();
}

function setTradeMonth(ym, btn) {
  tradeMonth = ym;
  document.querySelectorAll('.tmp-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  refreshTradeDisplay();
}

function refreshTradeDisplay() {
  if (typeof computeRankCache === 'function') { window._rankCache = null; computeRankCache(); }
  if (tradeVisible)  { clearTradeMarkers(); renderTradeMarkers(); renderTradeChart(); }
  renderAreaRank();
  if (bubbleVisible) renderBubbles();
}

function getFilteredTrades() {
  if (!window.TRADE_DATA || window.TRADE_DATA.length === 0) return [];
  const now = new Date();
  // 월 지정 모드
  if (tradePeriod === 'pick') {
    if (tradeMonth === 'all') return window.TRADE_DATA;
    return window.TRADE_DATA.filter(t => t.date && t.date.slice(0,4) + t.date.slice(5,7) === tradeMonth);
  }
  // 상대 기간 모드
  const cutoff = new Date(now);
  if      (tradePeriod === 'week')  cutoff.setDate(now.getDate() - 7);
  else if (tradePeriod === 'month') cutoff.setDate(now.getDate() - 30);
  else    cutoff.setFullYear(now.getFullYear() - 1);
  return window.TRADE_DATA.filter(t => t.date && new Date(t.date) >= cutoff);
}

function clearTradeMarkers() {
  tradeOverlays.forEach(o => o.setMap(null));
  tradeOverlays = [];
}

function renderTradeMarkers() {
  const trades = getFilteredTrades();
  document.getElementById('trade-cnt-badge').textContent = trades.length;

  // 로딩 상태 표시
  let statusEl = document.getElementById('trade-render-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'trade-render-status';
    statusEl.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(25,118,210,0.88);color:#fff;font-size:13px;padding:6px 18px;border-radius:20px;z-index:9999;pointer-events:none;';
    document.body.appendChild(statusEl);
  }
  statusEl.style.display = 'block';

  const CHUNK = 200;
  let i = 0;
  const token = ++renderTradeMarkers._token;

  function renderChunk() {
    if (token !== renderTradeMarkers._token) { statusEl.style.display = 'none'; return; }
    const end = Math.min(i + CHUNK, trades.length);
    for (; i < end; i++) {
      const t = trades[i];
      if (!t.lat || !t.lng || !isInJeju(t.lat, t.lng)) continue;
      const cls = t.price < 3 ? 'price-low' : t.price < 6 ? 'price-mid' : 'price-high';
      const el = document.createElement('div');
      el.className = 'trade-marker ' + cls;
      // 타입별 색상 테두리 (다중 유형 구분)
      if (t._typeColor) el.style.borderLeft = `3px solid ${t._typeColor}`;
      const dateShort = t.date ? t.date.slice(2).replace(/-/g, '.') : '';
      const typeBadge = t._typeLabel && t._tradeType !== 'apt'
        ? `<span class="tm-type-badge" style="background:${t._typeColor}">${t._typeLabel.slice(0,1)}</span>` : '';
      el.innerHTML = `<div class="tm-name">${typeBadge}${t.name||t.dong||''}</div><div class="tm-price">${t.price.toFixed(1)}억</div><div class="tm-sub">${t.area ? Math.round(t.area) + '㎡' : ''} ${dateShort}</div>`;
      el.addEventListener('click', (function(td){ return function(e) {
        e.stopPropagation(); showTradePopup(td);
      }; })(t));
      const ov = new kakao.maps.CustomOverlay({
        position: new kakao.maps.LatLng(t.lat, t.lng),
        content: el, yAnchor: 1.35, zIndex: 3
      });
      ov.setMap(map);
      tradeOverlays.push(ov);
    }
    if (i < trades.length) {
      statusEl.textContent = `실거래 마커 로딩… ${i} / ${trades.length}`;
      setTimeout(renderChunk, 0);
    } else {
      statusEl.style.display = 'none';
    }
  }

  statusEl.textContent = `실거래 마커 로딩… 0 / ${trades.length}`;
  setTimeout(renderChunk, 0);
}
renderTradeMarkers._token = 0;
