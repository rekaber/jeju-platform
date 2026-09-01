/* js/trade.js - 제주 부동산 플랫폼 */
function toggleTrade(btn) {
  tradeVisible = btn.classList.toggle('on');
  const filterRow  = document.getElementById('trade-filter-row');
  const monthPicker = document.getElementById('trade-month-picker');
  const chartWrap  = document.getElementById('trade-chart-wrap');
  const on = tradeVisible;
  filterRow.style.opacity  = on ? '1' : '0.4';
  filterRow.style.pointerEvents = on ? 'auto' : 'none';
  if (monthPicker) {
    monthPicker.style.opacity = on ? '1' : '0.4';
    monthPicker.style.pointerEvents = on ? 'auto' : 'none';
    monthPicker.style.display = (on && tradePeriod === 'pick') ? 'block' : 'none';
  }
  if (on) { chartWrap.style.display = 'block'; renderTradeMarkers(); renderTradeChart(); }
  else {
    chartWrap.style.display = 'none';
    clearTradeMarkers();
    document.getElementById('trade-popup').style.display = 'none';
  }
  updateActiveLayerCount();
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
  if (tradeVisible)  { clearTradeMarkers(); renderTradeMarkers(); renderTradeChart(); }
  if (bubbleVisible) renderBubbles();
}

function getFilteredTrades() {
  const now = new Date('2026-08-25');
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
  tradeOverlays.forEach(o => o.remove());
  tradeOverlays = [];
}

function renderTradeMarkers() {
  const trades = getFilteredTrades();
  document.getElementById('trade-cnt-badge').textContent = trades.length;
  trades.forEach(t => {
    if (!t.lat || !t.lng) return;
    const cls = t.price < 3 ? 'price-low' : t.price < 6 ? 'price-mid' : 'price-high';
    const el = document.createElement('div');
    el.className = 'trade-marker ' + cls;
    el.textContent = t.price.toFixed(1) + '억';
    el.title = `${t.name}\n${t.addr}\n${t.price}억 · ${t.area}㎡ · ${t.date}`;
    el.addEventListener('click', function(e) {
      e.stopPropagation();
      showTradePopup(t, this);
    });
    const ov = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([t.lng, t.lat]);
    ov.addTo(map);
    tradeOverlays.push(ov);
  });
}

function showTradePopup(t, el) {
  const popup = document.getElementById('trade-popup');
  document.getElementById('tp-name').textContent = t.name;
  document.getElementById('tp-addr').textContent = t.addr;
  document.getElementById('tp-price').textContent = t.price + '억원';
  document.getElementById('tp-meta').textContent =
    t.type + ' · ' + t.area + '㎡ · ' + t.date;

  // position:fixed 기준 — viewport 좌표로 마커 바로 위에 팝업 표시
  const elRect = el.getBoundingClientRect();
  const popW = 230, popH = 115;
  let left = elRect.left + elRect.width / 2 - popW / 2;
  let top  = elRect.top - popH - 10;
  if (left < 4) left = 4;
  if (left + popW > window.innerWidth - 4) left = window.innerWidth - popW - 4;
  if (top < 4) top = elRect.bottom + 8;
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.style.display = 'block';
}

