#!/bin/sh
set -e

cd /app

pnpm --filter @chifoumi/db generate
pnpm --filter @chifoumi/db migrate:deploy
pnpm db:seed

exec node apps/api/dist/main.js
