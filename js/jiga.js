/* js/jiga.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   지가변동률 모달
═══════════════════════════════════════════════ */
var jigaRegion = '제주전체', jigaCat = '평균', jigaSub = '평균';

fetch('./jiga_data.json').then(r=>r.json()).then(d=>{ window.JIGA_DATA=d; }).catch(()=>{});
fetch('./imde_data.json').then(r=>r.json()).then(d=>{ window.IMDE_DATA=d; }).catch(()=>{});

document.getElementById('jiga-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeJigaModal();});
document.getElementById('imde-modal').addEventListener('click',e=>{if(e.target===e.currentTarget)closeImdeModal();});

function openJigaModal(){ document.getElementById('jiga-modal').classList.add('open'); renderJigaChart(); }
function closeJigaModal(){ document.getElementById('jiga-modal').classList.remove('open'); }
function setJigaRegion(r,btn){
  jigaRegion=r;
  document.querySelectorAll('.jiga-region-tab').forEach(b=>b.classList.remove('active-all','active-jeju','active-seo'));
  btn.classList.add(r==='제주전체'?'active-all':r==='제주시'?'active-jeju':'active-seo');
  renderJigaChart();
}
function setJigaCat(c,btn){
  jigaCat=c; jigaSub='평균';
  document.querySelectorAll('.jiga-cat-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderJigaChart();
}
function setJigaSub(s,btn){
  jigaSub=s;
  document.querySelectorAll('.jiga-sub-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderJigaChart();
}

function renderJigaChart(){
  if(!window.JIGA_DATA) return;
  const data = window.JIGA_DATA;
  const QUARTERS = ['21.1Q','21.2Q','21.3Q','21.4Q','22.1Q','22.2Q','22.3Q','22.4Q',
    '23.1Q','23.2Q','23.3Q','23.4Q','24.1Q','24.2Q','24.3Q','24.4Q',
    '25.1Q','25.2Q','25.3Q','25.4Q','26.1Q','26.2Q'];

  // 서브 버튼 구성
  const subWrap = document.getElementById('jiga-sub-wrap');
  const filtered = data.filter(d=>d.region===jigaRegion && d.category===jigaCat);
  const subs = [...new Set(filtered.map(d=>d.sub))].filter(s=>s!=='평균');
  if(jigaCat==='평균'){
    subWrap.innerHTML='';
  } else {
    const colors = {'주거지역':'#1976D2','상업지역':'#E65100','녹지지역':'#2E7D32','공업지역':'#7B1FA2',
      '보전관리지역':'#00796B','생산관리지역':'#558B2F','계획관리지역':'#F57C00','농림지역':'#8D6E63','자연환경보전지역':'#546E7A',
      '전':'#1976D2','답':'#43A047','주거용':'#E65100','상업용':'#F57C00','임야':'#2E7D32','공업용':'#7B1FA2'};
    subWrap.innerHTML = subs.map(s=>
      `<button class="jiga-sub-btn${s===jigaSub?' active':''}" onclick="setJigaSub('${s}',this)">${s}</button>`
    ).join('');
  }

  // 데이터 선택
  let rows;
  if(jigaCat==='평균'){
    rows = [{row: data.find(d=>d.region===jigaRegion&&d.category==='평균'&&d.sub==='평균'), color:'#2E7D32', label:'평균'}];
  } else {
    const COLORS=['#1976D2','#E65100','#2E7D32','#7B1FA2','#00796B','#558B2F','#F57C00','#8D6E63','#546E7A'];
    if(jigaSub!=='평균'){
      const r = data.find(d=>d.region===jigaRegion&&d.category===jigaCat&&d.sub===jigaSub);
      rows = [{row:r, color:COLORS[subs.indexOf(jigaSub)%COLORS.length], label:jigaSub}];
    } else {
      rows = subs.map((s,i)=>({row:data.find(d=>d.region===jigaRegion&&d.category===jigaCat&&d.sub===s), color:COLORS[i%COLORS.length], label:s}));
    }
  }

  // KPI
  const kpiEl = document.getElementById('jiga-kpi');
  const latest = '26.2Q', prev = '26.1Q';
  kpiEl.innerHTML = rows.filter(r=>r.row).map(r=>{
    const lv = r.row.values[latest], pv = r.row.values[prev];
    const dir = lv>0?'▲':lv<0?'▼':'─';
    return `<div class="sm-kpi" style="border-left:3px solid ${r.color}">
      <div class="kpi-val" style="color:${lv>0?'#C62828':lv<0?'#1565C0':'#333'}">${dir} ${lv!=null?lv.toFixed(3):'-'}%</div>
      <div class="kpi-lbl">${r.label} (26.2Q)</div>
    </div>`;
  }).join('');

  // SVG 차트
  const svg = document.getElementById('jiga-chart');
  const W=840, H=280, padL=60, padB=44, padR=20, padT=20;
  const cW=W-padL-padR, cH=H-padT-padB, n=QUARTERS.length;
  const xStep=cW/(n-1);

  const allVals = rows.flatMap(r=>r.row?QUARTERS.map(q=>r.row.values[q]).filter(v=>v!=null):[]);
  if(!allVals.length){svg.innerHTML='<text x="420" y="140" text-anchor="middle" font-size="14" fill="#ccc">데이터 없음</text>';return;}
  const maxV=Math.max(...allVals), minV=Math.min(...allVals);
  const pad=(maxV-minV)*0.15||0.1;
  const hi=maxV+pad, lo=minV-pad;

  function toY(v){return padT+cH-((v-lo)/(hi-lo))*cH;}
  function toX(i){return padL+i*xStep;}

  const gridN=5; let grids='',yLabels='';
  for(let i=0;i<=gridN;i++){
    const v=lo+(hi-lo)*i/gridN, y=padT+cH-cH*i/gridN;
    const isZero=Math.abs(v)<0.001;
    grids+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="${isZero?'#999':'#e8ecf0'}" stroke-width="${isZero?1.5:1}" ${isZero?'stroke-dasharray="4,2"':''}/>`;
    yLabels+=`<text x="${padL-6}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${v.toFixed(2)}%</text>`;
  }

  // 0선
  const zeroY = toY(0);
  const zeroLine = zeroY>=padT&&zeroY<=padT+cH ?
    `<line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W-padR}" y2="${zeroY.toFixed(1)}" stroke="#999" stroke-width="1.5" stroke-dasharray="4,2"/>` : '';

  let chartContent='';
  rows.forEach(({row,color,label})=>{
    if(!row) return;
    const pts = QUARTERS.map((q,i)=>{const v=row.values[q]; return v!=null?{x:toX(i),y:toY(v),v,q}:null;}).filter(Boolean);
    if(pts.length<2) return;
    const pathD=pts.map((p,j)=>(j===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
    chartContent+=`<path d="${pathD}" fill="none" stroke="${color}" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round"/>`;
    pts.forEach(p=>{chartContent+=`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="3.5" fill="${color}" stroke="#fff" stroke-width="1.5"/>`;});
    // 최신값 레이블
    const last=pts[pts.length-1];
    chartContent+=`<text x="${(last.x+4).toFixed(1)}" y="${(last.y+4).toFixed(1)}" font-size="10" fill="${color}" font-weight="700">${last.v.toFixed(3)}%</text>`;
  });

  // X축 레이블 (분기)
  const xLabels=QUARTERS.map((q,i)=>{
    const show=q.endsWith('1Q')||q==='26.2Q';
    return show?`<text x="${toX(i).toFixed(1)}" y="${H-26}" text-anchor="middle" font-size="10" fill="#666">${q}</text>
      ${q.endsWith('1Q')?`<line x1="${toX(i).toFixed(1)}" y1="${padT}" x2="${toX(i).toFixed(1)}" y2="${padT+cH}" stroke="#ececec" stroke-width="1"/>`:''}`:'';
  }).join('');

  svg.innerHTML=`
    <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
    ${grids}${zeroLine}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>
    ${yLabels}
    <text x="12" y="${(padT+cH/2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,12,${(padT+cH/2).toFixed(1)})">변동률(%)</text>
    ${chartContent}${xLabels}`;

  document.getElementById('jiga-legend').innerHTML=
    rows.filter(r=>r.row).map(r=>`<span><i style="background:${r.color}"></i>${r.label}</span>`).join('');
}