function renderTradeChart() {
  const svg = document.getElementById('trade-chart-svg');
  const months = [];
  const now = new Date('2026-08-21');
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    const key = d.toISOString().slice(0,7);
    const label = (d.getMonth()+1) + '월';
    const trades = window.TRADE_DATA.filter(t => t.date.startsWith(key));
    const avg = trades.length ? (trades.reduce((s,t)=>s+t.price,0)/trades.length) : null;
    months.push({ label, avg });
  }
  const vals = months.map(m => m.avg || 0);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals.filter(v=>v>0), maxV);
  const W = 228, H = 80, padL = 22, padB = 16, padR = 6, padT = 6;
  const cW = W - padL - padR, cH = H - padT - padB;
  const xStep = cW / (months.length - 1);

  const points = months.map((m, i) => {
    const x = padL + i * xStep;
    const y = m.avg ? padT + cH - ((m.avg - minV + 0.5) / (maxV - minV + 1)) * cH : null;
    return { x, y, label: m.label, avg: m.avg };
  }).filter(p => p.y !== null);

  const pathD = points.map((p,i) => (i===0?'M':'L') + p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const areaD = pathD + ` L${points[points.length-1].x.toFixed(1)},${(padT+cH).toFixed(1)} L${points[0].x.toFixed(1)},${(padT+cH).toFixed(1)} Z`;

  // Y축 labels
  const yLabels = [minV.toFixed(1), ((minV+maxV)/2).toFixed(1), maxV.toFixed(1)];
  const yPositions = [padT+cH, padT+cH/2, padT];

  svg.innerHTML = `
    <defs>
      <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1976D2" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#1976D2" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- grid -->
    ${yPositions.map(y=>`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1"/>`).join('')}
    <!-- area -->
    <path d="${areaD}" fill="url(#tradeGrad)"/>
    <!-- line -->
    <path d="${pathD}" fill="none" stroke="#1976D2" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <!-- dots -->
    ${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#1976D2" stroke="#fff" stroke-width="1.2"/>`).join('')}
    <!-- Y axis labels -->
    ${yLabels.map((l,i)=>`<text x="${padL-2}" y="${(yPositions[i]+3).toFixed(1)}" text-anchor="end" font-size="7" fill="#aaa">${l}</text>`).join('')}
    <!-- X axis labels (every 3 months) -->
    ${points.filter((_,i)=>i%3===0||i===points.length-1).map(p=>`<text x="${p.x.toFixed(1)}" y="${H}" text-anchor="middle" font-size="7" fill="#aaa">${p.label}</text>`).join('')}
  `;
}

/* ═══════════════════════════════════════════════
   통계 모달
═══════════════════════════════════════════════ */
let statTab    = 'pyung';
let statRegion = 'all';   // 'all' | 'jeju' | 'seo'

function openStatModal() {
  document.getElementById('stat-modal').classList.add('open');
  renderStatChart();
}
function closeStatModal() {
  document.getElementById('stat-modal').classList.remove('open');
}
function setStatTab(tab, btn) {
  statTab = tab;
  document.querySelectorAll('.sm-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderStatChart();
}
function setStatRegion(region, btn) {
  statRegion = region;
  document.querySelectorAll('.sm-region-tab').forEach(b => {
    b.classList.remove('active-all','active-jeju','active-seo');
  });
  btn.classList.add('active-' + region);
  renderStatChart();
}

function renderStatChart() {
  if (!window.TRADE_DATA || !window.TRADE_DATA.length) return;
  const allData = window.TRADE_DATA;

  // ── 헬퍼 ──
  function pyungAvg(arr) {
    if (!arr.length) return null;
    return Math.round(arr.reduce((s,t) => s + (t.price*10000)/(t.area/3.3058), 0) / arr.length);
  }
  function priceAvg(arr) {
    return arr.length ? parseFloat((arr.reduce((s,t)=>s+t.price,0)/arr.length).toFixed(2)) : null;
  }
  function maxPrice(arr) { return arr.length ? Math.max(...arr.map(t=>t.price)) : null; }
  function minPrice(arr) { return arr.length ? Math.min(...arr.map(t=>t.price)) : null; }

  const jejuAll = allData.filter(t=>t.sigungu==='제주시');
  const seoAll  = allData.filter(t=>t.sigungu==='서귀포시');
  const regionData = statRegion==='jeju' ? jejuAll : statRegion==='seo' ? seoAll : allData;

  // ── KPI ──
  const sm = document.getElementById('sm-summary');
  if (statRegion === 'all') {
    sm.innerHTML = `
      <div class="sm-kpi"><div class="kpi-val">${allData.length.toLocaleString()}건</div><div class="kpi-lbl">전체 거래건수</div></div>
      <div class="sm-kpi"><div class="kpi-val">${(pyungAll(jejuAll)||0).toLocaleString()}만</div><div class="kpi-lbl">제주시 평균 평당가</div></div>
      <div class="sm-kpi kpi-seo"><div class="kpi-val">${(pyungAll(seoAll)||0).toLocaleString()}만</div><div class="kpi-lbl">서귀포시 평균 평당가</div></div>
      <div class="sm-kpi"><div class="kpi-val">${(priceAvg(allData)||0).toFixed(2)}억</div><div class="kpi-lbl">전체 평균 거래금액</div></div>
    `;
  } else {
    const color = statRegion==='jeju' ? '' : 'kpi-seo';
    const lbl   = statRegion==='jeju' ? '제주시' : '서귀포시';
    sm.innerHTML = `
      <div class="sm-kpi ${color}"><div class="kpi-val">${regionData.length.toLocaleString()}건</div><div class="kpi-lbl">${lbl} 총 거래</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(pyungAll(regionData)||0).toLocaleString()}만</div><div class="kpi-lbl">평균 평형당 단가</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(priceAvg(regionData)||0).toFixed(2)}억</div><div class="kpi-lbl">평균 거래금액</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(maxPrice(regionData)||0).toFixed(1)}억</div><div class="kpi-lbl">최고 거래금액</div></div>
    `;
  }

  function pyungAll(arr) { return pyungAvg(arr); }

  // ── 월 시계열 데이터 생성 (데이터 없는 월 제외) ──
  const months = [];
  const now = new Date('2026-08-25');
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const lbl = String(d.getMonth()+1) + '월';
    const yearLbl = m === 11 ? String(d.getFullYear()) : '';

    const jeju = allData.filter(t => t.date && t.date.startsWith(key) && t.sigungu==='제주시');
    const seo  = allData.filter(t => t.date && t.date.startsWith(key) && t.sigungu==='서귀포시');
    const all  = allData.filter(t => t.date && t.date.startsWith(key));
    const reg  = statRegion==='jeju' ? jeju : statRegion==='seo' ? seo : all;

    if (all.length === 0) continue; // 데이터 없는 월 건너뜀

    months.push({
      key, lbl, yearLbl,
      jejuPyung: pyungAvg(jeju),  seoPyung: pyungAvg(seo),  regPyung: pyungAvg(reg),
      jejuAvg:   priceAvg(jeju),  seoAvg:   priceAvg(seo),  regAvg:   priceAvg(reg),
      jejuCnt:   jeju.length,     seoCnt:   seo.length,      regCnt:   reg.length,
      allCnt:    all.length
    });
  }

  // ── SVG 렌더링 ──
  const svg = document.getElementById('stat-chart-main');
  const W=840, H=300, padL=62, padB=44, padR=50, padT=20;
  const cW=W-padL-padR, cH=H-padT-padB;
  const n = months.length;
  const xStep = cW / (n - 1);

  // 라인 설정
  let lines = [];   // [{vals, color, label}]
  let isBar = false;
  let yUnit = '';

  if (statRegion === 'all') {
    if (statTab === 'pyung') {
      lines = [{vals: months.map(m=>m.jejuPyung), color:'#1976D2', label:'제주시'},
               {vals: months.map(m=>m.seoPyung),  color:'#E65100', label:'서귀포시'}];
      yUnit = '만원/평';
    } else if (statTab === 'total') {
      lines = [{vals: months.map(m=>m.jejuAvg), color:'#1976D2', label:'제주시'},
               {vals: months.map(m=>m.seoAvg),  color:'#E65100', label:'서귀포시'}];
      yUnit = '억원';
    } else {
      lines = [{vals: months.map(m=>m.jejuCnt), color:'#1976D2', label:'제주시'},
               {vals: months.map(m=>m.seoCnt),  color:'#E65100', label:'서귀포시'}];
      isBar = true; yUnit = '건';
    }
  } else {
    const color = statRegion==='jeju' ? '#1976D2' : '#E65100';
    const label = statRegion==='jeju' ? '제주시' : '서귀포시';
    if (statTab === 'pyung') {
      lines = [{vals: months.map(m=>m.regPyung), color, label}]; yUnit = '만원/평';
    } else if (statTab === 'total') {
      lines = [{vals: months.map(m=>m.regAvg), color, label}]; yUnit = '억원';
    } else {
      lines = [{vals: months.map(m=>m.regCnt), color, label}]; isBar = true; yUnit = '건';
    }
  }

  const allVals = lines.flatMap(l=>l.vals).filter(v=>v!=null&&v>0);
  if (!allVals.length) { svg.innerHTML = '<text x="420" y="150" text-anchor="middle" font-size="14" fill="#ccc">데이터 없음</text>'; return; }
  const maxV = Math.max(...allVals);
  const minV = isBar ? 0 : Math.max(0, Math.min(...allVals) * 0.88);

  function toY(v) { return v==null ? null : padT + cH - ((v-minV)/(maxV-minV||1))*cH; }
  function toX(i) { return padL + i * xStep; }

  // 그리드
  const gridN = 5;
  let grids='', yLabels='';
  for (let i=0; i<=gridN; i++) {
    const v = minV + (maxV-minV)*i/gridN;
    const y = padT + cH - cH*i/gridN;
    const isZero = i===0;
    grids += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${isZero?'#bbb':'#e8ecf0'}" stroke-width="${isZero?1.5:1}"/>`;
    const lbl = statTab==='pyung' ? Math.round(v).toLocaleString()+'만' : statTab==='total' ? v.toFixed(2)+'억' : Math.round(v)+'건';
    yLabels += `<text x="${padL-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${lbl}</text>`;
  }

  // 바 or 라인
  let chartContent = '';
  if (isBar) {
    const bw = xStep * 0.35;
    const offset = lines.length > 1 ? [-bw*0.6, bw*0.6] : [0];
    lines.forEach((line, li) => {
      line.vals.forEach((v, i) => {
        if (!v) return;
        const bh = ((v-minV)/(maxV-minV))*cH;
        const ox = lines.length > 1 ? offset[li] : 0;
        chartContent += `<rect x="${(toX(i)-bw/2+ox).toFixed(1)}" y="${(padT+cH-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${line.color}" fill-opacity="0.75" rx="3"/>`;
        if (v > 0) chartContent += `<text x="${(toX(i)+ox).toFixed(1)}" y="${(padT+cH-bh-4).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${v}</text>`;
      });
    });
  } else {
    lines.forEach(line => {
      const pts = line.vals.map((v,i) => v!=null?{x:toX(i),y:toY(v),v}:null).filter(Boolean);
      if (pts.length < 2) return;
      const pathD = pts.map((p,j)=>(j===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
      const areaD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${(padT+cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT+cH).toFixed(1)} Z`;
      // 값 레이블 (각 점 위)
      const valLabels = pts.map(p=>`<text x="${p.x.toFixed(1)}" y="${(p.y-8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${statTab==='pyung'?Math.round(p.v).toLocaleString()+'만':statTab==='total'?p.v.toFixed(2)+'억':p.v+'건'}</text>`).join('');
      chartContent += `
        <defs><linearGradient id="g${line.color.replace('#','')}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${line.color}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${line.color}" stop-opacity="0.01"/>
        </linearGradient></defs>
        <path d="${areaD}" fill="url(#g${line.color.replace('#','')})"/>
        <path d="${pathD}" fill="none" stroke="${line.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"/>`).join('')}
        ${valLabels}
      `;
    });
  }

  // X축 레이블
  const xLabels = months.map((m,i) => `
    <text x="${toX(i).toFixed(1)}" y="${H-22}" text-anchor="middle" font-size="11" fill="#666" font-weight="600">${m.lbl}</text>
    ${m.yearLbl ? `<text x="${toX(i).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="10" fill="#aaa">${m.yearLbl}</text>` : ''}
  `).join('');

  // hover 영역
  let hoverRects = '';
  months.forEach((m, i) => {
    const x = i===0 ? padL : toX(i) - xStep/2;
    const w = i===0||i===n-1 ? xStep/2 : xStep;
    const fmtV = v => statTab==='pyung'?(v?v.toLocaleString()+'만/평':'-'):statTab==='total'?(v?v.toFixed(2)+'억':'-'):(v||0)+'건';
    const vals = lines.map(l => `${l.label}: ${fmtV(l.vals[i])}`).join('\n');
    const tip = `${m.key} (${m.allCnt}건)\n${vals}`;
    hoverRects += `<rect x="${x.toFixed(1)}" y="${padT}" width="${Math.min(w,cW).toFixed(1)}" height="${cH+8}" fill="transparent" class="stat-hover" data-tip="${tip}"/>`;
  });

  // 세로 구분선
  const vlines = months.map((m,i) => i>0&&i<n-1 ?
    `<line x1="${toX(i).toFixed(1)}" y1="${padT}" x2="${toX(i).toFixed(1)}" y2="${padT+cH}" stroke="#f0f0f0" stroke-width="1" stroke-dasharray="3,3"/>` : ''
  ).join('');

  svg.innerHTML = `
    <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
    ${grids}
    ${vlines}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>
    ${yLabels}
    <text x="14" y="${(padT+cH/2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,14,${(padT+cH/2).toFixed(1)})">${yUnit}</text>
    ${chartContent}
    ${xLabels}
    ${hoverRects}
  `;

  // 범례
  const legend = document.getElementById('sm-legend');
  legend.innerHTML = lines.map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('');

  // hover tooltip
  const tooltip = document.getElementById('stat-tooltip');
  svg.querySelectorAll('.stat-hover').forEach(r => {
    r.addEventListener('mousemove', e => {
      tooltip.innerHTML = r.dataset.tip.replace(/\n/g,'<br>');
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX + 14) + 'px';
      tooltip.style.top  = (e.clientY - 50) + 'px';
    });
    r.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
  });
}

// 모달 외부 클릭 닫기
document.getElementById('stat-modal').addEventListener('click', function(e){
  if (e.target === this) closeStatModal();
});
document.getElementById('land-stat-modal').addEventListener('click', function(e){
  if (e.target === this) closeLandStatModal();
});

/* ═══════════════════════════════════════════════
   토지 실거래 레이어
═══════════════════════════════════════════════ */
let landVisible  = false;
