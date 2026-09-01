/* js/migration.js - 제주 부동산 플랫폼 */
/* ═══════════════════════════════════════════════
   인구이동 데이터 & 지도 화살표
═══════════════════════════════════════════════ */
fetch('./migration_data.json').then(r=>r.json()).then(d=>{ window.MIGRATION_DATA=d; }).catch(()=>{});

let migActiveDir = null; // 'out' | 'in' | null

const JEJU_CENTER = {lat:33.3617, lng:126.5292};

function toggleMigration(dir, btn) {
  const tog = document.getElementById('toggle-mig-' + dir);
  const other = dir==='out' ? 'in' : 'out';
  const otherTog = document.getElementById('toggle-mig-' + other);

  if (migActiveDir === dir) {
    // 끄기
    tog.classList.remove('on');
    migActiveDir = null;
    clearMigrationArrows();
  } else {
    // 다른 쪽 끄기
    if (otherTog) otherTog.classList.remove('on');
    tog.classList.add('on');
    migActiveDir = dir;
    // 한국 전체가 보이는 뷰로 줌 조정 후 화살표 그리기
    map.flyTo({ center: [127.8, 36.0], zoom: 7 });
    setTimeout(() => drawMigrationArrows(dir), 500);
  }
}

function clearMigrationArrows() {
  const svg = document.getElementById('migration-svg-overlay');
  if (svg) svg.innerHTML = '';
}

function latlngToPixel(lat, lng) {
  const pt = map.project([lng, lat]);
  return { x: pt.x, y: pt.y };
}

function drawMigrationArrows(dir) {
  if (!window.MIGRATION_DATA) { alert('인구이동 데이터를 불러오는 중입니다.'); return; }
  const svg = document.getElementById('migration-svg-overlay');
  const mapEl = document.getElementById('map');
  const W = mapEl.offsetWidth, H = mapEl.offsetHeight;
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', W);
  svg.setAttribute('height', H);

  const data = dir==='out' ? window.MIGRATION_DATA.outflow : window.MIGRATION_DATA.inflow;
  const months = window.MIGRATION_DATA.months;
  const latestIdx = months.length - 1;

  // 최대값 (두께 스케일용)
  const maxCount = Math.max(...data.map(r=>r.counts[latestIdx]||0));

  const jeju = latlngToPixel(JEJU_CENTER.lat, JEJU_CENTER.lng);

  let defs = `<defs>
    <marker id="arr-out" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#E53935" fill-opacity="0.85"/>
    </marker>
    <marker id="arr-in" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
      <polygon points="0 0, 8 3, 0 6" fill="#1976D2" fill-opacity="0.85"/>
    </marker>
  </defs>`;

  let paths = '', labels = '', anims = '';

  data.forEach((region, idx) => {
    if (!region.lat || !region.lng) return;
    const count = region.counts[latestIdx] || 0;
    if (count === 0) return;

    const reg = latlngToPixel(region.lat, region.lng);
    const strokeW = Math.max(1.5, (count / maxCount) * 8);
    const color = dir==='out' ? '#E53935' : '#1976D2';
    const marker = dir==='out' ? 'arr-out' : 'arr-in';

    // 출발/도착 설정
    const x1 = dir==='out' ? jeju.x : reg.x;
    const y1 = dir==='out' ? jeju.y : reg.y;
    const x2 = dir==='out' ? reg.x  : jeju.x;
    const y2 = dir==='out' ? reg.y  : jeju.y;

    // 베지에 곡선 제어점 (왼쪽으로 휨)
    const mx=(x1+x2)/2, my=(y1+y2)/2;
    const dx=x2-x1, dy=y2-y1;
    const len=Math.sqrt(dx*dx+dy*dy)||1;
    const curve = Math.min(len*0.25, 80);
    const cx = mx - (dy/len)*curve;
    const cy = my + (dx/len)*curve;

    const pid = `mp${idx}`;
    paths += `<path id="${pid}" d="M${x1.toFixed(1)} ${y1.toFixed(1)} Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}"
      class="mig-arrow-path" stroke="${color}" stroke-width="${strokeW.toFixed(1)}"
      stroke-opacity="0.65" marker-end="url(#${marker})"/>`;

    // 흐르는 점 애니메이션
    const dur = (2.5 - (count/maxCount)*1.2).toFixed(1);
    anims += `<circle r="${Math.max(3,strokeW*0.7).toFixed(1)}" fill="white" fill-opacity="0.9">
      <animateMotion dur="${dur}s" repeatCount="indefinite" rotate="auto">
        <mpath href="#${pid}"/>
      </animateMotion>
    </circle>`;

    // 레이블 (중간점 근처)
    const lx=(x1+cx/2)/1.5, ly=(y1+cy/2)/1.5;
    const midX = (x1+2*cx+x2)/4, midY = (y1+2*cy+y2)/4;
    labels += `<rect x="${(midX-18).toFixed(1)}" y="${(midY-9).toFixed(1)}" width="36" height="16" rx="4" fill="${color}" fill-opacity="0.82"/>
      <text x="${midX.toFixed(1)}" y="${(midY+4).toFixed(1)}" text-anchor="middle" class="mig-label" fill="white">${count.toLocaleString()}</text>`;
  });

  svg.innerHTML = defs + paths + labels + anims;
}

