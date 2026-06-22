#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

docker compose --project-name chifoumi-e2e -f docker-compose.e2e.yml up \
  --build --detach --wait --wait-timeout 180
