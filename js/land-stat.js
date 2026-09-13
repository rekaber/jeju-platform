/* js/land-stat.js — 토지 실거래 통계 (도·시·읍면동 계층 + A vs B 비교) */
var landStatTab = 'perm2';
var landStatJimok = 'all';
var landStatYear = new Date().getFullYear();
var landStatCompare = false;
var landStatGeo = { sigungu: null, dong: null };   // dong = 읍·면·동 (리 미사용)
var landStatGeoA = { sigungu: '제주시', dong: null };
var landStatGeoB = { sigungu: '제주시', dong: null };
var _landStatUiBound = false;

function _lNorm(s) { return String(s || '').trim().replace(/\s+/g, ''); }
/** 원본 dong(예: "한림읍 상대리")에서 읍·면·동만 추출 */
function _lEmdOf(dong) {
  const raw = String(dong || '').trim().replace(/\s+/g, ' ');
  if (!raw) return '';
  const parts = raw.split(' ');
  if (parts.length >= 2 && /[읍면동]$/.test(parts[0])) return parts[0];
  return raw;
}
function _lGeoLabel(geo) {
  if (!geo || (!geo.sigungu && !geo.dong)) return '제주도 전체';
  if (geo.sigungu && !geo.dong) return geo.sigungu;
  return (geo.sigungu || '') + ' ' + (geo.dong || '');
}
function _lFilterByGeo(data, geo) {
  if (!geo || (!geo.sigungu && !geo.dong)) return data;
  return data.filter(t => {
    if (geo.sigungu && t.sigungu !== geo.sigungu) return false;
    if (!geo.dong) return true;
    return _lNorm(_lEmdOf(t.dong)) === _lNorm(geo.dong);
  });
}
function _lYearBase() {
  if (!window.LAND_DATA) return [];
  const yearFiltered = window.LAND_DATA.filter(r => r.date && r.date.startsWith(String(landStatYear)));
  return _lFilterJimok(yearFiltered);
}
function _lFilterJimok(arr) {
  if (typeof FARM_JIMOK === 'undefined') {
    window.FARM_JIMOK = ['전', '답', '과수원'];
  }
  if (landStatJimok === 'all') return arr;
  if (landStatJimok === 'dae') return arr.filter(r => r.jimok === '대' || r.jimok === '대지');
  if (landStatJimok === 'farm') return arr.filter(r => FARM_JIMOK.includes(r.jimok));
  if (landStatJimok === 'imya') return arr.filter(r => r.jimok === '임야');
  return arr.filter(r => !['대', '대지', '임야', ...FARM_JIMOK].includes(r.jimok));
}
function _lListEmd(yearData, sigungu) {
  const map = new Map();
  yearData.forEach(t => {
    if (sigungu && t.sigungu !== sigungu) return;
    const emd = _lEmdOf(t.dong);
    if (!emd) return;
    const key = (t.sigungu || '') + '|' + emd;
    const cur = map.get(key) || { sigungu: t.sigungu || '', dong: emd, count: 0 };
    cur.count++;
    map.set(key, cur);
  });
  return [...map.values()].sort((a, b) => b.count - a.count || a.dong.localeCompare(b.dong, 'ko'));
}
function _lPerm2Avg(arr) {
  const v = arr.filter(r => r.perM2 > 0);
  return v.length ? Math.round(v.reduce((s, r) => s + r.perM2, 0) / v.length) : null;
}
function _lPriceAvg(arr) {
  return arr.length ? parseFloat((arr.reduce((s, r) => s + r.price, 0) / arr.length).toFixed(2)) : null;
}
function _lMaxPrice(arr) {
  return arr.length ? Math.max(...arr.map(r => r.price)) : null;
}

function _initLandStatYearSelect() {
  const sel = document.getElementById('land-stat-year-select');
  if (!sel || !window.LAND_DATA) return;
  const years = [...new Set(window.LAND_DATA.map(t => t.date && t.date.slice(0, 4)).filter(Boolean))].sort();
  const list = years.length ? years : [String(new Date().getFullYear())];
  sel.innerHTML = list.map(y => `<option value="${y}"${String(landStatYear) === y ? ' selected' : ''}>${y}년</option>`).join('');
}
function setLandStatYear(y) {
  landStatYear = parseInt(y, 10);
  renderLandStatChart();
}

