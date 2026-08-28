/* js/map.js - 제주 부동산 플랫폼 */
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

/* ═══════════════════════════════════════════════
   카카오맵 초기화
═══════════════════════════════════════════════ */
const mapContainer = document.getElementById('map');
const mapOption = {
  center: new kakao.maps.LatLng(33.3617, 126.5292),
  level: 10
};
const map = new kakao.maps.Map(mapContainer, mapOption);

// 줌 컨트롤
const zoomControl = new kakao.maps.ZoomControl();
map.addControl(zoomControl, kakao.maps.ControlPosition.RIGHT);

// 좌표 표시
kakao.maps.event.addListener(map, 'mousemove', function(mouseEvent) {
  const lat = mouseEvent.latLng.getLat().toFixed(6);
  const lng = mouseEvent.latLng.getLng().toFixed(6);
  document.getElementById('coord-display').textContent = `위도: ${lat}  경도: ${lng}`;
});

// 지도 이동/줌 시 용도지역 WMS 갱신
kakao.maps.event.addListener(map, 'idle', function() {
  if (zoningVisible) updateZoningWMS();
});
kakao.maps.event.addListener(map, 'zoom_changed', function() {
  if (zoningVisible) updateZoningWMS();
});

/* ═══════════════════════════════════════════════
   지도 타입 전환
═══════════════════════════════════════════════ */
function setMapType(type, btn) {
  const types = {
    'ROADMAP': kakao.maps.MapTypeId.ROADMAP,
    'SKYVIEW': kakao.maps.MapTypeId.SKYVIEW,
    'HYBRID':  kakao.maps.MapTypeId.HYBRID
  };
  map.setMapTypeId(types[type]);
  document.querySelectorAll('.map-type-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

/* ═══════════════════════════════════════════════
   레이어 패널 토글
═══════════════════════════════════════════════ */
let panelOpen = true;
function togglePanel() {
  panelOpen = !panelOpen;
  const panel = document.getElementById('layer-panel');
  const btn = document.getElementById('panel-toggle');
  panel.classList.toggle('collapsed', !panelOpen);
  btn.style.left = panelOpen ? '260px' : '0px';
  btn.textContent = panelOpen ? '◀' : '▶';
}

function updateActiveLayerCount() {
  const cnt = document.querySelectorAll('.layer-toggle.on').length - 1; // 배경지도 제외
  document.getElementById('active-layer-cnt').textContent = Math.max(0, cnt);
}

/* ═══════════════════════════════════════════════
   용도지역 레이어 (카카오 지적편집도 + VWorld WMS 병행)
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   실거래 레이어
═══════════════════════════════════════════════ */
/* ═══════════════════════════════════════════════
   데이터 연결 모달 로직
═══════════════════════════════════════════════ */
let dmActiveTab = 'csv';
let csvParsedData = null;
