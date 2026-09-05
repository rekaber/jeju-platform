/* js/trade-layers.js - extracted from index.html */
/* ════════════════════════════════════════════════════════
   PER-TYPE TRADE SYSTEM (아파트·단독/다가구·연립·상업용)
════════════════════════════════════════════════════════ */

// UI 타입 키 → MULTI_DATA 키 매핑
var _typeToDataKey = { apt:'apt', house:'house', rht:'rht', comm:'offi' };

// 타입별 색상·레이블
var _typeMeta = {
  apt:  { color:'#1976D2', label:'아파트' },
  house:{ color:'#00695C', label:'단독/다가구' },
  rht:  { color:'#E65100', label:'연립/다세대' },
  comm: { color:'#7B1FA2', label:'상업용' }
};

// 타입별 상태 — 활성화 시 기본 기간은 주간
window._typeState = {};
['apt','house','rht','comm'].forEach(function(t) {
  window._typeState[t] = { visible:false, period:'week', month:'all', bubbleVisible:false, bubblePeriod:'week', bubbleMonth:'all' };
});

// 타입별 마커 오버레이 배열
window._typeOverlays = { apt:[], house:[], rht:[], comm:[] };

/** 실거래 기간 ↔ 지역별 건수 기간 UI/상태 동기화 */
function _syncPeriodButtons(type, period, source) {
  var st = window._typeState[type];
  var needle = ",'" + period + "',";
  if (source !== 'trade') {
    st.period = period;
    if (period !== 'pick') st.month = 'all';
    var row = document.getElementById('trade-filter-row-' + type);
    if (row) {
      row.querySelectorAll('.trade-filter-btn').forEach(function(b) {
        b.classList.toggle('active', (b.getAttribute('onclick') || '').indexOf(needle) >= 0);
      });
    }
    var tp = document.getElementById('trade-month-picker-' + type);
    if (tp) tp.style.display = (period === 'pick' && st.visible) ? 'block' : 'none';
  }
  if (source !== 'bubble') {
    st.bubblePeriod = period;
    if (period !== 'pick') st.bubbleMonth = 'all';
    var wrap = document.getElementById('bubble-period-wrap-' + type);
    if (wrap) {
      wrap.querySelectorAll('.trade-filter-btn').forEach(function(b) {
        b.classList.toggle('active', (b.getAttribute('onclick') || '').indexOf(needle) >= 0);
      });
    }
    var bp = document.getElementById('bubble-month-picker-' + type);
    if (bp) bp.style.display = (period === 'pick') ? 'block' : 'none';
  }
}

function _getTypeData(type) {
  var key = _typeToDataKey[type];
  return (window.MULTI_DATA && window.MULTI_DATA[key]) ? window.MULTI_DATA[key] : [];
}

function _getFilteredForType(type) {
  var data = _getTypeData(type);
  if (!data.length) return [];
  var st = window._typeState[type];
  var now = new Date();
  if (st.month !== 'all') {
    var ym = st.month;
    return data.filter(function(t) { return t.date && t.date.replace(/-/g,'').slice(0,6) === ym; });
  }
  var cutoff;
  switch(st.period) {
    case 'week':  cutoff = new Date(now - 7*86400000); break;
    case 'month': cutoff = new Date(now - 30*86400000); break;
    case 'year':  cutoff = new Date(now.getFullYear(), 0, 1); break;
    case 'pick':  // 월선택 > 전체: 당해년도만
      return data.filter(function(t) { return t.date && t.date.startsWith(String(now.getFullYear())); });
    default:      return data;
  }
  return data.filter(function(t) { return t.date && new Date(t.date) >= cutoff; });
}

function clearTradeMarkersForType(type) {
  // 배열을 교체하지 않고 비움 — 진행 중 청크가 옛 배열에 마커를 쌓아 고아 마커가 되는 것 방지
  if (!window._typeOverlays[type]) window._typeOverlays[type] = [];
  var arr = window._typeOverlays[type];
  arr.forEach(function(o) { try { o.setMap(null); } catch(_){} });
  arr.length = 0;
  // 진행 중 렌더 취소
  if (!window._typeRenderToken) window._typeRenderToken = {};
  window._typeRenderToken[type] = (window._typeRenderToken[type] || 0) + 1;
}

// ── 픽셀 거리 기반 클러스터링 ──────────────────────────
function _clusterTrades(trades, gridPx) {
  if (!window.map && typeof map === 'undefined') return trades.map(function(t){ return { type:'single', trade:t }; });
  var proj = map.getProjection();
  var cells = {};
  trades.forEach(function(t) {
    if (!t.lat || !t.lng || !isInJeju(t.lat, t.lng)) return;
    var pt = proj.pointFromCoords(new kakao.maps.LatLng(t.lat, t.lng));
    var cx = Math.floor(pt.x / gridPx);
    var cy = Math.floor(pt.y / gridPx);
    var key = cx + '_' + cy;
    if (!cells[key]) cells[key] = { trades:[], lat:0, lng:0, cnt:0 };
    cells[key].trades.push(t);
    cells[key].lat += t.lat; cells[key].lng += t.lng; cells[key].cnt++;
  });
  return Object.values(cells).map(function(c) {
    return c.cnt === 1
      ? { type:'single', trade:c.trades[0] }
      : { type:'cluster', lat:c.lat/c.cnt, lng:c.lng/c.cnt, cnt:c.cnt, trades:c.trades };
  });
}

