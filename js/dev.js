/* js/dev.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   개발사업 레이어
═══════════════════════════════════════════════ */
var STATUS_COLOR = {
  '계획':  '#607D8B',
  '추진중':'#E65100',
  '운영중':'#2E7D32',
  '중단':  '#B71C1C',
};
var STATUS_ICON = {
  '교통':'✈', '관광':'🌴', '교육':'🎓', '산업':'🏭',
  '복합':'🏢', '주거':'🏡', '도시개발':'🌆', '의료':'🏥',
};

var DEV_PROJECTS = [
  { id:1,  name:'제주 제2공항',          category:'교통',    status:'추진중',
    lat:33.4050, lng:126.8760, area:'서귀포시 성산읍 온평리 일원',
    desc:'총사업비 약 4.9조원, 2035년 개항 목표. 연간 여객 2,520만명 처리 규모. 환경영향평가 및 기본계획 수립 진행 중.',
    hasRadius: true },
  { id:2,  name:'제주헬스케어타운리조트', category:'의료',    status:'운영중',
    lat:33.2427, lng:126.3521, area:'서귀포시 예래동',
    desc:'JDC 추진. 의료·휴양·관광 복합단지. 녹지국제병원 입점. 외국인 의료관광 거점.' },
  { id:3,  name:'신화역사공원',           category:'관광',    status:'운영중',
    lat:33.3077, lng:126.2728, area:'서귀포시 안덕면 서광리',
    desc:'람정제주개발 투자. 테마파크·호텔·카지노 복합리조트. 2,600실 규모. 연간 방문객 300만명+.' },
  { id:4,  name:'제주영어교육도시',       category:'교육',    status:'운영중',
    lat:33.2890, lng:126.2548, area:'서귀포시 대정읍 보성리',
    desc:'JDC 추진. 국제학교 4개교 운영 중. 약 5,000세대 주거지 포함. 외국교육기관 집적.' },
  { id:5,  name:'제주첨단과학기술단지',   category:'산업',    status:'운영중',
    lat:33.4762, lng:126.5458, area:'제주시 아라이동',
    desc:'ICT·바이오·첨단산업 집적단지. 제주대학교 인접. 기업 200여개 입주. 고용 5,000명+.' },
  { id:6,  name:'오라관광단지',           category:'관광',    status:'추진중',
    lat:33.4812, lng:126.5012, area:'제주시 오라이동',
    desc:'총 사업비 1.7조원 규모 복합관광단지. 호텔·골프·주거 포함. 사업 일부 지연, 단계별 개발 진행 중.' },
  { id:7,  name:'제주 드림타워',          category:'복합',    status:'운영중',
    lat:33.4892, lng:126.4832, area:'제주시 노형동',
    desc:'롯데관광개발. 38층 쌍둥이 타워. 외국인 전용 카지노·호텔·쇼핑 복합리조트. 국내 최대 규모.' },
  { id:8,  name:'예래 휴양형 주거단지',   category:'주거',    status:'중단',
    lat:33.2360, lng:126.3380, area:'서귀포시 예래동',
    desc:'JDC 추진 외국인 전용 휴양주거단지. 헌법재판소 헌법불합치 결정으로 사업 중단. 대안 검토 중.' },
  { id:9,  name:'제주 혁신도시',          category:'도시개발',status:'운영중',
    lat:33.2748, lng:126.5145, area:'서귀포시 서호동',
    desc:'공공기관 11개 이전 완료. 한국국제교류재단·공무원연금공단 등 입주. 인구 약 8,600명 유입.' },
  { id:10, name:'제주 제2첨단과학기술단지',category:'산업',    status:'계획',
    lat:33.4698, lng:126.5818, area:'제주시 회천동 일원',
    desc:'1첨단단지 포화에 따른 확장 계획. 바이오·친환경 산업 중심. 입지 선정 및 타당성 조사 진행 중.' },
  { id:11, name:'제주 제2청사 (도청)',     category:'도시개발',status:'계획',
    lat:33.3617, lng:126.5292, area:'서귀포시 일원',
    desc:'제주도청 서귀포 이전 논의. 균형발전 차원 추진. 구체적 입지 및 일정 미확정.' },
  { id:12, name:'성산·구좌 스마트팜단지', category:'산업',    status:'추진중',
    lat:33.4934, lng:126.7982, area:'제주시 구좌읍 일원',
    desc:'스마트팜 혁신밸리 조성 사업. 농업 첨단화·청년 농업인 육성. 2026년 완공 목표.' },
];

var devVisible = false;
var devFilter  = 'all';
var devOverlays = [];
var devPopupOverlay = null;
var devRadiusCircles = [];
var devActiveRadii = new Set();