function openLandStatModal() {
  document.getElementById('land-stat-modal').classList.add('open');
  _initLandStatYearSelect();
  _bindLandStatGeoUi();
  renderLandStatChart();
}
function closeLandStatModal() {
  document.getElementById('land-stat-modal').classList.remove('open');
  const sr = document.getElementById('lsm-geo-search-results');
  if (sr) sr.style.display = 'none';
}
function setLandStatTab(tab, btn) {
  landStatTab = tab;
  document.querySelectorAll('.lsm-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLandStatChart();
}
function setLandStatJimok(jimok, btn) {
  landStatJimok = jimok;
  document.querySelectorAll('.lsm-jimok-tab').forEach(b => b.classList.remove('active'));
  if (btn) btn.classList.add('active');
  renderLandStatChart();
}
function setLandStatRegion(region) {
  if (region === 'all') landStatGeo = { sigungu: null, dong: null };
  else if (region === 'jeju') landStatGeo = { sigungu: '제주시', dong: null };
  else if (region === 'seo') landStatGeo = { sigungu: '서귀포시', dong: null };
  landStatCompare = false;
  renderLandStatChart();
}

function _bindLandStatGeoUi() {
  if (_landStatUiBound) return;
  _landStatUiBound = true;
  const mode = document.getElementById('lsm-mode-toggle');
  if (mode) {
    mode.querySelectorAll('.sm-mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        mode.querySelectorAll('.sm-mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        landStatCompare = btn.dataset.mode === 'compare';
        if (landStatCompare) {
          if (!landStatGeoA.sigungu) landStatGeoA = { sigungu: '제주시', dong: null };
          if (!landStatGeoB.sigungu) {
            const dongs = _lListEmd(_lYearBase(), '제주시');
            const pick = dongs.find(d => /읍$/.test(d.dong)) || dongs[0];
            landStatGeoB = pick
              ? { sigungu: pick.sigungu, dong: pick.dong }
              : { sigungu: '서귀포시', dong: null };
          }
        }
        renderLandStatChart();
      });
    });
  }
  const search = document.getElementById('lsm-geo-search');
  if (search) {
    search.addEventListener('input', () => _renderLandSearchResults(search.value.trim()));
    search.addEventListener('focus', () => _renderLandSearchResults(search.value.trim()));
  }
  document.addEventListener('click', (e) => {
    const box = document.getElementById('lsm-geo-search-results');
    const inp = document.getElementById('lsm-geo-search');
    if (!box || !inp) return;
    if (e.target === inp || box.contains(e.target)) return;
    box.style.display = 'none';
  });
  ['lsm-geo-a-si', 'lsm-geo-a-dong', 'lsm-geo-b-si', 'lsm-geo-b-dong'].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => {
      _readLandCompareSelects();
      renderLandStatChart();
    });
  });
}

function _readLandCompareSelects() {
  const aSi = document.getElementById('lsm-geo-a-si');
  const aDong = document.getElementById('lsm-geo-a-dong');
  const bSi = document.getElementById('lsm-geo-b-si');
  const bDong = document.getElementById('lsm-geo-b-dong');
  if (!aSi || !bSi) return;
  landStatGeoA = {
    sigungu: aSi.value || null,
    dong: (aDong && aDong.value) ? aDong.value : null
  };
  landStatGeoB = {
    sigungu: bSi.value || null,
    dong: (bDong && bDong.value) ? bDong.value : null
  };
  if (!landStatGeoA.sigungu) { landStatGeoA.sigungu = null; landStatGeoA.dong = null; }
  if (!landStatGeoB.sigungu) { landStatGeoB.sigungu = null; landStatGeoB.dong = null; }
}

function _fillLandDongSelect(sel, yearData, sigungu, selectedDong) {
  if (!sel) return;
  const dongs = sigungu ? _lListEmd(yearData, sigungu) : [];
  sel.innerHTML = `<option value="">시 전체</option>` +
    dongs.map(d => `<option value="${d.dong}"${_lNorm(selectedDong) === _lNorm(d.dong) ? ' selected' : ''}>${d.dong} (${d.count})</option>`).join('');
}

function _fillLandCompareSelects(yearData) {
  const aSi = document.getElementById('lsm-geo-a-si');
  const bSi = document.getElementById('lsm-geo-b-si');
  const opts = `
    <option value="">제주도 전체</option>
    <option value="제주시">제주시</option>
    <option value="서귀포시">서귀포시</option>`;
  if (aSi) { aSi.innerHTML = opts; aSi.value = landStatGeoA.sigungu || ''; }
  if (bSi) { bSi.innerHTML = opts; bSi.value = landStatGeoB.sigungu || ''; }
  _fillLandDongSelect(document.getElementById('lsm-geo-a-dong'), yearData, landStatGeoA.sigungu, landStatGeoA.dong);
  _fillLandDongSelect(document.getElementById('lsm-geo-b-dong'), yearData, landStatGeoB.sigungu, landStatGeoB.dong);
}