function renderTradeMarkersForType(type) {
  clearTradeMarkersForType(type);
  var meta = _typeMeta[type];
  var trades = _getFilteredForType(type);
  var badge = document.getElementById('trade-badge-' + type);
  if (badge) setTradeBadge(type, _getTypeData(type).length, trades.length);

  var statusEl = document.getElementById('trade-render-status');
  if (!statusEl) {
    statusEl = document.createElement('div');
    statusEl.id = 'trade-render-status';
    statusEl.style.cssText = 'position:fixed;bottom:16px;left:50%;transform:translateX(-50%);background:rgba(25,118,210,0.88);color:#fff;font-size:13px;padding:6px 18px;border-radius:20px;z-index:9999;pointer-events:none;';
    document.body.appendChild(statusEl);
  }
  statusEl.style.display = 'block';

  if (!trades.length) { statusEl.style.display = 'none'; return; }
  if (typeof map === 'undefined' || !map) { statusEl.style.display = 'none'; return; }

  // 줌 레벨 3 이하에서만 클러스터링 적용 (그 외는 개별 마커)
  var zoomLv = map.getLevel();
  var gridPx = zoomLv <= 3 ? 80 : 0;
  var items = gridPx > 0 ? _clusterTrades(trades, gridPx) : trades.map(function(t){ return { type:'single', trade:t }; });

  var CHUNK = 200, i = 0;
  if (!window._typeRenderToken) window._typeRenderToken = {};
  var token = ++window._typeRenderToken[type];
  var overlays = window._typeOverlays[type];

  function renderChunk() {
    if (token !== window._typeRenderToken[type]) { statusEl.style.display = 'none'; return; }
    var end = Math.min(i + CHUNK, items.length);
    for (; i < end; i++) {
      var item = items[i];
      var el, ov;
      if (item.type === 'cluster') {
        var avgPrice = item.trades.reduce(function(s,t){return s+t.price;},0)/item.cnt;
        var bgColor = avgPrice < 3 ? '#2E7D32' : avgPrice < 6 ? '#E65100' : '#B71C1C';
        el = document.createElement('div');
        el.className = 'trade-cluster';
        el.style.cssText = 'background:'+bgColor+';border-left:3px solid '+meta.color+';';
        el.innerHTML = '<div class="tc-cnt">'+item.cnt+'건</div><div class="tc-lbl">·'+avgPrice.toFixed(1)+'억</div>';
        el.title = meta.label+' '+item.cnt+'건 (평균 '+avgPrice.toFixed(1)+'억)';
        el.addEventListener('click', (function(lat,lng){ return function(e){
          e.stopPropagation();
          map.setCenter(new kakao.maps.LatLng(lat,lng));
          map.setLevel(Math.max(1, map.getLevel()-3));
        }; })(item.lat, item.lng));
        ov = new kakao.maps.CustomOverlay({ position:new kakao.maps.LatLng(item.lat,item.lng), content:el, yAnchor:0.5, zIndex:4 });
      } else {
        var t = item.trade;
        if (!t.lat || !t.lng || !isInJeju(t.lat, t.lng)) continue;
        var cls = t.price < 3 ? 'price-low' : t.price < 6 ? 'price-mid' : 'price-high';
        el = document.createElement('div');
        el.className = 'trade-marker ' + cls;
        el.style.borderLeft = '3px solid ' + meta.color;
        var dateShort = t.date ? t.date.slice(2).replace(/-/g, '.') : '';
        el.innerHTML = '<div class="tm-name">'+(t.name||t.dong||'')+'</div><div class="tm-price">'+t.price.toFixed(1)+'억</div><div class="tm-sub">'+(t.area?Math.round(t.area)+'㎡':'')+' '+dateShort+'</div>';
        el.addEventListener('click', (function(td){ return function(e){ e.stopPropagation(); showTradePopup(td); }; })(t));
        ov = new kakao.maps.CustomOverlay({ position:new kakao.maps.LatLng(t.lat,t.lng), content:el, yAnchor:1.35, zIndex:3 });
      }
      ov.setMap(map);
      overlays.push(ov);
    }
    if (i < items.length) {
      statusEl.textContent = meta.label + ' 마커 로딩… ' + i + ' / ' + items.length;
      setTimeout(renderChunk, 0);
    } else {
      statusEl.style.display = 'none';
    }
  }
  statusEl.textContent = meta.label + ' 마커 로딩…';
  setTimeout(renderChunk, 0);
}

