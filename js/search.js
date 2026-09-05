/* js/search.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   주소 검색 (카카오 Geocoder + Places)
═══════════════════════════════════════════════ */
var geocoder = new kakao.maps.services.Geocoder();
var places   = new kakao.maps.services.Places();
var searchPinOverlay = null;

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
