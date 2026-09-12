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
var devPopupOverlay = null;        // 호환용 (플로팅 팝업 참조)
var devRadiusCircles = [];
var devActiveRadii = new Set();
var devPopupRadiusCircle = null;   // 팝업에서 선택한 반경 원
var devNearbyOverlays = [];        // 반경 내 실거래 임시 마커
var devPopupDragCleanup = null;

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
  if (typeof window._closeDevPopup === 'function') window._closeDevPopup();
  else {
    if (devPopupOverlay && typeof devPopupOverlay.remove === 'function') {
      if (devPopupDragCleanup) { devPopupDragCleanup(); devPopupDragCleanup = null; }
      devPopupOverlay.remove();
    } else if (devPopupOverlay && typeof devPopupOverlay.setMap === 'function') {
      devPopupOverlay.setMap(null);
    }
    devPopupOverlay = null;
    window._devPopup = null;
    clearDevPopupRadius();
  }
}

/** 헤더를 잡고 화면 어디서든 드래그 */
function enableDevPopupDrag(el) {
  const header = el.querySelector('.dev-popup-header');
  if (!header) return;
  header.style.cursor = 'move';
  let dragging = false, sx = 0, sy = 0, sl = 0, st = 0;

  const onDown = (e) => {
    if (e.target.closest('.dev-popup-close')) return;
    e.preventDefault();
    e.stopPropagation();
    const point = e.touches ? e.touches[0] : e;
    dragging = true;
    el.classList.add('dragging');
    const rect = el.getBoundingClientRect();
    sx = point.clientX; sy = point.clientY;
    sl = rect.left; st = rect.top;
    el.style.left = sl + 'px';
    el.style.top = st + 'px';
    el.style.right = 'auto';
    el.style.bottom = 'auto';
    document.body.style.userSelect = 'none';
    if (map && map.setDraggable) map.setDraggable(false);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const point = e.touches ? e.touches[0] : e;
    if (!point) return;
    if (e.cancelable) e.preventDefault();
    let l = sl + (point.clientX - sx);
    let t = st + (point.clientY - sy);
    const maxL = Math.max(0, window.innerWidth - el.offsetWidth);
    const maxT = Math.max(0, window.innerHeight - 48);
    l = Math.max(0, Math.min(maxL, l));
    t = Math.max(0, Math.min(maxT, t));
    el.style.left = l + 'px';
    el.style.top = t + 'px';
  };
  const onUp = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('dragging');
    document.body.style.userSelect = '';
    if (map && map.setDraggable) map.setDraggable(true);
  };

  header.addEventListener('mousedown', onDown);
  header.addEventListener('touchstart', onDown, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onUp);
  document.addEventListener('touchend', onUp);

  if (devPopupDragCleanup) devPopupDragCleanup();
  devPopupDragCleanup = () => {
    header.removeEventListener('mousedown', onDown);
    header.removeEventListener('touchstart', onDown);
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.removeEventListener('touchend', onUp);
    document.body.style.userSelect = '';
    if (map && map.setDraggable) map.setDraggable(true);
  };
}

