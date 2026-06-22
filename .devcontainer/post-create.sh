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
pnpm config set store-dir "$ROOT_DIR/pnpm-store"

if [ ! -f .env ]; then
  cp .env.example .env
  sed -i \
    -e 's#DATABASE_URL=postgresql://app:chifoumi_dev@localhost:5432/chifoumi#DATABASE_URL=postgresql://app:chifoumi_dev@postgres:5432/chifoumi#' \
    -e 's#REDIS_URL=redis://localhost:6379#REDIS_URL=redis://redis:6379#' \
    -e 's#MAIL_HOST=localhost#MAIL_HOST=mailhog#' \
    .env
fi

if [ ! -f infra/keys/jwt-private.pem ] || [ ! -f infra/keys/jwt-public.pem ]; then
  mkdir -p infra/keys
  openssl genrsa -out infra/keys/jwt-private.pem 2048
  openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
  chmod 600 infra/keys/jwt-private.pem
  chmod 644 infra/keys/jwt-public.pem
fi

pnpm install --frozen-lockfile
pnpm --filter @chifoumi/db generate
pnpm dlx lefthook install

printf '\nDev container ready. Run: pnpm --filter @chifoumi/db migrate:deploy && pnpm dev\n'
