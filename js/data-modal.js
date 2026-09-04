/* js/data-modal.js - 제주 부동산 플랫폼 (index.html 과 동기화) */

function openDataModal() {
  document.getElementById('data-modal-backdrop').classList.add('open');
}
function closeDataModal() {
  document.getElementById('data-modal-backdrop').classList.remove('open');
}
function switchDmTab(tab, btn) {
  dmActiveTab = tab;
  document.querySelectorAll('.dm-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.dm-section').forEach(s => s.classList.remove('active'));
  document.getElementById('dm-' + tab).classList.add('active');
}

const API_ENDPOINTS = {
  apt: 'getRTMSDataSvcAptTradeDev',
  offi: 'getRTMSDataSvcOffiTradeDev',
  house: 'getRTMSDataSvcSHTradeDev',
};

async function fetchApiData(apiKey, regionVal, months, type) {
  let lawdCds, dongFilter = null;
  if (regionVal === 'all') {
    lawdCds = ['50110', '50130'];
  } else if (regionVal.includes('|')) {
    const [lawd, dong] = regionVal.split('|');
    lawdCds = [lawd]; dongFilter = dong;
  } else {
    lawdCds = [regionVal];
  }
  const endpoint = API_ENDPOINTS[type] || API_ENDPOINTS.apt;
  const now = new Date();
  const yearMonths = [];
  for (let m = 0; m < months; m++) {
    const d = new Date(now); d.setMonth(d.getMonth() - m);
    yearMonths.push(d.getFullYear() + '' + String(d.getMonth() + 1).padStart(2, '0'));
  }
  const results = [];
  let done = 0; const total = lawdCds.length * yearMonths.length;
  for (const lawdCd of lawdCds) {
    for (const ym of yearMonths) {
      const url = `https://apis.data.go.kr/1613000/RTMSDataSvc${endpoint.replace('Dev', '')}/${endpoint}` +
        `?serviceKey=${encodeURIComponent(apiKey)}&LAWD_CD=${lawdCd}&DEAL_YMD=${ym}&numOfRows=1000&pageNo=1`;
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`;
      try {
        const res = await fetch(proxyUrl);
        const json = await res.json();
        const xml = new DOMParser().parseFromString(json.contents, 'text/xml');
        const items = xml.querySelectorAll('item');
        items.forEach(item => {
          const g = tag => (item.querySelector(tag) || {}).textContent || '';
          const dongName = g('법정동').trim();
          if (dongFilter && dongName !== dongFilter) return;
          const priceRaw = g('거래금액').replace(/,/g, '').trim();
          const priceMan = parseInt(priceRaw);
          if (isNaN(priceMan)) return;
          const year = g('년'), month = g('월').padStart(2, '0'), day = g('일').padStart(2, '0');
          const bjInfo = (window.JEJU_BEOPJEONGDONG || []).find(b => b.dong === dongName && b.lawdCd === lawdCd);
          results.push({
            id: 20000 + results.length,
            name: g('아파트') || g('단지명') || g('건물명') || dongName + ' 거래',
            addr: (lawdCd === '50110' ? '제주시 ' : '서귀포시 ') + dongName,
            sigungu: lawdCd === '50110' ? '제주시' : '서귀포시',
            dong: dongName,
            lawdCd,
            lat: bjInfo ? bjInfo.lat : null,
            lng: bjInfo ? bjInfo.lng : null,
            type: type === 'apt' ? '아파트' : type === 'offi' ? '오피스텔' : '단독',
            area: parseFloat(g('전용면적')) || 84,
            price: Math.round(priceMan / 1000) / 100,
            date: `${year}-${month}-${day}`
          });
        });
      } catch (e) { /* ignore */ }
      done++;
      if (typeof setProgress === 'function') setProgress(done / total * 70, `데이터 수집 중... ${done}/${total}`);
    }
  }
  return results;
}
