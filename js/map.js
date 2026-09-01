/* js/map.js - 제주 부동산 플랫폼 (MapLibre GL JS) */
/* ═══════════════════════════════════════════════
   미분양 실제 확인 데이터
═══════════════════════════════════════════════ */
const UNSOLD_DATA = [
  // ★ 실제 확인 데이터
  { id:1,  name:'효성해링턴플레이스 제주',           addr:'제주시 애월읍 하귀1리', lat:33.4808, lng:126.3955, type:'apt', units:424, price:'84㎡ 최고 8.9억', area:'84~101㎡', company:'효성중공업', since:'확인필요', real:true, total:425, note:'공매 4,006억 유찰 반복·투자사기 의혹' },
  { id:13, name:'동문디이스트 시그니처원 1단지',      addr:'제주시 연동',           lat:33.4945, lng:126.5002, type:'apt', units:165, price:'미공개', area:'미공개',    company:'동문건설',   since:'확인필요', real:true, total:182, subscrip:17 },
  { id:14, name:'동문디이스트 시그니처원 2단지',      addr:'제주시 연동',           lat:33.4938, lng:126.5018, type:'apt', units:190, price:'미공개', area:'미공개',    company:'동문건설',   since:'확인필요', real:true, total:196, subscrip:6  },
  { id:16, name:'한경면 신축단지 (통매각)',          addr:'제주시 한경면',         lat:33.3558, lng:126.1821, type:'apt', units:164, price:'88.5㎡ 최대 8억', area:'88.5㎡',  company:'미공개', since:'확인필요', real:true, total:164, note:'공매 1,074억 통매각 추진 (서부권 고가 미분양)' },
  { id:15, name:'PH159',                           addr:'제주시 조천읍 북촌리',   lat:33.5408, lng:126.6781, type:'apt', units:37,  price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:49,  subscrip:12 },
  { id:17, name:'한화포레나 제주에듀시티',           addr:'서귀포시 대정읍 보성리', lat:33.2890, lng:126.2548, type:'apt', units:503, price:'미공개',       area:'미공개',  company:'한화건설', since:'확인필요', real:true, total:503, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:18, name:'호반써밋 제주',                    addr:'제주시 용담이동',        lat:33.5098, lng:126.4782, type:'apt', units:213, price:'미공개',       area:'미공개',  company:'호반건설', since:'확인필요', real:true, total:213, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:19, name:'엘리프 애월',                      addr:'제주시 애월읍',          lat:33.4622, lng:126.3275, type:'apt', units:136, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:136, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:20, name:'엘크루 더 퍼스트',                 addr:'제주시 이호이동',        lat:33.4981, lng:126.4388, type:'apt', units:134, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:134, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:21, name:'함덕해밀타운 2단지',               addr:'제주시 조천읍 함덕리',   lat:33.5350, lng:126.6618, type:'apt', units:116, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:116, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:22, name:'더 프리모84',                      addr:'서귀포시 토평동',        lat:33.2542, lng:126.5887, type:'apt', units:84,  price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:84,  note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:23, name:'트라움 제주 10단지',               addr:'서귀포시 안덕면',        lat:33.2782, lng:126.3215, type:'villa',units:80, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:80,  note:'전원형 단지. 정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:24, name:'레브카운티',                       addr:'제주시 아라동',          lat:33.4585, lng:126.5345, type:'villa',units:64, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:64,  note:'고급 빌라형. 정확한 미분양 세대수 미공개 (총세대 기재)' },
];

const TYPE_LABEL = { apt:'아파트', ofc:'오피스텔', villa:'빌라·타운하우스' };
const VWORLD_KEY = 'E7677C67-87D1-3D51-AE0C-C59B2947A413';

/* ═══ MapLibre 초기화 ═══ */
let map;
let zoningVisible = false;
let zoningLayer = null;

const CARTO_VOYAGER = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json';
const ESRI_SATELLITE = {
  version: 8,
  sources: {
    satellite: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: '© Esri'
    }
  },
  layers: [{ id: 'satellite', type: 'raster', source: 'satellite' }]
};

