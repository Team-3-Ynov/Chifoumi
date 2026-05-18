# Design — US-004 Docker Compose dev (Postgres + Redis + MailHog)

**Date:** 2026-05-18  
**Ticket:** US-004 (EPIC-S0, Sprint 0)  
**Backlog:** `docs/backlog/sprint-0-setup.md` (US-004)  
**Platform design:** `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` (§3.2, §9.2)  
**Depends on:** US-003 (Prisma) for schema migrations — US-004 can ship in parallel; it only provisions infra.

## Goal

A new contributor with Docker installed runs `docker compose up -d` and gets a **healthy local infra stack** (Postgres, Redis, MailHog) in under 30 seconds, with a dedicated application database and user created on first boot. Application processes run on the host via PNPM; this ticket does not containerize Nest/React apps.

## Design decisions (brainstorming)

| Topic | Decision |
|-------|----------|
| Postgres init | `infra/postgres/init.sql` only: create DB `chifoumi` + role `app` (no tables, no business seed) |
| Dev credentials | Fixed passwords documented in `.env.example` (local dev only) |
| Host ports | Standard `5432`, `6379`, `8025` (SMTP `1025`) |
| Redis auth | None in dev (`ALLOW_EMPTY_PASSWORD=yes`, `redis://localhost:6379`) |
| Bootstrap approach | **init.sql only** (no `POSTGRESQL_DATABASE` / `POSTGRESQL_USERNAME` in compose — avoids duplicate creation with Bitnami env) |

## Scope

### In scope

- Root `docker-compose.yml` with services `postgres`, `redis`, `mailhog`
- Named volumes `pg_data`, `redis_data`
- Healthchecks on all three services
- `infra/postgres/init.sql` mounted to `/docker-entrypoint-initdb.d/`
- Root `.env.example` with `DATABASE_URL`, `REDIS_URL`, mail variables
- Confirm `.env` remains gitignored (already: `.env`, `.env.*`, `!.env.example`)

### Out of scope

- `docker-compose.prod.yml`, app containers, Traefik, Prometheus, Grafana
- Prisma schema, migrations, seed data (ligues, skins) — US-003 / later sprints
- Redis password / TLS (staging and prod)
- Automated smoke script or CI Docker job (US-005 baseline; e2e compose in sprint 1 devops)

## Architecture

```text
Host (PNPM apps)                    Docker network (default)
─────────────────                   ─────────────────────────
api / game-service / job-runner  →  localhost:5432  postgres (Bitnami 16)
                                    localhost:6379  redis (Bitnami 7)
                                    localhost:1025  mailhog SMTP
                                    localhost:8025  mailhog UI
```

No `depends_on` between infra services for US-004. Apps connect via `localhost` and published ports.

## Services

### `postgres`

| Setting | Value |
|---------|--------|
| Image | `bitnami/postgresql:16` (pin major tag, not `latest`) |
| Ports | `5432:5432` |
| Volume | `pg_data:/bitnami/postgresql` |
| Init mount | `./infra/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro` |
| Env | `POSTGRESQL_PASSWORD=postgres_dev` (Bitnami superuser `postgres` only) |

Do **not** set `POSTGRESQL_DATABASE` or `POSTGRESQL_USERNAME` in compose; `init.sql` creates `app` and `chifoumi`.

**Healthcheck:**

```yaml
test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1 -p 5432"]
interval: 5s
timeout: 5s
retries: 6
start_period: 10s
```

### `redis`

| Setting | Value |
|---------|--------|
| Image | `bitnami/redis:7` |
| Ports | `6379:6379` |
| Volume | `redis_data:/bitnami/redis/data` |
| Env | `ALLOW_EMPTY_PASSWORD=yes` |

**Healthcheck:**

```yaml
test: ["CMD", "redis-cli", "ping"]
interval: 5s
timeout: 3s
retries: 5
```

### `mailhog`

| Setting | Value |
|---------|--------|
| Image | `mailhog/mailhog` |
| Ports | `8025:8025` (UI), `1025:1025` (SMTP) |
| Volume | none (ephemeral dev mail) |

**Healthcheck:** HTTP probe on port 8025. If `mailhog/mailhog` lacks `wget`, use an equivalent documented in the PR (e.g. `CMD-SHELL` with tool available in the image).

## `infra/postgres/init.sql`

Runs **once** when `pg_data` is empty (standard Bitnami/Postgres init behavior).

```sql
CREATE ROLE app WITH LOGIN PASSWORD 'chifoumi_dev';
CREATE DATABASE chifoumi OWNER app;
GRANT ALL PRIVILEGES ON DATABASE chifoumi TO app;
```

- Password `chifoumi_dev` must match `DATABASE_URL` in `.env.example`.
- No `CREATE TABLE`, extensions, or reference data.
- Re-running init after schema changes requires `docker compose down -v` (document in README when US-009 lands).

Mounted scripts run as superuser during first initialization. Bitnami runs as UID `1001`; bind-mount from the repo is sufficient on Docker Desktop (Windows/macOS) and Linux.

## `.env.example` (repository root)

```dotenv
# Local development only — do not use these values in production.

DATABASE_URL=postgresql://app:chifoumi_dev@localhost:5432/chifoumi
REDIS_URL=redis://localhost:6379

MAIL_TRANSPORT=mailhog
MAIL_HOST=localhost
MAIL_PORT=1025

BULLMQ_PREFIX=rps
```

Contributors copy to `.env` (`cp .env.example .env`). `BULLMQ_PREFIX` is unused until job-runner work; included for stable env contract across sprint 0–1.

## Developer workflow

```bash
cp .env.example .env
docker compose up -d
docker compose ps   # all services healthy, < 30s typical

# After US-003:
pnpm --filter @chifoumi/db prisma migrate dev
pnpm --filter @chifoumi/api dev
```

## Error handling

| Situation | Expected behavior | Mitigation |
|-----------|-------------------|------------|
| Port 5432 or 6379 in use | Compose fails: port already allocated | Stop local Postgres/Redis or change mapping locally (non-default; not part of this spec) |
| Existing `pg_data` after editing `init.sql` | Init script not re-executed | `docker compose down -v` then `up -d` |
| Missing `.env` | App connection errors | Copy `.env.example` |
| Infra stopped | Connection refused from apps | `docker compose up -d` |

## Verification (backlog acceptance criteria)

| AC | Command / check |
|----|-----------------|
| AC1 | `docker compose up -d` → `docker compose ps` shows `postgres`, `redis`, `mailhog` **healthy** within 30s |
| AC2 | Fresh volume → `docker compose exec postgres psql -U postgres -c "\du"` lists `app`; `\l` lists `chifoumi` |
| AC3 | `docker compose exec redis redis-cli ping` → `PONG` |
| AC4 | Browser `http://localhost:8025` → MailHog UI |

No Jest/Vitest suite required for this ticket.

## Git delivery

- **Branch:** `chore/infra-docker-compose-dev`
- **Suggested commits (one logical change each):**
  1. `chore(docker): add dev compose for postgres redis mailhog (#<issue>)`
  2. `chore(infra): add postgres init script for chifoumi database (#<issue>)`
  3. `chore(repo): add root env example for local stack (#<issue>)`

Replace `<issue>` with the GitHub issue number for US-004.

## Future work (not US-004)

- Extend compose with `api`, `game-service`, `job-runner`, `front`, observability stack (platform §9.2).
- `docker-compose.prod.yml` and deploy pipeline secrets.
- Redis `requirepass` and `REDIS_URL` with credentials for non-dev environments.
- Reference data seed via Prisma seed or migration, not `init.sql`.