function renderTradeChartForType(type) {
  var meta = _typeMeta[type];
  var svg = document.getElementById('trade-chart-svg-' + type);
  if (!svg) return;
  var data = _getTypeData(type);
  if (!data.length) { svg.innerHTML = ''; return; }

  var now = new Date();
  var months = [];
  var curYear = now.getFullYear();
  var curMonth = now.getMonth(); // 0-indexed
  for (var m = 0; m <= curMonth; m++) {
    var key = curYear + '-' + String(m+1).padStart(2,'0');
    var label = (m+1) + '월';
    var tradesM = data.filter(function(t) { return t.date && t.date.startsWith(key); });
    var validM = tradesM.filter(function(t){return t.price && t.area && t.area > 0;});
    // 만원/평 = (억*10000) / (㎡/3.3058) — 소표본 왜곡 완화로 중앙값 사용
    var avg = null;
    if (validM.length) {
      var list = validM.map(function(t) {
        return t.price * 10000 / (t.area / 3.3058);
      }).sort(function(a, b) { return a - b; });
      var mid = Math.floor(list.length / 2);
      avg = Math.round(list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2);
    }
    months.push({ label:label, avg:avg, n: validM.length });
  }

  var vals = months.map(function(m){ return m.avg || 0; });
  var maxV = Math.max.apply(null, vals.concat([1]));
  var posVals = vals.filter(function(v){ return v > 0; });
  var minV = posVals.length ? Math.min.apply(null, posVals) : maxV;
  // Y축 여유: 최소·최대가 붙지 않도록
  var yMin = Math.max(0, minV * 0.92);
  var yMax = maxV * 1.05;
  if (yMax <= yMin) yMax = yMin + 1;

  var W = 228, H = 80, padL = 34, padB = 16, padR = 6, padT = 6;
  var cW = W - padL - padR, cH = H - padT - padB;
  var xStep = months.length > 1 ? cW / (months.length - 1) : 0;

  // 월 인덱스 기준 좌표 (데이터 없는 달은 선에서 끊김)
  var points = [];
  months.forEach(function(mo, i) {
    var x = padL + i * xStep;
    if (mo.avg == null) return;
    var y = padT + cH - ((mo.avg - yMin) / (yMax - yMin)) * cH;
    points.push({ x:x, y:y, label:mo.label, avg:mo.avg, n:mo.n, i:i });
  });
  if (!points.length) { svg.innerHTML = ''; return; }

  var pathD = points.map(function(p, i) {
    return (i === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1);
  }).join(' ');
  var last = points[points.length - 1], first = points[0];
  var areaD = pathD + ' L' + last.x.toFixed(1) + ',' + (padT + cH).toFixed(1)
    + ' L' + first.x.toFixed(1) + ',' + (padT + cH).toFixed(1) + ' Z';
  var c = meta.color;
  var gradId = 'tradeGrad_' + type;
  var yPos = [padT + cH, padT + cH / 2, padT];

  // 만원/평 → 읽기 쉬운 라벨 (0.7천만 잘림 방지)
  function _ppLbl(v) {
    if (v >= 1000) return (v / 1000).toFixed(1).replace(/\.0$/, '') + '천만';
    return Math.round(v) + '만';
  }
  var yLbls = [_ppLbl(yMin), _ppLbl((yMin + yMax) / 2), _ppLbl(yMax)];

  // X축: 월 격자 기준 라벨 (포인트 인덱스가 아닌 달력 월)
  var xLabels = [];
  months.forEach(function(mo, i) {
    if (i % 3 === 0 || i === months.length - 1) {
      var x = padL + i * xStep;
      xLabels.push('<text x="' + x.toFixed(1) + '" y="' + H + '" text-anchor="middle" font-size="7" fill="#aaa">' + mo.label + '</text>');
    }
  });

  svg.innerHTML =
    '<defs><linearGradient id="' + gradId + '" x1="0" y1="0" x2="0" y2="1">' +
    '<stop offset="0%" stop-color="' + c + '" stop-opacity="0.25"/>' +
    '<stop offset="100%" stop-color="' + c + '" stop-opacity="0"/></linearGradient></defs>' +
    yPos.map(function(y) {
      return '<line x1="' + padL + '" y1="' + y.toFixed(1) + '" x2="' + (W - padR) + '" y2="' + y.toFixed(1) + '" stroke="#eee" stroke-width="1"/>';
    }).join('') +
    '<path d="' + areaD + '" fill="url(#' + gradId + ')"/>' +
    '<path d="' + pathD + '" fill="none" stroke="' + c + '" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>' +
    points.map(function(p) {
      var title = p.label + ' 중앙값 ' + _ppLbl(p.avg) + '/평 · ' + p.n + '건';
      return '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="2.5" fill="' + c + '" stroke="#fff" stroke-width="1.2"><title>' + title + '</title></circle>';
    }).join('') +
    yLbls.map(function(l, i) {
      return '<text x="' + (padL - 2) + '" y="' + (yPos[i] + 3).toFixed(1) + '" text-anchor="end" font-size="7" fill="#aaa">' + l + '</text>';
    }).join('') +
    xLabels.join('');
}

function _syncGlobalTradeData() {
  // 활성 타입들의 데이터를 합산하여 window.TRADE_DATA 동기화 (TOP5 랭킹 등 공통 참조용)
  var merged = [];
  ['apt','house','rht','comm'].forEach(function(t) {
    if (window._typeState[t].visible) merged = merged.concat(_getTypeData(t));
  });
  window.TRADE_DATA = merged.length ? merged : (window.MULTI_DATA && window.MULTI_DATA.apt ? window.MULTI_DATA.apt : window.TRADE_DATA);
}

function toggleTradeType(type, btn) {
  var st = window._typeState[type];
  st.visible = btn.classList.toggle('on');
  var filterRow = document.getElementById('trade-filter-row-'+type);
  if (filterRow) {
    filterRow.style.opacity = st.visible ? '1' : '0.4';
    filterRow.style.pointerEvents = st.visible ? 'auto' : 'none';
  }
  var picker = document.getElementById('trade-month-picker-'+type);
  if (picker && !st.visible) picker.style.display = 'none';
  var chartWrap = document.getElementById('trade-chart-wrap-'+type);
  if (st.visible) {
    // 켤 때마다 기본 기간 = 주간
    st.period = 'week';
    st.month = 'all';
    st.bubblePeriod = 'week';
    st.bubbleMonth = 'all';
    _syncPeriodButtons(type, 'week', 'both');
    if (picker) picker.style.display = 'none';
    renderTradeMarkersForType(type);
    renderTradeChartForType(type);
    if (chartWrap) chartWrap.style.display = 'block';
    if (st.bubbleVisible) _renderCombinedBubbles();
  } else {
    clearTradeMarkersForType(type);
    setTradeBadge(type, _getTypeData(type).length);
    if (chartWrap) chartWrap.style.display = 'none';
  }
  _syncGlobalTradeData();
  if (typeof computeRankCache === 'function') { window._rankCache = null; computeRankCache(); }
  updateActiveLayerCount();
  if (typeof renderAreaRank === 'function') renderAreaRank();
}

