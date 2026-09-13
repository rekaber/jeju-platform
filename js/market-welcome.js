/* js/market-welcome.js — 입장 후 제주 부동산 시장 요약 (시점 기준 동적 집계) */
var MARKET_WELCOME_KEY = 'jeju_market_welcome_hide_until';
var _mwOpenedOnce = false;

function _mwHideUntilOk() {
  try {
    var until = parseInt(localStorage.getItem(MARKET_WELCOME_KEY) || '0', 10);
    if (until && Date.now() < until) return false;
  } catch (e) {}
  return true;
}

function _mwSetHideToday() {
  try {
    var end = new Date();
    end.setHours(23, 59, 59, 999);
    localStorage.setItem(MARKET_WELCOME_KEY, String(end.getTime()));
  } catch (e) {}
}

function _mwPeriod() {
  var now = new Date();
  return {
    year: now.getFullYear(),
    prevYear: now.getFullYear() - 1,
    month: now.getMonth() + 1 // 1~12, 올해 누적 비교 월
  };
}

function _mwAptAll() {
  var apt = (window.MULTI_DATA && window.MULTI_DATA.apt) || [];
  if (!apt.length && window.TRADE_DATA && window.TRADE_DATA.length) {
    apt = window.TRADE_DATA.filter(function (t) {
      return !t._tradeType || t._tradeType === 'apt';
    });
  }
  return apt;
}

function _mwLandAll() {
  return (window.LAND_DATA && window.LAND_DATA.length) ? window.LAND_DATA : [];
}

/** 해당 연도 1월~throughMonth 누적 */
function _mwFilterYtd(rows, year, throughMonth) {
  return (rows || []).filter(function (t) {
    if (!t.date || !t.date.startsWith(String(year))) return false;
    var mo = parseInt(t.date.slice(5, 7), 10);
    return mo >= 1 && mo <= throughMonth;
  });
}

function _mwAvgPrice(arr) {
  var valid = (arr || []).filter(function (t) { return t.price > 0; });
  if (!valid.length) return null;
  return valid.reduce(function (s, t) { return s + t.price; }, 0) / valid.length;
}

/** 아파트 평형당 평균 (천만원/평) — price(억) ÷ 평수 × 10 */
function _mwAvgAptCheonmanPerPyung(arr) {
  var valid = (arr || []).filter(function (t) {
    return t.price > 0 && t.area > 0;
  });
  if (!valid.length) return null;
  var sum = valid.reduce(function (s, t) {
    var eokPerPyung = t.price / (t.area / 3.3058);
    return s + eokPerPyung * 10; // 억 → 천만원
  }, 0);
  return sum / valid.length;
}

/** 토지 ㎡당 평균 (만원/㎡) — 플랫폼 공통 단위 */
function _mwAvgLandPerM2(arr) {
  var sum = 0, n = 0;
  (arr || []).forEach(function (t) {
    var pm = Number(t.perM2) || 0;
    if (pm <= 0 && t.price > 0 && t.area > 0) {
      pm = (t.price * 10000) / t.area;
    }
    if (pm > 0) { sum += pm; n++; }
  });
  return n ? sum / n : null;
}

function _mwPctChange(cur, prev) {
  if (prev == null || prev === 0) return cur > 0 ? null : 0;
  return ((cur - prev) / prev) * 100;
}

function _mwFmtCnt(n) {
  return (n || 0).toLocaleString('ko-KR') + '건';
}

function _mwFmtEok(v) {
  if (v == null) return '—';
  return Number(v).toFixed(2) + '억';
}

function _mwFmtCheonmanPerPyung(v) {
  if (v == null) return '—';
  var n = Number(v);
  if (n >= 10) return n.toFixed(1) + '천만/평';
  return n.toFixed(2) + '천만/평';
}