/** 프로젝트 좌표 위에 팝업 초기 배치 */
function placeDevPopupNearProject(el, p) {
  let left = Math.max(12, (window.innerWidth - 280) / 2);
  let top = 72;
  try {
    if (map && map.getProjection && typeof kakao !== 'undefined') {
      const pt = map.getProjection().containerPointFromCoords(
        new kakao.maps.LatLng(p.lat, p.lng)
      );
      const mapRect = (map.getNode ? map.getNode() : document.getElementById('map')).getBoundingClientRect();
      const w = el.offsetWidth || 280;
      const h = el.offsetHeight || 320;
      left = mapRect.left + pt.x - w / 2;
      top = mapRect.top + pt.y - h - 16;
    }
  } catch (err) { /* fallback */ }
  const maxL = Math.max(0, window.innerWidth - (el.offsetWidth || 280));
  const maxT = Math.max(0, window.innerHeight - 48);
  el.style.left = Math.max(0, Math.min(maxL, left)) + 'px';
  el.style.top = Math.max(0, Math.min(maxT, top)) + 'px';
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

function clearDevNearbyMarkers() {
  devNearbyOverlays.forEach(o => o.setMap(null));
  devNearbyOverlays = [];
  const detail = document.getElementById('dev-nearby-detail-modal');
  if (detail) detail.style.display = 'none';
}

function clearDevPopupRadius() {
  if (devPopupRadiusCircle) {
    devPopupRadiusCircle.setMap(null);
    devPopupRadiusCircle = null;
  }
  clearDevNearbyMarkers();
}

function drawDevPopupRadius(p, km) {
  clearDevNearbyMarkers();
  if (devPopupRadiusCircle) {
    devPopupRadiusCircle.setMap(null);
    devPopupRadiusCircle = null;
  }
  if (!p || !km || typeof kakao === 'undefined' || !map) return;
  const meters = km * 1000;
  const center = new kakao.maps.LatLng(p.lat, p.lng);
  const color = STATUS_COLOR[p.status] || '#1565C0';
  devPopupRadiusCircle = new kakao.maps.Circle({
    center,
    radius: meters,
    strokeWeight: 2,
    strokeColor: color,
    strokeOpacity: 0.95,
    strokeStyle: 'dashed',
    fillColor: color,
    fillOpacity: 0.08,
  });
  devPopupRadiusCircle.setMap(map);

  const levelByKm = { 1: 6, 3: 7, 5: 8 };
  map.setCenter(center);
  map.setLevel(levelByKm[km] || 7);
}

/** 반경 내 실거래. yearOnly면 해당 연도만, limit 없으면 전체 */
function getDevNearbyTrades(p, km, tab, opts) {
  opts = opts || {};
  const year = opts.year != null ? opts.year : new Date().getFullYear();
  const yearOnly = !!opts.yearOnly;
  const limit = opts.limit != null ? opts.limit : null;
  const src = tab === 'house'
    ? ((window.MULTI_DATA && window.MULTI_DATA.house) || [])
    : (window.LAND_DATA || []);
  const yearPrefix = String(year) + '-';
  let list = src
    .filter(t => t.lat && t.lng)
    .map(t => {
      const dist = haversineKm(p.lat, p.lng, t.lat, t.lng);
      return Object.assign({}, t, { _distKm: dist });
    })
    .filter(t => t._distKm <= km);
  if (yearOnly) {
    list = list.filter(t => t.date && String(t.date).startsWith(yearPrefix));
  }
  list.sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
  if (limit != null && limit > 0) list = list.slice(0, limit);
  return list;
}

/** 동일 좌표 거래는 한 점으로 묶고 건수 배지 표시 (좌표 근사/동중심 겹침 대응) */
function renderDevNearbyMarkers(trades, tab) {
  clearDevNearbyMarkers();
  if (!trades || !trades.length) return;
  const color = tab === 'house' ? '#00695C' : '#5D4037';
  const groups = new Map();
  trades.forEach(t => {
    if (!t.lat || !t.lng) return;
    const key = Number(t.lat).toFixed(5) + ',' + Number(t.lng).toFixed(5);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(t);
  });

  groups.forEach((items) => {
    const t0 = items[0];
    const count = items.length;
    const el = document.createElement('div');
    if (count > 1) {
      el.style.cssText = 'min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:' + color +
        ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);color:#fff;font-size:10px;font-weight:800;' +
        'display:flex;align-items:center;justify-content:center;line-height:1;cursor:pointer;';
      el.textContent = String(count);
    } else {
      el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:' + color +
        ';border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35);cursor:pointer;';
    }
    el.title = (count > 1 ? count + '건 — 클릭하여 상세 보기' : '클릭하여 상세 보기');
    el.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      showDevNearbyPointDetail(items, tab);
    };

    const ov = new kakao.maps.CustomOverlay({
      position: new kakao.maps.LatLng(t0.lat, t0.lng),
      content: el,
      yAnchor: 0.5,
      xAnchor: 0.5,
      zIndex: 4,
      clickable: true,
    });
    ov.setMap(map);
    devNearbyOverlays.push(ov);
  });
}

