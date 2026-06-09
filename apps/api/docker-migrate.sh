#!/bin/sh
set -e

cd /app

pnpm --filter @chifoumi/db migrate:deploy
pnpm db:seed
