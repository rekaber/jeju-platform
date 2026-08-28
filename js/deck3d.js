/* js/deck3d.js - 3D 거래가 히트맵 (Deck.gl + Kakao Maps) */

let deckInstance = null;
let deck3dActive = false;
let deckContainer = null;

/* Kakao 레벨 → Deck.gl zoom 변환 */
function kakaoLevelToZoom(level) {
  // Kakao level 1(최근접)~14(최원), deck zoom은 반대 방향
  return 20 - level;
}

function getDeckViewState(pitch) {
  const center = map.getCenter();
  const level  = map.getLevel();
  return {
    latitude:          center.getLat(),
    longitude:         center.getLng(),
    zoom:              kakaoLevelToZoom(level),
    pitch:             pitch !== undefined ? pitch : (deck3dActive ? 50 : 0),
    bearing:           0,
    transitionDuration: 0
  };
}

function syncDeckViewport() {
  if (!deckInstance) return;
  deckInstance.setProps({ viewState: getDeckViewState() });
}

/* 데이터 레이어 생성 */
function buildLayers() {
  const raw = window.TRADE_DATA || [];
  if (!raw.length) return [];

  const data = raw
    .filter(d => d.lat && d.lng && d.price)
    .map(d => ({
      position: [parseFloat(d.lng), parseFloat(d.lat)],
      price:    parseFloat(d.price) * 10000  // 억 → 만원
    }));

  return [
    new deck.HexagonLayer({
      id:                  'trade-3d-hex',
      data,
      getPosition:         d => d.position,
      getElevationWeight:  d => d.price,
      elevationAggregation:'MEAN',
      elevationScale:      0.004,   // 높이 스케일 (값 조정 가능)
      extruded:            true,
      radius:              400,     // 헥사곤 반경 (미터)
      coverage:            0.85,
      opacity:             0.75,
      colorRange: [
        [34, 139, 87],
        [90, 190, 100],
        [251, 176, 59],
        [238, 100, 65],
        [200, 40, 40],
        [130, 10, 10]
      ],
      material: {
        ambient: 0.64,
        diffuse: 0.6,
        shininess: 32,
        specularColor: [51, 51, 51]
      },
      pickable: true,
      onHover: info => showDeck3DTooltip(info)
    })
  ];
}

/* 툴팁 */
let tooltipEl = null;
function showDeck3DTooltip(info) {
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

  if (info.object) {
    const avg = (info.object.elevationValue / 10000).toFixed(2);
    const cnt = info.object.points.length;
    tooltipEl.style.display = 'block';
    tooltipEl.style.left    = (info.x + 12) + 'px';
    tooltipEl.style.top     = (info.y - 10) + 'px';
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
  mapDiv.style.position = 'relative';

  deckContainer = document.createElement('div');
  deckContainer.id = 'deck-overlay';
  deckContainer.style.cssText = [
    'position:absolute', 'top:0', 'left:0',
    'width:100%', 'height:100%',
    'pointer-events:none', 'z-index:5'
  ].join(';');
  mapDiv.appendChild(deckContainer);

  deckInstance = new deck.DeckGL({
    parent:          deckContainer,
    style:           { position: 'absolute', left: 0, top: 0 },
    controller:      false,
    viewState:       getDeckViewState(50),
    layers:          buildLayers(),
    parameters:      { depthTest: true }
  });

  // Kakao 이벤트 동기화
  kakao.maps.event.addListener(map, 'center_changed', syncDeckViewport);
  kakao.maps.event.addListener(map, 'zoom_changed',   syncDeckViewport);
  kakao.maps.event.addListener(map, 'dragend',        syncDeckViewport);
}

/* 토글 */
function toggleDeck3D(btn) {
  deck3dActive = !deck3dActive;
  btn.classList.toggle('on', deck3dActive);

  if (deck3dActive) {
    initDeck3D();
    deckInstance.setProps({ layers: buildLayers(), viewState: getDeckViewState(50) });
    if (deckContainer) deckContainer.style.pointerEvents = 'auto';
  } else {
    if (deckInstance) {
      deckInstance.setProps({ layers: [] });
    }
    if (deckContainer) deckContainer.style.pointerEvents = 'none';
    if (tooltipEl)     tooltipEl.style.display = 'none';
  }

  updateActiveLayerCount();
}
