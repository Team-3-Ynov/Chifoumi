# Reset Postgres/Redis volumes and start the dev stack.
$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

Write-Host "=== dev-reset: tearing down volumes ==="
docker compose down -v

Write-Host "=== dev-reset: starting postgres, redis, mailhog ==="
docker compose up -d postgres redis mailhog

Write-Host "=== dev-reset: waiting for postgres to be ready on localhost:5432 ==="
$timeout = 30
$elapsed = 0
$ready = $false
while (-not $ready) {
    Start-Sleep -Seconds 1
    $elapsed++
    if ($elapsed -ge $timeout) {
        Write-Error "Postgres did not become ready within ${timeout}s"
        exit 1
    }
    # Step 1: host-level TCP check (ensures port forwarding is active)
    $tcpOk = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", 5432)
        $tcp.Close()
        $tcpOk = $true
    } catch {}
    if (-not $tcpOk) { continue }
    # Step 2: pg_isready inside container (ensures Postgres is accepting queries)
    $pgResult = docker compose exec -T postgres pg_isready -U postgres 2>&1
    if ($pgResult -match "accepting connections") {
        $ready = $true
    }
}
Write-Host "Postgres is ready."

Write-Host "=== dev-reset: running migrations ==="
pnpm --filter @chifoumi/db migrate:deploy
if ($LASTEXITCODE -ne 0) { Write-Error "migrate:deploy failed"; exit 1 }

Write-Host "=== dev-reset: seeding database ==="
pnpm db:seed
if ($LASTEXITCODE -ne 0) { Write-Error "db:seed failed"; exit 1 }

Write-Host "=== dev-reset: starting dev servers ==="
pnpm dev
