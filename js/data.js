/* js/data.js - 제주 부동산 플랫폼 */
/* ═══════════════════════════════════════════════
   실거래 샘플 데이터 (국토부 실거래가 기반 샘플)
═══════════════════════════════════════════════ */
/* 제주도 전체 법정동 기준 데이터 */
window.JEJU_BEOPJEONGDONG = [
  /* ── 제주시 동 지역 ── */
  { code:'5011000100', sigungu:'제주시', dong:'일도일동', lat:33.5145, lng:126.5263, lawdCd:'50110' },
  { code:'5011000200', sigungu:'제주시', dong:'일도이동', lat:33.5138, lng:126.5321, lawdCd:'50110' },
  { code:'5011000300', sigungu:'제주시', dong:'이도일동', lat:33.5072, lng:126.5312, lawdCd:'50110' },
  { code:'5011000400', sigungu:'제주시', dong:'이도이동', lat:33.5042, lng:126.5398, lawdCd:'50110' },
  { code:'5011000500', sigungu:'제주시', dong:'삼도일동', lat:33.5112, lng:126.5195, lawdCd:'50110' },
  { code:'5011000600', sigungu:'제주시', dong:'삼도이동', lat:33.5098, lng:126.5168, lawdCd:'50110' },
  { code:'5011000700', sigungu:'제주시', dong:'용담일동', lat:33.5148, lng:126.5042, lawdCd:'50110' },
  { code:'5011000800', sigungu:'제주시', dong:'용담이동', lat:33.5098, lng:126.4782, lawdCd:'50110' },
  { code:'5011000900', sigungu:'제주시', dong:'건입동',   lat:33.5178, lng:126.5312, lawdCd:'50110' },
  { code:'5011001000', sigungu:'제주시', dong:'화북일동', lat:33.5198, lng:126.5568, lawdCd:'50110' },
  { code:'5011001100', sigungu:'제주시', dong:'화북이동', lat:33.5218, lng:126.5632, lawdCd:'50110' },
  { code:'5011001200', sigungu:'제주시', dong:'삼양일동', lat:33.5298, lng:126.5918, lawdCd:'50110' },
  { code:'5011001300', sigungu:'제주시', dong:'삼양이동', lat:33.5318, lng:126.5998, lawdCd:'50110' },
  { code:'5011001400', sigungu:'제주시', dong:'삼양삼동', lat:33.5338, lng:126.6078, lawdCd:'50110' },
  { code:'5011001500', sigungu:'제주시', dong:'봉개동',   lat:33.4882, lng:126.5978, lawdCd:'50110' },
  { code:'5011001600', sigungu:'제주시', dong:'아라일동', lat:33.4762, lng:126.5458, lawdCd:'50110' },
  { code:'5011001700', sigungu:'제주시', dong:'아라이동', lat:33.4585, lng:126.5345, lawdCd:'50110' },
  { code:'5011001800', sigungu:'제주시', dong:'오라일동', lat:33.4892, lng:126.5112, lawdCd:'50110' },
  { code:'5011001900', sigungu:'제주시', dong:'오라이동', lat:33.4852, lng:126.5212, lawdCd:'50110' },
  { code:'5011002000', sigungu:'제주시', dong:'오라삼동', lat:33.4812, lng:126.5312, lawdCd:'50110' },
  { code:'5011002100', sigungu:'제주시', dong:'연동',     lat:33.4945, lng:126.5002, lawdCd:'50110' },
  { code:'5011002200', sigungu:'제주시', dong:'노형동',   lat:33.4892, lng:126.4832, lawdCd:'50110' },
  { code:'5011002300', sigungu:'제주시', dong:'외도일동', lat:33.4838, lng:126.4468, lawdCd:'50110' },
  { code:'5011002400', sigungu:'제주시', dong:'외도이동', lat:33.4818, lng:126.4368, lawdCd:'50110' },
  { code:'5011002500', sigungu:'제주시', dong:'이호일동', lat:33.5012, lng:126.4328, lawdCd:'50110' },
  { code:'5011002600', sigungu:'제주시', dong:'이호이동', lat:33.4981, lng:126.4388, lawdCd:'50110' },
  { code:'5011002700', sigungu:'제주시', dong:'도두일동', lat:33.5068, lng:126.4198, lawdCd:'50110' },
  { code:'5011002800', sigungu:'제주시', dong:'도두이동', lat:33.5088, lng:126.4148, lawdCd:'50110' },
  { code:'5011002900', sigungu:'제주시', dong:'도련일동', lat:33.5008, lng:126.5618, lawdCd:'50110' },
  { code:'5011003000', sigungu:'제주시', dong:'도련이동', lat:33.4988, lng:126.5698, lawdCd:'50110' },
  { code:'5011003100', sigungu:'제주시', dong:'용강동',   lat:33.4762, lng:126.5658, lawdCd:'50110' },
  { code:'5011003200', sigungu:'제주시', dong:'회천동',   lat:33.4698, lng:126.5818, lawdCd:'50110' },
  { code:'5011003300', sigungu:'제주시', dong:'오등동',   lat:33.4618, lng:126.5518, lawdCd:'50110' },
  /* ── 제주시 읍·면 ── */
  { code:'5011025000', sigungu:'제주시', dong:'애월읍',   lat:33.4622, lng:126.3275, lawdCd:'50110' },
  { code:'5011031000', sigungu:'제주시', dong:'한림읍',   lat:33.4152, lng:126.2682, lawdCd:'50110' },
  { code:'5011032000', sigungu:'제주시', dong:'한경면',   lat:33.3558, lng:126.1821, lawdCd:'50110' },
  { code:'5011025500', sigungu:'제주시', dong:'조천읍',   lat:33.5262, lng:126.6412, lawdCd:'50110' },
  { code:'5011033000', sigungu:'제주시', dong:'구좌읍',   lat:33.5312, lng:126.7582, lawdCd:'50110' },
  { code:'5011034000', sigungu:'제주시', dong:'우도면',   lat:33.5018, lng:126.9548, lawdCd:'50110' },
  { code:'5011035000', sigungu:'제주시', dong:'추자면',   lat:33.9618, lng:126.3012, lawdCd:'50110' },
  /* ── 서귀포시 동 지역 ── */
  { code:'5013000100', sigungu:'서귀포시', dong:'서귀동',  lat:33.2530, lng:126.5628, lawdCd:'50130' },
  { code:'5013000200', sigungu:'서귀포시', dong:'서홍동',  lat:33.2600, lng:126.5720, lawdCd:'50130' },
  { code:'5013000300', sigungu:'서귀포시', dong:'동홍동',  lat:33.2660, lng:126.5828, lawdCd:'50130' },
  { code:'5013000400', sigungu:'서귀포시', dong:'서호동',  lat:33.2480, lng:126.5528, lawdCd:'50130' },
  { code:'5013000500', sigungu:'서귀포시', dong:'호근동',  lat:33.2500, lng:126.5480, lawdCd:'50130' },
  { code:'5013000600', sigungu:'서귀포시', dong:'법환동',  lat:33.2450, lng:126.5428, lawdCd:'50130' },
  { code:'5013000700', sigungu:'서귀포시', dong:'강정동',  lat:33.2430, lng:126.4950, lawdCd:'50130' },
  { code:'5013000800', sigungu:'서귀포시', dong:'도순동',  lat:33.2500, lng:126.4728, lawdCd:'50130' },
  { code:'5013000900', sigungu:'서귀포시', dong:'회수동',  lat:33.2560, lng:126.4828, lawdCd:'50130' },
  { code:'5013001000', sigungu:'서귀포시', dong:'월평동',  lat:33.2580, lng:126.4528, lawdCd:'50130' },
  { code:'5013001100', sigungu:'서귀포시', dong:'하원동',  lat:33.2520, lng:126.4428, lawdCd:'50130' },
  { code:'5013001200', sigungu:'서귀포시', dong:'색달동',  lat:33.2530, lng:126.4127, lawdCd:'50130' },
  { code:'5013001300', sigungu:'서귀포시', dong:'중문동',  lat:33.2550, lng:126.4228, lawdCd:'50130' },
  { code:'5013001400', sigungu:'서귀포시', dong:'대포동',  lat:33.2480, lng:126.3928, lawdCd:'50130' },
  { code:'5013001500', sigungu:'서귀포시', dong:'예래동',  lat:33.2450, lng:126.3728, lawdCd:'50130' },
  { code:'5013001600', sigungu:'서귀포시', dong:'보목동',  lat:33.2518, lng:126.5928, lawdCd:'50130' },
  { code:'5013001700', sigungu:'서귀포시', dong:'토평동',  lat:33.2542, lng:126.5887, lawdCd:'50130' },
  { code:'5013001800', sigungu:'서귀포시', dong:'상효동',  lat:33.2832, lng:126.5728, lawdCd:'50130' },
  { code:'5013001900', sigungu:'서귀포시', dong:'하효동',  lat:33.2618, lng:126.6028, lawdCd:'50130' },
  { code:'5013002000', sigungu:'서귀포시', dong:'효돈동',  lat:33.2698, lng:126.6228, lawdCd:'50130' },
  { code:'5013002100', sigungu:'서귀포시', dong:'신효동',  lat:33.2768, lng:126.6128, lawdCd:'50130' },
  /* ── 서귀포시 읍·면 ── */
  { code:'5013025000', sigungu:'서귀포시', dong:'남원읍',  lat:33.2818, lng:126.6862, lawdCd:'50130' },
  { code:'5013031000', sigungu:'서귀포시', dong:'표선면',  lat:33.3272, lng:126.8368, lawdCd:'50130' },
  { code:'5013032000', sigungu:'서귀포시', dong:'성산읍',  lat:33.3872, lng:126.9238, lawdCd:'50130' },
  { code:'5013033000', sigungu:'서귀포시', dong:'대정읍',  lat:33.2890, lng:126.2548, lawdCd:'50130' },
  { code:'5013034000', sigungu:'서귀포시', dong:'안덕면',  lat:33.2782, lng:126.3215, lawdCd:'50130' },
];

