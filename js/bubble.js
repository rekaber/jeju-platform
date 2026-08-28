/* js/bubble.js - 제주 부동산 플랫폼 */
/* ═══════════════════════════════════════════════
   동별 거래현황 버블
═══════════════════════════════════════════════ */
let bubbleVisible = false;
let bubbleOverlays = [];
let bubblePeriod = 'year';  // 'year'|'6m'|'3m'|'month'

function setBubblePeriod(p, btn) {
  bubblePeriod = p;
  document.querySelectorAll('.bubble-period-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (bubbleVisible) renderBubbles();
}

function toggleBubble(btn) {
  bubbleVisible = btn.classList.toggle('on');
  document.getElementById('bubble-period-wrap').style.display = bubbleVisible ? 'block' : 'none';
  if (bubbleVisible) renderBubbles();
  else clearBubbles();
  updateActiveLayerCount();
}

function clearBubbles() {
  bubbleOverlays.forEach(o => o.setMap(null));
  bubbleOverlays = [];
}

function getPeriodLabel() {
  const now = new Date('2026-08-25');
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
  const now = new Date('2026-08-25');
  const cutoff = new Date(now);
  if      (bubblePeriod === 'year')  cutoff.setFullYear(now.getFullYear(), 0, 1);
  else if (bubblePeriod === '6m')    cutoff.setMonth(now.getMonth() - 6);
  else if (bubblePeriod === '3m')    cutoff.setMonth(now.getMonth() - 3);
  else if (bubblePeriod === 'month') cutoff.setMonth(now.getMonth() - 1);
  return window.TRADE_DATA.filter(t => t.date && new Date(t.date) >= cutoff);
}

function getBubblePeriodLabel() {
  const labels = { year:'2026년', '6m':'최근 6개월', '3m':'최근 3개월', month:'최근 1개월' };
  return labels[bubblePeriod] || '';
}

function renderBubbles() {
  clearBubbles();
  const trades = getBubbleFilteredTrades();
  const periodLabel = getBubblePeriodLabel();
  if (!trades.length) return;

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
    el.innerHTML =
      `<div class="sb-dong">${s.sigungu.replace('특별자치도','').replace('특별자치시','')} ${s.dong}</div>` +
      `<div class="sb-meta">${periodLabel}</div>` +
      `<div class="sb-count">${s.count}건</div>` +
      `<div class="sb-price">평당 ${perPyeongStr}</div>`;

    const scale = 0.78 + ratio * 0.5;
    el.style.transform = `scale(${scale.toFixed(2)})`;
    el.style.transformOrigin = 'bottom center';
    el.title = `${s.sigungu} ${s.dong}\n${periodLabel} ${s.count}건\n평균 ${avgPrice.toFixed(2)}억 · 평당 ${perPyeongStr}`;

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

let tradeVisible = false;
let tradePeriod  = 'week';
let tradeMonth   = 'all';   // 'all' 또는 '202601'~'202612'
let tradeOverlays = [];

