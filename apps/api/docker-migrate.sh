#!/bin/sh
set -e

cd /app

pnpm --filter @chifoumi/db migrate:deploy
