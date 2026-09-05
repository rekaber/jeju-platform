/* js/land-stat.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   토지 실거래 통계 모달
═══════════════════════════════════════════════ */
var landStatTab    = 'perm2';
var landStatRegion = 'all';
var landStatJimok  = 'all';
var landStatYear   = new Date().getFullYear();

function _initLandStatYearSelect() {
  const sel = document.getElementById('land-stat-year-select');
  if (!sel || !window.LAND_DATA) return;
  const years = [...new Set(window.LAND_DATA.map(t => t.date && t.date.slice(0,4)).filter(Boolean))].sort();
  const list = years.length ? years : [String(new Date().getFullYear())];
  sel.innerHTML = list.map(y => `<option value="${y}"${String(landStatYear)===y?' selected':''}>${y}년</option>`).join('');
}
function setLandStatYear(y) {
  landStatYear = parseInt(y);
  renderLandStatChart();
}

function openLandStatModal() {
  document.getElementById('land-stat-modal').classList.add('open');
  _initLandStatYearSelect();
  renderLandStatChart();
}
function closeLandStatModal() {
  document.getElementById('land-stat-modal').classList.remove('open');
}
function setLandStatTab(tab, btn) {
  landStatTab = tab;
  document.querySelectorAll('.lsm-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLandStatChart();
}
function setLandStatRegion(region, btn) {
  landStatRegion = region;
  document.querySelectorAll('.lsm-region-tab').forEach(b => {
    b.classList.remove('active-all','active-jeju','active-seo');
  });
  btn.classList.add('active-' + region);
  renderLandStatChart();
}
function setLandStatJimok(jimok, btn) {
  landStatJimok = jimok;
  document.querySelectorAll('.lsm-jimok-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderLandStatChart();
}

function renderLandStatChart() {
  if (!window.LAND_DATA || !window.LAND_DATA.length) {
    const svg = document.getElementById('land-stat-chart-main');
    if (svg) svg.innerHTML = '<text x="420" y="150" text-anchor="middle" font-size="14" fill="#ccc">토지 데이터 로드 중...</text>';
    return;
  }

  function filterByJimok(arr) {
    if (landStatJimok === 'all')  return arr;
    if (landStatJimok === 'dae')  return arr.filter(r => r.jimok === '대');
    if (landStatJimok === 'farm') return arr.filter(r => FARM_JIMOK.includes(r.jimok));
    if (landStatJimok === 'imya') return arr.filter(r => r.jimok === '임야');
    return arr.filter(r => !['대','임야',...FARM_JIMOK].includes(r.jimok));
  }
  function perm2Avg(arr) {
    const v = arr.filter(r => r.perM2 > 0);
    return v.length ? Math.round(v.reduce((s,r) => s + r.perM2, 0) / v.length) : null;
  }
  function priceAvg(arr) {
    return arr.length ? parseFloat((arr.reduce((s,r) => s + r.price, 0) / arr.length).toFixed(2)) : null;
  }

  const yearFiltered = window.LAND_DATA.filter(r => r.date && r.date.startsWith(String(landStatYear)));
  const baseData = filterByJimok(yearFiltered);
  const jejuAll  = baseData.filter(r => r.sigungu === '제주시');
  const seoAll   = baseData.filter(r => r.sigungu === '서귀포시');

  // KPI
  const sm = document.getElementById('lsm-summary');
  const fmtM2 = v => v ? v.toLocaleString() + '만/㎡' : '-';
  if (landStatRegion === 'all') {
    sm.innerHTML = `
      <div class="sm-kpi"><div class="kpi-val">${baseData.length.toLocaleString()}건</div><div class="kpi-lbl">전체 거래건수</div></div>
      <div class="sm-kpi"><div class="kpi-val">${fmtM2(perm2Avg(jejuAll))}</div><div class="kpi-lbl">제주시 평균 ㎡단가</div></div>
      <div class="sm-kpi kpi-seo"><div class="kpi-val">${fmtM2(perm2Avg(seoAll))}</div><div class="kpi-lbl">서귀포시 평균 ㎡단가</div></div>
      <div class="sm-kpi"><div class="kpi-val">${(priceAvg(baseData)||0).toFixed(2)}억</div><div class="kpi-lbl">전체 평균 거래금액</div></div>`;
  } else {
    const rd    = landStatRegion === 'jeju' ? jejuAll : seoAll;
    const lbl   = landStatRegion === 'jeju' ? '제주시' : '서귀포시';
    const color = landStatRegion === 'jeju' ? '' : 'kpi-seo';
    sm.innerHTML = `
      <div class="sm-kpi ${color}"><div class="kpi-val">${rd.length.toLocaleString()}건</div><div class="kpi-lbl">${lbl} 총 거래</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${fmtM2(perm2Avg(rd))}</div><div class="kpi-lbl">평균 ㎡당 단가</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(priceAvg(rd)||0).toFixed(2)}억</div><div class="kpi-lbl">평균 거래금액</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${rd.length ? Math.max(...rd.map(r=>r.price)).toFixed(1) : 0}억</div><div class="kpi-lbl">최고 거래금액</div></div>`;
  }

  // 월 시계열 (데이터 없는 월 제외)
  const months = [];
  const now = new Date();
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
    const key = d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0');
    const lbl = String(d.getMonth()+1) + '월';
    const yearLbl = m === 11 ? String(d.getFullYear()) : '';
    const jeju = baseData.filter(r => r.date && r.date.startsWith(key) && r.sigungu==='제주시');
    const seo  = baseData.filter(r => r.date && r.date.startsWith(key) && r.sigungu==='서귀포시');
    const all  = baseData.filter(r => r.date && r.date.startsWith(key));
    const reg  = landStatRegion==='jeju' ? jeju : landStatRegion==='seo' ? seo : all;
    if (all.length === 0) continue; // 데이터 없는 월 건너뜀
    months.push({
      key, lbl, yearLbl,
      jejuM2: perm2Avg(jeju), seoM2: perm2Avg(seo), regM2: perm2Avg(reg),
      jejuAvg: priceAvg(jeju), seoAvg: priceAvg(seo), regAvg: priceAvg(reg),
      jejuCnt: jeju.length, seoCnt: seo.length, regCnt: reg.length, allCnt: all.length
    });
  }

  // SVG
  const svg = document.getElementById('land-stat-chart-main');
  const W=840, H=300, padL=72, padB=44, padR=50, padT=20;
  const cW=W-padL-padR, cH=H-padT-padB;
  const n = months.length;
  const xStep = cW / (n - 1);

  let lines = [], isBar = false, yUnit = '';
  if (landStatRegion === 'all') {
    if (landStatTab === 'perm2') {
      lines = [{vals: months.map(m=>m.jejuM2), color:'#1976D2', label:'제주시'},
               {vals: months.map(m=>m.seoM2),  color:'#E65100', label:'서귀포시'}];
      yUnit = '만원/㎡';
    } else if (landStatTab === 'total') {
      lines = [{vals: months.map(m=>m.jejuAvg), color:'#1976D2', label:'제주시'},
               {vals: months.map(m=>m.seoAvg),  color:'#E65100', label:'서귀포시'}];
      yUnit = '억원';
    } else {
      lines = [{vals: months.map(m=>m.jejuCnt), color:'#1976D2', label:'제주시'},
               {vals: months.map(m=>m.seoCnt),  color:'#E65100', label:'서귀포시'}];
      isBar = true; yUnit = '건';
    }
  } else {
    const color = landStatRegion==='jeju' ? '#1976D2' : '#E65100';
    const label = landStatRegion==='jeju' ? '제주시' : '서귀포시';
    if (landStatTab === 'perm2')       { lines = [{vals: months.map(m=>m.regM2),  color, label}]; yUnit = '만원/㎡'; }
    else if (landStatTab === 'total')  { lines = [{vals: months.map(m=>m.regAvg), color, label}]; yUnit = '억원'; }
    else { lines = [{vals: months.map(m=>m.regCnt), color, label}]; isBar = true; yUnit = '건'; }
  }

  const allVals = lines.flatMap(l=>l.vals).filter(v=>v!=null&&v>0);
  if (!allVals.length) {
    svg.innerHTML = '<text x="420" y="150" text-anchor="middle" font-size="14" fill="#ccc">데이터 없음</text>';
    document.getElementById('lsm-legend').innerHTML = '';
    return;
  }
  const maxV = Math.max(...allVals);
  const minV = isBar ? 0 : Math.max(0, Math.min(...allVals) * 0.88);

  function toY(v) { return v==null ? null : padT + cH - ((v-minV)/(maxV-minV||1))*cH; }
  function toX(i) { return padL + i * xStep; }
  function fmtV(v) {
    if (landStatTab==='perm2')  return v ? Math.round(v).toLocaleString()+'만' : '-';
    if (landStatTab==='total')  return v ? v.toFixed(2)+'억' : '-';
    return (v||0)+'건';
  }

  const gridN = 5;
  let grids='', yLabels='';
  for (let i=0; i<=gridN; i++) {
    const v = minV + (maxV-minV)*i/gridN;
    const y = padT + cH - cH*i/gridN;
    grids += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${i===0?'#bbb':'#e8ecf0'}" stroke-width="${i===0?1.5:1}"/>`;
    yLabels += `<text x="${padL-8}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${fmtV(v)}</text>`;
  }

  let chartContent = '';
  if (isBar) {
    const bw = xStep * 0.35;
    const offsets = lines.length > 1 ? [-bw*0.6, bw*0.6] : [0];
    lines.forEach((line, li) => {
      line.vals.forEach((v, i) => {
        if (!v) return;
        const bh = ((v-minV)/(maxV-minV))*cH;
        const ox = offsets[li] || 0;
        chartContent += `<rect x="${(toX(i)-bw/2+ox).toFixed(1)}" y="${(padT+cH-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${line.color}" fill-opacity="0.75" rx="3"/>`;
        chartContent += `<text x="${(toX(i)+ox).toFixed(1)}" y="${(padT+cH-bh-4).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${v}</text>`;
      });
    });
  } else {
    lines.forEach(line => {
      const pts = line.vals.map((v,i) => v!=null?{x:toX(i),y:toY(v),v}:null).filter(Boolean);
      if (pts.length < 2) return;
      const pathD = pts.map((p,j)=>(j===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
      const areaD = pathD + ` L${pts[pts.length-1].x.toFixed(1)},${(padT+cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT+cH).toFixed(1)} Z`;
      const valLabels = pts.map(p=>`<text x="${p.x.toFixed(1)}" y="${(p.y-8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${fmtV(p.v)}</text>`).join('');
      const gid = 'lg' + line.color.replace('#','');
      chartContent += `
        <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${line.color}" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="${line.color}" stop-opacity="0.01"/>
        </linearGradient></defs>
        <path d="${areaD}" fill="url(#${gid})"/>
        <path d="${pathD}" fill="none" stroke="${line.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
        ${pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"/>`).join('')}
        ${valLabels}`;
    });
  }

  const xLabels = months.map((m,i) => `
    <text x="${toX(i).toFixed(1)}" y="${H-22}" text-anchor="middle" font-size="11" fill="#666" font-weight="600">${m.lbl}</text>
    ${m.yearLbl ? `<text x="${toX(i).toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="10" fill="#aaa">${m.yearLbl}</text>` : ''}
  `).join('');

  let hoverRects = '';
  months.forEach((m, i) => {
    const x = i===0 ? padL : toX(i) - xStep/2;
    const w = i===0||i===n-1 ? xStep/2 : xStep;
    const vals = lines.map(l => `${l.label}: ${fmtV(l.vals[i])}`).join('\n');
    hoverRects += `<rect x="${x.toFixed(1)}" y="${padT}" width="${Math.min(w,cW).toFixed(1)}" height="${cH+8}" fill="transparent" class="stat-hover" data-tip="${m.key} (${m.allCnt}건)\n${vals}"/>`;
  });

  const vlines = months.map((m,i) => i>0&&i<n-1 ?
    `<line x1="${toX(i).toFixed(1)}" y1="${padT}" x2="${toX(i).toFixed(1)}" y2="${padT+cH}" stroke="#f0f0f0" stroke-width="1" stroke-dasharray="3,3"/>` : ''
  ).join('');

  svg.innerHTML = `
    <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
    ${grids}${vlines}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>
    ${yLabels}
    <text x="14" y="${(padT+cH/2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,14,${(padT+cH/2).toFixed(1)})">${yUnit}</text>
    ${chartContent}${xLabels}${hoverRects}`;

  document.getElementById('lsm-legend').innerHTML =
    lines.map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('');
}
