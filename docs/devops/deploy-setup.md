# Production deployment setup (US-045)

This guide documents the continuous deployment pipeline triggered by pushes to `main` via [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml).

## Overview

```text
push main → build 4 Docker images → push GHCR → SSH rolling deploy → smoke tests
```

Images published:

| Service | Image |
|---|---|
| API | `ghcr.io/team-3-ynov/chifoumi-api` |
| Game service | `ghcr.io/team-3-ynov/chifoumi-game-service` |
| Job runner | `ghcr.io/team-3-ynov/chifoumi-job-runner` |
| Front | `ghcr.io/team-3-ynov/chifoumi-front` |

Each successful deploy tags images with `:sha-<short>` and `:latest`.

## VPS prerequisites

1. **Docker Engine** and **Docker Compose v2** installed.
2. A dedicated Linux user (e.g. `deploy`) with SSH key access.
3. DNS records pointing to the VPS:
   - `DEPLOY_DOMAIN` → API (Traefik routes `/health`, `/api/*`, `/auth/*`, …)
   - `GAME_DOMAIN` → WebSocket game service (sticky sessions)
   - `FRONT_DOMAIN` → React front (nginx)
4. Managed **PostgreSQL** and **Redis** reachable from the VPS (connection strings in `.env.prod`).
5. Repository clone on the VPS at `DEPLOY_PATH` containing:
   - [`docker-compose.prod.yml`](../../docker-compose.prod.yml)
   - [`scripts/deploy/rolling-update.sh`](../../scripts/deploy/rolling-update.sh)
   - `.env.prod` (not committed)

### First-time VPS bootstrap

```bash
sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2
sudo usermod -aG docker deploy

git clone https://github.com/Team-3-Ynov/Chifoumi.git /opt/chifoumi
cd /opt/chifoumi
cp docs/devops/.env.prod.example .env.prod
# Edit .env.prod with real secrets and domains
chmod +x scripts/deploy/rolling-update.sh
```

Log in to GHCR on the VPS once (package read access for the org):

```bash
echo "$GITHUB_PAT" | docker login ghcr.io -u USERNAME --password-stdin
```

Use a classic PAT with `read:packages` or configure the VPS as a GitHub Actions deploy target only (the CD workflow pushes images; the VPS pulls them).

## GitHub configuration

### Repository secrets

Configure under **Settings → Secrets and variables → Actions → Secrets**:

| Secret | Description |
|---|---|
| `DEPLOY_HOST` | VPS public IP or hostname |
| `DEPLOY_USER` | SSH user (e.g. `deploy`) |
| `DEPLOY_SSH_KEY` | Private SSH key (PEM) for `DEPLOY_USER` |
| `DEPLOY_PATH` | Absolute path to the repo on the VPS (e.g. `/opt/chifoumi`) |
| `JWT_PRIVATE_KEY` | RSA private key PEM (can live in `.env.prod` on VPS instead) |
| `DATABASE_URL` | PostgreSQL connection string (usually only in `.env.prod`) |
| `REDIS_URL` | Redis connection string (usually only in `.env.prod`) |
| `MAIL_HOST` | SMTP host |
| `MAIL_PORT` | SMTP port |
| `MAIL_USER` | SMTP username |
| `MAIL_PASSWORD` | SMTP password |
| `MAIL_FROM` | Sender address |
| `SWAGGER_USER` | Basic auth user for `/api/docs` in production |
| `SWAGGER_PASSWORD` | Basic auth password for Swagger (required for smoke test) |

> Runtime secrets (`DATABASE_URL`, JWT keys, mail, …) are read from `.env.prod` on the VPS. GitHub secrets above are listed in the ticket AC4 for traceability; only deploy-related secrets are consumed directly by the workflow.

### Repository variables

| Variable | Description |
|---|---|
| `DEPLOY_DOMAIN` | Public API hostname used by smoke tests (`https://<domain>/health`) |

