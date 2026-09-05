/* js/bubble.js - extracted from index.html */
var bubbleVisible = false;
var bubbleOverlays = [];
var bubblePeriod = 'year';  // 'year'|'6m'|'3m'|'month'

function setBubblePeriod(p, btn) {
  bubblePeriod = p;
  document.querySelectorAll('.bubble-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (bubbleVisible) renderBubbles();
}

function toggleBubble(btn) {
  bubbleVisible = btn.classList.toggle('on');
  document.getElementById('bubble-period-wrap').style.display = bubbleVisible ? 'block' : 'none';
  document.getElementById('ml-bubble').style.display = bubbleVisible ? 'block' : 'none';
  updateLegendVisibility();
  if (bubbleVisible) renderBubbles();
  else clearBubbles();
  updateActiveLayerCount();
}

function clearBubbles() {
  bubbleOverlays.forEach(function(o) { try { o.setMap(null); } catch(_){} });
  bubbleOverlays.length = 0;
}

function getPeriodLabel() {
  const now = new Date();
  if (tradePeriod === 'week')  return '최근 7일';
  if (tradePeriod === 'month') return now.getMonth() + 1 + '월';
  if (tradePeriod === 'pick') {
    if (tradeMonth === 'all') return now.getFullYear() + '년 전체';
    return tradeMonth.slice(0,4) + '년 ' + parseInt(tradeMonth.slice(4)) + '월';
  }
  return now.getFullYear() + '년';
}

function getBubbleFilteredTrades() {
  if (!window.TRADE_DATA) return [];
  const now = new Date();
  const cutoff = new Date(now);
  if      (bubblePeriod === 'year')  cutoff.setFullYear(now.getFullYear(), 0, 1);
  else if (bubblePeriod === '6m')    cutoff.setMonth(now.getMonth() - 6);
  else if (bubblePeriod === '3m')    cutoff.setMonth(now.getMonth() - 3);
  else if (bubblePeriod === 'month') cutoff.setMonth(now.getMonth() - 1);
  else if (bubblePeriod === 'week')  cutoff.setDate(now.getDate() - 7);
  else return window.TRADE_DATA.slice();
  return window.TRADE_DATA.filter(t => t.date && new Date(t.date) >= cutoff);
}

function getBubblePeriodLabel() {
  const labels = { year:'2026년', '6m':'최근 6개월', '3m':'최근 3개월', month:'최근 1개월', week:'최근 7일' };
  return labels[bubblePeriod] || '';
}

function renderBubbles(prefiltered, periodLabelOverride) {
  clearBubbles();
  // prefiltered가 있으면 그대로 사용 (타입별 월 필터 등). 없으면 레거시 TRADE_DATA 필터
  const trades = Array.isArray(prefiltered) ? prefiltered : getBubbleFilteredTrades();
  const periodLabel = periodLabelOverride || getBubblePeriodLabel();
  if (!trades.length) return;
  if (typeof map === 'undefined' || !map) return;

  // sigungu+dong 기준 법정동별 집계
  const stats = {};
  trades.forEach(t => {
    const sig  = t.sigungu || '';
    const dong = t.dong || '';
    if (!dong) return;
    const key = sig + '|' + dong;
    if (!stats[key]) {
      // 법정동 중심 좌표: JEJU_BEOPJEONGDONG에서 sigungu+dong으로 찾기
      const bjInfo = window.JEJU_BEOPJEONGDONG.find(b => b.dong === dong && b.sigungu === sig);
      stats[key] = {
        dong, sigungu: sig,
        lat: bjInfo ? bjInfo.lat : t.lat,
        lng: bjInfo ? bjInfo.lng : t.lng,
        count: 0, totalPrice: 0, totalArea: 0
      };
    }
    stats[key].count++;
    stats[key].totalPrice += t.price;
    stats[key].totalArea  += (t.area || 84);
  });

  const allCounts = Object.values(stats).map(s => s.count);
  const maxCnt = Math.max(...allCounts, 1);

  Object.values(stats).forEach(s => {
    if (!s.lat || !s.lng || s.count < 1) return;

    const avgPrice  = s.totalPrice / s.count;
    const avgArea   = s.totalArea  / s.count;
    const pyeong    = avgArea / 3.3058;
    const perPyeong = Math.round(avgPrice * 10000 / pyeong);
    const perPyeongStr = perPyeong >= 10000
      ? (perPyeong / 10000).toFixed(1) + '억/평'
      : perPyeong.toLocaleString() + '만/평';

    const ratio = s.count / maxCnt;
    const colorCls = ratio < 0.3 ? 'cnt-low' : ratio < 0.65 ? 'cnt-mid' : 'cnt-high';

    const el = document.createElement('div');
    el.className = `stat-bubble ${colorCls}`;
    el.style.cursor = 'pointer';
    el.innerHTML =
      `<div class="sb-dong">${s.sigungu.replace('특별자치도','').replace('특별자치시','')} ${s.dong}</div>` +
      `<div class="sb-meta">${periodLabel}</div>` +
      `<div class="sb-count">${s.count}건</div>` +
      `<div class="sb-price">평당 ${perPyeongStr}</div>`;

    const scale = 0.78 + ratio * 0.5;
    el.style.transform = `scale(${scale.toFixed(2)})`;
    el.style.transformOrigin = 'bottom center';
    el.title = `${s.sigungu} ${s.dong}\n${periodLabel} ${s.count}건\n평균 ${avgPrice.toFixed(2)}억 · 평당 ${perPyeongStr}`;
    el.addEventListener('click', (function(stat, tradeList) { return function(e) {
      e.stopPropagation();
      showBubbleDetail(stat, tradeList);
    }; })(s, trades.filter(t => t.sigungu === s.sigungu && t.dong === s.dong)));

    const ov = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(s.lat, s.lng),
      content: el,
      yAnchor: 1.18,
      zIndex: 4
    });
    ov.setMap(map);
    bubbleOverlays.push(ov);
  });
}

