# Chifoumi Ranked

[![PR workflow (develop)](https://github.com/Team-3-Ynov/Chifoumi/actions/workflows/pr.yml/badge.svg?branch=develop)](https://github.com/Team-3-Ynov/Chifoumi/actions/workflows/pr.yml?query=branch%3Adevelop)

Plateforme web competitive Pierre-Feuille-Ciseaux avec matchmaking ELO, parties temps reel et services decoupes en monorepo.

## Sommaire

- [Pre-requis](#pre-requis)
- [Demarrage rapide](#demarrage-rapide)
- [Stack multi-replicas (US-030)](#stack-multi-replicas-us-030)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Commandes utiles](#commandes-utiles)
- [Liens utiles](#liens-utiles)
- [Contributing](#contributing)
- [Documentation](#documentation)

## Pre-requis

- Node.js `>=20.19.0`
- pnpm `9.15.9` via Corepack ou `npx pnpm@9.15.9`
- Docker Desktop ou Docker Engine avec Compose
- Git

## Demarrage rapide

```bash
pnpm install
cp .env.example .env
docker compose up -d
pnpm --filter @chifoumi/db generate
pnpm dev
```

Services lances par `pnpm dev` :

| Service | URL locale | Role |
|---|---:|---|
| Front | `http://localhost:5173` | Interface React/Vite |
| API | `http://localhost:3000/health` | API HTTP NestJS |
| Game service | `http://localhost:3001/health` | Service temps reel Socket.io |
| Job runner | terminal uniquement | Workers et traitements asynchrones |

Si le schema Postgres evolue, relancer une base vide avec `docker compose down -v`, puis `docker compose up -d`.

## Stack multi-replicas (US-030)

Stack containerisee complete avec Traefik, 2 replicas API, 2 replicas Game Service et observabilite.

### Pre-requis supplementaires

Generer les cles JWT de dev (une seule fois) :

```bash
mkdir -p infra/keys
openssl genrsa -out infra/keys/jwt-private.pem 2048
openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
```

Ajouter les entrees suivantes au fichier hosts local (`C:\Windows\System32\drivers\etc\hosts` ou `/etc/hosts`) :

```text
127.0.0.1 api.localhost front.localhost game.localhost traefik.localhost grafana.localhost prometheus.localhost
```

### Lancer la stack

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d --build
```

Services demarres : `postgres` x1, `redis` x1, `db-migrate` (one-shot), `api-1` + `api-2`, `game-1` + `game-2`, `job-runner-match` x1, `job-runner-misc` x1, `front` x1, `traefik` x1, `mailhog` x1, `prometheus` x1, `grafana` x1.

| Service | URL via Traefik | Port direct |
|---|---:|---|
| Front | `http://front.localhost` | — |
| API (round-robin) | `http://api.localhost/health` | — |
| Game WS (sticky) | `ws://game.localhost/game` | — |
| Traefik dashboard | `http://traefik.localhost` | — |
| Grafana | `http://grafana.localhost` | `http://localhost:3002` |
| Prometheus | `http://prometheus.localhost` | `http://localhost:9090` |
| MailHog | — | `http://localhost:8025` |

Verifier le round-robin API : `curl http://api.localhost/health` plusieurs fois et comparer le champ `instance` (`api-1` / `api-2`) dans les logs ou la reponse JSON.

Demo de resilience : arreter une instance API puis verifier que `/health` repond toujours :

```bash
docker stop chifoumi-api-1
curl http://api.localhost/health
docker start chifoumi-api-1
```

Arreter la stack :

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml down
```

## Tech stack

| Couche | Choix |
|---|---|
| Monorepo | PNPM workspaces |
| Back | NestJS, TypeScript strict |
| Front | React, Vite |
| BDD | PostgreSQL 16, Prisma |
| Cache / queues | Redis, BullMQ |
| Temps reel | Socket.io |
| Qualite | Biome, TypeScript, lefthook |
| CI | GitHub Actions |

Biome remplace ESLint + Prettier pour ce projet, choix valide et documente dans [`packages/biome/README.md`](packages/biome/README.md).

## Architecture

```text
apps/front          -> React + Vite
apps/api            -> NestJS REST, acces BDD via Prisma
apps/game-service   -> NestJS + Socket.io, namespace /game
apps/job-runner     -> NestJS standalone pour jobs async
packages/db         -> Prisma schema, migrations, client
packages/biome      -> configuration Biome partagee
packages/tsconfig   -> configurations TypeScript partagees
```

La vision d'architecture complete est dans [`docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md`](docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md). Les plans d'implementation sont dans [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Commandes utiles

```bash
pnpm dev
pnpm -r typecheck
pnpm -r run --if-present build
pnpm exec biome ci .
pnpm exec biome check --write .
docker compose ps
docker compose logs -f
```

Pour lancer une app seule :

```bash
pnpm --filter @chifoumi/api dev
pnpm --filter @chifoumi/game-service dev
pnpm --filter @chifoumi/job-runner dev
pnpm --filter @chifoumi/front dev
```

## Liens utiles

| Outil | URL | Statut |
|---|---|---|
| Front | `http://localhost:5173` | disponible |
| API health | `http://localhost:3000/health` | disponible |
| Game service health | `http://localhost:3001/health` | disponible |
| Swagger | `http://localhost:3000/api/docs` | disponible |
| OpenAPI JSON | `http://localhost:3000/api/docs-json` | disponible |
| MailHog | `http://localhost:8025` | disponible apres `docker compose up -d` |
| Grafana | `http://localhost:3002` | disponible avec `docker-compose.scale.yml` |

En production, la documentation Swagger est protegee par Basic Auth via `SWAGGER_USER` et `SWAGGER_PASSWORD`.
Sans ces deux variables en production, les routes `/api/docs` et `/api/docs-json` ne sont pas exposees.

## Contributing

Le workflow Git, les conventions de commit et les regles de review sont dans [`CONTRIBUTING.md`](CONTRIBUTING.md).

Resume :

- partir de `develop` a jour ;
- creer une branche `feature/*`, `fix/*`, `docs/*` ou `chore/*` ;
- utiliser des commits Conventional Commits ;
- ouvrir une PR vers `develop` ;
- attendre une review avant merge.

## Documentation

Le sommaire documentaire est dans [`docs/README.md`](docs/README.md).
