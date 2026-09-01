/* js/deck3d.js - 3D 거래가 히트맵 (deck.Deck + MapLibre 카메라 완전 동기화) */

let deckInstance = null;
let deck3dActive = false;
let deckContainer = null;
let deckCanvas = null;

/* MapLibre 카메라를 그대로 읽어서 deck.gl에 전달 */
function getDeckViewState() {
  const center = map.getCenter();
  return {
    latitude:           center.lat,
    longitude:          center.lng,
    zoom:               map.getZoom(),
    pitch:              map.getPitch(),    // MapLibre pitch 그대로
    bearing:            map.getBearing(),  // MapLibre bearing 그대로
    transitionDuration: 0
  };
}

function syncDeckViewport() {
  if (!deckInstance || !deck3dActive) return;
  deckInstance.setProps({ viewState: getDeckViewState() });
}

/* 제주도 육지 범위 필터 (바다 포인트 제거) */
const JEJU_BBOX = { minLat: 33.10, maxLat: 33.62, minLng: 126.08, maxLng: 126.96 };

function buildLayers() {
  const raw = window.TRADE_DATA || [];
  if (!raw.length) return [];

  const data = raw
    .filter(d => {
      const lat = parseFloat(d.lat), lng = parseFloat(d.lng);
      return lat && lng && d.price
        && lat >= JEJU_BBOX.minLat && lat <= JEJU_BBOX.maxLat
        && lng >= JEJU_BBOX.minLng && lng <= JEJU_BBOX.maxLng;
    })
    .map(d => ({
      position: [parseFloat(d.lng), parseFloat(d.lat)],
      price:    parseFloat(d.price) * 10000
    }));

  return [
    new deck.HexagonLayer({
      id:                  'trade-3d-hex',
      data,
      getPosition:         d => d.position,
      getElevationWeight:  d => d.price,
      elevationAggregation:'MEAN',
      elevationScale:      0.012,   // 3D 기둥 높이
      extruded:            true,
      radius:              350,
      coverage:            0.85,
      opacity:             0.82,
      colorRange: [
        [34,  139,  87],
        [90,  190, 100],
        [251, 176,  59],
        [238, 100,  65],
        [200,  40,  40],
        [130,  10,  10]
      ],
      material: {
        ambient:       0.64,
        diffuse:       0.6,
        shininess:     32,
        specularColor: [51, 51, 51]
      },
      pickable: true
    })
  ];
}

/* 툴팁 */
let tooltipEl = null;
function showDeck3DTooltip(info, clientX, clientY) {
  if (!tooltipEl) {
    tooltipEl = document.createElement('div');
    tooltipEl.id = 'deck3d-tooltip';
    tooltipEl.style.cssText = [
      'position:fixed', 'z-index:9999', 'pointer-events:none',
      'background:rgba(10,22,40,0.92)', 'color:#7dd3c8',
      'border:1px solid #0d9488', 'border-radius:8px',
      'padding:8px 12px', 'font-size:12px', 'font-weight:600',
      'display:none', 'box-shadow:0 4px 16px rgba(0,0,0,0.4)'
    ].join(';');
    document.body.appendChild(tooltipEl);
  }
  if (info && info.object) {
    const avg = (info.object.elevationValue / 10000).toFixed(2);
    const cnt = info.object.points.length;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left    = (clientX + 14) + 'px';
    tooltipEl.style.top     = (clientY - 10) + 'px';
    tooltipEl.innerHTML = `
      <div style="color:#fff;margin-bottom:3px;">📍 평균 거래가</div>
      <div style="font-size:15px;">💰 ${avg}억 원</div>
      <div style="color:#aaa;font-size:11px;margin-top:2px;">거래 ${cnt}건</div>
    `;
  } else {
    tooltipEl.style.display = 'none';
  }
}

/* Deck.gl 초기화 */
function initDeck3D() {
  if (deckInstance) return;

  const mapDiv = document.getElementById('map');
  const w = mapDiv.clientWidth;
  const h = mapDiv.clientHeight;

  deckContainer = document.createElement('div');
  deckContainer.id = 'deck-overlay';
  deckContainer.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    `width:${w}px`, `height:${h}px`,
    'pointer-events:none', 'z-index:5'
  ].join(';');
  mapDiv.style.position = 'relative';
  mapDiv.appendChild(deckContainer);

  deckCanvas = document.createElement('canvas');
  deckCanvas.width  = w;
  deckCanvas.height = h;
  deckCanvas.style.cssText = 'position:absolute;top:0;left:0;pointer-events:none;';
  deckContainer.appendChild(deckCanvas);

  deckInstance = new deck.Deck({
    canvas:     deckCanvas,
    width:      w,
    height:     h,
    controller: false,
    viewState:  getDeckViewState(),
    layers:     [],
    parameters: { depthTest: true }
  });

  // MapLibre 모든 카메라 이벤트 동기화
  ['move', 'zoom', 'rotate', 'pitch', 'moveend', 'zoomend', 'pitchend', 'rotateend']
    .forEach(evt => map.on(evt, syncDeckViewport));

  // 툴팁
  mapDiv.addEventListener('mousemove', e => {
    if (!deck3dActive || !deckInstance) return;
    const rect = mapDiv.getBoundingClientRect();
    const info = deckInstance.pickObject({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      radius: 6
    });
    showDeck3DTooltip(info, e.clientX, e.clientY);
  });
  mapDiv.addEventListener('mouseleave', () => {
    if (tooltipEl) tooltipEl.style.display = 'none';
  });
}

/* 토글 */
function toggleDeck3D(btn) {
  deck3dActive = !deck3dActive;
  btn.classList.toggle('on', deck3dActive);

  if (deck3dActive) {
    // 1. MapLibre 카메라를 50° 기울임 → 타일도 같이 기울어짐
    map.easeTo({ pitch: 50, duration: 600 });

    // 2. deck.gl 초기화 및 레이어 세팅 (기울기 완료 후 동기화)
    initDeck3D();
    setTimeout(() => {
      deckInstance.setProps({
        layers:    buildLayers(),
        viewState: getDeckViewState()
      });
      if (deckContainer) deckContainer.style.display = 'block';
    }, 650);

  } else {
    if (deckInstance)  deckInstance.setProps({ layers: [] });
    if (deckContainer) deckContainer.style.display = 'none';
    if (tooltipEl)     tooltipEl.style.display = 'none';
    // 지도 원래대로
    map.easeTo({ pitch: 0, duration: 400 });
  }

  if (typeof updateActiveLayerCount === 'function') updateActiveLayerCount();
}
