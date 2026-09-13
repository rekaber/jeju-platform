/* js/stats.js — 실거래 통계 (도·시·읍면동 계층 + A vs B 비교) */
var statTab = 'pyung';
var statYear = new Date().getFullYear();
var statCompare = false;
var statGeo = { sigungu: null, dong: null };           // 단일
var statGeoA = { sigungu: '제주시', dong: null };      // 비교 A
var statGeoB = { sigungu: '제주시', dong: null };      // 비교 B
var _statUiBound = false;

function _normDong(d) {
  return String(d || '').trim().replace(/\s+/g, '');
}
/** 원본 dong에서 읍·면·동만 사용 (리 제외) */
function _emdOf(dong) {
  const raw = String(dong || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const parts = raw.split(' ');
  if (parts.length >= 2 && /[읍면동]$/.test(parts[0])) return parts[0];
  return raw;
}
function _geoLabel(geo) {
  if (!geo || (!geo.sigungu && !geo.dong)) return '제주도 전체';
  if (geo.sigungu && !geo.dong) return geo.sigungu;
  return (geo.sigungu || '') + ' ' + (geo.dong || '');
}
function _geoEquals(a, b) {
  return (a && a.sigungu) === (b && b.sigungu) && _normDong(a && a.dong) === _normDong(b && b.dong);
}
function _filterByGeo(data, geo) {
  if (!geo || (!geo.sigungu && !geo.dong)) return data;
  return data.filter(t => {
    if (geo.sigungu && t.sigungu !== geo.sigungu) return false;
    if (geo.dong && _normDong(_emdOf(t.dong)) !== _normDong(geo.dong)) return false;
    return true;
  });
}
function _yearData() {
  if (!window.TRADE_DATA) return [];
  return window.TRADE_DATA.filter(t => t.date && t.date.startsWith(String(statYear)));
}
function _listDongs(yearData, sigungu) {
  const map = new Map();
  yearData.forEach(t => {
    if (sigungu && t.sigungu !== sigungu) return;
    const d = _emdOf(t.dong);
    if (!d) return;
    const key = (t.sigungu || '') + '|' + d;
    const cur = map.get(key) || { sigungu: t.sigungu || '', dong: d, count: 0 };
    cur.count++;
    map.set(key, cur);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.dong.localeCompare(b.dong, 'ko'));
}
function _pyungAvg(arr) {
  const valid = arr.filter(t => t.area && t.area > 0 && t.price > 0);
  if (!valid.length) return null;
  return Math.round(valid.reduce((s, t) => s + (t.price * 10000) / (t.area / 3.3058), 0) / valid.length);
}
function _priceAvg(arr) {
  return arr.length ? parseFloat((arr.reduce((s, t) => s + t.price, 0) / arr.length).toFixed(2)) : null;
}
function _maxPrice(arr) {
  return arr.length ? Math.max(...arr.map(t => t.price)) : null;
}

function _getStatYears() {
  if (!window.TRADE_DATA) return [String(new Date().getFullYear())];
  const years = [...new Set(window.TRADE_DATA.map(t => t.date && t.date.slice(0, 4)).filter(Boolean))].sort();
  return years.length ? years : [String(new Date().getFullYear())];
}
function _initStatYearSelect() {
  const sel = document.getElementById('stat-year-select');
  if (!sel) return;
  const years = _getStatYears();
  sel.innerHTML = years.map(y => `<option value="${y}"${String(statYear) === y ? ' selected' : ''}>${y}년</option>`).join('');
}
function setStatYear(y) {
  statYear = parseInt(y, 10);
  renderStatChart();
}

function openStatModal() {
  document.getElementById('stat-modal').classList.add('open');
  _initStatYearSelect();
  _bindStatGeoUi();
  renderStatChart();
}
function closeStatModal() {
  document.getElementById('stat-modal').classList.remove('open');
  const sr = document.getElementById('sm-geo-search-results');
  if (sr) sr.style.display = 'none';
}
function setStatTab(tab, btn) {
  statTab = tab;
  document.querySelectorAll('.sm-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderStatChart();
}

function _bindStatGeoUi() {
  if (_statUiBound) return;
  _statUiBound = true;
  const mode = document.getElementById('sm-mode-toggle');
  if (mode) {
    mode.querySelectorAll('.sm-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mode.querySelectorAll('.sm-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        statCompare = btn.dataset.mode === 'compare';
        if (statCompare) {
          if (!statGeoA.sigungu) statGeoA = { sigungu: '제주시', dong: null };
          if (!statGeoB.sigungu) {
            const dongs = _listDongs(_yearData(), '제주시');
            const pick = dongs.find(d => /읍$/.test(d.dong)) || dongs[0];
            statGeoB = pick
              ? { sigungu: pick.sigungu, dong: pick.dong }
              : { sigungu: '서귀포시', dong: null };
          }
        }
        renderStatChart();
      });
    });
  }
  const search = document.getElementById('sm-geo-search');
  if (search) {
    search.addEventListener('input', () => _renderStatSearchResults(search.value.trim()));
    search.addEventListener('focus', () => _renderStatSearchResults(search.value.trim()));
  }
  document.addEventListener('click', (e) => {
    const box = document.getElementById('sm-geo-search-results');
    const inp = document.getElementById('sm-geo-search');
    if (!box || !inp) return;
    if (e.target === inp || box.contains(e.target)) return;
    box.style.display = 'none';
  });
  ['sm-geo-a-si', 'sm-geo-a-dong', 'sm-geo-b-si', 'sm-geo-b-dong'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      _readCompareSelects();
      renderStatChart();
    });
  });
}

