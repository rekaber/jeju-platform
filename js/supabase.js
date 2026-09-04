/* js/supabase.js - DB 연결 및 데이터 로더 (index.html 과 동기화된 유틸) */
async function sbFetchAll(table, select = '*', extraParams = '') {
  const pageSize = 1000;
  const concurrency = 5;
  const headers = { apikey: SUPABASE_ANON, Authorization: 'Bearer ' + SUPABASE_ANON };
  const countUrl = `${SUPABASE_URL}/rest/v1/${table}?select=id&limit=1${extraParams}`;
  const countR = await fetch(countUrl, { headers: { ...headers, Prefer: 'count=exact' } });
  if (!countR.ok) throw new Error(`[${table}] count ${countR.status}`);
  const cr = countR.headers.get('content-range') || '';
  const totalCount = parseInt(cr.split('/')[1], 10);
  if (!Number.isFinite(totalCount)) throw new Error(`[${table}] invalid content-range`);
  if (totalCount === 0) return [];

  const pages = Math.ceil(totalCount / pageSize);
  const results = new Array(pages);
  let next = 0;
  async function worker() {
    while (next < pages) {
      const i = next++;
      const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}&limit=${pageSize}&offset=${i * pageSize}${extraParams}`;
      const r = await fetch(url, { headers });
      if (!r.ok) throw new Error(`[${table}] page ${i} ${r.status}`);
      results[i] = await r.json();
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, pages) }, () => worker()));
  return results.flat();
}

function formatTradeCount(n) {
  return (Number(n) || 0).toLocaleString('ko-KR') + '건';
}
