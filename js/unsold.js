/* js/unsold.js - 제주 부동산 플랫폼 */
document.addEventListener('DOMContentLoaded', () => {
  const badge = document.getElementById('unsold-cnt-badge');
  if (badge) {
    const totalUnits = UNSOLD_DATA.reduce((sum, d) => sum + d.units, 0);
    badge.textContent = `${UNSOLD_DATA.length}개 단지 · ${totalUnits.toLocaleString()}세대`;
  }
});

/* ── 단지명으로 정확한 좌표 자동 보정 ──
   카카오 Places keywordSearch로 실제 위치를 찾아 UNSOLD_DATA 좌표를 갱신.
   이미 마커가 표시 중이면 즉시 위치도 갱신.
*/
let _geocodeStarted = false;
function geocodeUnsoldByName() {
  if (_geocodeStarted) return;
  _geocodeStarted = true;
  function doGeocode() {
    const ps = new kakao.maps.services.Places();
    const jejuCenter = new kakao.maps.LatLng(33.3617, 126.5292);

  UNSOLD_DATA.forEach((item, idx) => {
    setTimeout(() => {
      ps.keywordSearch(item.name, function(data, status) {
        if (status !== kakao.maps.services.Status.OK || !data.length) {
          // 결과 없으면 "제주 + 단지명"으로 재시도
          ps.keywordSearch('제주 ' + item.name, function(d2, s2) {
            if (s2 === kakao.maps.services.Status.OK && d2.length) applyCoord(item, d2[0], idx);
          }, { location: jejuCenter, radius: 20000 });
          return;
        }
        applyCoord(item, data[0], idx);
      }, { location: jejuCenter, radius: 20000 });
    }, idx * 400); // 400ms 간격으로 rate-limit
  });
  }
  if (window._kakaoReady) {
    doGeocode();
  } else {
    kakao.maps.load(doGeocode);
  }
}

function applyCoord(item, result, idx) {
  const newLat = parseFloat(result.y);
  const newLng = parseFloat(result.x);
  if (!newLat || !newLng) return;

  const prevLat = item.lat, prevLng = item.lng;
  item.lat = newLat;
  item.lng = newLng;
  item.roadAddr = result.road_address_name || result.address_name || '';

  // 이미 마커가 표시 중이면 위치 갱신
  if (unsoldVisible && unsoldOverlays[idx]) {
    unsoldOverlays[idx].setLngLat([newLng, newLat]);
  }

  // 좌표가 크게 바뀐 경우 콘솔에 기록 (디버그용)
  const dist = Math.sqrt(Math.pow(newLat - prevLat, 2) + Math.pow(newLng - prevLng, 2));
  if (dist > 0.01) {
    console.log(`[위치보정] ${item.name}: (${prevLat.toFixed(4)},${prevLng.toFixed(4)}) → (${newLat.toFixed(4)},${newLng.toFixed(4)}) | ${item.roadAddr}`);
  }
}

function drawUnsoldMarkers() {
  unsoldOverlays.forEach(o => o.remove());
  unsoldOverlays.length = 0;
  if (!unsoldVisible) return;

  UNSOLD_DATA.forEach(d => {
    const el = document.createElement('div');
    el.className = 'unsold-marker';
    el.style.opacity = unsoldOpacity;
    el.innerHTML = `
      <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
      </svg>
      <div class="unsold-badge">${d.units}</div>`;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      showUnsoldPopup(d, el);
    });

    const overlay = new maplibregl.Marker({ element: el, anchor: 'bottom' })
      .setLngLat([d.lng, d.lat]);
    overlay.addTo(map);
    unsoldOverlays.push(overlay);
  });
}

function toggleUnsold(btn) {
  unsoldVisible = btn.classList.toggle('on');
  if (unsoldVisible) drawUnsoldMarkers();
  else {
    unsoldOverlays.forEach(o => o.remove());
    unsoldOverlays.length = 0;
    closeUnsoldPopup();
  }
  updateActiveLayerCount();
}

function setUnsoldOpacity(val) {
  unsoldOpacity = val / 100;
  document.querySelectorAll('.unsold-marker').forEach(el => el.style.opacity = unsoldOpacity);
}

function showUnsoldPopup(d, markerEl) {
  closeUnsoldPopup();
  const popup = document.getElementById('unsold-popup');
  const mapEl = document.getElementById('map-wrap');

  const realBadge = d.real ? `<span style="background:#e53935;color:#fff;font-size:10px;padding:1px 5px;border-radius:4px;margin-left:4px;">실제확인</span>` : '';
  document.getElementById('up-title').innerHTML = '🏠 ' + d.name + realBadge;
  document.getElementById('up-addr').innerHTML =
    '📍 ' + (d.roadAddr || d.addr) +
    (d.roadAddr ? `<br><span style="font-size:10px;color:#bbb;">${d.addr}</span>` : '');
  document.getElementById('up-tag-wrap').innerHTML =
    `<span class="up-tag ${d.type}">${TYPE_LABEL[d.type]}</span>`;

  const unitsLabel = d.total
    ? `${d.units}세대 <span style="font-size:11px;color:#888;">(총 ${d.total}세대 중)</span>`
    : `${d.units}세대`;
  const subscripRow = d.subscrip !== undefined
    ? `<div class="up-field"><div class="uf-lbl">청약 접수</div><div class="uf-val" style="color:#e65100;">${d.subscrip}명 (경쟁률 ${(d.subscrip/d.total).toFixed(2)}:1)</div></div>` : '';

  document.getElementById('up-grid').innerHTML = `
    <div class="up-field"><div class="uf-lbl">미분양 세대</div><div class="uf-val red">${unitsLabel}</div></div>
    ${subscripRow}
    <div class="up-field"><div class="uf-lbl">분양가</div><div class="uf-val purple">${d.price}</div></div>
    <div class="up-field"><div class="uf-lbl">공급면적</div><div class="uf-val">${d.area}</div></div>
    <div class="up-field"><div class="uf-lbl">미분양 발생</div><div class="uf-val">${d.since}</div></div>
    <div class="up-field" style="grid-column:1/-1"><div class="uf-lbl">시행·시공사</div><div class="uf-val">${d.company}</div></div>
    ${d.note ? `<div class="up-field" style="grid-column:1/-1"><div class="uf-lbl">비고</div><div class="uf-val" style="color:#b71c1c;font-size:11px;">${d.note}</div></div>` : ''}
  `;

  // 마커 픽셀 위치 계산
  const rect = markerEl ? markerEl.getBoundingClientRect() : { left: 400, top: 300, width: 0 };
  const mapRect = mapEl.getBoundingClientRect();
  const popW = 300, popH = 260;
  const left = Math.max(8, Math.min(rect.left - mapRect.left + rect.width / 2 - popW / 2, mapEl.offsetWidth - popW - 8));
  const top  = Math.max(8, rect.top - mapRect.top - popH - 10);
  popup.style.left = left + 'px';
  popup.style.top  = top  + 'px';
  popup.style.display = 'block';
}

function closeUnsoldPopup() {
  document.getElementById('unsold-popup').style.display = 'none';
}

// 지도 클릭 시 팝업 닫기
// 지도 클릭 이벤트는 map 초기화 후 등록
document.addEventListener('DOMContentLoaded', () => {
  // map 로드 후 클릭 이벤트 등록
  const registerClick = () => {
    if (window.map) {
      window.map.on('click', function() {
        closeUnsoldPopup();
        document.getElementById('search-results').style.display = 'none';
        document.getElementById('trade-popup').style.display = 'none';
      });
    } else {
      setTimeout(registerClick, 200);
    }
  };
  registerClick();
});