function _readCompareSelects() {
  const aSi = document.getElementById('sm-geo-a-si');
  const aDong = document.getElementById('sm-geo-a-dong');
  const bSi = document.getElementById('sm-geo-b-si');
  const bDong = document.getElementById('sm-geo-b-dong');
  if (!aSi || !bSi) return;
  statGeoA = {
    sigungu: aSi.value || null,
    dong: (aDong && aDong.value) ? aDong.value : null
  };
  statGeoB = {
    sigungu: bSi.value || null,
    dong: (bDong && bDong.value) ? bDong.value : null
  };
  if (!statGeoA.sigungu) { statGeoA.sigungu = null; statGeoA.dong = null; }
  if (!statGeoB.sigungu) { statGeoB.sigungu = null; statGeoB.dong = null; }
}

function _fillDongSelect(sel, yearData, sigungu, selectedDong) {
  if (!sel) return;
  const dongs = sigungu ? _listDongs(yearData, sigungu) : [];
  sel.innerHTML = `<option value="">시 전체</option>` +
    dongs.map(d => `<option value="${d.dong}"${_normDong(selectedDong) === d.dong ? ' selected' : ''}>${d.dong} (${d.count})</option>`).join('');
}

function _fillCompareSelects(yearData) {
  const aSi = document.getElementById('sm-geo-a-si');
  const bSi = document.getElementById('sm-geo-b-si');
  const opts = `
    <option value="">제주도 전체</option>
    <option value="제주시">제주시</option>
    <option value="서귀포시">서귀포시</option>`;
  if (aSi) {
    aSi.innerHTML = opts;
    aSi.value = statGeoA.sigungu || '';
  }
  if (bSi) {
    bSi.innerHTML = opts;
    bSi.value = statGeoB.sigungu || '';
  }
  _fillDongSelect(document.getElementById('sm-geo-a-dong'), yearData, statGeoA.sigungu, statGeoA.dong);
  _fillDongSelect(document.getElementById('sm-geo-b-dong'), yearData, statGeoB.sigungu, statGeoB.dong);
}

