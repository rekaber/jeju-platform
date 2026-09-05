/* js/stats.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   통계 모달
═══════════════════════════════════════════════ */
var statTab    = 'pyung';
var statRegion = 'all';   // 'all' | 'jeju' | 'seo'
var statYear   = new Date().getFullYear();

function _getStatYears() {
  if (!window.TRADE_DATA) return [new Date().getFullYear()];
  const years = [...new Set(window.TRADE_DATA.map(t => t.date && t.date.slice(0,4)).filter(Boolean))].sort();
  return years.length ? years : [String(new Date().getFullYear())];
}
function _initStatYearSelect() {
  const sel = document.getElementById('stat-year-select');
  if (!sel) return;
  const years = _getStatYears();
  sel.innerHTML = years.map(y => `<option value="${y}"${String(statYear)===y?' selected':''}>${y}년</option>`).join('');
}
function setStatYear(y) {
  statYear = parseInt(y);
  renderStatChart();
}

function openStatModal() {
  document.getElementById('stat-modal').classList.add('open');
  _initStatYearSelect();
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
  const allData = window.TRADE_DATA.filter(t => t.date && t.date.startsWith(String(statYear)));

  // ── 헬퍼 ──
  function pyungAvg(arr) {
    // area=0 레코드 제외 (division by zero 방지)
    const valid = arr.filter(t => t.area && t.area > 0);
    if (!valid.length) return null;
    return Math.round(valid.reduce((s,t) => s + (t.price * 10000) / (t.area / 3.3058), 0) / valid.length);
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

  // ── 월 시계열 데이터 생성 (선택 연도 1월~12월, 데이터 없는 월 제외) ──
  const months = [];
  const now = new Date();
  const isCurrentYear = statYear === now.getFullYear();
  const lastMonth = isCurrentYear ? now.getMonth() : 11; // 현재년도면 현재월까지, 과거면 12월까지
  for (let mo = 0; mo <= lastMonth; mo++) {
    const key = statYear + '-' + String(mo + 1).padStart(2, '0');
    const lbl = String(mo + 1) + '월';
    const yearLbl = mo === 0 ? String(statYear) : '';

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