function setTradeTypePeriod(type, period, btn) {
  var st = window._typeState[type];
  st.period = period;
  var row = document.getElementById('trade-filter-row-'+type);
  if (row) row.querySelectorAll('.trade-filter-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var picker = document.getElementById('trade-month-picker-'+type);
  if (picker) {
    var show = (period === 'pick' && st.visible);
    picker.style.display = show ? 'block' : 'none';
    picker.style.opacity = st.visible ? '1' : '0.4';
    picker.style.pointerEvents = st.visible ? 'auto' : 'none';
  }
  if (period !== 'pick') st.month = 'all';
  // 지역별 건수 기간도 동일하게 맞춤 (표시·집계 불일치 방지)
  _syncPeriodButtons(type, period, 'trade');
  if (st.visible) { renderTradeMarkersForType(type); renderTradeChartForType(type); }
  if (st.bubbleVisible) _renderCombinedBubbles();
}

function setTradeTypeMonth(type, month, btn) {
  var st = window._typeState[type];
  st.month = month;
  var picker = document.getElementById('trade-month-picker-'+type);
  if (picker) picker.querySelectorAll('.tmp-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  // 월 선택 시 버블도 동일 월로
  st.bubblePeriod = 'pick';
  st.bubbleMonth = month;
  var bPicker = document.getElementById('bubble-month-picker-'+type);
  if (bPicker) {
    bPicker.style.display = 'block';
    bPicker.querySelectorAll('.tmp-btn').forEach(function(b){b.classList.remove('active');});
    var match = bPicker.querySelector('[onclick*="\'' + month + '\'"]');
    if (match) match.classList.add('active');
  }
  var bWrap = document.getElementById('bubble-period-wrap-'+type);
  if (bWrap) {
    bWrap.querySelectorAll('.trade-filter-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'pick'") >= 0);
    });
  }
  if (st.visible) { renderTradeMarkersForType(type); renderTradeChartForType(type); }
  if (st.bubbleVisible) _renderCombinedBubbles();
}

function toggleBubbleForType(type, btn) {
  var st = window._typeState[type];
  st.bubbleVisible = btn.classList.toggle('on');
  var wrap = document.getElementById('bubble-period-wrap-'+type);
  if (wrap) wrap.style.display = st.bubbleVisible ? 'block' : 'none';
  if (!st.bubbleVisible) {
    var bb = document.getElementById('bubble-badge-' + type);
    if (bb) bb.textContent = '0건';
  } else {
    // 켤 때마다 기본 기간 = 주간
    st.period = 'week';
    st.month = 'all';
    st.bubblePeriod = 'week';
    st.bubbleMonth = 'all';
    _syncPeriodButtons(type, 'week', 'both');
    var tp = document.getElementById('trade-month-picker-' + type);
    if (tp) tp.style.display = 'none';
    var bp = document.getElementById('bubble-month-picker-' + type);
    if (bp) bp.style.display = 'none';
    if (st.visible) { renderTradeMarkersForType(type); renderTradeChartForType(type); }
  }
  var anyBubble = ['apt','house','rht','comm'].some(function(t){return window._typeState[t].bubbleVisible;});
  var mlBubble = document.getElementById('ml-bubble');
  if (mlBubble) mlBubble.style.display = anyBubble ? 'block' : 'none';
  updateActiveLayerCount();
  _renderCombinedBubbles();
}

function setBubblePeriodForType(type, period, btn) {
  var st = window._typeState[type];
  st.bubblePeriod = period;
  var wrap = document.getElementById('bubble-period-wrap-'+type);
  if (wrap) wrap.querySelectorAll('.trade-filter-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  var picker = document.getElementById('bubble-month-picker-'+type);
  if (picker) picker.style.display = (period === 'pick') ? 'block' : 'none';
  if (period !== 'pick') st.bubbleMonth = 'all';
  // 실거래 내역 기간도 동일하게 맞춤
  _syncPeriodButtons(type, period, 'bubble');
  if (st.visible) { renderTradeMarkersForType(type); renderTradeChartForType(type); }
  _renderCombinedBubbles();
}

function setBubbleMonthForType(type, month, btn) {
  window._typeState[type].bubbleMonth = month;
  window._typeState[type].bubblePeriod = 'pick';
  var picker = document.getElementById('bubble-month-picker-'+type);
  if (picker) picker.querySelectorAll('.tmp-btn').forEach(function(b){b.classList.remove('active');});
  btn.classList.add('active');
  // 실거래도 동일 월
  var st = window._typeState[type];
  st.period = 'pick';
  st.month = month;
  var tPicker = document.getElementById('trade-month-picker-'+type);
  if (tPicker) {
    tPicker.style.display = st.visible ? 'block' : 'none';
    tPicker.querySelectorAll('.tmp-btn').forEach(function(b){b.classList.remove('active');});
    var match = tPicker.querySelector('[onclick*="\'' + month + '\'"]');
    if (match) match.classList.add('active');
  }
  var row = document.getElementById('trade-filter-row-'+type);
  if (row) {
    row.querySelectorAll('.trade-filter-btn').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('onclick') && b.getAttribute('onclick').indexOf("'pick'") >= 0);
    });
  }
  if (st.visible) { renderTradeMarkersForType(type); renderTradeChartForType(type); }
  _renderCombinedBubbles();
}

function _getBubbleFilteredForType(type) {
  var data = _getTypeData(type);
  if (!data.length) return [];
  var st = window._typeState[type];
  var now = new Date();
  if (st.bubblePeriod === 'pick') {
    if (st.bubbleMonth && st.bubbleMonth !== 'all') {
      var ym = st.bubbleMonth;
      return data.filter(function(t){ return t.date && t.date.replace(/-/g,'').slice(0,6) === ym; });
    }
    return data.filter(function(t){ return t.date && new Date(t.date).getFullYear() === now.getFullYear(); });
  }
  var cutoff;
  switch(st.bubblePeriod) {
    case 'week':  cutoff = new Date(now - 7*86400000); break;
    case 'month': cutoff = new Date(now - 30*86400000); break;
    case 'year':  cutoff = new Date(now.getFullYear(), 0, 1); break;
    default: return data;
  }
  return data.filter(function(t){ return t.date && new Date(t.date) >= cutoff; });
}