(function() {
  const now = new Date('2026-08-21');
  const BJ = window.JEJU_BEOPJEONGDONG;
  // 법정동별 가격 범위 (시세 반영)
  const priceMap = {
    '연동':5.2,'노형동':5.5,'이도이동':4.8,'이도일동':4.5,'삼도일동':4.2,'삼도이동':4.1,
    '일도일동':4.0,'일도이동':3.9,'건입동':3.8,'용담이동':4.3,'용담일동':4.1,
    '화북일동':3.8,'화북이동':3.7,'아라일동':4.2,'아라이동':4.0,'오라일동':3.9,
    '오라이동':3.8,'오라삼동':3.7,'도련일동':3.5,'도련이동':3.4,'봉개동':3.2,
    '외도일동':3.8,'외도이동':3.6,'이호일동':4.1,'이호이동':4.0,'도두일동':3.8,'도두이동':3.7,
    '용강동':3.5,'회천동':3.3,'오등동':3.2,'삼양일동':3.4,'삼양이동':3.3,'삼양삼동':3.2,
    '애월읍':4.8,'한림읍':3.2,'한경면':2.8,'조천읍':3.8,'구좌읍':3.0,'우도면':3.5,'추자면':1.8,
    '서귀동':4.2,'서홍동':4.5,'동홍동':4.3,'서호동':3.8,'호근동':3.6,'법환동':3.5,
    '강정동':3.4,'도순동':3.2,'회수동':3.1,'월평동':3.3,'하원동':3.0,'색달동':5.8,
    '중문동':5.5,'대포동':4.8,'예래동':4.2,'보목동':3.6,'토평동':3.8,'상효동':3.2,
    '하효동':3.1,'효돈동':3.0,'신효동':3.1,'남원읍':3.2,'표선면':2.8,'성산읍':3.5,
    '대정읍':3.0,'안덕면':3.2,
  };
  const types = ['아파트','아파트','아파트','오피스텔','빌라','단독'];
  const areas = [33,49,59,75,84,101,112,132,148,178,200];
  const TRADE_DATA = [];
  let id = 1;
  for (let d = 0; d < 365; d++) {
    const dt = new Date(now); dt.setDate(dt.getDate() - d);
    const count = d < 7 ? 4 : d < 30 ? 3 : 2;
    for (let c = 0; c < count; c++) {
      const bj = BJ[Math.floor(Math.random()*BJ.length)];
      const base = priceMap[bj.dong] || 3.5;
      const price = Math.round((base + (Math.random()-0.5)*1.6) * 10) / 10;
      const type = types[Math.floor(Math.random()*types.length)];
      const area = areas[Math.floor(Math.random()*areas.length)];
      const jitter = (Math.random()-0.5)*0.008;
      TRADE_DATA.push({
        id: id++,
        name: bj.dong + ' ' + type,
        addr: bj.sigungu + ' ' + bj.dong,
        sigungu: bj.sigungu,
        dong: bj.dong,
        code: bj.code,
        lawdCd: bj.lawdCd,
        lat: bj.lat + jitter, lng: bj.lng + jitter,
        type, area, price: Math.max(0.5, price),
        date: dt.toISOString().slice(0,10)
      });
    }
  }
  window.TRADE_DATA = TRADE_DATA; // 샘플 데이터 (기본값)
})();

// ── 도로명주소 → 좌표 캐시 (localStorage 영속) ──────────────────────────
const GEOCACHE_KEY = 'jeju_geocache_v1';
function loadGeoCache() {
  try { return JSON.parse(localStorage.getItem(GEOCACHE_KEY) || '{}'); } catch(e) { return {}; }
}
function saveGeoCache(cache) {
  try { localStorage.setItem(GEOCACHE_KEY, JSON.stringify(cache)); } catch(e) {}
}

