#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

export DATABASE_URL="${DATABASE_URL:-postgresql://app:chifoumi_dev@localhost:5432/chifoumi}"
export REDIS_URL="${REDIS_URL:-redis://localhost:6379}"
export BULLMQ_PREFIX="${BULLMQ_PREFIX:-rps}"
export JWT_PRIVATE_KEY_PATH="${JWT_PRIVATE_KEY_PATH:-$ROOT_DIR/infra/keys/jwt-private.pem}"
export JWT_PUBLIC_KEY_PATH="${JWT_PUBLIC_KEY_PATH:-$ROOT_DIR/infra/keys/jwt-public.pem}"
export MATCHMAKING_WORKER_ENABLED="${MATCHMAKING_WORKER_ENABLED:-true}"
export WORKER_QUEUES="${WORKER_QUEUES:-match-events}"
export WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-8}"
export CRON_ENABLED="${CRON_ENABLED:-false}"

pnpm --filter @chifoumi/db build
pnpm --filter @chifoumi/elo build
pnpm --filter @chifoumi/api build
pnpm --filter @chifoumi/game-service build
pnpm --filter @chifoumi/job-runner build
pnpm --filter @chifoumi/db migrate:deploy

API_PORT=3000 node apps/api/dist/main.js &
API_PID=$!

GAME_SERVICE_PORT=3101 node apps/game-service/dist/main.js &
GAME1_PID=$!

GAME_SERVICE_PORT=3102 node apps/game-service/dist/main.js &
GAME2_PID=$!

node apps/job-runner/dist/main.js &
JOB_PID=$!

echo "$API_PID" > /tmp/chifoumi-e2e-api.pid
echo "$GAME1_PID" > /tmp/chifoumi-e2e-game1.pid
echo "$GAME2_PID" > /tmp/chifoumi-e2e-game2.pid
echo "$JOB_PID" > /tmp/chifoumi-e2e-job.pid

echo "E2E stack started (api=$API_PID, game1=$GAME1_PID, game2=$GAME2_PID, job=$JOB_PID)"