function _renderCombinedBubbles() {
  // 실거래 OFF인 타입의 고아 마커 정리
  ['apt','house','rht','comm'].forEach(function(t) {
    if (!window._typeState[t].visible) clearTradeMarkersForType(t);
  });
  clearBubbles();
  var anyBubble = ['apt','house','rht','comm'].some(function(t){return window._typeState[t].bubbleVisible;});
  if (!anyBubble) return;
  var merged = [];
  var labelParts = [];
  ['apt','house','rht','comm'].forEach(function(type) {
    if (!window._typeState[type].bubbleVisible) return;
    merged = merged.concat(_getBubbleFilteredForType(type));
    var st = window._typeState[type];
    if (st.bubblePeriod === 'pick' && st.bubbleMonth && st.bubbleMonth !== 'all') {
      labelParts.push(st.bubbleMonth.slice(0,4) + '년 ' + parseInt(st.bubbleMonth.slice(4), 10) + '월');
    } else if (st.bubblePeriod === 'week') labelParts.push('최근 7일');
    else if (st.bubblePeriod === 'month') labelParts.push('최근 30일');
    else labelParts.push(new Date().getFullYear() + '년');
  });
  var periodLabel = labelParts[0] || '';
  // 이미 기간 필터된 merged를 그대로 그림 (구 bubblePeriod로 재필터하지 않음)
  if (typeof renderBubbles === 'function') renderBubbles(merged, periodLabel);
  ['apt','house','rht','comm'].forEach(function(t) {
    var bb = document.getElementById('bubble-badge-' + t);
    if (!bb) return;
    var cnt = window._typeState[t].bubbleVisible ? _getBubbleFilteredForType(t).length : 0;
    bb.textContent = cnt + '건';
  });
}

var _statTypeLabels = { apt:'🏢 아파트', house:'🏠 단독/다가구', rht:'🏘 연립/다세대', comm:'🏬 상업용' };
function openStatModalForType(type) {
  var data = _getTypeData(type);
  if (data.length) window.TRADE_DATA = data;
  var titleEl = document.getElementById('stat-modal-title');
  if (titleEl) titleEl.textContent = '제주 ' + (_statTypeLabels[type]||'') + ' 실거래 통계';
  openStatModal();
}

window._tradePopupOverlay = null;

function showBubbleDetail(stat, trades) {
  var modal = document.getElementById('bubble-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bubble-detail-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:1100;';
    modal.innerHTML = '<div id="bubble-detail-inner" style="background:#F8FAFB;border-radius:12px;width:min(680px,96vw);max-height:80vh;overflow:auto;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);box-shadow:0 12px 40px rgba(0,0,0,0.3);"></div>';
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.style.display='none'; });
    document.body.appendChild(modal);
  }
  var sigShort = (stat.sigungu||'').replace('특별자치도','').replace('특별자치시','');
  var sorted = trades.slice().sort(function(a,b){ return new Date(b.date) - new Date(a.date); });
  var rows = sorted.map(function(t) {
    var pyeong = t.area ? (t.area/3.3058) : 0;
    var pp = pyeong>0 ? Math.round(t.price*10000/pyeong).toLocaleString()+'만/평' : '-';
    var typeLabel = t._typeLabel || t.type || '아파트';
    return '<tr style="border-bottom:1px solid #eee;">' +
      '<td style="padding:6px 8px;font-size:12px;color:#333;">'+(t.date||'-')+'</td>' +
      '<td style="padding:6px 8px;font-size:12px;font-weight:600;white-space:nowrap;">'+(t.name||t.dong||'-')+'</td>' +
      '<td style="padding:6px 8px;font-size:12px;color:#1565C0;font-weight:700;">'+t.price.toFixed(1)+'억</td>' +
      '<td style="padding:6px 8px;font-size:11px;color:#666;">'+(t.area?Math.round(t.area)+'㎡':'-')+'</td>' +
      '<td style="padding:6px 8px;font-size:11px;color:#666;">'+pp+'</td>' +
      '<td style="padding:6px 8px;font-size:11px;color:#888;">'+typeLabel+'</td>' +
      '</tr>';
  }).join('');
  document.getElementById('bubble-detail-inner').innerHTML =
    '<div style="background:linear-gradient(135deg,#1F4E79,#2E75B6);color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="font-size:15px;font-weight:700;">📍 '+sigShort+' '+stat.dong+'</div>' +
      '<div style="font-size:12px;opacity:0.85;margin-top:2px;">총 '+stat.count+'건 · 평균 '+(stat.totalPrice/stat.count).toFixed(1)+'억</div></div>' +
      '<button onclick="document.getElementById(\'bubble-detail-modal\').style.display=\'none\';" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:18px;cursor:pointer;border-radius:50%;width:28px;height:28px;">✕</button>' +
    '</div>' +
    '<div style="padding:12px 16px;overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#f0f4f8;">' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">날짜</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">단지명</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">금액</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">면적</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">평당가</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">유형</th>' +
        '</tr></thead>' +
        '<tbody>'+rows+'</tbody>' +
      '</table>' +
    '</div>';
  modal.style.display = 'block';
}