// 지도 이동/줌 시 화살표 재렌더
// map 초기화 후 moveend 이벤트 등록
document.addEventListener('DOMContentLoaded', () => {
  const registerMove = () => {
    if (window.map) {
      window.map.on('moveend', function() {
        if (migActiveDir) drawMigrationArrows(migActiveDir);
      });
    } else {
      setTimeout(registerMove, 200);
    }
  };
  registerMove();
});

/* ─── 인구이동 통계 모달 ─── */
let migTab = 'trend';
let migYear = 'all';

function setMigYear(year, btn) {
  migYear = year;
  document.querySelectorAll('.mig-year-btn').forEach(b => {
    b.style.background = '#fff'; b.style.color = '#555'; b.style.borderColor = '#D0D7E2';
  });
  btn.style.background = '#7B1FA2'; btn.style.color = '#fff'; btn.style.borderColor = '#7B1FA2';
  renderMigChart();
}

function getMigFilteredData(D) {
  // 연도 필터 적용
  const allMonths = D.months;
  const indices = migYear === 'all'
    ? allMonths.map((_,i)=>i)
    : allMonths.map((m,i)=>m.startsWith(migYear)?i:-1).filter(i=>i>=0);
  const months = indices.map(i=>allMonths[i]);
  const filterRegion = (regions) => regions.map(r=>({
    ...r,
    counts: indices.map(i=>r.counts[i]||0),
    nets:   indices.map(i=>r.nets[i]||0),
  }));
  return { months, outflow: filterRegion(D.outflow), inflow: filterRegion(D.inflow) };
}

function openMigrationModal() {
  document.getElementById('mig-modal').classList.add('open');
  renderMigChart();
}
function closeMigrationModal() {
  document.getElementById('mig-modal').classList.remove('open');
}
document.getElementById('mig-modal').addEventListener('click', function(e){
  if(e.target===this) closeMigrationModal();
});

function setMigTab(tab, btn) {
  migTab = tab;
  document.querySelectorAll('.mig-tab').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderMigChart();
}

