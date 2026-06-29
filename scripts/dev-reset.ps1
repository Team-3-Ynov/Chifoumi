# Reset Postgres/Redis volumes and start the dev stack.
$ErrorActionPreference = "Stop"

$RootDir = Resolve-Path (Join-Path $PSScriptRoot "..")
Set-Location $RootDir

Write-Host "=== dev-reset: tearing down volumes ==="
docker compose down -v

Write-Host "=== dev-reset: starting postgres, redis, mailhog (waiting for healthchecks) ==="
docker compose up -d --wait postgres redis mailhog
if ($LASTEXITCODE -ne 0) { Write-Error "Services failed to become healthy"; exit 1 }
Write-Host "Postgres is ready."

Write-Host "=== dev-reset: running migrations ==="
pnpm --filter @chifoumi/db migrate:deploy
if ($LASTEXITCODE -ne 0) { Write-Error "migrate:deploy failed"; exit 1 }

Write-Host "=== dev-reset: seeding database ==="
pnpm db:seed
if ($LASTEXITCODE -ne 0) { Write-Error "db:seed failed"; exit 1 }

Write-Host "=== dev-reset: seeding demo data (players, matches, ELO) ==="
pnpm --filter @chifoumi/db seed:demo
if ($LASTEXITCODE -ne 0) { Write-Error "seed:demo failed"; exit 1 }

Write-Host "=== dev-reset: starting dev servers ==="
pnpm dev