function toggleDevProjects(btn) {
  devVisible = btn.classList.toggle('on');
  document.getElementById('dev-filter-wrap').style.display = devVisible ? 'block' : 'none';
  if (devVisible) renderDevProjects();
  else { clearDevProjects(); clearDevRadius(); }
  updateActiveLayerCount();
}

function setDevFilter(f, btn) {
  devFilter = f;
  document.querySelectorAll('.dev-filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (devVisible) renderDevProjects();
}

function toggleDevRadius(meters, btn) {
  if (devActiveRadii.has(meters)) {
    devActiveRadii.delete(meters);
    btn.classList.remove('active');
  } else {
    devActiveRadii.add(meters);
    btn.classList.add('active');
  }
  renderDevRadius();
}

function clearDevRadius() {
  devRadiusCircles.forEach(c => c.setMap(null));
  devRadiusCircles = [];
}

function renderDevRadius() {
  clearDevRadius();
  const airport = DEV_PROJECTS.find(p => p.hasRadius);
  if (!airport || !devVisible) return;
  const center = new kakao.maps.LatLng(airport.lat, airport.lng);
  const colors = { 1000: '#E53935', 3000: '#FB8C00', 5000: '#FDD835' };
  devActiveRadii.forEach(r => {
    const circle = new kakao.maps.Circle({
      center, radius: r,
      strokeWeight: 2, strokeColor: colors[r] || '#607D8B',
      strokeOpacity: 0.9, strokeStyle: 'dashed',
      fillColor: colors[r] || '#607D8B', fillOpacity: 0.06
    });
    circle.setMap(map);
    devRadiusCircles.push(circle);
  });
}

function clearDevProjects() {
  devOverlays.forEach(o => o.setMap(null));
  devOverlays = [];
  if (devPopupOverlay) { devPopupOverlay.setMap(null); devPopupOverlay = null; }
}

function renderDevProjects() {
  clearDevProjects();
  const list = devFilter === 'all' ? DEV_PROJECTS : DEV_PROJECTS.filter(p => p.status === devFilter);
  list.forEach(p => {
    const color = STATUS_COLOR[p.status] || '#607D8B';
    const icon  = STATUS_ICON[p.category] || '📌';
    const el = document.createElement('div');
    el.className = 'dev-marker';
    el.innerHTML = `
      <div class="dev-marker-pin" style="background:${color};">
        <span class="dev-marker-icon">${icon}</span>
      </div>
      <div class="dev-marker-label">${p.name}</div>`;
    el.onclick = () => showDevPopup(p);
    const ov = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(p.lat, p.lng),
      content: el, yAnchor: 1.05, zIndex: 6
    });
    ov.setMap(map);
    devOverlays.push(ov);
  });
  renderDevRadius();
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, toRad = d => d * Math.PI / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLng/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

function getDevNearbyTrades(p, km, tab) {
  if (tab === 'apt') {
    return (window.TRADE_DATA || [])
      .filter(t => t.lat && t.lng && haversineKm(p.lat, p.lng, t.lat, t.lng) <= km)
      .sort((a,b) => b.date > a.date ? 1 : -1).slice(0, 30);
  } else {
    return (window.LAND_DATA || [])
      .filter(t => t.lat && t.lng && haversineKm(p.lat, p.lng, t.lat, t.lng) <= km)
      .sort((a,b) => b.date > a.date ? 1 : -1).slice(0, 30);
  }
}