// ── 토지 지역별 건수 버블 ──────────────────────────────
var landBubbleVisible = false;
var landBubbleOverlays = [];
var landBubblePeriod = 'week';
var landBubbleMonth  = 'all';

function setLandBubblePeriod(p, btn) {
  landBubblePeriod = p;
  var wrap = document.getElementById('land-bubble-period-wrap');
  if (wrap) wrap.querySelectorAll('.trade-filter-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  var picker = document.getElementById('land-bubble-month-picker');
  if (picker) picker.style.display = (p === 'pick') ? 'block' : 'none';
  if (p !== 'pick') landBubbleMonth = 'all';
  if (landBubbleVisible) renderLandBubbles();
}

function setLandBubbleMonth(ym, btn) {
  landBubbleMonth = ym;
  landBubblePeriod = 'pick';
  var picker = document.getElementById('land-bubble-month-picker');
  if (picker) picker.querySelectorAll('.tmp-btn').forEach(function(b){ b.classList.remove('active'); });
  btn.classList.add('active');
  if (landBubbleVisible) renderLandBubbles();
}

function toggleLandBubble(btn) {
  landBubbleVisible = btn.classList.toggle('on');
  document.getElementById('land-bubble-period-wrap').style.display = landBubbleVisible ? 'block' : 'none';
  if (landBubbleVisible) {
    // 켤 때마다 기본 기간 = 주간
    landBubblePeriod = 'week';
    landBubbleMonth = 'all';
    var wrap = document.getElementById('land-bubble-period-wrap');
    if (wrap) {
      wrap.querySelectorAll('.trade-filter-btn').forEach(function(b) {
        b.classList.toggle('active', (b.getAttribute('onclick') || '').indexOf(",'week',") >= 0);
      });
    }
    var picker = document.getElementById('land-bubble-month-picker');
    if (picker) {
      picker.style.display = 'none';
      picker.querySelectorAll('.tmp-btn').forEach(function(b){ b.classList.remove('active'); });
      var allBtn = picker.querySelector('.tmp-btn');
      if (allBtn) allBtn.classList.add('active');
    }
    renderLandBubbles();
  } else {
    clearLandBubbles();
    var bb = document.getElementById('land-bubble-badge');
    if (bb) bb.textContent = '0건';
  }
  updateActiveLayerCount();
}

function clearLandBubbles() {
  landBubbleOverlays.forEach(function(o) { try { o.setMap(null); } catch(_){} });
  landBubbleOverlays.length = 0;
}

function getLandBubbleFiltered() {
  if (!window.LAND_DATA) return [];
  const now = new Date();
  if (landBubblePeriod === 'pick') {
    if (landBubbleMonth && landBubbleMonth !== 'all') {
      return window.LAND_DATA.filter(t => t.date && t.date.replace(/-/g,'').slice(0,6) === landBubbleMonth);
    }
    return window.LAND_DATA.filter(t => t.date && t.date.startsWith(String(now.getFullYear())));
  }
  let cutoff = new Date(now);
  if      (landBubblePeriod === 'week')  cutoff = new Date(now - 7*86400000);
  else if (landBubblePeriod === 'month') cutoff = new Date(now - 30*86400000);
  else if (landBubblePeriod === 'year')  cutoff.setFullYear(now.getFullYear(), 0, 1);
  return window.LAND_DATA.filter(t => t.date && new Date(t.date) >= cutoff);
}

function renderLandBubbles() {
  clearLandBubbles();
  const lands = getLandBubbleFiltered();
  const bb = document.getElementById('land-bubble-badge');
  if (bb) bb.textContent = landBubbleVisible ? ((lands.length || 0) + '건') : '0건';
  const now2 = new Date();
  const periodLabels = { week:'최근 7일', month:'최근 30일', year:now2.getFullYear()+'년', pick: landBubbleMonth !== 'all' ? landBubbleMonth.slice(0,4)+'년 '+parseInt(landBubbleMonth.slice(4))+'월' : now2.getFullYear()+'년 전체' };
  const periodLabel = periodLabels[landBubblePeriod] || '';
  if (!lands.length) return;

  const stats = {};
  lands.forEach(t => {
    const sig  = t.sigungu || '';
    const dong = t.dong || '';
    if (!dong) return;
    const key = sig + '|' + dong;
    if (!stats[key]) {
      const bjInfo = window.JEJU_BEOPJEONGDONG.find(b => b.dong === dong && b.sigungu === sig);
      stats[key] = { dong, sigungu: sig, lat: bjInfo ? bjInfo.lat : t.lat, lng: bjInfo ? bjInfo.lng : t.lng, count: 0, totalPerM2: 0, m2cnt: 0 };
    }
    stats[key].count++;
    if (t.perM2 > 0) { stats[key].totalPerM2 += t.perM2; stats[key].m2cnt++; }
  });

  const allCounts = Object.values(stats).map(s => s.count);
  const maxCnt = Math.max(...allCounts, 1);

  Object.values(stats).forEach(s => {
    if (!s.lat || !s.lng || s.count < 1) return;
    const avgPerM2 = s.m2cnt > 0 ? Math.round(s.totalPerM2 / s.m2cnt) : 0;
    const perM2Str = avgPerM2 >= 10000 ? (avgPerM2/10000).toFixed(1)+'만/㎡' : avgPerM2.toLocaleString()+'원/㎡';
    const ratio = s.count / maxCnt;
    const colorCls = ratio < 0.3 ? 'cnt-low' : ratio < 0.65 ? 'cnt-mid' : 'cnt-high';

    const el = document.createElement('div');
    el.className = `stat-bubble ${colorCls}`;
    el.style.background = ratio < 0.3 ? 'rgba(121,85,72,0.85)' : ratio < 0.65 ? 'rgba(93,64,55,0.90)' : 'rgba(62,39,35,0.88)';
    el.style.cursor = 'pointer';
    el.innerHTML =
      `<div class="sb-dong">${s.sigungu.replace('특별자치도','').replace('특별자치시','')} ${s.dong}</div>` +
      `<div class="sb-meta">${periodLabel}</div>` +
      `<div class="sb-count">${s.count}건</div>` +
      `<div class="sb-price">${perM2Str}</div>`;
    const scale = 0.78 + ratio * 0.5;
    el.style.transform = `scale(${scale.toFixed(2)})`;
    el.style.transformOrigin = 'bottom center';
    (function(stat, key) {
      el.addEventListener('click', function(e) {
        e.stopPropagation();
        var dongTrades = lands.filter(function(t){ return (t.sigungu||'')+'|'+(t.dong||'') === key; });
        showLandBubbleDetail(stat, dongTrades);
      });
    })(s, s.sigungu + '|' + s.dong);

    const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(s.lat, s.lng), content: el, yAnchor: 1.18, zIndex: 4 });
    ov.setMap(map);
    landBubbleOverlays.push(ov);
  });
}
// ── /토지 지역별 건수 버블 ─────────────────────────────
