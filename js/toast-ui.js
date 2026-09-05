/* js/toast-ui.js - extracted from index.html */
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

// 줌 변경 시 클러스터 재렌더링
kakao.maps.event.addListener(map, 'zoom_changed', function() {
  ['apt','house','rht','comm'].forEach(function(type) {
    if (window._typeState && window._typeState[type] && window._typeState[type].visible) {
      renderTradeMarkersForType(type);
    }
  });
});

// 모달에 드래그 적용
makeDraggable('stat-modal-inner',      'stat-modal-hd');
makeDraggable('land-stat-modal-inner', 'land-stat-modal-hd');
makeDraggable('jiga-modal-inner',      'jiga-modal-hd');
makeDraggable('imde-modal-inner',      'imde-modal-hd');
makeDraggable('mig-modal-inner',       'mig-modal-hd');
makeDraggable('visitor-modal-inner',   'visitor-modal-hd');