function showLandBubbleDetail(stat, trades) {
  var modal = document.getElementById('bubble-detail-modal');
  if (!modal) {
    modal = document.createElement('div');
    modal.id = 'bubble-detail-modal';
    modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.35);z-index:1100;';
    modal.innerHTML = '<div id="bubble-detail-inner" style="background:#F8FAFB;border-radius:12px;width:min(680px,96vw);max-height:80vh;overflow:auto;position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);box-shadow:0 12px 40px rgba(0,0,0,0.3);"></div>';
    modal.addEventListener('click', function(e){ if(e.target===modal) modal.style.display='none'; });
    document.body.appendChild(modal);
  }
  var sorted = trades.slice().sort(function(a,b){ return (b.date||'').localeCompare(a.date||''); });
  var sigShort = (stat.sigungu||'').replace('제주특별자치도 ','').replace('특별자치도','');
  var avgPerM2 = stat.m2cnt > 0 ? Math.round(stat.totalPerM2 / stat.m2cnt) : 0;
  var rows = sorted.map(function(t) {
    var pm2 = t.perM2 ? Math.round(t.perM2).toLocaleString()+'만/㎡' : '-';
    var price = typeof t.price === 'number' ? t.price.toFixed(1)+'억' : (t.price||'-');
    return '<tr style="border-bottom:1px solid #eee;">' +
      '<td style="padding:6px 8px;font-size:12px;color:#333;">'+(t.date||'-')+'</td>' +
      '<td style="padding:6px 8px;font-size:12px;font-weight:600;white-space:nowrap;">'+(t.jimok||'-')+'</td>' +
      '<td style="padding:6px 8px;font-size:12px;color:#5D4037;font-weight:700;">'+price+'</td>' +
      '<td style="padding:6px 8px;font-size:11px;color:#666;">'+(t.area?Math.round(t.area)+'㎡':'-')+'</td>' +
      '<td style="padding:6px 8px;font-size:11px;color:#666;">'+pm2+'</td>' +
      '<td style="padding:6px 8px;font-size:11px;color:#888;">'+(t.yongdo||'-')+'</td>' +
      '</tr>';
  }).join('');
  document.getElementById('bubble-detail-inner').innerHTML =
    '<div style="background:linear-gradient(135deg,#4E342E,#795548);color:#fff;padding:14px 18px;border-radius:12px 12px 0 0;display:flex;justify-content:space-between;align-items:center;">' +
      '<div><div style="font-size:15px;font-weight:700;">📍 '+sigShort+' '+stat.dong+'</div>' +
      '<div style="font-size:12px;opacity:0.85;margin-top:2px;">총 '+stat.count+'건 · 평균 '+avgPerM2.toLocaleString()+'만/㎡</div></div>' +
      '<button onclick="document.getElementById(\'bubble-detail-modal\').style.display=\'none\';" style="background:rgba(255,255,255,0.2);border:none;color:#fff;font-size:18px;cursor:pointer;border-radius:50%;width:28px;height:28px;">✕</button>' +
    '</div>' +
    '<div style="padding:12px 16px;overflow-x:auto;">' +
      '<table style="width:100%;border-collapse:collapse;">' +
        '<thead><tr style="background:#f0f4f8;">' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">날짜</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">지목</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">금액</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">면적</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">㎡당가</th>' +
          '<th style="padding:6px 8px;font-size:11px;text-align:left;color:#555;">용도지역</th>' +
        '</tr></thead>' +
        '<tbody>'+rows+'</tbody>' +
      '</table>' +
    '</div>';
  modal.style.display = 'block';
}

function showTradePopup(t) {
  // 기존 팝업 제거
  if (window._tradePopupOverlay) { window._tradePopupOverlay.setMap(null); window._tradePopupOverlay = null; }

  const pyeong = t.area ? (t.area / 3.3) : 0;
  const ppStr  = pyeong > 0 ? ` · ${Math.round(t.price * 10000 / pyeong).toLocaleString()}만/평` : '';

  const content = document.createElement('div');
  content.className = 'trade-popup-ov';
  content.innerHTML = `
    <button class="tp-close" onclick="if(window._tradePopupOverlay){window._tradePopupOverlay.setMap(null);window._tradePopupOverlay=null;}">×</button>
    <div class="tp-name">${t.name}</div>
    <div class="tp-addr">${t.addr}</div>
    <div class="tp-price">${t.price}억원${ppStr}</div>
    <div class="tp-meta">${t._typeLabel || t.type || '아파트'}${t.building_use ? ' · ' + t.building_use : ''}${t.building_type ? '(' + t.building_type + ')' : ''} · ${t.area ? Math.round(t.area) + '㎡' : '-'} · ${t.date || '-'}</div>
    <div class="tp-arrow"></div>
  `;

  window._tradePopupOverlay = new kakao.maps.CustomOverlay({
    position: new kakao.maps.LatLng(t.lat, t.lng),
    content:  content,
    yAnchor:  1.18,
    zIndex:   10
  });
  window._tradePopupOverlay.setMap(map);
}

/* ═══ 지역별 평균 거래가 TOP 5 ═══ */
var arPeriod = 'year';

function setArPeriod(period, btn) {
  arPeriod = period;
  document.querySelectorAll('.ar-period-btn').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderAreaRank();
}

function filterByPeriod(data) {
  const now = new Date();
  if (arPeriod === 'week') {
    const cutoff = new Date(now - 7 * 86400000);
    return data.filter(t => t.date && new Date(t.date) >= cutoff);
  } else if (arPeriod === 'month') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
    return data.filter(t => t.date && new Date(t.date) >= cutoff);
  }
  // 연간: 올해
  return data.filter(t => t.date && t.date.startsWith(String(now.getFullYear())));
}

/* ──────────────────────────────────────────────
   순위 캐시: 데이터 로드 시 1회만 계산, 이후엔 읽기만
   ────────────────────────────────────────────── */
function computeRankCache() {
  const raw = window.TRADE_DATA || [];
  if (!raw.length) { window._rankCache = null; return; }

  const now = new Date();
  const periods = {
    year:  raw.filter(t => t.date && t.date.startsWith(String(now.getFullYear()))),
    month: raw.filter(t => {
      if (!t.date) return false;
      const cutoff = new Date(now.getFullYear(), now.getMonth() - 1, now.getDate());
      return new Date(t.date) >= cutoff;
    }),
    week:  raw.filter(t => {
      if (!t.date) return false;
      return new Date(t.date) >= new Date(now - 7 * 86400000);
    })
  };

  const buildTop5 = (data) => {
    const byDong = {};
    data.forEach(t => {
      const key = t.dong || '기타';
      const pyeong = t.area ? t.area / 3.3 : 0;
      const perPyeong = (pyeong > 0) ? (t.price * 10000 / pyeong) : 0; // 만원/평
      if (!byDong[key]) byDong[key] = { ppSum: 0, ppCnt: 0, maxPP: 0, cnt: 0 };
      byDong[key].cnt++;
      if (perPyeong > byDong[key].maxPP) byDong[key].maxPP = perPyeong;
      if (perPyeong > 0) { byDong[key].ppSum += perPyeong; byDong[key].ppCnt++; }
    });
    return Object.entries(byDong)
      .filter(([, s]) => s.ppCnt > 0)
      .map(([dong, s]) => ({ dong, avg: s.ppSum / s.ppCnt, max: s.maxPP, cnt: s.cnt }))
      .sort((a, b) => b.avg - a.avg)
      .slice(0, 5);
  };

  window._rankCache = {
    year:  buildTop5(periods.year),
    month: buildTop5(periods.month),
    week:  buildTop5(periods.week)
  };
}

