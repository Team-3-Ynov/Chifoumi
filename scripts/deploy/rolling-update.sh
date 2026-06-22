#!/usr/bin/env bash
# Rolling update for production: pull images then restart one service at a time.
set -euo pipefail

COMPOSE_FILE="${1:-docker-compose.prod.yml}"
COMPOSE=(docker compose -f "${COMPOSE_FILE}")

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "Compose file not found: ${COMPOSE_FILE}" >&2
  exit 1
fi

if [ -f .env.prod ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.prod
  set +a
fi

export IMAGE_TAG="${IMAGE_TAG:-latest}"
echo "Rolling update with IMAGE_TAG=${IMAGE_TAG}"

ROLLING_SERVICES=(
  job-runner-match
  job-runner-misc
  api-1
  api-2
  game-1
  game-2
  front
  traefik
)

"${COMPOSE[@]}" pull

if "${COMPOSE[@]}" config --services | grep -qx db-migrate; then
  echo "Running db-migrate"
  "${COMPOSE[@]}" up db-migrate
fi

for service in "${ROLLING_SERVICES[@]}"; do
  if ! "${COMPOSE[@]}" config --services | grep -qx "${service}"; then
    echo "Skipping unknown service: ${service}"
    continue
  fi

  echo "Updating ${service}"
  "${COMPOSE[@]}" pull "${service}"
  "${COMPOSE[@]}" up -d --no-deps --remove-orphans "${service}"
  sleep 5
done

"${COMPOSE[@]}" up -d --remove-orphans
echo "Rolling update completed"