function _mwFmtManPerM2(v) {
  if (v == null) return '—';
  var n = Number(v);
  if (n >= 100) return Math.round(n).toLocaleString('ko-KR') + '만/㎡';
  return (Math.round(n * 10) / 10).toFixed(1) + '만/㎡';
}

function _mwFmtYoY(pct) {
  if (pct == null) return '전년 동기 비교 불가';
  var abs = Math.abs(pct);
  var approx = abs >= 10 ? Math.round(pct) : (Math.round(pct * 10) / 10);
  var sign = pct > 0 ? '+' : '';
  return '전년 동기 ' + sign + approx + '%';
}

function _mwYoYClass(pct) {
  if (pct == null) return 'mw-yoy-flat';
  if (pct > 3) return 'mw-yoy-up';
  if (pct < -3) return 'mw-yoy-down';
  return 'mw-yoy-flat';
}

function _mwToneWord(pct) {
  if (pct == null) return null;
  if (pct >= 15) return '눈에 띄게 늘어난';
  if (pct >= 5) return '늘어난';
  if (pct > 3) return '소폭 늘어난';
  if (pct <= -15) return '크게 줄어든';
  if (pct <= -5) return '줄어든';
  if (pct < -3) return '소폭 줄어든';
  return '비슷한';
}

function _mwBuildComment(stats) {
  var p = stats.period;
  var lines = [];
  lines.push(
    p.year + '년 1~' + p.month + '월 실거래 기준으로 보면,'
  );

  var aptTone = _mwToneWord(stats.apt.volPct);
  var landTone = _mwToneWord(stats.land.volPct);

  if (aptTone && landTone) {
    if (aptTone === landTone) {
      lines.push(
        '아파트·토지 거래량이 작년 같은 기간과 ' + aptTone + ' 흐름입니다.'
      );
    } else {
      lines.push(
        '아파트는 작년 동기 대비 ' + aptTone + ' 편이고, 토지는 ' + landTone + ' 편입니다.'
      );
    }
  } else if (aptTone) {
    lines.push('아파트 거래량은 작년 같은 기간보다 ' + aptTone + ' 편입니다.');
  } else if (landTone) {
    lines.push('토지 거래량은 작년 같은 기간보다 ' + landTone + ' 편입니다.');
  } else {
    lines.push('아직 비교할 거래 데이터가 충분하지 않습니다.');
  }

  if (stats.apt.avg != null && stats.land.avg != null) {
    lines.push(
      '평균 거래금액은 아파트 약 ' + Number(stats.apt.avg).toFixed(1) +
      '억, 토지 약 ' + Number(stats.land.avg).toFixed(1) + '억 수준입니다.'
    );
  } else if (stats.apt.avg != null) {
    lines.push('아파트 평균 거래금액은 약 ' + Number(stats.apt.avg).toFixed(1) + '억 수준입니다.');
  } else if (stats.land.avg != null) {
    lines.push('토지 평균 거래금액은 약 ' + Number(stats.land.avg).toFixed(1) + '억 수준입니다.');
  }

  if (stats.apt.unit != null || stats.land.unit != null) {
    var unitBits = [];
    if (stats.apt.unit != null) {
      unitBits.push('아파트 평형당 약 ' + Number(stats.apt.unit).toFixed(2) + '천만원');
    }
    if (stats.land.unit != null) {
      var u = Number(stats.land.unit);
      unitBits.push('토지 ㎡당 약 ' + (u >= 100 ? Math.round(u).toLocaleString('ko-KR') : (Math.round(u * 10) / 10).toFixed(1)) + '만원');
    }
    lines.push(unitBits.join(', ') + ' 정도로 보입니다.');
  }

  // 가격 방향 한 줄 (대략)
  var aptPx = stats.apt.unitPct != null ? stats.apt.unitPct : stats.apt.avgPct;
  var landPx = stats.land.unitPct != null ? stats.land.unitPct : stats.land.avgPct;
  if (aptPx != null || landPx != null) {
    var bits = [];
    if (aptPx != null) {
      bits.push('아파트 단가는 전년 동기 대비 ' + (aptPx >= 0 ? '약 +' : '약 ') +
        (Math.abs(aptPx) >= 10 ? Math.round(aptPx) : (Math.round(aptPx * 10) / 10)) + '%');
    }
    if (landPx != null) {
      bits.push('토지 단가는 ' + (landPx >= 0 ? '약 +' : '약 ') +
        (Math.abs(landPx) >= 10 ? Math.round(landPx) : (Math.round(landPx * 10) / 10)) + '%');
    }
    lines.push(bits.join(', ') + ' 흐름입니다.');
  }

  lines.push('지도에서 지역·유형별로 더 자세히 살펴보세요.');
  return lines.join(' ');
}