function updateInfoPanelApt() {
  var data = (window.MULTI_DATA && window.MULTI_DATA.apt) ? window.MULTI_DATA.apt : (window.TRADE_DATA || []);
  if (!data.length) {
    var priceEl0 = document.getElementById('ip-apt-price');
    var countEl0 = document.getElementById('ip-apt-count');
    var detailEl0 = document.getElementById('ip-apt-detail');
    if (priceEl0) priceEl0.textContent = '-';
    if (countEl0) countEl0.textContent = '-';
    if (detailEl0) detailEl0.textContent = '데이터 없음';
    return;
  }
  var now = new Date();
  var curYear = String(now.getFullYear());
  var yearData = data.filter(function(t){ return t.date && t.date.startsWith(curYear); });
  if (!yearData.length) yearData = data;

  var total = yearData.length;
  var jejuData = yearData.filter(function(t){ return t.sigungu === '제주시'; });
  var seoData  = yearData.filter(function(t){ return t.sigungu === '서귀포시'; });

  function avgPrice(arr) {
    if (!arr.length) return null;
    return arr.reduce(function(s,t){ return s+t.price; }, 0) / arr.length;
  }
  var totalAvg = avgPrice(yearData);
  var jejuAvg  = avgPrice(jejuData);
  var seoAvg   = avgPrice(seoData);

  var priceEl  = document.getElementById('ip-apt-price');
  var countEl  = document.getElementById('ip-apt-count');
  var detailEl = document.getElementById('ip-apt-detail');

  if (priceEl)  priceEl.textContent  = totalAvg ? totalAvg.toFixed(2) + '억' : '-';
  if (countEl)  countEl.textContent  = total.toLocaleString() + '건';
  if (detailEl) {
    var jejuTxt = jejuAvg  ? '제주시 ' + jejuAvg.toFixed(2)  + '억·' + jejuData.length.toLocaleString() + '건' : '';
    var seoTxt  = seoAvg   ? '서귀포시 ' + seoAvg.toFixed(2) + '억·' + seoData.length.toLocaleString() + '건'  : '';
    detailEl.textContent = [jejuTxt, seoTxt].filter(Boolean).join(' · ');
  }

  // 라벨 년도도 업데이트
  var lblEl = document.querySelector('#ip-apt-price')?.closest('.stat-chip')?.querySelector('.sc-lbl');
  if (lblEl) lblEl.textContent = '아파트 평균매매가 / 실거래 건수 (' + curYear + '년)';
}

function renderAreaRank() {
  if (!window.TRADE_DATA || !window.TRADE_DATA.length) return;
  if (!window._rankCache) computeRankCache();

  const top5 = (window._rankCache && window._rankCache[arPeriod]) || [];
  const list  = document.getElementById('area-rank-list');
  if (!list) return;

  if (!top5.length) {
    list.innerHTML = `<div style="color:#7dd3c8;font-size:10px;text-align:center;padding:8px;opacity:0.6">해당 기간 데이터 없음</div>`;
    return;
  }

  list.innerHTML = top5.map((d, i) => `
    <div class="rank-row" onclick="focusDong('${d.dong}')">
      <span class="r-rank">${i + 1}</span>
      <div class="rank-row-inner">
        <div class="rank-row-name">${d.dong}</div>
        <div class="rank-row-stats">
          <span class="rank-row-avg">평균 ${Math.round(d.avg).toLocaleString()}만/평</span>
          <span class="rank-row-max">최고 ${Math.round(d.max).toLocaleString()}만/평</span>
        </div>
      </div>
    </div>
  `).join('');
}

/* ═══ 동 클릭 → 지도 이동 + 거래 목록 팝업 ═══ */
var dongPopupOverlay = null;

function focusDong(dongName) {
  // JEJU_BEOPJEONGDONG에서 좌표 찾기
  const bjData = window.JEJU_BEOPJEONGDONG || [];
  const bjInfo = bjData.find(b => b.dong === dongName);

  // 해당 동 거래 목록 — TOP 5와 동일한 기간 필터 적용
  const allDong = (window.TRADE_DATA || []).filter(t => t.dong === dongName);
  const trades  = filterByPeriod(allDong).sort((a, b) => b.price - a.price);

  if (!trades.length) return;

  // 지도 이동 — BJ 정확 매칭 → 부분 매칭 → 유효 거래 좌표 순
  let lat, lng;
  const bjExact   = bjData.find(b => b.dong === dongName);
  const bjPartial = !bjExact && bjData.find(b => dongName.includes(b.dong) || b.dong.includes(dongName));
  if (bjExact || bjPartial) {
    const bj = bjExact || bjPartial;
    lat = bj.lat; lng = bj.lng;
  } else {
    const withCoords = trades.filter(t => t.lat && t.lng);
    if (withCoords.length) {
      lat = withCoords.reduce((s, t) => s + t.lat, 0) / withCoords.length;
      lng = withCoords.reduce((s, t) => s + t.lng, 0) / withCoords.length;
    }
  }
  if (lat && lng) {
    map.setCenter(new kakao.maps.LatLng(lat, lng));
    map.setLevel(5);
  }

  // 팝업 표시
  const popup   = document.getElementById('dong-popup');
  const title   = document.getElementById('dong-popup-title');
  const summary = document.getElementById('dong-popup-summary');
  const listEl  = document.getElementById('dong-popup-list');

  const avg = trades.reduce((s, t) => s + t.price, 0) / trades.length;
  const periodLabel = {year:'연간', month:'월간', week:'주간'}[arPeriod] || '';
  title.textContent   = `📍 ${dongName} (${periodLabel})`;
  summary.innerHTML   = `평균 <strong>${avg.toFixed(2)}억</strong> · 총 <strong>${trades.length}건</strong>`;
  window._dongTrades = trades; // 인덱스 참조용 캐시
  listEl.innerHTML = trades.slice(0, 20).map((t, i) => `
    <div class="dong-popup-item" onclick="showTradePinOnMap(${i})">
      <span class="dpi-name">${t.name}</span>
      <span class="dpi-area">${t.area ? t.area.toFixed(0) + '㎡' : ''}</span>
      <span class="dpi-price">${t.price.toFixed(2)}억</span>
    </div>
  `).join('');

  // 패널 우측 상단 위치
  const panel = document.getElementById('info-panel');
  const rect  = panel.getBoundingClientRect();
  popup.style.display  = 'flex';
  popup.style.right    = (window.innerWidth - rect.left + 8) + 'px';
  popup.style.top      = (rect.top + 40) + 'px';
  popup.style.left     = '';
}

