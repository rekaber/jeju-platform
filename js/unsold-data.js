/* js/unsold-data.js - extracted from index.html */
/* ═══════════════════════════════════════════════
   미분양 실제 확인 데이터
   - 기존 단지 유지
   - 2026.7 제주도 사업장별 미분양 현황에서 미등록·미분양≥10세대 단지 추가
   - 국토부 7월 총량 3,303호와 사업장별 합계는 범위가 다를 수 있음
═══════════════════════════════════════════════ */
var UNSOLD_DATA = [
  // ★ 기존 확인 데이터
  { id:1,  name:'효성해링턴플레이스 제주',           addr:'제주시 애월읍 하귀1리', lat:33.4808, lng:126.3955, type:'apt', units:424, price:'84㎡ 최고 8.9억', area:'84~101㎡', company:'효성중공업', since:'확인필요', real:true, total:425, note:'공매 4,006억 유찰 반복·투자사기 의혹' },
  { id:13, name:'동문디이스트 시그니처원 1단지',      addr:'제주시 연동',           lat:33.4945, lng:126.5002, type:'apt', units:165, price:'미공개', area:'미공개',    company:'동문건설',   since:'확인필요', real:true, total:182, subscrip:17 },
  { id:14, name:'동문디이스트 시그니처원 2단지',      addr:'제주시 연동',           lat:33.4938, lng:126.5018, type:'apt', units:190, price:'미공개', area:'미공개',    company:'동문건설',   since:'확인필요', real:true, total:196, subscrip:6  },
  { id:16, name:'한경면 신축단지 (통매각)',          addr:'제주시 한경면',         lat:33.3558, lng:126.1821, type:'apt', units:164, price:'88.5㎡ 최대 8억', area:'88.5㎡',  company:'미공개', since:'확인필요', real:true, total:164, note:'공매 1,074억 통매각 추진 (서부권 고가 미분양)' },
  { id:15, name:'PH159',                           addr:'제주시 조천읍 북촌리',   lat:33.5408, lng:126.6781, type:'apt', units:37,  price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:49,  subscrip:12 },
  { id:17, name:'한화포레나 제주에듀시티',           addr:'서귀포시 대정읍 보성리', lat:33.2890, lng:126.2548, type:'apt', units:503, price:'미공개',       area:'미공개',  company:'한화건설', since:'확인필요', real:true, total:503, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:18, name:'호반써밋 제주',                    addr:'제주시 용담이동',        lat:33.5098, lng:126.4782, type:'apt', units:213, price:'미공개',       area:'미공개',  company:'호반건설', since:'확인필요', real:true, total:213, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:19, name:'엘리프 애월',                      addr:'제주시 애월읍',          lat:33.4622, lng:126.3275, type:'apt', units:136, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:136, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:20, name:'엘크루 더 퍼스트',                 addr:'제주시 이호이동',        lat:33.4981, lng:126.4388, type:'apt', units:134, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:134, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:21, name:'함덕해밀타운 2단지',               addr:'제주시 조천읍 함덕리',   lat:33.5350, lng:126.6618, type:'apt', units:116, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:116, note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:22, name:'더 프리모84',                      addr:'서귀포시 토평동',        lat:33.2542, lng:126.5887, type:'apt', units:84,  price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:84,  note:'정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:23, name:'트라움 제주 10단지',               addr:'서귀포시 안덕면',        lat:33.2782, lng:126.3215, type:'villa',units:80, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:80,  note:'전원형 단지. 정확한 미분양 세대수 미공개 (총세대 기재)' },
  { id:24, name:'레브카운티',                       addr:'제주시 아라동',          lat:33.4585, lng:126.5345, type:'villa',units:64, price:'미공개',       area:'미공개',  company:'미공개',   since:'확인필요', real:true, total:64,  note:'고급 빌라형. 정확한 미분양 세대수 미공개 (총세대 기재)' },

  // ★ 2026.7 제주도 사업장별 미분양 현황 — 신규 추가 (기존 단지 제외, 미분양 10세대↑)
  { id:25, name:'서광에듀파크', addr:'서귀포시 안덕면 서광리 2519', lat:33.2903, lng:126.3317, type:'villa', units:80, price:'미공개', area:'미공개', company:'동호건설', since:'2026.7 기준', real:true, total:80, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:26, name:'제주 다이아빌라스', addr:'서귀포시 안덕면 서광리 2343', lat:33.2575, lng:126.3200, type:'villa', units:75, price:'미공개', area:'미공개', company:'㈜중해건설', since:'2026.7 기준', real:true, total:75, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:27, name:'제주에듀루치올라', addr:'제주시 한경면 청수리 2680-2번지 외 7', lat:33.2967, lng:126.2426, type:'apt', units:58, price:'미공개', area:'미공개', company:'일호종합건설㈜', since:'2026.7 기준', real:true, total:99, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:28, name:'루첸시아표선 IBEDU', addr:'서귀포시 표선면 표선리 2957', lat:33.3282, lng:126.8298, type:'apt', units:46, price:'미공개', area:'미공개', company:'㈜에이원종합건설', since:'2026.7 기준', real:true, total:50, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:29, name:'서귀포 휴안1차 아파트', addr:'서귀포시 하효동 582', lat:33.2584, lng:126.6183, type:'apt', units:39, price:'미공개', area:'미공개', company:'㈜도현종합건설', since:'2026.7 기준', real:true, total:78, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:30, name:'모슬포 라움', addr:'서귀포시 대정읍 동일리 3172', lat:33.2285, lng:126.2458, type:'apt', units:37, price:'미공개', area:'미공개', company:'라움건설', since:'2026.7 기준', real:true, total:46, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:31, name:'사계리 오션캐슬', addr:'서귀포시 안덕면 사계리 3596', lat:33.2500, lng:126.3232, type:'apt', units:35, price:'미공개', area:'미공개', company:'유성건설', since:'2026.7 기준', real:true, total:120, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:32, name:'제이원클래시움', addr:'서귀포시 동홍동 2197', lat:33.2505, lng:126.5733, type:'apt', units:29, price:'미공개', area:'미공개', company:'㈜웅진산업개발', since:'2026.7 기준', real:true, total:59, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:33, name:'더샵 노형포레', addr:'제주시 노형동 460', lat:33.4396, lng:126.4641, type:'apt', units:26, price:'미공개', area:'미공개', company:'㈜포스코건설', since:'2026.7 기준', real:true, total:80, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:34, name:'도두 네오하임', addr:'제주시 도두일동 2619-1', lat:33.5040, lng:126.4645, type:'apt', units:24, price:'미공개', area:'미공개', company:'네오종합건설㈜', since:'2026.7 기준', real:true, total:64, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:35, name:'빌라드아르떼', addr:'서귀포시 토평동 659-3', lat:33.2488, lng:126.5855, type:'villa', units:22, price:'미공개', area:'미공개', company:'㈜엄지하우스', since:'2026.7 기준', real:true, total:36, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:36, name:'에듀골드힐 더클래식', addr:'서귀포시 대정읍 보성리 1782-1', lat:33.2210, lng:126.2530, type:'apt', units:20, price:'미공개', area:'미공개', company:'광제건설', since:'2026.7 기준', real:true, total:83, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:37, name:'산방산 어반아르떼', addr:'서귀포시 안덕면 화순리 2015', lat:33.2865, lng:126.2948, type:'apt', units:17, price:'미공개', area:'미공개', company:'서원종합건설㈜', since:'2026.7 기준', real:true, total:72, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:38, name:'도두 네오하임 주상복합 아파트 2차', addr:'제주시 도두일동 2619-2', lat:33.5038, lng:126.4642, type:'apt', units:16, price:'미공개', area:'미공개', company:'네오종합건설㈜', since:'2026.7 기준', real:true, total:64, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:39, name:'신화오션빌', addr:'서귀포시 안덕면 동광리 1600', lat:33.3029, lng:126.3360, type:'apt', units:16, price:'미공개', area:'미공개', company:'제이에이치', since:'2026.7 기준', real:true, total:44, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:40, name:'제주 푸르지오 더 퍼스트', addr:'서귀포시 대정읍 구억리 34', lat:33.2780, lng:126.2810, type:'apt', units:14, price:'미공개', area:'미공개', company:'㈜대우건설', since:'2026.7 기준', real:true, total:160, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:41, name:'스마트리치', addr:'서귀포시 서홍동 2596', lat:33.2633, lng:126.5578, type:'apt', units:12, price:'미공개', area:'미공개', company:'보아스메가텍', since:'2026.7 기준', real:true, total:69, note:'제주도 2026.7월 사업장별 미분양 현황' },
  { id:42, name:'휴온 아델리브 더 테라스', addr:'서귀포시 대정읍 구억리 865', lat:33.2784, lng:126.2819, type:'villa', units:12, price:'미공개', area:'미공개', company:'대창기업', since:'2026.7 기준', real:true, total:68, note:'제주도 2026.7월 사업장별 미분양 현황' },
];
