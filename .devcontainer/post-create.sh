#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

sudo mkdir -p \
  /workspaces/Chifoumi/node_modules \
  /workspaces/Chifoumi/pnpm-store
sudo chown -R "$(id -u):$(id -g)" \
  /workspaces/Chifoumi/node_modules \
  /workspaces/Chifoumi/pnpm-store

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i \
    -e 's#DATABASE_URL=postgresql://app:chifoumi_dev@localhost:5432/chifoumi#DATABASE_URL=postgresql://app:chifoumi_dev@postgres:5432/chifoumi#' \
    -e 's#REDIS_URL=redis://localhost:6379#REDIS_URL=redis://redis:6379#' \
    -e 's#MAIL_HOST=localhost#MAIL_HOST=mailhog#' \
    .env
fi

if ! command -v pnpm >/dev/null 2>&1; then
  npm install -g pnpm@9.15.9
fi

pnpm install --frozen-lockfile
pnpm --filter @chifoumi/db generate
pnpm dlx lefthook install

printf '\nDev container ready. Run: pnpm --filter @chifoumi/db migrate:deploy && pnpm dev\n'
