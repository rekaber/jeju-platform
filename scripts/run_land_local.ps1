# 토지 실거래 로컬 백필 (2024-01 ~ 당월)
# 사용: .\scripts\run_land_local.ps1
#       .\scripts\run_land_local.ps1 -From 202401

param(
  [string]$From = '202401',
  [switch]$SkipGeocode
)

$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)

if (Test-Path .env) {
  Get-Content .env -Encoding UTF8 | ForEach-Object {
    $line = $_.Trim().TrimStart([char]0xFEFF)
    if ($line -match '^\s*#' -or $line -notmatch '=') { return }
    $k, $v = $line -split '=', 2
    $k = $k.Trim().TrimStart([char]0xFEFF)
    $v = $v.Trim().Trim('"').Trim("'")
    Set-Item -Path "Env:$k" -Value $v
  }
}
if (-not $env:MOLIT_API_KEY -and $env:MOLIT_KEY) { $env:MOLIT_API_KEY = $env:MOLIT_KEY }

foreach ($n in @('MOLIT_API_KEY', 'SUPABASE_URL', 'SUPABASE_SERVICE_KEY', 'KAKAO_REST_KEY')) {
  if (-not (Get-Item -Path "Env:$n" -ErrorAction SilentlyContinue).Value) {
    throw "환경변수 없음: $n (.env 확인)"
  }
}

$env:PYTHONUNBUFFERED = '1'
$pyArgs = @('scripts/fetch_incremental.py', '--from', $From, '--only', 'land_trades', '--force')
if ($SkipGeocode) { $pyArgs += '--skip-geocode' }

Write-Host "실행: python $($pyArgs -join ' ')"
Write-Host "월별 DELETE+INSERT (테이블 전체 clear 없음). 중단돼도 완료된 월은 유지됩니다."
python @pyArgs