function closeDongPopup() {
  document.getElementById('dong-popup').style.display = 'none';
}

function showTradePinOnMap(idx) {
  const t = (window._dongTrades || [])[idx];
  if (!t) return;

  let lat = t.lat, lng = t.lng;

  // 좌표 없으면 동 좌표로 폴백
  if (!lat || !lng) {
    const bjData = window.JEJU_BEOPJEONGDONG || [];
    const bj = bjData.find(b => b.dong === t.dong)
             || bjData.find(b => (t.dong||'').includes(b.dong) || (b.dong||'').includes(t.dong));
    if (bj) { lat = bj.lat; lng = bj.lng; }
  }

  // 좌표 없으면 Kakao 지오코더로 실시간 조회
  if (!lat || !lng) {
    if (t.roadAddr || t.addr) {
      const gc = new kakao.maps.services.Geocoder();
      gc.addressSearch(t.roadAddr || t.addr, function(result, status) {
        if (status === kakao.maps.services.Status.OK && result[0]) {
          t.lat = parseFloat(result[0].y);
          t.lng = parseFloat(result[0].x);
          map.setCenter(new kakao.maps.LatLng(t.lat, t.lng));
          map.setLevel(3);
          showTradePopup(t);
        }
      });
    }
    return;
  }

  map.setCenter(new kakao.maps.LatLng(lat, lng));
  map.setLevel(3);
  // popup용 임시 좌표 주입
  const tWithCoords = Object.assign({}, t, { lat, lng });
  showTradePopup(tWithCoords);
}

function renderTradeChart() {
  const svg = document.getElementById('trade-chart-svg');
  const months = [];
  const now = new Date();
  for (let m = 11; m >= 0; m--) {
    const d = new Date(now);
    d.setMonth(d.getMonth() - m);
    const key = d.toISOString().slice(0,7);
    const label = (d.getMonth()+1) + '월';
    const trades = window.TRADE_DATA.filter(t => t.date.startsWith(key));
    const avg = trades.length ? (trades.reduce((s,t)=>s+t.price,0)/trades.length) : null;
    months.push({ label, avg });
  }
  const vals = months.map(m => m.avg || 0);
  const maxV = Math.max(...vals, 1);
  const minV = Math.min(...vals.filter(v=>v>0), maxV);
  const W = 228, H = 80, padL = 22, padB = 16, padR = 6, padT = 6;
  const cW = W - padL - padR, cH = H - padT - padB;
  const xStep = cW / (months.length - 1);

  const points = months.map((m, i) => {
    const x = padL + i * xStep;
    const y = m.avg ? padT + cH - ((m.avg - minV + 0.5) / (maxV - minV + 1)) * cH : null;
    return { x, y, label: m.label, avg: m.avg };
  }).filter(p => p.y !== null);

  const pathD = points.map((p,i) => (i===0?'M':'L') + p.x.toFixed(1)+','+p.y.toFixed(1)).join(' ');
  const areaD = pathD + ` L${points[points.length-1].x.toFixed(1)},${(padT+cH).toFixed(1)} L${points[0].x.toFixed(1)},${(padT+cH).toFixed(1)} Z`;

  // Y축 labels
  const yLabels = [minV.toFixed(1), ((minV+maxV)/2).toFixed(1), maxV.toFixed(1)];
  const yPositions = [padT+cH, padT+cH/2, padT];

  svg.innerHTML = `
    <defs>
      <linearGradient id="tradeGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#1976D2" stop-opacity="0.25"/>
        <stop offset="100%" stop-color="#1976D2" stop-opacity="0"/>
      </linearGradient>
    </defs>
    <!-- grid -->
    ${yPositions.map(y=>`<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W-padR}" y2="${y.toFixed(1)}" stroke="#eee" stroke-width="1"/>`).join('')}
    <!-- area -->
    <path d="${areaD}" fill="url(#tradeGrad)"/>
    <!-- line -->
    <path d="${pathD}" fill="none" stroke="#1976D2" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/>
    <!-- dots -->
    ${points.map(p=>`<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.5" fill="#1976D2" stroke="#fff" stroke-width="1.2"/>`).join('')}
    <!-- Y axis labels -->
    ${yLabels.map((l,i)=>`<text x="${padL-2}" y="${(yPositions[i]+3).toFixed(1)}" text-anchor="end" font-size="7" fill="#aaa">${l}</text>`).join('')}
    <!-- X axis labels (every 3 months) -->
    ${points.filter((_,i)=>i%3===0||i===points.length-1).map(p=>`<text x="${p.x.toFixed(1)}" y="${H}" text-anchor="middle" font-size="7" fill="#aaa">${p.label}</text>`).join('')}
  `;
}
