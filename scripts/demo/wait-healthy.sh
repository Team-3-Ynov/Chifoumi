#!/usr/bin/env bash
set -euo pipefail

wait_url() {
  local url="$1"
  local label="${2:-$url}"
  for attempt in $(seq 1 60); do
    if curl -fsS "$url" >/dev/null 2>&1; then
      echo "OK  $label"
      return 0
    fi
    sleep 2
  done
  echo "FAIL $label (timeout after 120s)" >&2
  return 1
}

wait_url "$1" "${2:-$1}"
