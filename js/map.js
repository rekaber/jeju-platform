/* js/map.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   카카오맵 초기화
═══════════════════════════════════════════════ */
var mapContainer = document.getElementById('map');
var mapOption = {
  center: new kakao.maps.LatLng(33.3617, 126.5292),
  level: 10
};
var map = new kakao.maps.Map(mapContainer, mapOption);
window.map = map;

// 용도지역 플래그 (land.js에서 재할당) — idle 핸들러 TDZ 방지
var zoningVisible = false;

// 줌 컨트롤
var zoomControl = new kakao.maps.ZoomControl();
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
var panelOpen = true;
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