/** 지도 반경 마커 클릭 → 해당 좌표의 실거래 상세 목록 */
function showDevNearbyPointDetail(items, tab) {
  if (!items || !items.length) return;
  let modal = document.getElementById('dev-nearby-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'dev-nearby-detail-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:1200;';
    modal.innerHTML = '<div id="dev-nearby-detail-inner" style="background:#F8FAFB;border-radius:12px;width:min(420px,94vw);max-height:78vh;overflow:auto;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);box-shadow:0 12px 40px rgba(0,0,0,0.3);"></div>';
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.style.display = 'none';
    });
    document.body.appendChild(modal);
  }

  const color = tab === 'house' ? '#00695C' : '#5D4037';
  const label = tab === 'house' ? '단독/다가구' : '토지실거래';
  const sorted = items.slice().sort((a, b) => (b.date || '') > (a.date || '') ? 1 : -1);
  const place = sorted[0].name || sorted[0].dong || '해당 지점';
  const dist0 = sorted[0]._distKm != null ? sorted[0]._distKm.toFixed(1) + 'km' : '';

  const rows = sorted.map(t => {
    const distTxt = (t._distKm != null) ? ` · ${t._distKm.toFixed(1)}km` : '';
    if (tab === 'house') {
      const pyeong = t.area ? t.area / 3.3 : 0;
      const pp = pyeong > 0 ? ` · ${Math.round(t.price * 10000 / pyeong).toLocaleString()}만/평` : '';
      return `<div style="padding:10px 14px;border-bottom:1px solid #eee;">
        <div style="font-size:12px;font-weight:700;color:${color};">[단독/다가구] ${t.name || t.dong || '-'}</div>
        <div style="font-size:12px;color:#333;margin-top:3px;">${t.price}억${pp} · ${t.area ? Math.round(t.area) + '㎡' : '-'} · ${t.date || '-'}${distTxt}</div>
      </div>`;
    }
    const pm = (t.perM2 > 0)
      ? (t.perM2 >= 100 ? Math.round(t.perM2).toLocaleString() + '만/㎡' : (Math.round(t.perM2 * 10) / 10).toFixed(1) + '만/㎡')
      : ((t.price > 0 && t.area > 0)
        ? ((Math.round(t.price * 10000 / t.area * 10) / 10).toFixed(1) + '만/㎡')
        : '-');
    const priceStr = (typeof t.price === 'number')
      ? ((t.price < 1 ? t.price.toFixed(2) : t.price.toFixed(1)) + '억')
      : (t.price || '-');
    return `<div style="padding:10px 14px;border-bottom:1px solid #eee;">
      <div style="font-size:12px;font-weight:700;color:${color};">${t.dong || '-'} (${t.jimok || '-'})</div>
      <div style="font-size:12px;color:#333;margin-top:3px;">${priceStr} · ${t.area ? Math.round(t.area).toLocaleString() + '㎡' : '-'} · ${pm} · ${t.date || '-'}${distTxt}</div>
      ${t.yongdo ? `<div style="font-size:11px;color:#888;margin-top:2px;">${t.yongdo}</div>` : ''}
    </div>`;
  }).join('');

  document.getElementById('dev-nearby-detail-inner').innerHTML =
    `<div style="background:linear-gradient(135deg,${color},${color}cc);color:#fff;padding:14px 16px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">
      <div>
        <div style="font-size:14px;font-weight:800;">📍 ${place}</div>
        <div style="font-size:11px;opacity:0.9;margin-top:3px;">${label} ${sorted.length}건${dist0 ? ' · 사업지에서 ' + dist0 : ''}</div>
      </div>
      <button type="button" onclick="document.getElementById('dev-nearby-detail-modal').style.display='none';"
        style="background:rgba(255,255,255,0.22);border:none;color:#fff;font-size:18px;cursor:pointer;border-radius:50%;width:28px;height:28px;line-height:1;">×</button>
    </div>
    <div style="max-height:58vh;overflow-y:auto;">${rows}</div>`;

  modal.style.display = 'block';
}