function _mwComputeStats() {
  var p = _mwPeriod();
  var aptAll = _mwAptAll();
  var landAll = _mwLandAll();
  var aptCur = _mwFilterYtd(aptAll, p.year, p.month);
  var aptPrev = _mwFilterYtd(aptAll, p.prevYear, p.month);
  var landCur = _mwFilterYtd(landAll, p.year, p.month);
  var landPrev = _mwFilterYtd(landAll, p.prevYear, p.month);

  var aptAvg = _mwAvgPrice(aptCur);
  var aptAvgPrev = _mwAvgPrice(aptPrev);
  var landAvg = _mwAvgPrice(landCur);
  var landAvgPrev = _mwAvgPrice(landPrev);
  var aptUnit = _mwAvgAptCheonmanPerPyung(aptCur);
  var aptUnitPrev = _mwAvgAptCheonmanPerPyung(aptPrev);
  var landUnit = _mwAvgLandPerM2(landCur);
  var landUnitPrev = _mwAvgLandPerM2(landPrev);

  return {
    period: p,
    aptReady: !!aptAll.length,
    landReady: !!landAll.length,
    apt: {
      count: aptCur.length,
      prevCount: aptPrev.length,
      volPct: aptPrev.length ? _mwPctChange(aptCur.length, aptPrev.length) : null,
      avg: aptAvg,
      avgPct: (aptAvg != null && aptAvgPrev != null && aptAvgPrev > 0)
        ? _mwPctChange(aptAvg, aptAvgPrev) : null,
      unit: aptUnit,
      unitPct: (aptUnit != null && aptUnitPrev != null && aptUnitPrev > 0)
        ? _mwPctChange(aptUnit, aptUnitPrev) : null
    },
    land: {
      count: landCur.length,
      prevCount: landPrev.length,
      volPct: landPrev.length ? _mwPctChange(landCur.length, landPrev.length) : null,
      avg: landAvg,
      avgPct: (landAvg != null && landAvgPrev != null && landAvgPrev > 0)
        ? _mwPctChange(landAvg, landAvgPrev) : null,
      unit: landUnit,
      unitPct: (landUnit != null && landUnitPrev != null && landUnitPrev > 0)
        ? _mwPctChange(landUnit, landUnitPrev) : null
    }
  };
}

