-- 제주 부동산 플랫폼 — 기존 Supabase(boukipzpoapqotvauzrj) 실제 스키마 기준
-- 이미 운영 중인 테이블과 컬럼을 문서화/재생성용으로 유지합니다.

CREATE TABLE IF NOT EXISTS apt_trades (
  id BIGSERIAL PRIMARY KEY,
  name TEXT, addr TEXT, sigungu TEXT, dong TEXT, roadaddr TEXT,
  type TEXT, area NUMERIC, price NUMERIC, date TEXT,
  floor INT, built INT, lat NUMERIC, lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS house_trades (
  id BIGSERIAL PRIMARY KEY,
  name TEXT, sigungu TEXT, dong TEXT, addr TEXT, roadaddr TEXT,
  house_type TEXT, type TEXT, area NUMERIC, plottage_ar NUMERIC,
  price NUMERIC, date TEXT, built INT, lat NUMERIC, lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS rht_trades (
  id BIGSERIAL PRIMARY KEY,
  name TEXT, sigungu TEXT, dong TEXT, addr TEXT, roadaddr TEXT,
  type TEXT, area NUMERIC, price NUMERIC, date TEXT,
  floor INT, built INT, lat NUMERIC, lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS land_trades (
  id BIGSERIAL PRIMARY KEY,
  addr TEXT, sigungu TEXT, dong TEXT, jibun TEXT, jimok TEXT,
  yongdo TEXT, doro TEXT, area NUMERIC, price NUMERIC, per_m2 NUMERIC,
  date TEXT, jibun_type TEXT, trade_type TEXT, lat NUMERIC, lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS comm_trades (
  id BIGSERIAL PRIMARY KEY,
  name TEXT, sigungu TEXT, dong TEXT, addr TEXT, roadaddr TEXT,
  type TEXT, build_use TEXT, building_type TEXT, building_use TEXT,
  land_use TEXT, area NUMERIC, land_area NUMERIC, plottage_ar NUMERIC,
  price NUMERIC, date TEXT, floor INT, built INT, lat NUMERIC, lng NUMERIC
);

CREATE TABLE IF NOT EXISTS arch_permits (
  id BIGSERIAL PRIMARY KEY,
  sigungu TEXT, dong TEXT, bld_nm TEXT, addr TEXT, purps TEXT,
  arch_gb TEXT, jimok TEXT, yongdo TEXT, tot_area NUMERIC, plat_area NUMERIC,
  arch_area NUMERIC, bc_rat NUMERIC, vl_rat NUMERIC, hhld_cnt INT, ho_cnt INT,
  pms_day TEXT, use_apr_day TEXT, lat NUMERIC, lng NUMERIC
);

CREATE TABLE IF NOT EXISTS migration_data (
  id SERIAL PRIMARY KEY,
  year_month TEXT NOT NULL,
  direction TEXT NOT NULL,
  region TEXT NOT NULL,
  count INTEGER,
  net_count INTEGER,
  lat NUMERIC,
  lng NUMERIC,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE apt_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE house_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE rht_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE land_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE comm_trades ENABLE ROW LEVEL SECURITY;
ALTER TABLE arch_permits ENABLE ROW LEVEL SECURITY;
ALTER TABLE migration_data ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public read apt" ON apt_trades;
DROP POLICY IF EXISTS "public read house" ON house_trades;
DROP POLICY IF EXISTS "public read rht" ON rht_trades;
DROP POLICY IF EXISTS "public read land" ON land_trades;
DROP POLICY IF EXISTS "public read comm" ON comm_trades;
DROP POLICY IF EXISTS "public read arch" ON arch_permits;
DROP POLICY IF EXISTS "public read migration" ON migration_data;

CREATE POLICY "public read apt" ON apt_trades FOR SELECT USING (true);
CREATE POLICY "public read house" ON house_trades FOR SELECT USING (true);
CREATE POLICY "public read rht" ON rht_trades FOR SELECT USING (true);
CREATE POLICY "public read land" ON land_trades FOR SELECT USING (true);
CREATE POLICY "public read comm" ON comm_trades FOR SELECT USING (true);
CREATE POLICY "public read arch" ON arch_permits FOR SELECT USING (true);
CREATE POLICY "public read migration" ON migration_data FOR SELECT USING (true);
