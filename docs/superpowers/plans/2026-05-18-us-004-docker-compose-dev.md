# US-004 Docker Compose dev Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a root `docker-compose.yml` stack (Postgres Bitnami legacy 16, Redis Bitnami legacy 7.4, MailHog) with healthchecks, first-boot SQL init for database `chifoumi` / user `app`, and `.env.example` so `docker compose up -d` yields a healthy local infra in under 30 seconds.

**Architecture:** Infra-only compose file at repo root; apps run on the host via PNPM. Postgres bootstrap uses `infra/postgres/init.sql` mounted into Bitnami’s `/docker-entrypoint-initdb.d/` (no `POSTGRESQL_DATABASE` / `POSTGRESQL_USERNAME` env vars). Redis has no password in dev (`ALLOW_EMPTY_PASSWORD=yes`).

**Tech stack:** Docker Compose v2, `bitnamilegacy/postgresql:16`, `bitnamilegacy/redis:7.4`, `mailhog/mailhog:v1.0.1`.

**Authoritative spec:** `docs/superpowers/specs/2026-05-18-us-004-docker-compose-dev-design.md`

---

## File map (this ticket)

| Path | Role |
|------|------|
| `docker-compose.yml` | Services `postgres`, `redis`, `mailhog`, volumes, healthchecks |
| `infra/postgres/init.sql` | First-boot: role `app`, database `chifoumi` |
| `.env.example` | Dev URLs for Postgres, Redis, mail, BullMQ prefix |

**Do not modify in US-004:** Prisma schema, app source, CI workflows, `docker-compose.prod.yml`, README (US-009).

**Read-only verify:** `.gitignore` already contains `.env`, `.env.*`, `!.env.example`.

---

### Task 0: Branch and preflight

**Files:**

- Read: `docs/superpowers/specs/2026-05-18-us-004-docker-compose-dev-design.md`
- Read: `.gitignore`

- [ ] **Step 1: Confirm Docker Compose v2**

Run:

```powershell
docker compose version
```

Expected: `Docker Compose version v2.x.x` (or `docker-compose` plugin present).

Run:

```powershell
docker info
```

Expected: Server running, no error.

- [ ] **Step 2: Use branch `chore/infra-docker-compose-dev`**

From repo root:

```powershell
git fetch origin
git checkout develop
git pull origin develop
git checkout -b chore/infra-docker-compose-dev
```

If the branch already exists (e.g. `feature/Docker-compose`), either rename to match conventions or continue on the existing branch after rebasing on `develop`:

```powershell
git checkout feature/Docker-compose
git fetch origin
git rebase origin/develop
```

Expected: `git branch --show-current` shows your feature branch, clean of unrelated changes.

- [ ] **Step 3: Confirm ports 5432 and 6379 are free**

Run:

```powershell
netstat -ano | findstr ":5432"
netstat -ano | findstr ":6379"
```

Expected: no LISTENING lines (or stop conflicting local Postgres/Redis before `docker compose up`).

---

### Task 1: Postgres init script

**Files:**

- Create: `infra/postgres/init.sql`

- [ ] **Step 1: Create directory and SQL file**

Create `infra/postgres/init.sql` with exactly:

```sql
CREATE ROLE app WITH LOGIN PASSWORD 'chifoumi_dev';
CREATE DATABASE chifoumi OWNER app;
GRANT ALL PRIVILEGES ON DATABASE chifoumi TO app;
```

- [ ] **Step 2: Commit**

```powershell
git add infra/postgres/init.sql
git commit -m "chore(infra): add postgres init script for chifoumi database (#4)"
```

---

### Task 2: Docker Compose file

**Files:**

- Create: `docker-compose.yml`

- [ ] **Step 1: Add `docker-compose.yml` at repository root**

Create `docker-compose.yml` with exactly:

```yaml
services:
  postgres:
    image: bitnamilegacy/postgresql:16
    container_name: chifoumi-postgres
    ports:
      - "5432:5432"
    environment:
      POSTGRESQL_PASSWORD: postgres_dev
    volumes:
      - pg_data:/bitnami/postgresql
      - ./infra/postgres/init.sql:/docker-entrypoint-initdb.d/01-init.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -h 127.0.0.1 -p 5432"]
      interval: 5s
      timeout: 5s
      retries: 6
      start_period: 10s
    restart: unless-stopped

  redis:
    image: bitnamilegacy/redis:7.4
    container_name: chifoumi-redis
    ports:
      - "6379:6379"
    environment:
      ALLOW_EMPTY_PASSWORD: "yes"
    volumes:
      - redis_data:/bitnami/redis/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5
    restart: unless-stopped

  mailhog:
    image: mailhog/mailhog:v1.0.1
    container_name: chifoumi-mailhog
    ports:
      - "8025:8025"
      - "1025:1025"
    healthcheck:
      test: ["CMD-SHELL", "wget -q -O /dev/null http://127.0.0.1:8025/ || exit 1"]
      interval: 10s
      timeout: 5s
      retries: 5
      start_period: 5s
    restart: unless-stopped

volumes:
  pg_data:
  redis_data:
```

Do **not** add `POSTGRESQL_DATABASE` or `POSTGRESQL_USERNAME` on `postgres`.

