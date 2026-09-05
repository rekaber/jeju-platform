/* js/bid.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   경매·공매 레이어
═══════════════════════════════════════════════ */
window.BID_DATA = [];
var bidVisible = false;
var bidStatus  = 'all';
var bidType    = 'all';
var bidOverlays = [];
var bidPopupOv  = null;

var BID_STATUS_COLOR = { '진행중':'#B71C1C', '공고중':'#E65100', '종료':'#757575' };

function getBidStatusLabel(d) {
  const now = new Date();
  const begin = d.bidBeginDt ? new Date(d.bidBeginDt.slice(0,4)+'-'+d.bidBeginDt.slice(4,6)+'-'+d.bidBeginDt.slice(6,8)) : null;
  const end   = d.bidEndDt   ? new Date(d.bidEndDt.slice(0,4)+'-'+d.bidEndDt.slice(4,6)+'-'+d.bidEndDt.slice(6,8))     : null;
  if (end && now > end) return '종료';
  if (begin && now >= begin) return '진행중';
  return '공고중';
}

function getBidTypeGroup(nm) {
  if (!nm) return '기타';
  if (/토지|임야|전|답|대지/.test(nm)) return '토지';
  if (/건물|아파트|주택|오피스|상가|공장/.test(nm)) return '건물';
  return '기타';
}

function getFilteredBid() {
  return (window.BID_DATA || []).filter(d => {
    if (bidStatus !== 'all' && d._status !== bidStatus) return false;
    if (bidType   !== 'all' && d._typeGroup !== bidType)  return false;
    return true;
  });
}

function toggleBid(btn) {
  bidVisible = btn.classList.toggle('on');
  document.getElementById('bid-controls').style.display = bidVisible ? 'block' : 'none';
  if (bidVisible) renderBidMarkers();
  else clearBidMarkers();
  updateActiveLayerCount();
}

function setBidStatus(s, btn) {
  bidStatus = s;
  document.querySelectorAll('#bid-controls .bid-filter-btn').forEach((b,i) => { if(i<4) b.classList.remove('active'); });
  btn.classList.add('active');
  if (bidVisible) renderBidMarkers();
}

function setBidType(t, btn) {
  bidType = t;
  document.querySelectorAll('#bid-controls .bid-filter-btn').forEach((b,i) => { if(i>=4) b.classList.remove('active'); });
  btn.classList.add('active');
  if (bidVisible) renderBidMarkers();
}

function clearBidMarkers() {
  bidOverlays.forEach(o => o.setMap(null));
  bidOverlays = [];
  if (bidPopupOv) { bidPopupOv.setMap(null); bidPopupOv = null; }
}

function renderBidMarkers() {
  clearBidMarkers();
  const list = getFilteredBid();
  document.getElementById('bid-cnt-badge').textContent = list.length;
  const token = {};
  window._bidToken = token;
  let i = 0;
  function chunk() {
    if (window._bidToken !== token) return;
    const end = Math.min(i + 60, list.length);
    for (; i < end; i++) {
      const d = list[i];
      if (!d.lat || !d.lng || !isInJeju(d.lat, d.lng)) continue;
      const color = BID_STATUS_COLOR[d._status] || '#757575';
      const el = document.createElement('div');
      el.className = 'bid-marker';
      el.style.color = color;
      el.innerHTML = `<div class="bid-marker-pin"></div><div class="bid-marker-label">${d.cltrNm||d._typeGroup}</div>`;
      el.onclick = () => showBidPopup(d);
      const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(d.lat, d.lng), content: el, yAnchor: 1.0, zIndex: 5 });
      ov.setMap(map);
      bidOverlays.push(ov);
    }
    if (i < list.length) setTimeout(chunk, 20);
  }
  chunk();
}

