/* js/reg-zone.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   동별 거래현황 버블
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   규제구역 레이어
═══════════════════════════════════════════════ */

// ── 원형 근사 폴리곤 생성 (lat, lng 중심, radiusKm 반경, n 꼭짓점수)
function makeCirclePoly(lat, lng, radiusKm, n=28) {
  const pts = [];
  for (let i=0; i<n; i++) {
    const angle = (i / n) * 2 * Math.PI;
    const dlat = (radiusKm / 111.0) * Math.cos(angle);
    const dlng = (radiusKm / (111.0 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    pts.push(new kakao.maps.LatLng(lat + dlat, lng + dlng));
  }
  return pts;
}

// ── 타원형 근사 폴리곤 (rx=경도방향km, ry=위도방향km)
function makeEllipsePoly(lat, lng, rx, ry, n=32) {
  const pts = [];
  for (let i=0; i<n; i++) {
    const angle = (i / n) * 2 * Math.PI;
    const dlat = (ry / 111.0) * Math.cos(angle);
    const dlng = (rx / (111.0 * Math.cos(lat * Math.PI / 180))) * Math.sin(angle);
    pts.push(new kakao.maps.LatLng(lat + dlat, lng + dlng));
  }
  return pts;
}

// ── 규제구역 데이터 (근사 경계, 참고용) — Kakao Maps 초기화 후 buildRegZoneDef() 호출
var REG_ZONE_DEF = null; // var: 호이스팅으로 buildRegZoneDef() 호출 시점에 TDZ 없음
function buildRegZoneDef() {
  REG_ZONE_DEF = {
  np: {
    name: '한라산국립공원',
    color: '#2E7D32',
    strokeColor: '#1B5E20',
    opacity: 0.22,
    desc: '총 153.4km². 해발 600m 이상 및 주요 오름군 포함.',
    law: '자연공원법',
    // 한라산 중심부 (백록담 33.362/126.529) + 주요 능선 근사
    polygons: [
      makeEllipsePoly(33.362, 126.529, 14, 16.5, 36),
    ]
  },
  wh: {
    name: '유네스코 세계자연유산',
    color: '#E65100',
    strokeColor: '#BF360C',
    opacity: 0.28,
    desc: '2007년 등재. 한라산·성산일출봉·거문오름 용암동굴계',
    law: '세계유산법',
    polygons: [
      // 한라산 핵심지역 (더 작은 범위)
      makeCirclePoly(33.362, 126.529, 9.5, 28),
      // 성산일출봉
      makeEllipsePoly(33.459, 126.942, 2.8, 2.2, 20),
      // 거문오름
      makeCirclePoly(33.486, 126.715, 2.2, 18),
      // 만장굴 일대
      makeCirclePoly(33.529, 126.722, 1.6, 16),
      // 김녕굴·벵뒤굴 일대
      makeCirclePoly(33.525, 126.754, 1.0, 14),
      // 당처물동굴 일대
      makeCirclePoly(33.524, 126.697, 0.8, 12),
    ]
  },
  abs: {
    name: '절대보전지역',
    color: '#1565C0',
    strokeColor: '#0D47A1',
    opacity: 0.18,
    desc: '개발행위 원칙 금지. 한라산 천연보호구역, 특정도서, 습지 등.',
    law: '제주특별자치도법 제293조',
    polygons: [
      // 한라산 천연보호구역 (국립공원보다 약간 큰 범위)
      makeEllipsePoly(33.360, 126.529, 16, 18.5, 36),
      // 영주산 오름 일대 (북동부)
      makeCirclePoly(33.413, 126.819, 2.5, 16),
      // 물영아리오름
      makeCirclePoly(33.329, 126.603, 1.2, 12),
      // 물장오리오름
      makeCirclePoly(33.450, 126.495, 1.0, 12),
      // 선흘곶자왈 (람사르 습지)
      makeEllipsePoly(33.508, 126.718, 2.0, 1.2, 14),
    ]
  },
  rel: {
    name: '상대보전지역',
    color: '#7B1FA2',
    strokeColor: '#4A148C',
    opacity: 0.14,
    desc: '허가 기준 강화 구역. 한라산 완충지대, 주요 오름 주변.',
    law: '제주특별자치도법 제294조',
    polygons: [
      // 한라산 완충지대 (절대보전보다 넓은 범위)
      makeEllipsePoly(33.360, 126.529, 22, 24, 40),
      // 서귀포 해안 일부
      makeEllipsePoly(33.240, 126.560, 4.0, 1.5, 20),
      // 제주 북동부 오름군
      makeEllipsePoly(33.470, 126.750, 5.0, 3.0, 22),
      // 안덕계곡 일대
      makeCirclePoly(33.297, 126.369, 2.0, 14),
    ]
  },
  gw: {
    name: '지하수자원특별관리구역',
    color: '#00838F',
    strokeColor: '#006064',
    opacity: 0.10,
    desc: '제주 전역 대부분 해당. 지하수 개발·이용 허가 필요.',
    law: '제주특별자치도법 제304조',
    polygons: [
      // 제주 전역 근사 (제주도 외곽 근사 폴리곤)
      [
        new kakao.maps.LatLng(33.560, 126.155),
        new kakao.maps.LatLng(33.530, 126.095),
        new kakao.maps.LatLng(33.500, 126.070),
        new kakao.maps.LatLng(33.445, 126.065),
        new kakao.maps.LatLng(33.390, 126.110),
        new kakao.maps.LatLng(33.290, 126.210),
        new kakao.maps.LatLng(33.220, 126.330),
        new kakao.maps.LatLng(33.200, 126.480),
        new kakao.maps.LatLng(33.215, 126.620),
        new kakao.maps.LatLng(33.240, 126.760),
        new kakao.maps.LatLng(33.300, 126.890),
        new kakao.maps.LatLng(33.380, 126.970),
        new kakao.maps.LatLng(33.430, 126.980),
        new kakao.maps.LatLng(33.490, 126.960),
        new kakao.maps.LatLng(33.545, 126.900),
        new kakao.maps.LatLng(33.570, 126.820),
        new kakao.maps.LatLng(33.580, 126.700),
        new kakao.maps.LatLng(33.570, 126.570),
        new kakao.maps.LatLng(33.565, 126.440),
        new kakao.maps.LatLng(33.575, 126.320),
        new kakao.maps.LatLng(33.572, 126.220),
        new kakao.maps.LatLng(33.560, 126.155),
      ]
    ]
  }
  }; // end REG_ZONE_DEF object
} // end buildRegZoneDef()

// ── 활성 규제구역 폴리곤 목록 (var: buildRegZoneDef 호출 전 선언 필요)
var _zonePolygons = { np:[], wh:[], abs:[], rel:[], gw:[] };
var _zoneQueryMode = false;
var _zoneQueryListener = null;
var _zoneQueryOverlay = null;

function toggleRegZone(key, btn) {
  const active = btn.classList.toggle('on');
  if (active) {
    showRegZone(key);
  } else {
    hideRegZone(key);
  }
}

function showRegZone(key) {
  const def = REG_ZONE_DEF[key];
  if (!def) return;
  def.polygons.forEach(coords => {
    const poly = new kakao.maps.Polygon({
      map: map,
      path: coords,
      strokeWeight: 1.5,
      strokeColor: def.strokeColor,
      strokeOpacity: 0.7,
      fillColor: def.color,
      fillOpacity: def.opacity,
    });
    _zonePolygons[key].push(poly);
  });
}

function hideRegZone(key) {
  _zonePolygons[key].forEach(p => p.setMap(null));
  _zonePolygons[key] = [];
}

// ── 클릭 규제조회 모드
function toggleZoneQueryMode(btn) {
  _zoneQueryMode = !_zoneQueryMode;
  if (_zoneQueryMode) {
    btn.style.background = '#7B1FA2';
    btn.style.color = '#fff';
    btn.textContent = '📍 조회 ON (클릭)';
    _zoneQueryListener = kakao.maps.event.addListener(map, 'click', onMapZoneQuery);
  } else {
    btn.style.background = '#EDE7F6';
    btn.style.color = '#7B1FA2';
    btn.textContent = '📍 클릭 규제조회';
    if (_zoneQueryListener) kakao.maps.event.removeListener(map, 'click', _zoneQueryListener);
    _zoneQueryListener = null;
    if (_zoneQueryOverlay) { _zoneQueryOverlay.setMap(null); _zoneQueryOverlay = null; }
  }
}

function onMapZoneQuery(mouseEvent) {
  const ll = mouseEvent.latLng;
  const lat = ll.getLat(), lng = ll.getLng();

  // 현재 활성 구역 중 해당 위치 포함 여부 체크
  const activeZones = [];
  Object.entries(_zonePolygons).forEach(([key, polys]) => {
    if (polys.length > 0) {
      // 거리 기반 근사 포함 여부 체크
      const def = REG_ZONE_DEF[key];
      if (def) activeZones.push(def.name);
    }
  });

  // 모든 구역 대상으로 포인트 포함 여부 근사 확인 (ray-casting)
  const contained = [];
  Object.entries(REG_ZONE_DEF).forEach(([key, def]) => {
    for (const poly of def.polygons) {
      if (pointInPolygon(lat, lng, poly)) {
        contained.push({ key, def });
        break;
      }
    }
  });

  if (_zoneQueryOverlay) { _zoneQueryOverlay.setMap(null); _zoneQueryOverlay = null; }

  const eumUrl = `https://www.eum.go.kr/web/ar/lu/luLandDynamic.jsp?lat=${lat.toFixed(5)}&lng=${lng.toFixed(5)}`;

  let zonesHtml;
  if (contained.length === 0) {
    zonesHtml = '<div style="color:#4CAF50;font-weight:700;">규제구역 없음 (개발가능)</div>';
  } else {
    zonesHtml = contained.map(({def}) =>
      `<div class="zq-row"><span class="zone-legend-dot" style="background:${def.color};"></span><span class="zq-val" style="color:${def.color};">${def.name}</span></div>`
    ).join('');
  }

  const content = `<div class="zone-query-popup">
    <button class="zq-close" onclick="this.closest('.zone-query-popup').parentNode._overlay&&this.closest('.zone-query-popup').parentNode._overlay.setMap(null)">✕</button>
    <div class="zq-title">규제구역 조회 (근사)</div>
    <div class="zq-row"><span class="zq-label">좌표</span><span class="zq-val">${lat.toFixed(5)}, ${lng.toFixed(5)}</span></div>
    <hr style="margin:5px 0;border:none;border-top:1px solid #eee;">
    ${zonesHtml}
    <div class="zq-link">
      <a href="${eumUrl}" target="_blank">🔗 토지이음에서 정확한 규제 확인 ↗</a>
    </div>
    <div style="font-size:9px;color:#bbb;margin-top:4px;">※ 위 경계는 근사값입니다</div>
  </div>`;

  _zoneQueryOverlay = new kakao.maps.CustomOverlay({
    position: ll,
    content: content,
    yAnchor: 1.1,
    zIndex: 10
  });
  // close 버튼에 오버레이 참조 전달을 위해 약간 다른 방식 사용
  _zoneQueryOverlay.setMap(map);

  // close 버튼 이벤트 직접 바인딩
  setTimeout(() => {
    const closeBtn = document.querySelector('.zone-query-popup .zq-close');
    if (closeBtn) closeBtn.onclick = () => { _zoneQueryOverlay && _zoneQueryOverlay.setMap(null); _zoneQueryOverlay = null; };
  }, 0);
}

// ── 레이 캐스팅 포인트-인-폴리곤
function pointInPolygon(lat, lng, path) {
  let inside = false;
  const n = path.length;
  for (let i=0, j=n-1; i<n; j=i++) {
    const xi = path[i].getLng(), yi = path[i].getLat();
    const xj = path[j].getLng(), yj = path[j].getLat();
    const intersect = ((yi > lat) !== (yj > lat)) &&
      (lng < (xj - xi) * (lat - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

/* ═══════════════════════════════════════════════
   입도객 통계
═══════════════════════════════════════════════ */
var VISITOR_DATA = {
  labels: ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'],
  yearly: {
    2022: [78, 65, 98, 112, 120, 108, 145, 158, 132, 140, 115, 122],
    2023: [95, 80, 110, 125, 133, 120, 158, 172, 145, 152, 120, 130],
    2024: [98, 84, 112, 120, 128, 114, 150, 162, 135, 143, 118, 125],
    2025: [102, 88, 115, 124, 130, 118, 155, 165, 138, 145, 120, 128],
    2026: [105, 91, 118, 128, 133, 121, 158, 168, null, null, null, null],
  },
  yearTotal: { 2022: 1393, 2023: 1540, 2024: 1489, 2025: 1528, 2026: null },
};

var visitorTab = 'monthly';

function openVisitorModal() {
  const m = document.getElementById('visitor-modal');
  m.style.display = 'block';
  renderVisitorSummary();
  renderVisitorChart(visitorTab);
  makeDraggable('visitor-modal-inner', 'visitor-modal-hd');
}

function closeVisitorModal() {
  document.getElementById('visitor-modal').style.display = 'none';
}

function setVisitorTab(tab, btn) {
  visitorTab = tab;
  document.querySelectorAll('.visitor-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  renderVisitorChart(tab);
}

function renderVisitorSummary() {
  const sum = document.getElementById('visitor-summary');
  const y2026 = VISITOR_DATA.yearly[2026].filter(v => v !== null);
  const total2026 = y2026.reduce((a,b) => a+b, 0);
  const total2025 = VISITOR_DATA.yearly[2025].reduce((a,b)=>a+b,0);
  const growth = ((VISITOR_DATA.yearTotal[2025] - VISITOR_DATA.yearTotal[2024]) / VISITOR_DATA.yearTotal[2024] * 100).toFixed(1);
  const maxMonth = VISITOR_DATA.yearly[2025].indexOf(Math.max(...VISITOR_DATA.yearly[2025])) + 1;
  sum.innerHTML = `
    <div class="visitor-card"><div class="vc-label">2026 누계 (1~8월)</div><div class="vc-val">${total2026.toLocaleString()}만명</div><div class="vc-sub">전년 동기간 ${VISITOR_DATA.yearly[2025].slice(0,8).reduce((a,b)=>a+b,0).toLocaleString()}만명</div></div>
    <div class="visitor-card"><div class="vc-label">2025 연간 합계</div><div class="vc-val">${VISITOR_DATA.yearTotal[2025].toLocaleString()}만명</div><div class="vc-sub">전년 대비 +${growth}%</div></div>
    <div class="visitor-card"><div class="vc-label">2025 최다 방문월</div><div class="vc-val">${maxMonth}월</div><div class="vc-sub">${Math.max(...VISITOR_DATA.yearly[2025]).toLocaleString()}만명</div></div>
    <div class="visitor-card"><div class="vc-label">월평균 (2025)</div><div class="vc-val">${Math.round(total2025/12).toLocaleString()}만명</div><div class="vc-sub">항공 약 91% / 여객선 9%</div></div>
  `;
}

function renderVisitorChart(tab) {
  const area = document.getElementById('visitor-chart-area');
  if (tab === 'monthly') renderVisitorMonthly(area);
  else if (tab === 'yearly') renderVisitorYearly(area);
  else renderVisitorCorr(area);
}

function renderVisitorMonthly(area) {
  const W=820, H=220, padL=46, padR=20, padT=16, padB=40;
  const cW=W-padL-padR, cH=H-padT-padB;
  const labels = VISITOR_DATA.labels;
  const years = [2024, 2025, 2026];
  const colors = { 2024:'#90CAF9', 2025:'#1976D2', 2026:'#E53935' };
  const allVals = years.flatMap(y => VISITOR_DATA.yearly[y].filter(v => v !== null));
  const maxV = Math.max(...allVals), minV = 0;
  const xStep = cW / (labels.length - 1);
  const yScale = v => padT + cH - (v - minV) / (maxV - minV) * cH;

  let lines = '', dots = '', legendItems = '';
  years.forEach(y => {
    const data = VISITOR_DATA.yearly[y];
    const pts = data.map((v, i) => v !== null ? [padL + i * xStep, yScale(v)] : null);
    let pathD = '';
    pts.forEach(p => { if (p) pathD += (pathD ? 'L' : 'M') + `${p[0].toFixed(1)},${p[1].toFixed(1)}`; });
    lines += `<path d="${pathD}" fill="none" stroke="${colors[y]}" stroke-width="${y===2026?2.5:1.8}" stroke-dasharray="${y===2026?'6,3':'none'}"/>`;
    pts.forEach((p,i) => { if (p) dots += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${colors[y]}"/>`; });
    legendItems += `<text x="${(years.indexOf(y))*80+padL}" y="${H-4}" font-size="10" fill="${colors[y]}" font-weight="700">${y}년</text>`;
  });

  const gridLines = [0.25, 0.5, 0.75, 1].map(r => {
    const v = Math.round(maxV * r); const y2 = yScale(v);
    return `<line x1="${padL}" y1="${y2.toFixed(1)}" x2="${W-padR}" y2="${y2.toFixed(1)}" stroke="#eee" stroke-width="1"/>
            <text x="${padL-4}" y="${(y2+3).toFixed(1)}" text-anchor="end" font-size="9" fill="#aaa">${v}</text>`;
  }).join('');

  const xLabels = labels.map((l,i) => `<text x="${(padL+i*xStep).toFixed(1)}" y="${padT+cH+14}" text-anchor="middle" font-size="9" fill="#888">${l}</text>`).join('');

  area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;max-width:${W}px;">
    ${gridLines}${lines}${dots}${xLabels}${legendItems}
    <text x="${padL-38}" y="${padT+cH/2}" font-size="9" fill="#aaa" transform="rotate(-90,${padL-38},${padT+cH/2})">만명</text>
  </svg>`;
}

function renderVisitorYearly(area) {
  const years = [2022, 2023, 2024, 2025];
  const totals = years.map(y => VISITOR_DATA.yearTotal[y]);
  const W=820, H=200, padL=60, padR=20, padT=16, padB=36;
  const cW=W-padL-padR, cH=H-padT-padB;
  const maxV = Math.max(...totals), barW = (cW/years.length)*0.6, gap = cW/years.length;
  const yScale = v => padT + cH - (v / maxV) * cH;
  const bars = years.map((y,i) => {
    const h = (totals[i] / maxV) * cH;
    const x = padL + i * gap + (gap - barW) / 2;
    const yy = padT + cH - h;
    const ratio = (i > 0 ? ((totals[i]-totals[i-1])/totals[i-1]*100) : 0);
    const sign = ratio >= 0 ? '+' : '';
    return `<rect x="${x.toFixed(1)}" y="${yy.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" fill="#1976D2" rx="4"/>
      <text x="${(x+barW/2).toFixed(1)}" y="${(yy-5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#1976D2">${totals[i].toLocaleString()}</text>
      <text x="${(x+barW/2).toFixed(1)}" y="${(padT+cH+14).toFixed(1)}" text-anchor="middle" font-size="10" fill="#555">${y}년</text>
      ${i>0?`<text x="${(x+barW/2).toFixed(1)}" y="${(yy-16).toFixed(1)}" text-anchor="middle" font-size="9" fill="${ratio>=0?'#2E7D32':'#B71C1C'}">${sign}${ratio.toFixed(1)}%</text>`:''}`;
  }).join('');
  // 2026 partial bar
  const total2026 = VISITOR_DATA.yearly[2026].filter(v=>v!==null).reduce((a,b)=>a+b,0);
  const i2026=4, h2026=(total2026/maxV)*cH, x2026=padL+i2026*gap+(gap-barW)/2, y2026=padT+cH-h2026;
  const bar2026 = `<rect x="${x2026.toFixed(1)}" y="${y2026.toFixed(1)}" width="${barW.toFixed(1)}" height="${h2026.toFixed(1)}" fill="#90CAF9" rx="4" stroke="#1976D2" stroke-width="1.5" stroke-dasharray="4,2"/>
    <text x="${(x2026+barW/2).toFixed(1)}" y="${(y2026-5).toFixed(1)}" text-anchor="middle" font-size="10" font-weight="700" fill="#1976D2">${total2026}*</text>
    <text x="${(x2026+barW/2).toFixed(1)}" y="${(padT+cH+14).toFixed(1)}" text-anchor="middle" font-size="10" fill="#555">2026년</text>`;
  const gridLines = [0.5, 1.0].map(r => {
    const v=Math.round(maxV*r); const yg=yScale(v);
    return `<line x1="${padL}" y1="${yg.toFixed(1)}" x2="${W-padR}" y2="${yg.toFixed(1)}" stroke="#eee" stroke-width="1"/>
            <text x="${padL-4}" y="${(yg+3).toFixed(1)}" text-anchor="end" font-size="9" fill="#aaa">${v.toLocaleString()}</text>`;
  }).join('');
  area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;">
    ${gridLines}${bars}${bar2026}
    <text x="10" y="${padT+cH/2}" font-size="9" fill="#aaa" transform="rotate(-90,10,${padT+cH/2})">만명</text>
    <text x="${W-60}" y="${H-4}" font-size="9" fill="#90CAF9">* 1~8월 누계</text>
  </svg>`;
}

function renderVisitorCorr(area) {
  // 월별 입도객 vs 아파트 실거래 건수 (2025 기준)
  const visitors = VISITOR_DATA.yearly[2025];
  const trades   = window.TRADE_DATA || [];
  const months   = Array.from({length:12}, (_,i) => {
    const m = String(i+1).padStart(2,'0');
    const cnt = trades.filter(t => t.date && t.date.startsWith('2025-'+m)).length;
    return { v: visitors[i], t: cnt, label: (i+1)+'월' };
  }).filter(d => d.t > 0);

  if (!trades.length || months.every(d=>d.t===0)) {
    area.innerHTML = `<div style="padding:30px;text-align:center;color:#aaa;font-size:12px;">아파트 실거래 데이터를 연결하면 입도객-거래량 상관관계를 확인할 수 있습니다.</div>`;
    return;
  }
  const W=820,H=220,padL=52,padR=20,padT=16,padB=36;
  const cW=W-padL-padR, cH=H-padT-padB;
  const maxV=Math.max(...months.map(d=>d.v)), maxT=Math.max(...months.map(d=>d.t));
  const dots = months.map(d => {
    const x=(padL+d.v/maxV*cW).toFixed(1), y=(padT+cH-(d.t/maxT*cH)).toFixed(1);
    return `<circle cx="${x}" cy="${y}" r="5" fill="#1976D2" opacity="0.75"/>
      <text x="${x}" y="${parseFloat(y)-8}" text-anchor="middle" font-size="9" fill="#555">${d.label}</text>`;
  }).join('');
  area.innerHTML = `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg" style="width:100%;">
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT+cH}" stroke="#ddd" stroke-width="1"/>
    <line x1="${padL}" y1="${padT+cH}" x2="${W-padR}" y2="${padT+cH}" stroke="#ddd" stroke-width="1"/>
    ${dots}
    <text x="${W/2}" y="${H-4}" text-anchor="middle" font-size="10" fill="#888">입도객 (만명, 2025)</text>
    <text x="12" y="${padT+cH/2}" font-size="10" fill="#888" transform="rotate(-90,12,${padT+cH/2})">거래건수</text>
  </svg>
  <div style="margin-top:6px;font-size:10px;color:#aaa;text-align:center;">2025년 월별 입도객 수 vs 아파트 실거래 건수</div>`;
}
