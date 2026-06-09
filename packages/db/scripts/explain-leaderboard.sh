#!/usr/bin/env bash
set -euo pipefail

if [[ -z "${DATABASE_URL:-}" ]]; then
  echo "DATABASE_URL is required" >&2
  exit 1
fi

USER_ID="${BENCH_USER_ID:-$(psql "$DATABASE_URL" -Atc "SELECT id FROM users ORDER BY created_at LIMIT 1")}"

if [[ -z "$USER_ID" ]]; then
  echo "No users found. Run seed-bench first." >&2
  exit 1
fi

echo "=== US-028 EXPLAIN ANALYZE — leaderboard top 50 ==="
psql "$DATABASE_URL" -c "ANALYZE elo_ratings;"
psql "$DATABASE_URL" -c "
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT er.user_id, er.rating, er.games_played
FROM elo_ratings er
ORDER BY er.rating DESC, er.games_played DESC
LIMIT 50;
"

echo
echo "=== US-028 EXPLAIN ANALYZE — player history (user ${USER_ID}) ==="
psql "$DATABASE_URL" -c "ANALYZE matches;"
psql "$DATABASE_URL" -c "
EXPLAIN (ANALYZE, BUFFERS, FORMAT TEXT)
SELECT m.id, m.player_a_id, m.player_b_id, m.ended_at
FROM matches m
WHERE m.status = 'ended'
  AND m.ended_at IS NOT NULL
  AND (m.player_a_id = '${USER_ID}'::uuid OR m.player_b_id = '${USER_ID}'::uuid)
ORDER BY m.ended_at DESC, m.id DESC
LIMIT 21;
"
