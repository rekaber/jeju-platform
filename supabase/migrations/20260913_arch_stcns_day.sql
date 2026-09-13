-- 건축인허가 착공일 컬럼 추가 (기존 DB용)
-- Supabase SQL Editor에서 1회 실행 후 scripts/fetch_arch.py 재수집
ALTER TABLE arch_permits ADD COLUMN IF NOT EXISTS stcns_day TEXT;
