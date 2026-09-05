# 제주 부동산 종합정보 플랫폼

GitHub Pages 웹서비스 + data.go.kr 실거래 수집 + **Supabase** DB

- 사이트: https://rekaber.github.io/jeju-platform/
- Supabase: `boukipzpoapqotvauzrj` (프로젝트명 jeju-platform)

## 구조

```
data.go.kr (국토부 RTMS)
        │
GitHub Actions (매일 / 수동)
  scripts/fetch_incremental.py
        │
Supabase (apt/house/rht/land/comm/arch/migration)
        │
GitHub Pages (`index.html` + `css/` + `js/` → REST anon)
```

## 프론트 파일 구조

```
index.html          # 마크업 + CSS/JS 로드만 (~1k줄)
css/
  style.css         # 메인 UI
  intro.css         # 인트로 오버레이
js/
  config.js         # Supabase URL/anon, 상수
  supabase.js       # sbFetchAll
  data-dong.js      # 법정동 기준점
  geo.js            # 지오캐시·동좌표·지오코딩
  intro.js          # 인트로
  unsold-data.js    # 미분양 정적 데이터
  map.js            # 카카오맵 초기화
  load-trades.js    # 실거래/토지 Supabase 로드·배지
  data-modal.js     # CSV/API 데이터 연결
  reg-zone.js       # 규제구역
  bid.js / arch.js / dev.js
  bubble.js         # 지역별 건수 버블
  trade.js / trade-layers.js
  stats.js / land.js / unsold.js / search.js
  migration.js / jiga.js / imde.js / land-stat.js
  toast-ui.js / boot.js
```

스크립트는 ES module이 아닌 일반 `<script src>` (전역 `var`/`function`). Vite 없음.

## 테이블

| 테이블 | 내용 |
|--------|------|
| `apt_trades` | 아파트 실거래 |
| `house_trades` | 단독/다가구 |
| `rht_trades` | 연립/다세대 |
| `land_trades` | 토지 |
| `comm_trades` | 상업용 |
| `arch_permits` | 건축인허가 |
| `migration_data` | 인구이동 |

스키마: `supabase/schema.sql`

## GitHub Secrets (이미 설정됨)

| Secret | 용도 |
|--------|------|
| `MOLIT_API_KEY` | data.go.kr |
| `SUPABASE_URL` | Supabase URL |
| `SUPABASE_SERVICE_KEY` | service_role (서버 전용) |
| `KAKAO_REST_KEY` | 지오코딩 |

Actions → **제주 부동산 데이터 자동 업데이트** → Run workflow

## 로컬 시드 (선택)

```bash
cp .env.example .env   # SERVICE_KEY 입력
python scripts/seed_from_json.py --only house
```

## Actions

| 워크플로 | 용도 |
|----------|------|
| `update_data.yml` | 매일 증분(기본 3개월) / 수동 실행 |
| `backfill_data.yml` | 수동 백필 — 기본 **2024-01 ~ 당월** + 테이블 clear |

백필 재적재:
Actions → **제주 부동산 전체 백필** → `from_ym=202401`, clear=`true` → Run

지오코딩은 **지번주소 우선** (Kakao Local API).

## 프론트 개선 요약

- 실거래는 Supabase만 사용 (로컬 JSON 폴백 없음). 레이어 OFF 시 배지 0건
- Supabase 페이지 fetch 동시성 제한 + count 검증
- API 키 HTML 하드코딩 제거 (localStorage만)
- 인구이동 Supabase 로드
- `geocodeByNameFallback` 전역화 (단독/연립/상업용 지오코딩)
- `index.html` CSS/JS 모듈 분리 (유지보수)

## 보안

- `service_role` 키는 Secrets / `.env` 에만 보관 (코드·커밋 금지)
- 과거 커밋에 키가 있었다면 Supabase에서 **키 재발급** 권장
- 프론트에는 **anon** 키만 사용 (RLS SELECT)
