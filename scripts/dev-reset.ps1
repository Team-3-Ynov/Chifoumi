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
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("localhost", 5432)
        $tcp.Close()
        $ready = $true
    } catch {
        # port not yet open — keep waiting
    }
}
Write-Host "Postgres is ready."

Write-Host "=== dev-reset: running migrations ==="
pnpm --filter @chifoumi/db migrate:deploy

Write-Host "=== dev-reset: seeding database ==="
pnpm db:seed

Write-Host "=== dev-reset: starting dev servers ==="
pnpm dev
