#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

if [ -d infra/keys ]; then
  chmod a+r infra/keys/*.pem 2>/dev/null || true
fi

docker compose --project-name chifoumi-e2e -f docker-compose.e2e.yml up \
  --build --detach --wait --wait-timeout 180