- [ ] **Step 2: Pull images and start stack (fresh volumes)**

Run:

```powershell
docker compose down -v
docker compose pull
docker compose up -d
```

Expected: three containers created, no immediate exit errors.

- [ ] **Step 3: Wait for healthy status (AC1)**

Run every 5s until all healthy or 60s elapsed:

```powershell
docker compose ps
```

Expected within 30s:

```text
chifoumi-postgres   ...   Up (healthy)
chifoumi-redis      ...   Up (healthy)
chifoumi-mailhog    ...   Up (healthy)
```

If `mailhog` stays `unhealthy`, inspect:

```powershell
docker compose logs mailhog
```

If `mailhog` stays `unhealthy`, keep the HTTP probe aligned with `docker-compose.yml` and inspect whether `wget` is available in the image before trying another documented probe. Do not change the MailHog image tag without noting it in the PR.

- [ ] **Step 4: Commit**

```powershell
git add docker-compose.yml
git commit -m "chore(docker): add dev compose for postgres redis mailhog (#4)"
```

---

### Task 3: Environment example

**Files:**

- Create: `.env.example`

- [ ] **Step 1: Create `.env.example` at repository root**

```dotenv
# Local development only — do not use these values in production.

DATABASE_URL=postgresql://app:chifoumi_dev@localhost:5432/chifoumi
REDIS_URL=redis://localhost:6379

MAIL_TRANSPORT=mailhog
MAIL_HOST=localhost
MAIL_PORT=1025

BULLMQ_PREFIX=rps
```

- [ ] **Step 2: Verify `.env.example` is tracked**

Run:

```powershell
git check-ignore -v .env.example
```

Expected: no match (file is not ignored thanks to `!.env.example` in `.gitignore`).

Run:

```powershell
Copy-Item .env.example .env
```

Confirm `.env` is ignored:

```powershell
git status
```

Expected: `.env` does **not** appear in untracked files.

- [ ] **Step 3: Commit**

```powershell
git add .env.example
git commit -m "chore(repo): add root env example for local stack (#4)"
```

---

### Task 4: Acceptance criteria verification

**Files:** none (manual verification)

- [ ] **Step 1: AC2 — Postgres role and database**

With stack running and **fresh** `pg_data` (already done in Task 2 if you used `down -v` once):

```powershell
docker compose exec postgres psql -U postgres -c "\du"
```

Expected: row for `app`.

```powershell
docker compose exec postgres psql -U postgres -c "\l"
```

Expected: database `chifoumi` with owner `app`.

Optional connection test as `app`:

```powershell
docker compose exec postgres psql -U app -d chifoumi -c "SELECT 1;"
```

Expected: `?column? | 1`.

- [ ] **Step 2: AC3 — Redis PONG**

```powershell
docker compose exec redis redis-cli ping
```

Expected: `PONG`.

- [ ] **Step 3: AC4 — MailHog UI**

Open in browser: `http://localhost:8025`

Expected: MailHog web UI loads.

- [ ] **Step 4: AC1 timing spot-check**

```powershell
docker compose down
docker compose up -d
Measure-Command { do { Start-Sleep -Seconds 2; $s = docker compose ps --format json | ConvertFrom-Json } while (($s.Health -notcontains 'healthy') -and ((Get-Date) -lt (Get-Date).AddSeconds(35))) }
docker compose ps
```

Expected: all three services `healthy` before 30s on a typical dev machine (note actual time in PR description if borderline).

- [ ] **Step 5: Teardown (optional, keep stack for US-003)**

```powershell
docker compose down
```

Use `docker compose down -v` only when you need to re-run `init.sql` from scratch.

---

### Task 5: PR checklist

- [ ] **Step 1: Push branch and open PR toward `develop`**

```powershell
git push -u origin HEAD
```

PR title: `chore(docker): add dev compose for postgres redis mailhog (#4)`

PR body must include:

- Link to US-004 / Closes #4
- Summary: infra-only compose, init.sql, `.env.example`
- Manual test checklist (AC1–AC4 commands above)
- Note: Prisma migrations remain US-003

- [ ] **Step 2: Confirm CI still green**

US-004 does not require Docker in CI. Ensure existing `pr.yml` (biome, typecheck) passes on the PR.

---

## Spec coverage checklist

| Spec requirement | Task |
|------------------|------|
| `docker-compose.yml` with postgres, redis, mailhog | Task 2 |
| Bitnami legacy postgres 16, redis 7.4 | Task 2 |
| Healthchecks all services | Task 2, 4 |
| Volumes `pg_data`, `redis_data` | Task 2 |
| `infra/postgres/init.sql` → initdb.d | Task 1, 2 |
| `.env.example` with DATABASE_URL, REDIS_URL, MAIL_* | Task 3 |
| AC1–AC4 verification | Task 4 |
| No app containers / no prod compose | Out of scope |
| `.env` gitignored | Task 3 step 2 |

## Out of scope (do not implement here)

- `docker-compose.prod.yml`, Prometheus, Grafana, Traefik
- Prisma schema or migrations (US-003)
- README onboarding updates (US-009)
- CI job running Docker
