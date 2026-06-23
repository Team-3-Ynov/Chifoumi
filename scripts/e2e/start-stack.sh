#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [ -d infra/keys ]; then
  chmod a+r infra/keys/*.pem 2>/dev/null || true
fi

for attempt in 1 2 3; do
  if docker compose --project-name chifoumi-e2e -f docker-compose.e2e.yml up \
    --build --detach --wait --wait-timeout 180; then
    exit 0
  fi

  if [ "$attempt" -eq 3 ]; then
    break
  fi

  echo "E2E stack failed to start, retrying after cleanup ($attempt/3)..." >&2
  docker compose --project-name chifoumi-e2e -f docker-compose.e2e.yml down --remove-orphans || true
  sleep $((attempt * 5))
done

exit 1
