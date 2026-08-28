/* js/imde.js - 제주 부동산 플랫폼 */
/* ═══════════════════════════════════════════════
   상업용 임대시장 모달
═══════════════════════════════════════════════ */
let imdeSec='임대가격지수', imdeCat='오피스';

function openImdeModal(){ document.getElementById('imde-modal').classList.add('open'); renderImdeChart(); }
function closeImdeModal(){ document.getElementById('imde-modal').classList.remove('open'); }
function setImdeSec(s,btn){
  imdeSec=s;
  document.querySelectorAll('.imde-sec-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderImdeChart();
}
function setImdeCat(c,btn){
  imdeCat=c;
  document.querySelectorAll('.imde-cat-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderImdeChart();
}

function renderImdeChart(){
  if(!window.IMDE_DATA) return;
  const QUARTERS=['23.1Q','23.2Q','23.3Q','23.4Q','24.1Q','24.2Q','24.3Q','24.4Q',
    '25.1Q','25.2Q','25.3Q','25.4Q','26.1Q','26.2Q'];
  const CAT_COLORS={'오피스':'#1976D2','중대형':'#E65100','소규모':'#2E7D32','집합':'#7B1FA2'};

  // 현재 섹션 전체 카테고리 표시 (선택된 것만 굵게)
  const allCats=['오피스','중대형','소규모','집합'];
  const rows = allCats.map(cat=>{
    const d = window.IMDE_DATA.find(r=>r.section===imdeSec&&r.category===cat);
    return {cat, d, color:CAT_COLORS[cat], active: cat===imdeCat};
  }).filter(r=>r.d);

  // KPI (선택 카테고리)
  const cur = rows.find(r=>r.cat===imdeCat);
  const kpiEl = document.getElementById('imde-kpi');
  if(cur && cur.d){
    const latest = cur.d.values['26.2Q'];
    const yoy = cur.d.yoy, qoq = cur.d.qoq;
    const unit = imdeSec==='임대가격지수'?'pt':'%';
    kpiEl.innerHTML=`
      <div class="sm-kpi"><div class="kpi-val">${latest!=null?latest.toFixed(2):'-'}</div><div class="kpi-lbl">${imdeCat} 최신값 (26.2Q)</div></div>
      <div class="sm-kpi"><div class="kpi-val" style="color:${yoy>0?'#C62828':'#1565C0'}">${yoy!=null?(yoy>=0?'+':'')+yoy.toFixed(2)+'%p':'-'}</div><div class="kpi-lbl">전년동기대비</div></div>
      <div class="sm-kpi"><div class="kpi-val" style="color:${qoq>0?'#C62828':'#1565C0'}">${qoq!=null?(qoq>=0?'+':'')+qoq.toFixed(2)+'%p':'-'}</div><div class="kpi-lbl">전기대비</div></div>`;
  }

  // SVG
  const svg = document.getElementById('imde-chart');
  const W=840, H=280, padL=72, padB=44, padR=20, padT=20;
  const cW=W-padL-padR, cH=H-padT-padB, n=QUARTERS.length;
  const xStep=cW/(n-1);

  const activeRow = rows.find(r=>r.cat===imdeCat);
  const drawRows = activeRow ? [activeRow] : rows; // 선택한 것만
  const allVals = drawRows.flatMap(r=>QUARTERS.map(q=>r.d.values[q]).filter(v=>v!=null));
  if(!allVals.length){svg.innerHTML='<text x="420" y="140" text-anchor="middle" font-size="14" fill="#ccc">데이터 없음</text>';return;}
  const maxV=Math.max(...allVals), minV=Math.min(...allVals);
  const pad=(maxV-minV)*0.12||0.5;
  const hi=maxV+pad, lo=minV-pad;

  function toY(v){return padT+cH-((v-lo)/(hi-lo))*cH;}
  function toX(i){return padL+i*xStep;}
  function fmtV(v){return imdeSec==='임대가격지수'?v.toFixed(2):v.toFixed(2)+'%';}

  const gridN=5; let grids='',yLabels='';
  for(let i=0;i<=gridN;i++){
    const v=lo+(hi-lo)*i/gridN, y=padT+cH-cH*i/gridN;
    grids+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#e8ecf0" stroke-width="1"/>`;
    yLabels+=`<text x="${padL-6}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${fmtV(v)}</text>`;
  }

  let chartContent='';
  // 배경에 전체 카테고리 연하게
  rows.filter(r=>r.cat!==imdeCat).forEach(({d,color})=>{
    const pts=QUARTERS.map((q,i)=>{const v=d.values[q];return v!=null?{x:toX(i),y:toY(v)}:null;}).filter(Boolean);
    if(pts.length<2) return;
    const pathD=pts.map((p,j)=>(j===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
    chartContent+=`<path d="${pathD}" fill="none" stroke="${color}" stroke-width="1.2" opacity="0.25" stroke-dasharray="4,3"/>`;
  });
  // 선택 카테고리 강조
  if(activeRow){
    const {d,color}=activeRow;
    const pts=QUARTERS.map((q,i)=>{const v=d.values[q];return v!=null?{x:toX(i),y:toY(v),v,q}:null;}).filter(Boolean);
    if(pts.length>=2){
      const pathD=pts.map((p,j)=>(j===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
      const areaD=pathD+` L${pts[pts.length-1].x.toFixed(1)},${(padT+cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT+cH).toFixed(1)} Z`;
      const gid='ig'+color.replace('#','');
      chartContent+=`<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${color}" stop-opacity="0.15"/>
        <stop offset="100%" stop-color="${color}" stop-opacity="0.01"/>
      </linearGradient></defs>
      <path d="${areaD}" fill="url(#${gid})"/>
      <path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.8" stroke-linejoin="round"/>`;
      pts.forEach(p=>{chartContent+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4" fill="${color}" stroke="#fff" stroke-width="2"/>`;});
      const last=pts[pts.length-1];
      chartContent+=`<text x="${(last.x+4).toFixed(1)}" y="${(last.y+4).toFixed(1)}" font-size="10" fill="${color}" font-weight="700">${fmtV(last.v)}</text>`;
    }
  }

  const xLabels=QUARTERS.map((q,i)=>`<text x="${toX(i).toFixed(1)}" y="${H-26}" text-anchor="middle" font-size="10" fill="#666">${q}</text>`).join('');

  svg.innerHTML=`
    <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
    ${grids}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>
    ${yLabels}
    <text x="12" y="${(padT+cH/2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,12,${(padT+cH/2).toFixed(1)})">${imdeSec}</text>
    ${chartContent}${xLabels}`;
}

