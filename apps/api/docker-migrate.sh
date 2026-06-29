#!/bin/sh
set -e

cd /app

pnpm --filter @chifoumi/db migrate:deploy

if [ "${RUN_DB_SEED:-false}" = "true" ]; then
  pnpm db:seed
fi