function _renderStatSearchResults(q) {
  const box = document.getElementById('sm-geo-search-results');
  if (!box) return;
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const yearData = _yearData();
  const hits = _listDongs(yearData, null)
    .filter(d => d.dong.includes(q) || (d.sigungu && d.sigungu.includes(q)))
    .slice(0, 20);
  if (!hits.length) {
    box.style.display = 'block';
    box.innerHTML = '<div style="padding:10px 12px;font-size:12px;color:#999;">검색 결과 없음</div>';
    return;
  }
  box.style.display = 'block';
  box.innerHTML = hits.map(d =>
    `<button type="button" data-si="${d.sigungu}" data-dong="${d.dong}">${d.sigungu} ${d.dong}<span style="color:#888;margin-left:6px;">${d.count}건</span></button>`
  ).join('');
  box.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      const geo = { sigungu: btn.dataset.si, dong: btn.dataset.dong };
      if (statCompare) {
        statGeoB = geo;
        if (!statGeoA.sigungu) statGeoA = { sigungu: geo.sigungu, dong: null };
      } else {
        statGeo = geo;
      }
      const inp = document.getElementById('sm-geo-search');
      if (inp) inp.value = '';
      box.style.display = 'none';
      renderStatChart();
    };
  });
}

function _renderStatBreadcrumb() {
  const el = document.getElementById('sm-breadcrumb');
  if (!el) return;
  const geo = statCompare ? null : statGeo;
  const parts = [];
  parts.push(`<button type="button" data-level="all">제주도</button>`);
  if (geo && geo.sigungu) {
    parts.push(`<span class="sm-bc-sep">›</span>`);
    if (geo.dong) {
      parts.push(`<button type="button" data-level="si" data-si="${geo.sigungu}">${geo.sigungu}</button>`);
      parts.push(`<span class="sm-bc-sep">›</span>`);
      parts.push(`<span class="sm-bc-cur">${geo.dong}</span>`);
    } else {
      parts.push(`<span class="sm-bc-cur">${geo.sigungu}</span>`);
    }
  } else if (!statCompare) {
    parts.push(`<span class="sm-bc-sep">›</span><span class="sm-bc-cur">전체</span>`);
  } else {
    parts.push(`<span class="sm-bc-sep">›</span><span class="sm-bc-cur">비교: ${_geoLabel(statGeoA)} vs ${_geoLabel(statGeoB)}</span>`);
  }
  el.innerHTML = parts.join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      if (statCompare) {
        statCompare = false;
        document.querySelectorAll('#sm-mode-toggle .sm-mode-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.mode === 'single');
        });
      }
      if (btn.dataset.level === 'all') statGeo = { sigungu: null, dong: null };
      else if (btn.dataset.level === 'si') statGeo = { sigungu: btn.dataset.si, dong: null };
      renderStatChart();
    };
  });
}

function _renderStatChips(yearData) {
  const el = document.getElementById('sm-geo-chips');
  if (!el) return;
  if (statCompare) {
    el.innerHTML = '';
    return;
  }
  let html = '';
  if (!statGeo.sigungu) {
    const jejuCnt = yearData.filter(t => t.sigungu === '제주시').length;
    const seoCnt = yearData.filter(t => t.sigungu === '서귀포시').length;
    html += `<button type="button" class="sm-geo-chip${!statGeo.sigungu ? ' active' : ''}" data-si="">제주도 전체<span class="sm-chip-cnt">${yearData.length}</span></button>`;
    html += `<button type="button" class="sm-geo-chip" data-si="제주시">제주시<span class="sm-chip-cnt">${jejuCnt}</span></button>`;
    html += `<button type="button" class="sm-geo-chip" data-si="서귀포시">서귀포시<span class="sm-chip-cnt">${seoCnt}</span></button>`;
  } else {
    html += `<button type="button" class="sm-geo-chip${!statGeo.dong ? ' active' : ''}" data-si="${statGeo.sigungu}" data-dong="">${statGeo.sigungu} 전체</button>`;
    _listDongs(yearData, statGeo.sigungu).slice(0, 40).forEach(d => {
      const on = _normDong(statGeo.dong) === d.dong ? ' active' : '';
      html += `<button type="button" class="sm-geo-chip${on}" data-si="${d.sigungu}" data-dong="${d.dong}">${d.dong}<span class="sm-chip-cnt">${d.count}</span></button>`;
    });
  }
  el.innerHTML = html;
  el.querySelectorAll('.sm-geo-chip').forEach(btn => {
    btn.onclick = () => {
      const si = btn.dataset.si || null;
      const dong = btn.dataset.dong || null;
      if (!si) statGeo = { sigungu: null, dong: null };
      else statGeo = { sigungu: si, dong: dong || null };
      renderStatChart();
    };
  });
}

