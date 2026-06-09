#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

COMPOSE_FILES=(-f docker-compose.yml -f docker-compose.scale.yml -f docker-compose.demo.yml)
DEMO_CLIENT_BASE="${DEMO_CLIENT_BASE:-http://front.localhost/demo-client.html}"
API_URL="${API_URL:-http://api.localhost}"
GAME1_URL="${GAME1_URL:-http://127.0.0.1:3101}"
GAME2_URL="${GAME2_URL:-http://127.0.0.1:3102}"

echo "== Chifoumi multi-instances demo (US-032) =="

if [[ ! -f infra/keys/jwt-private.pem || ! -f infra/keys/jwt-public.pem ]]; then
  echo "Generating dev JWT keys in infra/keys/ ..."
  mkdir -p infra/keys
  openssl genrsa -out infra/keys/jwt-private.pem 2048
  openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
fi

echo "Starting scaled stack (with demo port mappings 3101/3102) ..."
docker compose "${COMPOSE_FILES[@]}" up -d --build

echo "Waiting for health endpoints ..."
bash scripts/demo/wait-healthy.sh "$API_URL/health" "API"
bash scripts/demo/wait-healthy.sh "$GAME1_URL/health" "game-1"
bash scripts/demo/wait-healthy.sh "$GAME2_URL/health" "game-2"
bash scripts/demo/wait-healthy.sh "http://127.0.0.1:3002/api/health" "Grafana"

player_a_url="${DEMO_CLIENT_BASE}?player=A&apiUrl=${API_URL}&gameUrl=${GAME1_URL}"
player_b_url="${DEMO_CLIENT_BASE}?player=B&apiUrl=${API_URL}&gameUrl=${GAME2_URL}"

echo ""
echo "Stack ready. Open these URLs (4 browser windows recommended):"
echo "  Player A (game-1): $player_a_url"
echo "  Player B (game-2): $player_b_url"
echo "  Grafana:           http://grafana.localhost  (admin / admin)"
echo "  Traefik dashboard: http://traefik.localhost"
echo ""
echo "Full walkthrough: docs/demo/multi-instances.md"
echo ""

open_url() {
  local url="$1"
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v open >/dev/null 2>&1; then
    open "$url" >/dev/null 2>&1 || true
  fi
}

if [[ "${OPEN_BROWSER:-1}" == "1" ]]; then
  echo "Opening demo tabs (best effort) ..."
  open_url "$player_a_url"
  open_url "$player_b_url"
  open_url "http://grafana.localhost"
  open_url "http://traefik.localhost"
fi