function _renderLandSearchResults(q) {
  const box = document.getElementById('lsm-geo-search-results');
  if (!box) return;
  if (!q) { box.style.display = 'none'; box.innerHTML = ''; return; }
  const yearData = _lYearBase();
  // 읍·면·동만 검색 (리 단위는 상위 읍·면으로 합산)
  const hits = _lListEmd(yearData, null)
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
      const geo = { sigungu: btn.dataset.si, dong: btn.dataset.dong || null };
      if (landStatCompare) {
        landStatGeoB = geo;
        if (!landStatGeoA.sigungu) landStatGeoA = { sigungu: geo.sigungu, dong: null };
      } else {
        landStatGeo = geo;
      }
      const inp = document.getElementById('lsm-geo-search');
      if (inp) inp.value = '';
      box.style.display = 'none';
      renderLandStatChart();
    };
  });
}

function _renderLandBreadcrumb() {
  const el = document.getElementById('lsm-breadcrumb');
  if (!el) return;
  const geo = landStatCompare ? null : landStatGeo;
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
  } else if (!landStatCompare) {
    parts.push(`<span class="sm-bc-sep">›</span><span class="sm-bc-cur">전체</span>`);
  } else {
    parts.push(`<span class="sm-bc-sep">›</span><span class="sm-bc-cur">비교: ${_lGeoLabel(landStatGeoA)} vs ${_lGeoLabel(landStatGeoB)}</span>`);
  }
  el.innerHTML = parts.join('');
  el.querySelectorAll('button').forEach(btn => {
    btn.onclick = () => {
      if (landStatCompare) {
        landStatCompare = false;
        document.querySelectorAll('#lsm-mode-toggle .sm-mode-btn').forEach(b => {
          b.classList.toggle('active', b.dataset.mode === 'single');
        });
      }
      if (btn.dataset.level === 'all') landStatGeo = { sigungu: null, dong: null };
      else if (btn.dataset.level === 'si') landStatGeo = { sigungu: btn.dataset.si, dong: null };
      renderLandStatChart();
    };
  });
}

function _renderLandChips(yearData) {
  const el = document.getElementById('lsm-geo-chips');
  if (!el) return;
  if (landStatCompare) { el.innerHTML = ''; return; }
  let html = '';
  if (!landStatGeo.sigungu) {
    const jejuCnt = yearData.filter(t => t.sigungu === '제주시').length;
    const seoCnt = yearData.filter(t => t.sigungu === '서귀포시').length;
    html += `<button type="button" class="sm-geo-chip active" data-si="">제주도 전체<span class="sm-chip-cnt">${yearData.length}</span></button>`;
    html += `<button type="button" class="sm-geo-chip" data-si="제주시">제주시<span class="sm-chip-cnt">${jejuCnt}</span></button>`;
    html += `<button type="button" class="sm-geo-chip" data-si="서귀포시">서귀포시<span class="sm-chip-cnt">${seoCnt}</span></button>`;
  } else {
    html += `<button type="button" class="sm-geo-chip${!landStatGeo.dong ? ' active' : ''}" data-si="${landStatGeo.sigungu}" data-dong="">${landStatGeo.sigungu} 전체</button>`;
    _lListEmd(yearData, landStatGeo.sigungu).slice(0, 40).forEach(d => {
      const on = _lNorm(landStatGeo.dong) === _lNorm(d.dong) ? ' active' : '';
      html += `<button type="button" class="sm-geo-chip${on}" data-si="${d.sigungu}" data-dong="${d.dong}">${d.dong}<span class="sm-chip-cnt">${d.count}</span></button>`;
    });
  }
  el.innerHTML = html;
  el.querySelectorAll('.sm-geo-chip').forEach(btn => {
    btn.onclick = () => {
      const si = btn.dataset.si || null;
      const dong = btn.dataset.dong || null;
      if (!si) landStatGeo = { sigungu: null, dong: null };
      else landStatGeo = { sigungu: si, dong: dong || null };
      renderLandStatChart();
    };
  });
}

