-- 인구이동 테이블
CREATE TABLE IF NOT EXISTS migration_data (
  id         SERIAL PRIMARY KEY,
  year_month TEXT    NOT NULL,   -- e.g. '2026-04'
  direction  TEXT    NOT NULL,   -- 'out' | 'in'
  region     TEXT    NOT NULL,   -- e.g. '서울특별시'
  count      INTEGER,            -- 이동자수
  net_count  INTEGER,            -- 순이동자수
  lat        NUMERIC,
  lng        NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE migration_data ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read migration" ON migration_data FOR SELECT USING (true);