function _mwFillAsset(prefix, asset, ready) {
  var volEl = document.getElementById('mw-' + prefix + '-vol');
  var yoyEl = document.getElementById('mw-' + prefix + '-yoy');
  var avgEl = document.getElementById('mw-' + prefix + '-avg');
  var avgYoyEl = document.getElementById('mw-' + prefix + '-avg-yoy');
  var unitEl = document.getElementById('mw-' + prefix + '-unit');
  var unitYoyEl = document.getElementById('mw-' + prefix + '-unit-yoy');

  if (!ready) {
    [volEl, avgEl, unitEl].forEach(function (el) {
      if (el) { el.textContent = '집계 중…'; el.classList.add('muted'); }
    });
    [yoyEl, avgYoyEl, unitYoyEl].forEach(function (el) {
      if (el) { el.textContent = ''; el.className = 'mw-yoy'; }
    });
    return;
  }

  if (volEl) {
    volEl.textContent = _mwFmtCnt(asset.count);
    volEl.classList.toggle('muted', !asset.count);
  }
  if (yoyEl) {
    yoyEl.textContent = _mwFmtYoY(asset.volPct);
    yoyEl.className = 'mw-yoy ' + _mwYoYClass(asset.volPct);
  }
  if (avgEl) {
    avgEl.textContent = asset.avg != null ? _mwFmtEok(asset.avg) : '—';
    avgEl.classList.toggle('muted', asset.avg == null);
  }
  if (avgYoyEl) {
    avgYoyEl.textContent = asset.avgPct != null ? _mwFmtYoY(asset.avgPct) : '';
    avgYoyEl.className = 'mw-yoy ' + _mwYoYClass(asset.avgPct);
  }
  if (unitEl) {
    if (prefix === 'apt') {
      unitEl.textContent = asset.unit != null ? _mwFmtCheonmanPerPyung(asset.unit) : '—';
    } else {
      unitEl.textContent = asset.unit != null ? _mwFmtManPerM2(asset.unit) : '—';
    }
    unitEl.classList.toggle('muted', asset.unit == null);
  }
  if (unitYoyEl) {
    unitYoyEl.textContent = asset.unitPct != null ? _mwFmtYoY(asset.unitPct) : '';
    unitYoyEl.className = 'mw-yoy ' + _mwYoYClass(asset.unitPct);
  }
}

function renderMarketWelcome() {
  var stats = _mwComputeStats();
  var p = stats.period;

  var yearEl = document.getElementById('mw-year');
  var subEl = document.getElementById('mw-sub');
  var noteEl = document.getElementById('mw-note');

  if (yearEl) {
    yearEl.textContent =
      p.year + '년 1~' + p.month + '월 누적 · ' + p.prevYear + '년 동기 대비 (조회 시점 기준)';
  }
  if (subEl) {
    subEl.textContent =
      '지금 조회한 실거래로 본 제주 아파트·토지 요약';
  }

  _mwFillAsset('apt', stats.apt, stats.aptReady);
  _mwFillAsset('land', stats.land, stats.landReady);

  if (noteEl) {
    if (!stats.aptReady && !stats.landReady) {
      noteEl.textContent = '실거래 데이터를 불러오는 중입니다. 잠시만 기다려 주세요.';
    } else {
      noteEl.textContent = _mwBuildComment(stats);
    }
  }
}

function openMarketWelcome() {
  if (_mwOpenedOnce) return;
  if (!_mwHideUntilOk()) return;
  var el = document.getElementById('market-welcome');
  if (!el) return;
  _mwOpenedOnce = true;
  el.classList.add('open');
  el.setAttribute('aria-hidden', 'false');
  renderMarketWelcome();

  var tries = 0;
  function tick() {
    renderMarketWelcome();
    var aptOk = window.MULTI_DATA && window.MULTI_DATA.apt;
    var landOk = window.LAND_DATA;
    if (aptOk && landOk) return;
    if (++tries < 48) setTimeout(tick, 250);
  }
  tick();
}

function closeMarketWelcome(hideToday) {
  var el = document.getElementById('market-welcome');
  if (!el) return;
  if (hideToday) _mwSetHideToday();
  el.classList.remove('open');
  el.setAttribute('aria-hidden', 'true');
}

(function bindMarketWelcomeUi() {
  var el = document.getElementById('market-welcome');
  if (!el) return;
  el.addEventListener('click', function (e) {
    if (e.target === el) closeMarketWelcome();
  });
})();

function _mwRefreshIfOpen() {
  var el = document.getElementById('market-welcome');
  if (el && el.classList.contains('open')) renderMarketWelcome();
}

window.addEventListener('jeju-apt-loaded', _mwRefreshIfOpen);
window.addEventListener('jeju-land-loaded', _mwRefreshIfOpen);
