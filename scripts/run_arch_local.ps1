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
  if (-not (Get-Item -Path "Env:$n" -ErrorAction SilentlyContinue).Value) {
    throw "환경변수 없음: $n (.env 확인)"
  }
}

$env:PYTHONUNBUFFERED = '1'
if ($GeocodeOnly) {
  python scripts/fetch_arch.py --geocode-only
} else {
  python scripts/fetch_arch.py --days $Days
}
