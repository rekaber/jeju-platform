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
GitHub Pages (index.html → REST anon)
```

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

## 보안

- `service_role` 키는 Secrets / `.env` 에만 보관 (코드·커밋 금지)
- 과거 커밋에 키가 있었다면 Supabase에서 **키 재발급** 권장