function showDevPopup(p) {
  if (typeof window._closeDevPopup === 'function') window._closeDevPopup();
  clearDevPopupRadius();
  const color = STATUS_COLOR[p.status] || '#607D8B';
  const el = document.createElement('div');
  el.className = 'dev-popup';
  el.style.width = '280px';

  function yearTrades(km, tab) {
    return getDevNearbyTrades(p, km, tab, { yearOnly: true });
  }

  function renderTradeList(km, tab) {
    const trades = yearTrades(km, tab);
    if (!trades.length) {
      return `<div style="font-size:10px;color:#aaa;padding:6px 0;">올해 반경 ${km}km 내 실거래 없음</div>`;
    }
    return trades.map(t => {
      const distTxt = (t._distKm != null) ? ` · ${t._distKm.toFixed(1)}km` : '';
      if (tab === 'house') {
        const pyeong = t.area ? t.area / 3.3 : 0;
        const pp = pyeong > 0 ? ` · ${Math.round(t.price*10000/pyeong).toLocaleString()}만/평` : '';
        const badgeColor = '#00695C';
        const name = t.name || t.dong || '단독/다가구';
        return `<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:10px;">
          <div style="font-weight:700;color:${badgeColor};">[단독/다가구] ${name}</div>
          <div style="color:#444;">${t.price}억${pp} · ${t.area?Math.round(t.area)+'㎡':'-'} · ${t.date||'-'}${distTxt}</div>
        </div>`;
      } else {
        return `<div style="padding:4px 0;border-bottom:1px solid #f0f0f0;font-size:10px;">
          <div style="font-weight:700;color:#5D4037;">${t.dong||'-'} (${t.jimok||'-'})</div>
          <div style="color:#444;">${t.price}억 · ${t.area?Math.round(t.area)+'㎡':'-'} · ${(t.perM2||0).toLocaleString()}원/㎡ · ${t.date||'-'}${distTxt}</div>
        </div>`;
      }
    }).join('');
  }

  function updateListHeader(km, count, mapPoints) {
    const hdr = el.querySelector('.dev-trade-header');
    if (!hdr) return;
    const y = new Date().getFullYear();
    let txt = `올해 실거래 (${count}건 · ${km}km)`;
    if (mapPoints != null && mapPoints < count) {
      txt += ` · 지도 ${mapPoints}지점`;
    }
    hdr.textContent = txt;
    hdr.title = y + '년 반경 ' + km + 'km 내 거래. 동일 좌표는 지도에서 한 점으로 합쳐 표시됩니다.';
  }

  function applyRadiusToMap(km, tab) {
    const trades = yearTrades(km, tab);
    drawDevPopupRadius(p, km);
    renderDevNearbyMarkers(trades, tab);
    return trades;
  }

  function countMapPoints(trades) {
    const keys = new Set();
    (trades || []).forEach(t => {
      if (!t.lat || !t.lng) return;
      keys.add(Number(t.lat).toFixed(5) + ',' + Number(t.lng).toFixed(5));
    });
    return keys.size;
  }

  function renderDevChart(km, tab) {
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth() + 1;
    const nearby = yearTrades(km, tab);

    const months = [];
    for (let m = 1; m <= curMonth; m++) {
      const key = curYear + '-' + String(m).padStart(2,'0');
      const items = nearby.filter(t => t.date && t.date.startsWith(key));
      let avg = null;
      if (tab === 'house') {
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
    const c = tab === 'house' ? '#00695C' : '#5D4037';
    const unit = tab === 'house' ? '만/평' : '만/㎡';

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
      if (tab === 'house') return (Math.round(v/100)/10).toFixed(1)+'천만';
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

    const mapPts = countMapPoints(nearby);
    return `
      <div style="font-size:10px;font-weight:700;color:#555;margin-bottom:3px;">📈 ${curYear} 월별 평균 (${unit}) · ${km}km · ${nearby.length}건${mapPts < nearby.length ? ' · 지도 ' + mapPts + '지점' : ''}</div>
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
    const trades = applyRadiusToMap(km, tab);
    const list = el.querySelector('.dev-trade-list');
    if (list) list.innerHTML = renderTradeList(km, tab);
    updateListHeader(km, trades.length, countMapPoints(trades));
    const chart = el.querySelector('.dev-chart-area');
    const statBtn = el.querySelector('.dev-stat-btn');
    if (chart && chart.style.display !== 'none') {
      chart.innerHTML = renderDevChart(km, tab);
      if (statBtn) statBtn.textContent = '📉 통계 접기';
    }
    el.querySelectorAll('.dev-km-btn').forEach(b => b.classList.toggle('active', +b.dataset.km === km));
    el.querySelectorAll('.dev-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  }

  function toggleStatChart() {
    const chart = el.querySelector('.dev-chart-area');
    const statBtn = el.querySelector('.dev-stat-btn');
    if (!chart || !statBtn) return;
    const opening = chart.style.display === 'none' || !chart.style.display;
    if (opening) {
      chart.style.display = 'block';
      chart.innerHTML = renderDevChart(curKm, curTab);
      statBtn.textContent = '📉 통계 접기';
    } else {
      chart.style.display = 'none';
      chart.innerHTML = '';
      statBtn.textContent = '📈 월별 가격 통계';
    }
  }

  function enableOverlayScroll(node) {
    if (!node) return;
    const stop = (e) => { e.stopPropagation(); };
    ['wheel', 'mousewheel', 'DOMMouseScroll', 'touchstart', 'touchmove'].forEach(ev => {
      node.addEventListener(ev, stop, { passive: true });
    });
  }

  function closePopup() {
    if (devPopupDragCleanup) { devPopupDragCleanup(); devPopupDragCleanup = null; }
    if (el && el.parentNode) el.parentNode.removeChild(el);
    window._devPopup = null;
    devPopupOverlay = null;
    clearDevPopupRadius();
  }
  window._closeDevPopup = closePopup;

  let curKm = 3, curTab = 'house';
  const initTrades = yearTrades(curKm, curTab);
  const initMapPts = countMapPoints(initTrades);
  el.innerHTML = `
    <div class="dev-popup-header" style="background:${color};">
      <button type="button" class="dev-popup-close">×</button>
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
            <button type="button" class="dev-tab-btn active" data-tab="house">단독/다가구</button>
            <button type="button" class="dev-tab-btn" data-tab="land">토지실거래</button>
          </div>
        </div>
        <div style="display:flex;gap:4px;margin-bottom:8px;">
          <button type="button" class="dev-km-btn" data-km="1">1km</button>
          <button type="button" class="dev-km-btn active" data-km="3">3km</button>
          <button type="button" class="dev-km-btn" data-km="5">5km</button>
        </div>
        <button type="button" class="dev-stat-btn" style="width:100%;font-size:11px;font-weight:700;padding:5px 0;border-radius:7px;border:1px solid #1565C0;background:#f0f4ff;color:#1565C0;cursor:pointer;margin-bottom:6px;">📈 월별 가격 통계</button>
        <div class="dev-chart-area" style="display:none;margin-bottom:8px;"></div>
        <div class="dev-trade-header" style="font-size:11px;font-weight:700;color:#444;margin-bottom:5px;" title="올해 반경 내 거래. 동일 좌표는 지도에서 한 점으로 합쳐 표시됩니다.">올해 실거래 (${initTrades.length}건 · ${curKm}km${initMapPts < initTrades.length ? ' · 지도 ' + initMapPts + '지점' : ''})</div>
        <div class="dev-trade-list">${renderTradeList(curKm, curTab)}</div>
      </div>
    </div>`;

  enableOverlayScroll(el);
  enableOverlayScroll(el.querySelector('.dev-popup-body'));
  enableOverlayScroll(el.querySelector('.dev-trade-list'));

  el.querySelector('.dev-popup-close').onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    closePopup();
  };
  el.querySelector('.dev-stat-btn').onclick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggleStatChart();
  };
  el.querySelectorAll('.dev-km-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      curKm = parseInt(btn.dataset.km, 10);
      rebuild(curKm, curTab);
    };
  });
  el.querySelectorAll('.dev-tab-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      curTab = btn.dataset.tab;
      rebuild(curKm, curTab);
    };
  });

  // 지도 핀에 고정하지 않고, 화면 위 플로팅 패널로 띄운 뒤 헤더 드래그 가능
  el.style.position = 'fixed';
  el.style.zIndex = '10050';
  document.body.appendChild(el);
  applyRadiusToMap(curKm, curTab);
  placeDevPopupNearProject(el, p);
  enableDevPopupDrag(el);
  window._devPopup = el;
  devPopupOverlay = el;
}