// Kakao Services 초기화 (검색/지오코딩만)
kakao.maps.load(function() {
  window._kakaoReady = true;
});

document.addEventListener('DOMContentLoaded', () => {
  map = new maplibregl.Map({
    container: 'map',
    style: CARTO_VOYAGER,
    center: [126.5292, 33.3617],
    zoom: 10,
    pitch: 0,
    bearing: 0,
    attributionControl: false
  });
  window.map = map;

  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'right');
  map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');

  map.on('mousemove', (e) => {
    document.getElementById('coord-display').textContent =
      `위도: ${e.lngLat.lat.toFixed(6)}  경도: ${e.lngLat.lng.toFixed(6)}`;
  });

  map.on('load', () => {
    // 용도지역 WMS source 준비
    map.addSource('vworld-zoning', {
      type: 'raster',
      tiles: [
        `https://api.vworld.kr/req/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=lt_c_uq111&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
        `&WIDTH=256&HEIGHT=256&CRS=EPSG:3857` +
        `&KEY=${VWORLD_KEY}&BBOX={bbox-epsg-3857}`
      ],
      tileSize: 256
    });
    map.addLayer({
      id: 'zoning-layer',
      type: 'raster',
      source: 'vworld-zoning',
      paint: { 'raster-opacity': 0.6 },
      layout: { visibility: 'none' }
    });
  });
});

/* ═══ 지도 타입 전환 ═══ */
function setMapType(type, btn) {
  document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  if (type === 'ROADMAP') {
    map.setStyle(CARTO_VOYAGER);
    map.once('style.load', () => restoreZoningSource());
  } else if (type === 'SKYVIEW' || type === 'HYBRID') {
    map.setStyle(ESRI_SATELLITE);
    map.once('style.load', () => restoreZoningSource());
  }
}

function restoreZoningSource() {
  if (!map.getSource('vworld-zoning')) {
    map.addSource('vworld-zoning', {
      type: 'raster',
      tiles: [
        `https://api.vworld.kr/req/wms?SERVICE=WMS&VERSION=1.3.0&REQUEST=GetMap` +
        `&LAYERS=lt_c_uq111&STYLES=&FORMAT=image/png&TRANSPARENT=true` +
        `&WIDTH=256&HEIGHT=256&CRS=EPSG:3857` +
        `&KEY=${VWORLD_KEY}&BBOX={bbox-epsg-3857}`
      ],
      tileSize: 256
    });
    map.addLayer({
      id: 'zoning-layer',
      type: 'raster',
      source: 'vworld-zoning',
      paint: { 'raster-opacity': 0.6 },
      layout: { visibility: zoningVisible ? 'visible' : 'none' }
    });
  }
}

/* ═══ 용도지역 토글 ═══ */
let zoningOpacity = 0.6;
function toggleZoning(btn) {
  zoningVisible = !zoningVisible;
  btn.classList.toggle('on', zoningVisible);
  const legend = document.getElementById('zoning-legend');
  if (legend) legend.style.display = zoningVisible ? 'block' : 'none';
  if (map.getLayer('zoning-layer')) {
    map.setLayoutProperty('zoning-layer', 'visibility', zoningVisible ? 'visible' : 'none');
  }
  updateActiveLayerCount();
}
function setZoningOpacity(val) {
  zoningOpacity = val / 100;
  if (map.getLayer('zoning-layer')) {
    map.setPaintProperty('zoning-layer', 'raster-opacity', zoningOpacity);
  }
}

/* ═══ 레이어 패널 토글 ═══ */
let panelOpen = true;
function togglePanel() {
  panelOpen = !panelOpen;
  const panel = document.getElementById('layer-panel');
  const btn   = document.getElementById('panel-toggle');
  panel.classList.toggle('collapsed', !panelOpen);
  btn.style.left   = panelOpen ? '260px' : '0px';
  btn.textContent  = panelOpen ? '◀' : '▶';
}

function updateActiveLayerCount() {
  const cnt = document.querySelectorAll('.layer-toggle.on').length - 1;
  document.getElementById('active-layer-cnt').textContent = Math.max(0, cnt);
}

let dmActiveTab = 'csv';
let csvParsedData = null;
