#!/usr/bin/env bash
set -euo pipefail

for pid_file in /tmp/chifoumi-e2e-api.pid /tmp/chifoumi-e2e-game1.pid /tmp/chifoumi-e2e-game2.pid /tmp/chifoumi-e2e-job.pid; do
  if [[ -f "$pid_file" ]]; then
    kill "$(cat "$pid_file")" 2>/dev/null || true
    rm -f "$pid_file"
  fi
done
