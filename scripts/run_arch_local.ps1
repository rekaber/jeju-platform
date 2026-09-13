# 건축인허가 로컬 수집 (Hub API — Actions 대신 사용)
# 사용: .\scripts\run_arch_local.ps1
#       .\scripts\run_arch_local.ps1 -Days 980

param(
  [int]$Days = 120,
  [switch]$GeocodeOnly
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if (Test-Path .env) {
  Get-Content .env | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $k, $v = $_ -split '=', 2
    Set-Item -Path "Env:$($k.Trim())" -Value ($v.Trim().Trim('"').Trim("'"))
  }
}

foreach ($n in @('MOLIT_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'KAKAO_REST_KEY')) {
  if ($n -eq 'MOLIT_API_KEY' -and -not (Get-Item -Path "Env:MOLIT_API_KEY" -ErrorAction SilentlyContinue).Value) {
    if ((Get-Item -Path "Env:MOLIT_KEY" -ErrorAction SilentlyContinue).Value) {
      $env:MOLIT_API_KEY = $env:MOLIT_KEY
    }
  }
  if (-not (Get-Item -Path "Env:$n" -ErrorAction SilentlyContinue).Value) {
    throw "환경변수 없음: $n (.env 확인)"
  }
}

$env:PYTHONUNBUFFERED = '1'
python scripts/ensure_arch_stcns_day.py
if ($LASTEXITCODE -eq 2) {
  Write-Host ''
  Write-Host 'stcns_day 컬럼이 없습니다. Supabase SQL Editor에서 추가한 뒤 다시 실행하세요:' -ForegroundColor Yellow
  Write-Host '  ALTER TABLE arch_permits ADD COLUMN IF NOT EXISTS stcns_day TEXT;'
  exit 2
}
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

if ($GeocodeOnly) {
  python scripts/fetch_arch.py --geocode-only
} else {
  python scripts/fetch_arch.py --days $Days
}