function _metricOf(arr) {
  if (statTab === 'pyung') return _pyungAvg(arr);
  if (statTab === 'total') return _priceAvg(arr);
  return arr.length;
}
function _fmtMetric(v) {
  if (v == null) return '-';
  if (statTab === 'pyung') return Math.round(v).toLocaleString() + '만';
  if (statTab === 'total') return Number(v).toFixed(2) + '억';
  return Math.round(v).toLocaleString() + '건';
}
function _yUnit() {
  if (statTab === 'pyung') return '만원/평';
  if (statTab === 'total') return '억원';
  return '건';
}

function renderStatChart() {
  const svg = document.getElementById('stat-chart-main');
  const sm = document.getElementById('sm-summary');
  const legend = document.getElementById('sm-legend');
  const note = document.getElementById('sm-geo-note');
  const cmpRow = document.getElementById('sm-compare-row');
  if (!svg || !sm) return;

  if (!window.TRADE_DATA || !window.TRADE_DATA.length) {
    svg.innerHTML = '<text x="420" y="150" text-anchor="middle" font-size="14" fill="#ccc">데이터 없음</text>';
    return;
  }

  const yearData = _yearData();
  if (cmpRow) cmpRow.style.display = statCompare ? 'flex' : 'none';
  if (statCompare) _fillCompareSelects(yearData);
  _renderStatBreadcrumb();
  _renderStatChips(yearData);

  const series = [];
  if (statCompare) {
    series.push({ geo: statGeoA, color: '#1976D2', label: _geoLabel(statGeoA) });
    series.push({ geo: statGeoB, color: '#E65100', label: _geoLabel(statGeoB) });
  } else if (!statGeo.sigungu) {
    series.push({ geo: { sigungu: '제주시', dong: null }, color: '#1976D2', label: '제주시' });
    series.push({ geo: { sigungu: '서귀포시', dong: null }, color: '#E65100', label: '서귀포시' });
  } else {
    const color = statGeo.sigungu === '서귀포시' ? '#E65100' : '#1976D2';
    series.push({ geo: { ...statGeo }, color, label: _geoLabel(statGeo) });
  }

  const seriesData = series.map(s => {
    const rows = _filterByGeo(yearData, s.geo);
    return Object.assign({}, s, { rows });
  });

  // KPI
  if (statCompare || seriesData.length === 2) {
    const a = seriesData[0], b = seriesData[1];
    const aM = _metricOf(a.rows), bM = _metricOf(b.rows);
    let diffHtml = '-';
    if (aM != null && bM != null && aM !== 0 && statTab !== 'count') {
      const pct = ((bM - aM) / aM) * 100;
      diffHtml = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    } else if (statTab === 'count') {
      diffHtml = ((b.rows.length - a.rows.length) >= 0 ? '+' : '') + (b.rows.length - a.rows.length) + '건';
    }
    sm.innerHTML = `
      <div class="sm-kpi"><div class="kpi-val">${_fmtMetric(aM)}</div><div class="kpi-lbl">A ${_geoLabel(a.geo)}</div></div>
      <div class="sm-kpi kpi-seo"><div class="kpi-val">${_fmtMetric(bM)}</div><div class="kpi-lbl">B ${_geoLabel(b.geo)}</div></div>
      <div class="sm-kpi"><div class="kpi-val">${diffHtml}</div><div class="kpi-lbl">차이 (B 대비 A)</div></div>
      <div class="sm-kpi"><div class="kpi-val">${a.rows.length.toLocaleString()} / ${b.rows.length.toLocaleString()}</div><div class="kpi-lbl">건수 A / B</div></div>`;
  } else {
    const r = seriesData[0].rows;
    const color = seriesData[0].geo.sigungu === '서귀포시' ? 'kpi-seo' : '';
    sm.innerHTML = `
      <div class="sm-kpi ${color}"><div class="kpi-val">${r.length.toLocaleString()}건</div><div class="kpi-lbl">${_geoLabel(seriesData[0].geo)} 총 거래</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(_pyungAvg(r) || 0).toLocaleString()}만</div><div class="kpi-lbl">평균 평형당 단가</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(_priceAvg(r) || 0).toFixed(2)}억</div><div class="kpi-lbl">평균 거래금액</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(_maxPrice(r) || 0).toFixed(1)}억</div><div class="kpi-lbl">최고 거래금액</div></div>`;
  }

  // 소표본 안내
  if (note) {
    const warns = seriesData.filter(s => s.rows.length > 0 && s.rows.length < 5)
      .map(s => `${_geoLabel(s.geo)} ${s.rows.length}건`);
    note.textContent = warns.length
      ? '※ 표본 부족: ' + warns.join(', ') + ' — 단가 해석에 주의하세요.'
      : '';
  }

  // 월 시계열
  const now = new Date();
  const lastMonth = (statYear === now.getFullYear()) ? now.getMonth() : 11;
  const months = [];
  for (let mo = 0; mo <= lastMonth; mo++) {
    const key = statYear + '-' + String(mo + 1).padStart(2, '0');
    const lbl = (mo + 1) + '월';
    const yearLbl = mo === 0 ? String(statYear) : '';
    const vals = seriesData.map(s => {
      const mrows = s.rows.filter(t => t.date && t.date.startsWith(key));
      return _metricOf(mrows);
    });
    const any = seriesData.some(s => s.rows.some(t => t.date && t.date.startsWith(key)));
    if (!any && !statCompare) continue;
    months.push({ key, lbl, yearLbl, vals, allCnt: yearData.filter(t => t.date && t.date.startsWith(key)).length });
  }

  const lines = seriesData.map((s, i) => ({
    vals: months.map(m => m.vals[i]),
    color: s.color,
    label: s.label
  }));

  const allVals = lines.flatMap(l => l.vals).filter(v => v != null && v > 0);
  if (!months.length || !allVals.length) {
    svg.innerHTML = '<text x="420" y="150" text-anchor="middle" font-size="14" fill="#ccc">데이터 없음</text>';
    if (legend) legend.innerHTML = '';
    return;
  }

  const isCount = statTab === 'count';
  const W = 840, H = 300, padL = 62, padB = 44, padR = 50, padT = 20;
  const cW = W - padL - padR, cH = H - padT - padB;
  const n = months.length;
  const maxV = Math.max(...allVals);
  const minV = isCount ? 0 : Math.max(0, Math.min(...allVals) * 0.88);
  const xStep = n > 1 ? cW / (n - 1) : 0;
  const toY = v => (v == null ? null : padT + cH - ((v - minV) / (maxV - minV || 1)) * cH);
  const toX = i => padL + i * xStep;

  let grids = '', yLabels = '';
  for (let i = 0; i <= 5; i++) {
    const v = minV + (maxV - minV) * i / 5;
    const y = padT + cH - cH * i / 5;
    grids += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${W - padR}" y2="${y.toFixed(1)}" stroke="${i === 0 ? '#bbb' : '#e8ecf0'}" stroke-width="${i === 0 ? 1.5 : 1}"/>`;
    yLabels += `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${_fmtMetric(v)}</text>`;
  }

  let chartContent = '';
  lines.forEach(line => {
    const pts = line.vals.map((v, i) => (v != null && (isCount || v > 0)) ? { x: toX(i), y: toY(isCount ? v : v), v, i } : null).filter(Boolean);
    if (!pts.length) return;
    if (pts.length === 1) {
      const p = pts[0];
      chartContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${_fmtMetric(p.v)}</text>`;
      return;
    }
    const pathD = pts.map((p, j) => (j === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const areaD = pathD + ` L${pts[pts.length - 1].x.toFixed(1)},${(padT + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + cH).toFixed(1)} Z`;
    const gid = 'sg' + line.color.replace('#', '') + (line.label || '').length;
    chartContent += `
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${line.color}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${line.color}" stop-opacity="0.01"/>
      </linearGradient></defs>
      <path d="${areaD}" fill="url(#${gid})"/>
      <path d="${pathD}" fill="none" stroke="${line.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"><title>${months[p.i].lbl}: ${_fmtMetric(p.v)}</title></circle>`).join('')}
      ${pts.map(p => `<text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${_fmtMetric(p.v)}</text>`).join('')}`;
  });

  const xLabels = months.map((m, i) => `
    <text x="${toX(i).toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="11" fill="#666" font-weight="600">${m.lbl}</text>
    ${m.yearLbl ? `<text x="${toX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#aaa">${m.yearLbl}</text>` : ''}
  `).join('');

  let hoverRects = '';
  months.forEach((m, i) => {
    const x = i === 0 ? padL : toX(i) - xStep / 2;
    const w = (i === 0 || i === n - 1) ? xStep / 2 : xStep;
    const vals = lines.map(l => `${l.label}: ${_fmtMetric(l.vals[i])}`).join('\n');
    const tip = `${m.key}\n${vals}`;
    hoverRects += `<rect x="${x.toFixed(1)}" y="${padT}" width="${Math.min(w, cW).toFixed(1)}" height="${cH + 8}" fill="transparent" class="stat-hover" data-tip="${tip.replace(/"/g, '&quot;')}"/>`;
  });

  svg.innerHTML = `
    <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
    ${grids}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#bbb" stroke-width="1.5"/>
    ${yLabels}
    <text x="14" y="${(padT + cH / 2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,14,${(padT + cH / 2).toFixed(1)})">${_yUnit()}</text>
    ${chartContent}${xLabels}${hoverRects}`;

  if (legend) {
    legend.innerHTML = lines.map(l => `<span><i style="background:${l.color}"></i>${l.label}</span>`).join('');
  }

  const tooltip = document.getElementById('stat-tooltip');
  if (tooltip) {
    svg.querySelectorAll('.stat-hover').forEach(r => {
      r.addEventListener('mousemove', e => {
        tooltip.innerHTML = r.dataset.tip.replace(/\n/g, '<br>');
        tooltip.style.display = 'block';
        tooltip.style.left = (e.clientX + 14) + 'px';
        tooltip.style.top = (e.clientY - 50) + 'px';
      });
      r.addEventListener('mouseleave', () => { tooltip.style.display = 'none'; });
    });
  }
}

// 하위 호환: 옛 지역 버튼 API
function setStatRegion(region) {
  if (region === 'all') statGeo = { sigungu: null, dong: null };
  else if (region === 'jeju') statGeo = { sigungu: '제주시', dong: null };
  else if (region === 'seo') statGeo = { sigungu: '서귀포시', dong: null };
  statCompare = false;
  renderStatChart();
}

document.getElementById('stat-modal').addEventListener('click', function (e) {
  if (e.target === this) closeStatModal();
});
document.getElementById('land-stat-modal').addEventListener('click', function (e) {
  if (e.target === this) closeLandStatModal();
});
