# Chifoumi Ranked

[![PR workflow (develop)](https://github.com/Team-3-Ynov/Chifoumi/actions/workflows/pr.yml/badge.svg?branch=develop)](https://github.com/Team-3-Ynov/Chifoumi/actions/workflows/pr.yml?query=branch%3Adevelop)

Plateforme web competitive Pierre-Feuille-Ciseaux avec matchmaking ELO, parties temps reel et services decoupes en monorepo.

## Sommaire

- [Pre-requis](#pre-requis)
- [Demarrage rapide](#demarrage-rapide)
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
pnpm --filter @chifoumi/db migrate:deploy
pnpm dev
```

## Premier lancement

Au premier demarrage (base Postgres vide), appliquer les migrations puis le seed :

```bash
docker compose up -d postgres
pnpm --filter @chifoumi/db migrate:deploy
pnpm db:seed
```

Le seed cree un compte admin par defaut :

| Champ | Valeur dev |
|---|---|
| Email | `admin@chifoumi.local` |
| Mot de passe | `admin-CHANGE-ME!` |
| Role | `admin` |
| ELO initial | `1000` |

**En production**, definir obligatoirement `ADMIN_DEFAULT_EMAIL` et `ADMIN_DEFAULT_PASSWORD` dans l'environnement — ne jamais conserver les valeurs par defaut.

Le seed est idempotent : relance sur une base deja initialisee, il ne duplique rien. En conteneur Docker, l'entrypoint API execute `migrate deploy` puis `db:seed` avant le demarrage (skip si l'admin existe deja).

Services lances par `pnpm dev` :

| Service | URL locale | Role |
|---|---:|---|
| Front | `http://localhost:5173` | Interface React/Vite |
| API | `http://localhost:3000/health` | API HTTP NestJS |
| Game service | `http://localhost:3001/health` | Service temps reel Socket.io |
| Job runner | terminal uniquement | Workers et traitements asynchrones |

Si le schema Postgres evolue, relancer une base vide avec `docker compose down -v`, puis `docker compose up -d`.

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
| Grafana | `http://localhost:3002` | prevu avec la stack observabilite |

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