function showBidPopup(d) {
  if (bidPopupOv) { bidPopupOv.setMap(null); bidPopupOv = null; }
  const color = BID_STATUS_COLOR[d._status] || '#757575';
  const fmtAmt = v => v ? Math.round(parseInt(v)/10000).toLocaleString()+'만원' : '-';
  const fmtDt  = s => s && s.length>=8 ? `${s.slice(0,4)}-${s.slice(4,6)}-${s.slice(6,8)}` : '-';
  const ratio  = (d.minBdgAmt && d.drauUpAmt && parseInt(d.drauUpAmt)>0)
    ? Math.round(parseInt(d.minBdgAmt)/parseInt(d.drauUpAmt)*100)+'%' : '-';
  const el = document.createElement('div');
  el.className = 'bid-popup';
  el.innerHTML = `
    <div class="bid-popup-header" style="background:${color};">
      <button class="bid-popup-close" onclick="if(window._bidPopup){window._bidPopup.setMap(null);window._bidPopup=null;}">×</button>
      <div class="bid-popup-type">${d._status} · ${d._typeGroup}</div>
      <div class="bid-popup-name">${d.cltrNm||d.pblancNm||'-'}</div>
    </div>
    <div class="bid-popup-body">
      <div class="bid-popup-row"><span class="bid-popup-label">주소</span><span class="bid-popup-val" style="font-size:9px;">${d.cltrAddr||'-'}</span></div>
      <div class="bid-popup-row"><span class="bid-popup-label">종류</span><span class="bid-popup-val">${d.realTyNm||'-'}</span></div>
      <div style="display:flex;gap:12px;margin:6px 0 4px;">
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:1px;">감정가</div>
          <div class="bid-popup-amt" style="color:#333;">${fmtAmt(d.drauUpAmt)}</div>
        </div>
        <div>
          <div style="font-size:9px;color:#999;margin-bottom:1px;">최저입찰가 (${ratio})</div>
          <div class="bid-popup-amt" style="color:${color};">${fmtAmt(d.minBdgAmt)}</div>
        </div>
      </div>
      <div class="bid-popup-row"><span class="bid-popup-label">입찰기간</span><span class="bid-popup-val">${fmtDt(d.bidBeginDt)} ~ ${fmtDt(d.bidEndDt)}</span></div>
      <div class="bid-popup-row"><span class="bid-popup-label">담당기관</span><span class="bid-popup-val">${d.cltrInsttNm||'-'}</span></div>
    </div>
    <div class="bid-popup-arrow" style="border-top-color:${color};"></div>`;
  window._bidPopup = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(d.lat, d.lng), content: el, yAnchor: 1.1, zIndex: 10 });
  window._bidPopup.setMap(map);
  bidPopupOv = window._bidPopup;
}

async function loadBidData() {
  const btn  = document.getElementById('bid-load-btn');
  const prog = document.getElementById('bid-progress');
  const apiKey = document.getElementById('api-key-input').value.trim();
  if (!apiKey) { alert('API 키를 먼저 입력해 주세요.'); return; }
  btn.disabled = true;
  prog.style.display = 'block';
  prog.textContent = '온비드 공매 데이터 요청 중...';

  try {
    let all = [], page = 1, total = 9999;
    while ((page-1)*100 < total) {
      // 온비드 공매공고 목록 (data.go.kr 경유)
      const url = `https://apis.data.go.kr/1160100/service/GetBidPblancListService/getBidPblancList?serviceKey=${apiKey}&sido=제주특별자치도&pageNo=${page}&numOfRows=100&_type=json`;
      const proxy = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      const res  = await fetch(proxy);
      const json = await res.json();
      let body;
      try { body = JSON.parse(json.contents)?.response?.body; } catch(e) { break; }
      if (!body) break;
      total = parseInt(body.totalCount) || 0;
      const items = body.items?.item || [];
      const arr = Array.isArray(items) ? items : (items ? [items] : []);
      arr.forEach(d => {
        d._status    = getBidStatusLabel(d);
        d._typeGroup = getBidTypeGroup(d.realTyNm);
        d.lat = null; d.lng = null;
      });
      all = all.concat(arr);
      prog.textContent = `수집 중... ${all.length}/${total}건`;
      page++;
      if (arr.length < 100) break;
    }

    if (!all.length) throw new Error('데이터 없음 — data.go.kr에서 "온비드공매물건정보조회서비스" 활용신청 필요');

    prog.textContent = `위경도 변환 중 (${all.length}건)...`;
    const addrMap = {};
    const uniq = [...new Set(all.map(d => d.cltrAddr).filter(Boolean))];
    await new Promise(resolve => {
      let i = 0;
      function next() {
        if (i >= uniq.length) { resolve(); return; }
        const addr = uniq[i++];
        geocoder.addressSearch(addr, (result, status) => {
          if (status === kakao.maps.services.Status.OK && result[0]) {
            addrMap[addr] = { lat: parseFloat(result[0].y), lng: parseFloat(result[0].x) };
          }
          setTimeout(next, 60);
        });
      }
      next();
    });

    all.forEach(d => {
      if (d.cltrAddr && addrMap[d.cltrAddr]) {
        d.lat = addrMap[d.cltrAddr].lat + (Math.random()-0.5)*0.001;
        d.lng = addrMap[d.cltrAddr].lng + (Math.random()-0.5)*0.001;
      }
    });

    window.BID_DATA = all.filter(d => d.lat && d.lng);
    document.getElementById('bid-cnt-badge').textContent = window.BID_DATA.length;
    prog.textContent = `✓ ${window.BID_DATA.length}건 로드 완료`;
    if (bidVisible) renderBidMarkers();
    showToast(`✓ 온비드 공매 ${window.BID_DATA.length}건 로드 완료`);
    setTimeout(() => { prog.style.display = 'none'; }, 3000);
  } catch(e) {
    prog.textContent = '⚠ ' + e.message;
    setTimeout(() => { prog.style.display = 'none'; btn.disabled = false; }, 6000);
    return;
  }
  btn.disabled = false;
}