### Workflow permissions

Ensure **Settings → Actions → General → Workflow permissions** allows `GITHUB_TOKEN` to write packages (GHCR push).

## `.env.prod` on the VPS

See [`docs/devops/.env.prod.example`](./.env.prod.example). Minimum required keys:

```dotenv
IMAGE_TAG=latest
DEPLOY_DOMAIN=api.example.com
GAME_DOMAIN=game.example.com
FRONT_DOMAIN=app.example.com
ACME_EMAIL=ops@example.com
CORS_ORIGINS=https://app.example.com
FRONTEND_URL=https://app.example.com
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
JWT_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----"
JWT_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"
SWAGGER_USER=docs
SWAGGER_PASSWORD=change-me
MAIL_TRANSPORT=smtp
MAIL_HOST=smtp.example.com
MAIL_PORT=587
MAIL_USER=noreply@example.com
MAIL_PASSWORD=secret
MAIL_FROM=noreply@example.com
```

## Deploy flow

On push to `main`:

1. **Build** — matrix job builds `api`, `game-service`, `job-runner`, `front` using existing multi-stage Dockerfiles (`node:20-alpine` / nginx).
2. **Push** — images pushed to GHCR with `:sha-<short>` and `:latest`.
3. **Deploy** — [`appleboy/ssh-action`](https://github.com/appleboy/ssh-action) connects to the VPS, sets `IMAGE_TAG=sha-<short>` in `.env.prod`, then runs [`scripts/deploy/rolling-update.sh`](../../scripts/deploy/rolling-update.sh) for a one-by-one rolling restart.
4. **Smoke** — workflow checks:
   - `GET https://<DEPLOY_DOMAIN>/health` → `200` with `{ "status": "ok" }`
   - `GET https://<DEPLOY_DOMAIN>/api/docs-json` → `200` (with Swagger basic auth if configured)

PRs and pushes to branches other than `main` do **not** trigger `deploy.yml` (`on.push.branches: [main]` only).

## Rollback

Identify the previous image tag from GitHub Actions logs or GHCR (e.g. `sha-a1b2c3d`):

```bash
cd /opt/chifoumi
sed -i 's/^IMAGE_TAG=.*/IMAGE_TAG=sha-a1b2c3d/' .env.prod
docker compose -f docker-compose.prod.yml pull
bash scripts/deploy/rolling-update.sh docker-compose.prod.yml
```

Or pin a single service:

```bash
docker compose -f docker-compose.prod.yml pull api-1
IMAGE_TAG=sha-a1b2c3d docker compose -f docker-compose.prod.yml up -d --no-deps api-1
```

## Alternative: Coolify / Dokploy (bonus)

For a UI-driven deploy, [Coolify](https://coolify.io/) or [Dokploy](https://dokploy.com/) can watch GHCR and redeploy containers. The primary path for the YNOV demo remains the GitHub Actions pipeline above (build → GHCR → SSH → smoke) because it demonstrates the full DevOps loop in CI logs during the defense.

## Troubleshooting

| Symptom | Check |
|---|---|
| GHCR push denied | Workflow `packages: write` permission; org package visibility |
| SSH deploy fails | `DEPLOY_*` secrets, key authorized on VPS, `DEPLOY_PATH` exists |
| Health smoke timeout | Traefik ACME, DNS, `DATABASE_URL` / migrations |
| Swagger smoke 401 | Set `SWAGGER_USER` / `SWAGGER_PASSWORD` in `.env.prod` and GitHub secrets |
| Game WS disconnects | `GAME_DOMAIN` sticky cookie via Traefik labels |

## Related files

- [`.github/workflows/deploy.yml`](../../.github/workflows/deploy.yml)
- [`docker-compose.prod.yml`](../../docker-compose.prod.yml)
- [`scripts/deploy/rolling-update.sh`](../../scripts/deploy/rolling-update.sh)
