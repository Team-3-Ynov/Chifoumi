# @chifoumi/db

Shared Prisma schema, migrations, and generated client for the Chifoumi monorepo.

## Commands

```bash
pnpm --filter @chifoumi/db generate
pnpm --filter @chifoumi/db migrate:dev
pnpm --filter @chifoumi/db migrate:deploy
pnpm --filter @chifoumi/db typecheck
```

Requires `DATABASE_URL` (see root `.env.example`).

## Tables

| Table | Purpose |
|---|---|
| `users` | Accounts (`player` / `admin`), sprint 0 |
| `refresh_tokens` | Opaque refresh token hashes, sprint 0 |
| `elo_ratings` | Current ELO rating per user, sprint 0 |
| `matches` | Ranked match sessions (players, score, status, timestamps), sprint 1 |
| `rounds` | Individual BO3 rounds with commit-reveal audit fields, sprint 1 |
| `elo_history` | ELO delta audit trail per user and match, sprint 1 |

## Sprint 1 ranked models (US-027)

### Enums

- `MatchStatus`: `in_progress`, `ended`, `aborted`
- `Move`: `rock`, `paper`, `scissors`
- `RoundWinner`: `a`, `b`, `draw`

### `matches`

- FKs: `player_a_id`, `player_b_id`, optional `winner_id` → `users`
- CHECK: `player_a_id <> player_b_id`
- Columns: `score_a`, `score_b`, `started_at`, `ended_at`, `status`

### `rounds`

- FK: `match_id` → `matches` (cascade delete)
- Unique index: `(match_id, round_number)`
- Nullable commit-reveal fields: `move_a/b`, `commit_a/b`, `nonce_a/b`
- Required: `winner`, `resolved_at`

### `elo_history`

- FKs: `user_id`, `match_id`
- Columns: `rating_before`, `rating_after`, `delta`, `created_at`

## Migration

Sprint 1 tables are created by migration `20260608120000_sprint_1_ranked_tables`.

Apply on a clean database:

```bash
docker compose down -v
docker compose up -d postgres
pnpm --filter @chifoumi/db migrate:deploy
```

Re-running `migrate:deploy` on an already migrated database is a no-op.

## Exports

`src/index.ts` re-exports `Match`, `Round`, `EloHistory` types and `MatchStatus`, `Move`, `RoundWinner` enums from `@prisma/client`.
