/* js/search.js - 제주 부동산 플랫폼 */
/* ═══════════════════════════════════════════════
   주소 검색 (카카오 Geocoder + Places)
═══════════════════════════════════════════════ */
const geocoder = new kakao.maps.services.Geocoder();
const places   = new kakao.maps.services.Places();
let searchPinOverlay = null;

function doSearch() {
  const q = document.getElementById('search-input').value.trim();
  if (!q) return;

  // 도로명/지번 주소 우선
  geocoder.addressSearch(q, function(result, status) {
    if (status === kakao.maps.services.Status.OK && result.length > 0) {
      const items = result.map(r => ({
        name: r.address_name,
        sub: r.road_address ? r.road_address.address_name : '',
        lat: parseFloat(r.y),
        lng: parseFloat(r.x)
      }));
      showSearchResults(items, true);
    } else {
      // 장소명 검색 fallback
      places.keywordSearch('제주 ' + q, function(data, s) {
        if (s === kakao.maps.services.Status.OK) {
          const items = data.map(r => ({
            name: r.place_name,
            sub: r.road_address_name || r.address_name,
            lat: parseFloat(r.y),
            lng: parseFloat(r.x)
          }));
          showSearchResults(items, true);
        } else {
          showToast('검색 결과가 없습니다');
        }
      }, { location: new kakao.maps.LatLng(33.3617, 126.5292), radius: 60000 });
    }
  });
}

function showSearchResults(items, autoSelect) {
  const box = document.getElementById('search-results');
  if (!items.length) { box.style.display = 'none'; return; }
  // 결과 1개면 바로 이동
  if (autoSelect && items.length === 1) { selectResultItem(items[0]); return; }
  const icon = '📍';
  box.innerHTML = `<div id="search-results-header">검색결과 ${items.length}건</div>` +
    items.slice(0, 8).map((r, i) =>
      `<div class="search-result-item" onclick="selectResult(${i})">
         <div class="sr-icon">${icon}</div>
         <div class="sr-text">
           <div class="addr-main">${r.name}</div>
           ${r.sub ? `<div class="addr-sub">${r.sub}</div>` : ''}
         </div>
       </div>`
    ).join('');
  box.style.display = 'block';
  box._items = items;
}

function selectResult(i) {
  const item = document.getElementById('search-results')._items[i];
  selectResultItem(item);
}
function selectResultItem(item) {
  document.getElementById('search-results').style.display = 'none';
  document.getElementById('search-input').value = item.name;

  const pos = new kakao.maps.LatLng(item.lat, item.lng);
  map.setCenter(pos);
  map.setLevel(4);

  // 검색 핀
  if (searchPinOverlay) searchPinOverlay.setMap(null);
  const pinEl = document.createElement('div');
  pinEl.className = 'search-pin-el';
  pinEl.innerHTML = `
    <svg class="pin-icon" viewBox="0 0 24 36" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 20 8 20s8-14 8-20c0-4.4-3.6-8-8-8z" fill="#C62828"/>
      <circle cx="12" cy="8" r="4" fill="#fff"/>
    </svg>
    <div class="pin-label">${item.name}</div>`;
  searchPinOverlay = new kakao.maps.CustomOverlay({
    position: pos,
    content: pinEl,
    yAnchor: 1.0
  });
  searchPinOverlay.setMap(map);
}

document.getElementById('search-btn').addEventListener('click', doSearch);
document.getElementById('search-input').addEventListener('keydown', e => {
  if (e.key === 'Enter') doSearch();
});

/* ═══════════════════════════════════════════════
   Toast 알림
═══════════════════════════════════════════════ */
function showToast(msg, dur = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.style.opacity = '1';
  setTimeout(() => t.style.opacity = '0', dur);
}

// 미분양 단지 좌표 자동 보정 (모든 변수 선언 후 실행)
geocodeUnsoldByName();

/* ═══════════════════════════════════════════════
   드래그 가능 모달
═══════════════════════════════════════════════ */
function makeDraggable(innerId, hdId) {
  const inner = document.getElementById(innerId);
  const hd    = document.getElementById(hdId);
  if (!inner || !hd) return;
  let startX, startY, startL, startT, dragging = false;

  function resetPos() {
    inner.style.transform = 'translateX(-50%)';
    inner.style.left = '50%';
    inner.style.top  = '5vh';
  }

  hd.addEventListener('mousedown', e => {
    if (e.target.closest('.sm-close')) return;
    dragging = true;
    // 처음 드래그 시 절대 좌표로 전환
    const rect = inner.getBoundingClientRect();
    inner.style.transform = 'none';
    inner.style.left = rect.left + 'px';
    inner.style.top  = rect.top  + 'px';
    startX = e.clientX; startY = e.clientY;
    startL = rect.left; startT = rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    let l = startL + (e.clientX - startX);
    let t = startT + (e.clientY - startY);
    // 화면 밖으로 나가지 않게
    l = Math.max(0, Math.min(window.innerWidth  - inner.offsetWidth,  l));
    t = Math.max(0, Math.min(window.innerHeight - inner.offsetHeight, t));
    inner.style.left = l + 'px';
    inner.style.top  = t + 'px';
  });
  document.addEventListener('mouseup', () => {
    dragging = false;
    document.body.style.userSelect = '';
  });

  // 모달이 열릴 때 위치 초기화
  const modal = inner.closest('[id$="-modal"]');
  if (modal) {
    const obs = new MutationObserver(() => {
      if (modal.classList.contains('open')) resetPos();
    });
    obs.observe(modal, { attributes: true, attributeFilter: ['class'] });
  }
}

// 4개 모달에 드래그 적용
makeDraggable('stat-modal-inner',      'stat-modal-hd');
makeDraggable('land-stat-modal-inner', 'land-stat-modal-hd');
makeDraggable('jiga-modal-inner',      'jiga-modal-hd');
makeDraggable('imde-modal-inner',      'imde-modal-hd');
makeDraggable('mig-modal-inner',       'mig-modal-hd');