function showDevPopup(p) {
  if (devPopupOverlay) { devPopupOverlay.setMap(null); devPopupOverlay = null; }
  const color = STATUS_COLOR[p.status] || '#607D8B';
  const el = document.createElement('div');
  el.className = 'dev-popup';
  el.style.width = '280px';

  function renderTradeList(km, tab) {
    const trades = getDevNearbyTrades(p, km, tab);
    if (!trades.length) return `<div style="font-size:10px;color:#aaa;padding:6px 0;">데이터 없음</div>`;
    return trades.map(t => {
      if (tab === 'apt') {
        const pyeong = t.area ? t.area / 3.3 : 0;
        const pp = pyeong > 0 ? ` · ${Math.round(t.price*10000/pyeong).toLocaleString()}만/평` : '';
        const badgeColor = t._typeColor || '#1976D2';
        const badgeLabel = t._typeLabel || '아파트';
        return `<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:10px;">
          <div style="font-weight:700;color:${badgeColor};">[${badgeLabel}] ${t.name}</div>
          <div style="color:#444;">${t.price}억${pp} · ${t.area?Math.round(t.area)+'㎡':'-'} · ${t.date||'-'}</div>
        </div>`;
      } else {
        return `<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:10px;">
          <div style="font-weight:700;color:#5D4037;">${t.dong||'-'} (${t.jimok||'-'})</div>
          <div style="color:#444;">${t.price}억 · ${t.area?Math.round(t.area)+'㎡':'-'} · ${(t.perM2||0).toLocaleString()}원/㎡ · ${t.date||'-'}</div>
        </div>`;
      }
    }).join('');
  }

  function renderDevChart(km, tab) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const srcData = tab === 'apt' ? (window.TRADE_DATA || []) : (window.LAND_DATA || []);
    const nearby = srcData.filter(t => t.lat && t.lng && haversineKm(p.lat, p.lng, t.lat, t.lng) <= km);

    const months = [];
    for (let m = 1; m <= curMonth; m++) {
      const key = curYear + '-' + String(m).padStart(2,'0');
      const items = nearby.filter(t => t.date && t.date.startsWith(key));
      let avg = null;
      if (tab === 'apt') {
        const valid = items.filter(t => t.price && t.area && t.area > 0);
        if (valid.length) avg = Math.round(valid.reduce((s,t) => s + t.price*10000/(t.area/3.3058), 0) / valid.length);
      } else {
        const valid = items.filter(t => t.perM2 && t.perM2 > 0);
        if (valid.length) avg = Math.round(valid.reduce((s,t) => s + t.perM2, 0) / valid.length);
      }
      months.push({ label: m+'월', avg, count: items.length });
    }

    const vals = months.map(m => m.avg || 0);
    const maxV = Math.max(...vals, 1);
    const posVals = vals.filter(v => v > 0);
    const minV = posVals.length ? Math.min(...posVals) : maxV;
    const W = 254, H = 72, padL = 30, padB = 14, padR = 4, padT = 6;
    const cW = W-padL-padR, cH = H-padT-padB;
    const xStep = cW / Math.max(months.length - 1, 1);
    const toY = v => padT + cH - ((v - minV + 0.5) / (maxV - minV + 1)) * cH;
    const c = tab === 'apt' ? '#1976D2' : '#5D4037';
    const unit = tab === 'apt' ? '만/평' : '만/㎡';

    const points = months.map((mo, i) => ({
      x: padL + i * xStep,
      y: mo.avg ? toY(mo.avg) : null,
      label: mo.label, avg: mo.avg, count: mo.count
    })).filter(pt => pt.y !== null);

    if (!points.length) return `<div style="font-size:10px;color:#aaa;text-align:center;padding:8px;">올해 반경 ${km}km 데이터 없음</div>`;

    const pathD = points.map((pt,i) => (i===0?'M':'L')+pt.x.toFixed(1)+','+pt.y.toFixed(1)).join(' ');
    const first = points[0], last = points[points.length-1];
    const areaD = pathD + ' L'+last.x.toFixed(1)+','+(padT+cH)+' L'+first.x.toFixed(1)+','+(padT+cH)+' Z';

    const fmtV = v => {
      if (tab === 'apt') return (Math.round(v/100)/10).toFixed(1)+'천만';
      return v >= 10000 ? (v/10000).toFixed(1)+'억' : Math.round(v).toLocaleString()+'만';
    };
    const yLbls = [fmtV(minV), fmtV((minV+maxV)/2), fmtV(maxV)];
    const yPos = [padT+cH, padT+cH/2, padT];

    const xLbls = months.map((mo,i) => {
      const x = (padL + i*xStep).toFixed(1);
      const step = months.length > 6 ? 3 : months.length > 4 ? 2 : 1;
      if (i % step !== 0 && i !== months.length-1) return '';
      return `<text x="${x}" y="${H}" text-anchor="middle" font-size="7" fill="#aaa">${mo.label}</text>`;
    }).join('');

    return `
      <div style="font-size:10px;font-weight:700;color:#555;margin-bottom:3px;">📈 올해 월별 평균 (${unit}) · 반경 ${km}km</div>
      <svg width="${W}" height="${H}" style="display:block;">
        <defs><linearGradient id="devGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${c}" stop-opacity="0.2"/>
          <stop offset="100%" stop-color="${c}" stop-opacity="0"/>
        </linearGradient></defs>
        ${yPos.map((y,i) => `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1"/>`).join('')}
        <path d="${areaD}" fill="url(#devGrad)"/>
        <path d="${pathD}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
        ${points.map(pt => `<circle cx="${pt.x.toFixed(1)}" cy="${pt.y.toFixed(1)}" r="2.8" fill="${c}" stroke="#fff" stroke-width="1.2">
          <title>${pt.label}: ${pt.avg ? fmtV(pt.avg)+unit : '-'} (${pt.count}건)</title>
        </circle>`).join('')}
        ${yLbls.map((l,i) => `<text x="${padL-2}" y="${(yPos[i]+3).toFixed(1)}" text-anchor="end" font-size="7" fill="#aaa">${l}</text>`).join('')}
        ${xLbls}
      </svg>`;
  }

  function rebuild(km, tab) {
    const list = el.querySelector('.dev-trade-list');
    if (list) list.innerHTML = renderTradeList(km, tab);
    const chart = el.querySelector('.dev-chart-area');
    if (chart && chart.style.display !== 'none') chart.innerHTML = renderDevChart(km, tab);
    else if (chart) chart.innerHTML = '';
    el.querySelectorAll('.dev-km-btn').forEach(b => b.classList.toggle('active', b.dataset.km == km));
    el.querySelectorAll('.dev-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }

  // 통계 버튼 클릭 시 차트 렌더링
  el.addEventListener('click', function(e) {
    const btn = e.target.closest('.dev-stat-btn');
    if (btn) {
      const chart = el.querySelector('.dev-chart-area');
      if (chart && chart.style.display !== 'none' && !chart.innerHTML.trim()) {
        chart.innerHTML = renderDevChart(curKm, curTab);
      }
    }
  }, true);

  let curKm = 2, curTab = 'apt';
  el.innerHTML = `
    <div class="dev-popup-header" style="background:${color};">
      <button class="dev-popup-close" onclick="if(window._devPopup){window._devPopup.setMap(null);window._devPopup=null;}">×</button>
      <div class="dev-popup-status">${p.status}</div>
      <div class="dev-popup-name">${p.name}</div>
    </div>
    <div class="dev-popup-body">
      <div class="dev-popup-area" style="font-size:11px;">📍 ${p.area} · ${p.category}</div>
      <button onclick="(function(btn){var d=btn.nextElementSibling;if(d.style.display==='none'){d.style.display='block';btn.style.color='#888';btn.textContent='▲ 사업내용 접기';}else{d.style.display='none';btn.style.color=''+(btn.getAttribute('data-c'));btn.textContent='📋 사업내용 보기';}})(this)"
        data-c="${color}" style="width:100%;text-align:left;font-size:11px;font-weight:700;padding:5px 0 3px;border:none;background:none;color:${color};cursor:pointer;margin-top:4px;">📋 사업내용 보기</button>
      <div class="dev-popup-desc" style="display:none;font-size:11px;line-height:1.6;color:#333;background:#f8f9fa;border-radius:6px;padding:8px;margin-bottom:6px;">${p.desc}</div>
      <div style="margin-top:6px;border-top:1px solid #eee;padding-top:8px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:11px;font-weight:700;color:#444;">주변 실거래</div>
          <div style="display:flex;gap:4px;">
            <button class="dev-tab-btn active" data-tab="apt">아파트</button>
            <button class="dev-tab-btn" data-tab="land">토지</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:8px;">
          <button class="dev-km-btn" data-km="1">1km</button>
          <button class="dev-km-btn active" data-km="2">2km</button>
          <button class="dev-km-btn" data-km="5">5km</button>
        </div>
        <button class="dev-stat-btn" onclick="(function(btn){var c=btn.closest('.dev-popup-body').querySelector('.dev-chart-area');if(c.style.display==='none'){c.style.display='block';btn.textContent='📉 통계 접기';}else{c.style.display='none';btn.textContent='📈 월별 가격 통계';}})(this)" style="width:100%;font-size:11px;font-weight:700;padding:5px 0;border-radius:7px;border:1px solid #1565C0;background:#f0f4ff;color:#1565C0;cursor:pointer;margin-bottom:6px;">📈 월별 가격 통계</button>
        <div class="dev-chart-area" style="display:none;margin-bottom:8px;"></div>
        <div style="font-size:11px;font-weight:700;color:#444;margin-bottom:5px;">최근 실거래</div>
        <div class="dev-trade-list" style="max-height:160px;overflow-y:auto;">${renderTradeList(curKm, curTab)}</div>
      </div>
    </div>
    <div class="dev-popup-arrow" style="border-top-color:${color};"></div>`;

  el.querySelectorAll('.dev-km-btn').forEach(btn => {
    btn.onclick = () => {
      curKm = parseInt(btn.dataset.km);
      rebuild(curKm, curTab);
    };
  });
  el.querySelectorAll('.dev-tab-btn').forEach(btn => {
    btn.onclick = () => {
      curTab = btn.dataset.tab;
      rebuild(curKm, curTab);
    };
  });

  window._devPopup = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(p.lat, p.lng),
    content: el, yAnchor: 1.05, zIndex: 10
  });
  window._devPopup.setMap(map);
  devPopupOverlay = window._devPopup;
  map.setCenter(new kakao.maps.LatLng(p.lat, p.lng));
  map.setLevel(7);
}
