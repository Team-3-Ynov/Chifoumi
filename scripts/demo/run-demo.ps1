# US-032 — Start multi-instance demo stack and open browser tabs (Windows).
$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..\..")
Set-Location $RootDir

$DemoClientBase = if ($env:DEMO_CLIENT_BASE) { $env:DEMO_CLIENT_BASE } else { "http://front.localhost/demo-client.html" }
$ApiUrl = if ($env:API_URL) { $env:API_URL } else { "http://api.localhost" }
$Game1Url = if ($env:GAME1_URL) { $env:GAME1_URL } else { "http://127.0.0.1:3101" }
$Game2Url = if ($env:GAME2_URL) { $env:GAME2_URL } else { "http://127.0.0.1:3102" }

Write-Host "== Chifoumi multi-instances demo (US-032) =="

$privateKey = Join-Path $RootDir "infra/keys/jwt-private.pem"
$publicKey = Join-Path $RootDir "infra/keys/jwt-public.pem"
if (-not (Test-Path $privateKey) -or -not (Test-Path $publicKey)) {
  Write-Host "Generating dev JWT keys in infra/keys/ ..."
  New-Item -ItemType Directory -Force -Path (Join-Path $RootDir "infra/keys") | Out-Null
  openssl genrsa -out $privateKey 2048
  openssl rsa -in $privateKey -pubout -out $publicKey
}

Write-Host "Starting scaled stack (with demo port mappings 3101/3102) ..."
docker compose -f docker-compose.yml -f docker-compose.scale.yml -f docker-compose.demo.yml up -d --build

function Wait-Healthy($Url, $Label) {
  for ($i = 1; $i -le 60; $i++) {
    try {
      $null = Invoke-WebRequest -Uri $Url -UseBasicParsing -TimeoutSec 3
      Write-Host "OK  $Label"
      return
    } catch {
      Start-Sleep -Seconds 2
    }
  }
  throw "Health check timeout for $Label ($Url)"
}

Write-Host "Waiting for health endpoints ..."
Wait-Healthy "$ApiUrl/health" "API"
Wait-Healthy "$Game1Url/health" "game-1"
Wait-Healthy "$Game2Url/health" "game-2"
Wait-Healthy "http://127.0.0.1:3002/api/health" "Grafana"

$playerA = "$DemoClientBase?player=A&apiUrl=$([uri]::EscapeDataString($ApiUrl))&gameUrl=$([uri]::EscapeDataString($Game1Url))"
$playerB = "$DemoClientBase?player=B&apiUrl=$([uri]::EscapeDataString($ApiUrl))&gameUrl=$([uri]::EscapeDataString($Game2Url))"

Write-Host ""
Write-Host "Stack ready. Open these URLs (4 browser windows recommended):"
Write-Host "  Player A (game-1): $playerA"
Write-Host "  Player B (game-2): $playerB"
Write-Host "  Grafana:           http://grafana.localhost  (admin / admin)"
Write-Host "  Traefik dashboard: http://traefik.localhost"
Write-Host ""
Write-Host "Full walkthrough: docs/demo/multi-instances.md"
Write-Host ""

if ($env:OPEN_BROWSER -ne "0") {
  Write-Host "Opening demo tabs (best effort) ..."
  Start-Process $playerA
  Start-Process $playerB
  Start-Process "http://grafana.localhost"
  Start-Process "http://traefik.localhost"
}