function _lMetricOf(arr) {
  if (landStatTab === 'perm2') return _lPerm2Avg(arr);
  if (landStatTab === 'total') return _lPriceAvg(arr);
  return arr.length;
}
function _lFmtMetric(v) {
  if (v == null) return '-';
  if (landStatTab === 'perm2') return Math.round(v).toLocaleString() + '만';
  if (landStatTab === 'total') return Number(v).toFixed(2) + '억';
  return Math.round(v).toLocaleString() + '건';
}
function _lYUnit() {
  if (landStatTab === 'perm2') return '만원/㎡';
  if (landStatTab === 'total') return '억원';
  return '건';
}

function renderLandStatChart() {
  const svg = document.getElementById('land-stat-chart-main');
  const sm = document.getElementById('lsm-summary');
  const legend = document.getElementById('lsm-legend');
  const note = document.getElementById('lsm-geo-note');
  const cmpRow = document.getElementById('lsm-compare-row');
  if (!svg || !sm) return;

  if (!window.LAND_DATA || !window.LAND_DATA.length) {
    svg.innerHTML = '<text x="420" y="150" text-anchor="middle" font-size="14" fill="#ccc">토지 데이터 로드 중...</text>';
    return;
  }

  const yearData = _lYearBase();
  if (cmpRow) cmpRow.style.display = landStatCompare ? 'flex' : 'none';
  if (landStatCompare) _fillLandCompareSelects(yearData);
  _renderLandBreadcrumb();
  _renderLandChips(yearData);

  const series = [];
  if (landStatCompare) {
    series.push({ geo: landStatGeoA, color: '#1976D2', label: _lGeoLabel(landStatGeoA) });
    series.push({ geo: landStatGeoB, color: '#E65100', label: _lGeoLabel(landStatGeoB) });
  } else if (!landStatGeo.sigungu) {
    series.push({ geo: { sigungu: '제주시', dong: null }, color: '#1976D2', label: '제주시' });
    series.push({ geo: { sigungu: '서귀포시', dong: null }, color: '#E65100', label: '서귀포시' });
  } else {
    const color = landStatGeo.sigungu === '서귀포시' ? '#E65100' : '#1976D2';
    series.push({ geo: { ...landStatGeo }, color, label: _lGeoLabel(landStatGeo) });
  }

  const seriesData = series.map(s => Object.assign({}, s, { rows: _lFilterByGeo(yearData, s.geo) }));

  if (landStatCompare || seriesData.length === 2) {
    const a = seriesData[0], b = seriesData[1];
    const aM = _lMetricOf(a.rows), bM = _lMetricOf(b.rows);
    let diffHtml = '-';
    if (aM != null && bM != null && aM !== 0 && landStatTab !== 'count') {
      const pct = ((bM - aM) / aM) * 100;
      diffHtml = (pct >= 0 ? '+' : '') + pct.toFixed(1) + '%';
    } else if (landStatTab === 'count') {
      diffHtml = ((b.rows.length - a.rows.length) >= 0 ? '+' : '') + (b.rows.length - a.rows.length) + '건';
    }
    sm.innerHTML = `
      <div class="sm-kpi"><div class="kpi-val">${_lFmtMetric(aM)}</div><div class="kpi-lbl">A ${_lGeoLabel(a.geo)}</div></div>
      <div class="sm-kpi kpi-seo"><div class="kpi-val">${_lFmtMetric(bM)}</div><div class="kpi-lbl">B ${_lGeoLabel(b.geo)}</div></div>
      <div class="sm-kpi"><div class="kpi-val">${diffHtml}</div><div class="kpi-lbl">차이 (B 대비 A)</div></div>
      <div class="sm-kpi"><div class="kpi-val">${a.rows.length.toLocaleString()} / ${b.rows.length.toLocaleString()}</div><div class="kpi-lbl">건수 A / B</div></div>`;
  } else {
    const r = seriesData[0].rows;
    const color = seriesData[0].geo.sigungu === '서귀포시' ? 'kpi-seo' : '';
    sm.innerHTML = `
      <div class="sm-kpi ${color}"><div class="kpi-val">${r.length.toLocaleString()}건</div><div class="kpi-lbl">${_lGeoLabel(seriesData[0].geo)} 총 거래</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(_lPerm2Avg(r) || 0).toLocaleString()}만</div><div class="kpi-lbl">평균 ㎡당 단가</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(_lPriceAvg(r) || 0).toFixed(2)}억</div><div class="kpi-lbl">평균 거래금액</div></div>
      <div class="sm-kpi ${color}"><div class="kpi-val">${(_lMaxPrice(r) || 0).toFixed(1)}억</div><div class="kpi-lbl">최고 거래금액</div></div>`;
  }

  if (note) {
    const warns = seriesData.filter(s => s.rows.length > 0 && s.rows.length < 5)
      .map(s => `${_lGeoLabel(s.geo)} ${s.rows.length}건`);
    note.textContent = warns.length
      ? '※ 표본 부족: ' + warns.join(', ') + ' — 단가 해석에 주의하세요.'
      : '';
  }

  const now = new Date();
  const lastMonth = (landStatYear === now.getFullYear()) ? now.getMonth() : 11;
  const months = [];
  for (let mo = 0; mo <= lastMonth; mo++) {
    const key = landStatYear + '-' + String(mo + 1).padStart(2, '0');
    const vals = seriesData.map(s => {
      const mrows = s.rows.filter(t => t.date && t.date.startsWith(key));
      return _lMetricOf(mrows);
    });
    months.push({
      key,
      lbl: (mo + 1) + '월',
      yearLbl: mo === 0 ? String(landStatYear) : '',
      vals,
      allCnt: yearData.filter(t => t.date && t.date.startsWith(key)).length
    });
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

  const isCount = landStatTab === 'count';
  const W = 840, H = 300, padL = 72, padB = 44, padR = 50, padT = 20;
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
    yLabels += `<text x="${padL - 8}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="11" fill="#999">${_lFmtMetric(v)}</text>`;
  }

  let chartContent = '';
  lines.forEach(line => {
    const pts = line.vals.map((v, i) => (v != null && (isCount || v > 0)) ? { x: toX(i), y: toY(v), v, i } : null).filter(Boolean);
    if (!pts.length) return;
    if (pts.length === 1) {
      const p = pts[0];
      chartContent += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"/>
        <text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${_lFmtMetric(p.v)}</text>`;
      return;
    }
    const pathD = pts.map((p, j) => (j === 0 ? 'M' : 'L') + p.x.toFixed(1) + ',' + p.y.toFixed(1)).join(' ');
    const areaD = pathD + ` L${pts[pts.length - 1].x.toFixed(1)},${(padT + cH).toFixed(1)} L${pts[0].x.toFixed(1)},${(padT + cH).toFixed(1)} Z`;
    const gid = 'lg' + line.color.replace('#', '') + String(line.label.length);
    chartContent += `
      <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${line.color}" stop-opacity="0.18"/>
        <stop offset="100%" stop-color="${line.color}" stop-opacity="0.01"/>
      </linearGradient></defs>
      <path d="${areaD}" fill="url(#${gid})"/>
      <path d="${pathD}" fill="none" stroke="${line.color}" stroke-width="2.8" stroke-linejoin="round" stroke-linecap="round"/>
      ${pts.map(p => `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="5" fill="${line.color}" stroke="#fff" stroke-width="2"><title>${months[p.i].lbl}: ${_lFmtMetric(p.v)}</title></circle>`).join('')}
      ${pts.map(p => `<text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-size="9" fill="${line.color}" font-weight="600">${_lFmtMetric(p.v)}</text>`).join('')}`;
  });

  const xLabels = months.map((m, i) => `
    <text x="${toX(i).toFixed(1)}" y="${H - 22}" text-anchor="middle" font-size="11" fill="#666" font-weight="600">${m.lbl}</text>
    ${m.yearLbl ? `<text x="${toX(i).toFixed(1)}" y="${H - 8}" text-anchor="middle" font-size="10" fill="#aaa">${m.yearLbl}</text>` : ''}
  `).join('');

  let hoverRects = '';
  months.forEach((m, i) => {
    const x = i === 0 ? padL : toX(i) - xStep / 2;
    const w = (i === 0 || i === n - 1) ? xStep / 2 : xStep;
    const vals = lines.map(l => `${l.label}: ${_lFmtMetric(l.vals[i])}`).join('\n');
    const tip = `${m.key} (${m.allCnt}건)\n${vals}`;
    hoverRects += `<rect x="${x.toFixed(1)}" y="${padT}" width="${Math.min(w, cW).toFixed(1)}" height="${cH + 8}" fill="transparent" class="stat-hover" data-tip="${tip.replace(/"/g, '&quot;')}"/>`;
  });

  svg.innerHTML = `
    <rect x="${padL}" y="${padT}" width="${cW}" height="${cH}" fill="#fafbfc" rx="2"/>
    ${grids}
    <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + cH}" stroke="#bbb" stroke-width="1.5"/>
    ${yLabels}
    <text x="14" y="${(padT + cH / 2).toFixed(1)}" text-anchor="middle" font-size="11" fill="#999" transform="rotate(-90,14,${(padT + cH / 2).toFixed(1)})">${_lYUnit()}</text>
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
