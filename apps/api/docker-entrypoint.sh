#!/bin/sh
set -e

cd /app
pnpm --filter @chifoumi/db migrate:deploy

exec node apps/api/dist/main.js