function renderMigChart() {
  if (!window.MIGRATION_DATA) { return; }
  const D = getMigFilteredData(window.MIGRATION_DATA);
  const months = D.months;
  const svg = document.getElementById('mig-chart-main');

  // KPI
  const latestIdx = months.length-1;
  const totalOut = D.outflow.reduce((s,r)=>s+(r.counts[latestIdx]||0),0);
  const totalIn  = D.inflow.reduce((s,r)=>s+(r.counts[latestIdx]||0),0);
  const netMove  = totalIn - totalOut;
  const totalOutAll = D.outflow.reduce((s,r)=>s+r.counts.reduce((a,b)=>a+b,0),0);
  const totalInAll  = D.inflow.reduce((s,r)=>s+r.counts.reduce((a,b)=>a+b,0),0);
  const periodLbl = migYear==='all' ? `${months[0]}~${months[latestIdx]}` : migYear+'년';
  document.getElementById('mig-kpi').innerHTML = `
    <div class="mig-kpi-card"><div class="mig-kpi-lbl">전출 (${months[latestIdx]})</div><div class="mig-kpi-val" style="color:#E53935">${totalOut.toLocaleString()}명</div><div class="mig-kpi-sub">제주→타지역</div></div>
    <div class="mig-kpi-card"><div class="mig-kpi-lbl">전입 (${months[latestIdx]})</div><div class="mig-kpi-val" style="color:#1976D2">${totalIn.toLocaleString()}명</div><div class="mig-kpi-sub">타지역→제주</div></div>
    <div class="mig-kpi-card"><div class="mig-kpi-lbl">순이동 (${months[latestIdx]})</div><div class="mig-kpi-val" style="color:${netMove>=0?'#1976D2':'#E53935'}">${netMove>=0?'+':''}${netMove.toLocaleString()}명</div><div class="mig-kpi-sub">${netMove>=0?'순유입':'순유출'}</div></div>
    <div class="mig-kpi-card"><div class="mig-kpi-lbl">누적 전입 (${periodLbl})</div><div class="mig-kpi-val">${totalInAll.toLocaleString()}명</div><div class="mig-kpi-sub">전출 누계: ${totalOutAll.toLocaleString()}명</div></div>`;

  const W=840, H=300, padL=60, padB=44, padR=50, padT=20;
  const cW=W-padL-padR, cH=H-padT-padB;
  const n = months.length;
  const xStep = n>1 ? cW/(n-1) : cW;
  function toX(i){return padL+i*xStep;}

  if (migTab==='trend') {
    // 월별 전출/전입/순이동 추이
    const outVals = months.map((_,mi)=>D.outflow.reduce((s,r)=>s+(r.counts[mi]||0),0));
    const inVals  = months.map((_,mi)=>D.inflow.reduce((s,r)=>s+(r.counts[mi]||0),0));
    const netVals = months.map((_,mi)=>inVals[mi]-outVals[mi]);
    const allV = [...outVals,...inVals];
    const maxV=Math.max(...allV), minV=0;
    function toY(v){return padT+cH-((v-minV)/(maxV-minV||1))*cH;}
    const lines=[{vals:outVals,color:'#E53935',label:'전출'},{vals:inVals,color:'#1976D2',label:'전입'}];
    let grids='',yLbls='';
    for(let i=0;i<=4;i++){const v=minV+(maxV-minV)*i/4;const y=padT+cH-cH*i/4;grids+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#e8ecf0" stroke-width="1"/>`;yLbls+=`<text x="${padL-6}" y="${(y+4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${Math.round(v).toLocaleString()}</text>`;}
    let content='';
    lines.forEach(line=>{
      const pts=line.vals.map((v,i)=>({x:toX(i),y:toY(v),v}));
      const pathD=pts.map((p,j)=>(j===0?'M':'L')+p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
      content+=`<path d="${pathD}" fill="none" stroke="${line.color}" stroke-width="2.5" stroke-linejoin="round"/>`;
      content+=pts.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y-10).toFixed(1)}" text-anchor="middle" font-size="10" fill="${line.color}" font-weight="700">${p.v.toLocaleString()}</text>`).join('');
    });
    // 순이동 막대
    const zeroY=toY(0);
    netVals.forEach((v,i)=>{const bh=Math.abs((v/(maxV||1))*cH*0.4);const by=v>=0?zeroY-bh:zeroY;content+=`<rect x="${(toX(i)-12).toFixed(1)}" y="${by.toFixed(1)}" width="24" height="${bh.toFixed(1)}" fill="${v>=0?'#1976D2':'#E53935'}" fill-opacity="0.25" rx="3"/>`;});
    const xLbls=months.map((m,i)=>`<text x="${toX(i).toFixed(1)}" y="${H-22}" text-anchor="middle" font-size="11" fill="#666" font-weight="600">${m.replace('-','년 ')}월</text>`).join('');
    svg.innerHTML=`<rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>${grids}<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>${yLbls}${content}${xLbls}`;
    document.getElementById('mig-modal-body').querySelector('.sm-legend')?.remove();
    const leg=document.createElement('div');leg.className='sm-legend';leg.style.marginTop='8px';
    leg.innerHTML=`<span><i style="background:#E53935;display:inline-block;width:22px;height:3px;border-radius:2px;"></i> 전출</span><span><i style="background:#1976D2;display:inline-block;width:22px;height:3px;border-radius:2px;"></i> 전입</span><span><i style="background:#9E9E9E;display:inline-block;width:14px;height:10px;border-radius:2px;opacity:0.4;"></i> 순이동(배경)</span>`;
    document.getElementById('mig-chart-wrap').after(leg);
    document.getElementById('mig-table-wrap').innerHTML='';

  } else if (migTab==='out' || migTab==='in') {
    const dir=migTab;
    const data=dir==='out'?D.outflow:D.inflow;
    const color=dir==='out'?'#E53935':'#1976D2';
    const latestCounts=data.map(r=>({region:r.region,count:r.counts[latestIdx]||0})).sort((a,b)=>b.count-a.count);
    const maxC=latestCounts[0]?.count||1;
    const bw=cW/latestCounts.length*0.6;
    const isBar=true;
    let content='',xLbls='';
    latestCounts.forEach((r,i)=>{
      const x=padL+i*(cW/latestCounts.length)+(cW/latestCounts.length)*0.2;
      const bh=(r.count/maxC)*cH;
      content+=`<rect x="${x.toFixed(1)}" y="${(padT+cH-bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color}" fill-opacity="0.75" rx="3"/>`;
      content+=`<text x="${(x+bw/2).toFixed(1)}" y="${(padT+cH-bh-4).toFixed(1)}" text-anchor="middle" font-size="9" fill="${color}" font-weight="700">${r.count}</text>`;
      xLbls+=`<text x="${(x+bw/2).toFixed(1)}" y="${H-22}" text-anchor="middle" font-size="9" fill="#666" transform="rotate(-30,${(x+bw/2).toFixed(1)},${H-22})">${r.region.replace('특별자치도','').replace('특별자치시','').replace('광역시','').replace('특별시','')}</text>`;
    });
    let grids='';
    for(let i=0;i<=4;i++){const v=maxC*i/4;const y=padT+cH-cH*i/4;grids+=`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#e8ecf0" stroke-width="1"/>`;}
    svg.innerHTML=`<rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>${grids}<line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>${content}${xLbls}`;
    document.getElementById('mig-table-wrap').innerHTML=`<table class="mig-region-table"><thead><tr><th>지역</th><th>${months[latestIdx]} 이동자수</th><th>비율</th><th>추이</th></tr></thead><tbody>${
      latestCounts.map(r=>`<tr><td>${r.region}</td><td style="font-weight:700;color:${color}">${r.count.toLocaleString()}명</td><td><span class="mig-bar-bg"><span class="mig-bar-fill" style="width:${Math.round(r.count/maxC*100)}%;background:${color};"></span></span></td><td style="font-size:10px;color:#999">${data.find(d=>d.region===r.region)?.counts.map(c=>c||0).join('→')}</td></tr>`).join('')
    }</tbody></table>`;

  } else { // net
    const netByRegion = D.inflow.map(ri=>{
      const ro=D.outflow.find(r=>r.region===ri.region)||{counts:[0,0,0]};
      const net=ri.counts[latestIdx]-(ro.counts[latestIdx]||0);
      return {region:ri.region, net, inCount:ri.counts[latestIdx], outCount:ro.counts[latestIdx]||0};
    }).sort((a,b)=>b.net-a.net);
    const maxN=Math.max(...netByRegion.map(r=>Math.abs(r.net)))||1;
    const zeroY=padT+cH/2;
    const bw2=cW/netByRegion.length*0.6;
    let content='',xLbls='';
    netByRegion.forEach((r,i)=>{
      const x=padL+i*(cW/netByRegion.length)+(cW/netByRegion.length)*0.2;
      const bh=Math.abs(r.net/maxN)*(cH/2)*0.9;
      const color2=r.net>=0?'#1976D2':'#E53935';
      const by=r.net>=0?zeroY-bh:zeroY;
      content+=`<rect x="${x.toFixed(1)}" y="${by.toFixed(1)}" width="${bw2.toFixed(1)}" height="${bh.toFixed(1)}" fill="${color2}" fill-opacity="0.75" rx="3"/>`;
      content+=`<text x="${(x+bw2/2).toFixed(1)}" y="${(r.net>=0?zeroY-bh-4:zeroY+bh+12).toFixed(1)}" text-anchor="middle" font-size="9" fill="${color2}" font-weight="700">${r.net>=0?'+':''}${r.net}</text>`;
      xLbls+=`<text x="${(x+bw2/2).toFixed(1)}" y="${H-22}" text-anchor="middle" font-size="9" fill="#666" transform="rotate(-30,${(x+bw2/2).toFixed(1)},${H-22})">${r.region.replace('특별자치도','').replace('특별자치시','').replace('광역시','').replace('특별시','')}</text>`;
    });
    svg.innerHTML=`<rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
      <line x1="${padL}" y1="${zeroY.toFixed(1)}" x2="${W-padR}" y2="${zeroY.toFixed(1)}" stroke="#999" stroke-width="1.5" stroke-dasharray="4,2"/>
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#bbb" stroke-width="1.5"/>
      <text x="${padL-6}" y="${(zeroY+4).toFixed(1)}" text-anchor="end" font-size="10" fill="#999">0</text>${content}${xLbls}`;
    document.getElementById('mig-table-wrap').innerHTML=`<table class="mig-region-table"><thead><tr><th>지역</th><th>순이동</th><th>전입</th><th>전출</th></tr></thead><tbody>${
      netByRegion.map(r=>`<tr><td>${r.region}</td><td style="font-weight:700;color:${r.net>=0?'#1976D2':'#E53935'}">${r.net>=0?'+':''}${r.net}명</td><td style="color:#1976D2">${r.inCount}명</td><td style="color:#E53935">${r.outCount}명</td></tr>`).join('')
    }</tbody></table>`;
  }
}

