# Chifoumi Ranked

[![PR workflow (develop)](https://github.com/Team-3-Ynov/Chifoumi/actions/workflows/pr.yml/badge.svg?branch=develop)](https://github.com/Team-3-Ynov/Chifoumi/actions/workflows/pr.yml?query=branch%3Adevelop)

Plateforme web compétitive Pierre-Feuille-Ciseaux avec matchmaking ELO, parties temps réel et services découpés en monorepo.

## Sommaire

- [Pré-requis](#pré-requis)
- [Démarrage rapide](#démarrage-rapide)
- [Devcontainer](#devcontainer)
- [Stack multi-replicas (US-030)](#stack-multi-replicas-us-030)
- [Démo multi-instances (US-032)](#démo-multi-instances-us-032)
- [Tech stack](#tech-stack)
- [Architecture](#architecture)
- [Commandes utiles](#commandes-utiles)
- [Liens utiles](#liens-utiles)
- [Contributing](#contributing)
- [Documentation](#documentation)

## Pré-requis

- Node.js `>=20.19.0`
- pnpm `9.15.9` via Corepack ou `npx pnpm@9.15.9`
- Docker Desktop ou Docker Engine avec Compose
- Git

## Démarrage rapide

```bash
pnpm install
cp .env.example .env
mkdir -p infra/keys
openssl genrsa -out infra/keys/jwt-private.pem 2048
openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
docker compose up -d postgres redis mailhog
pnpm --filter @chifoumi/db generate
pnpm --filter @chifoumi/db migrate:deploy
pnpm db:seed
pnpm dev
```

Sous PowerShell, remplace `cp .env.example .env` par `Copy-Item .env.example .env` et `mkdir -p infra/keys` par `New-Item -ItemType Directory -Force infra/keys`.

`pnpm dev` lance les apps sur la machine hôte. Il faut donc démarrer uniquement les dépendances Docker (`postgres`, `redis`, `mailhog`) pour éviter les conflits de ports avec les conteneurs applicatifs du `docker-compose.yml`.

Si les clés JWT existent déjà dans `infra/keys/`, ne les régénère pas : les tokens déjà émis seraient invalides.

## Premier lancement

Au premier démarrage (base Postgres vide), appliquer les migrations puis le seed :

```bash
docker compose up -d postgres redis mailhog
pnpm --filter @chifoumi/db migrate:deploy
pnpm db:seed
```

Le seed crée un compte admin par défaut :

| Champ | Valeur dev |
|---|---|
| Email | `admin@chifoumi.local` |
| Mot de passe | `admin-CHANGE-ME!` |
| Rôle | `admin` |
| ELO initial | `1000` |

**En production**, définir obligatoirement `ADMIN_DEFAULT_EMAIL` et `ADMIN_DEFAULT_PASSWORD` dans l'environnement — ne jamais conserver les valeurs par défaut.

Le seed est idempotent : relancé sur une base déjà initialisée, il ne duplique rien. En stack Docker scale, le job one-shot `db-migrate` exécute `migrate deploy` puis `db:seed` avant le démarrage des replicas API (skip si l'admin existe déjà).

Services lancés par `pnpm dev` :

| Service | URL locale | Rôle |
|---|---:|---|
| Front | `http://localhost:5173` | Interface React/Vite |
| API | `http://localhost:3000/health` | API HTTP NestJS |
| Game service | `http://localhost:3001/health` | Service temps réel Socket.io |
| Job runner | terminal uniquement | Workers et traitements asynchrones |

Si le schéma Postgres évolue et que tu veux repartir d'une base vide :

```bash
docker compose down -v
docker compose up -d postgres redis mailhog
pnpm --filter @chifoumi/db migrate:deploy
pnpm db:seed
```

### Stack Docker complète

Pour lancer aussi les apps en conteneurs (API x2, Game Service x2, Job Runner x2, Prometheus, Grafana), utilise :

```bash
docker compose up -d --build
```

Dans ce mode, ne pas exécuter `pnpm dev` en parallèle : les ports locaux `3000`, `3001`, `3002`, `3003` sont déjà utilisés par les conteneurs.

## Devcontainer

Le devcontainer lance un workspace Node + pnpm avec Postgres, Redis et MailHog. Le dossier local du repo doit rester nommé `Chifoumi`, car le workspace est monté dans le conteneur sous `/workspaces/Chifoumi`.

Au premier démarrage, `.devcontainer/post-create.sh` :

- copie `.env.example` vers `.env` avec les URLs internes Docker ;
- génère les clés JWT de développement dans `infra/keys/` si elles n'existent pas ;
- configure le store pnpm persistant dans `pnpm-store` ;
- installe les dépendances et génère le client Prisma.

Après ouverture dans VS Code ou Cursor, lancer les migrations puis les apps :

```bash
pnpm --filter @chifoumi/db migrate:deploy
pnpm dev
```

## Stack multi-replicas (US-030)

Stack containerisée complète avec Traefik, 2 replicas API, 2 replicas Game Service et observabilité.

### Pré-requis supplémentaires

Générer les clés JWT de dev (une seule fois) :

```bash
mkdir -p infra/keys
openssl genrsa -out infra/keys/jwt-private.pem 2048
openssl rsa -in infra/keys/jwt-private.pem -pubout -out infra/keys/jwt-public.pem
```

Ajouter les entrées suivantes au fichier hosts local (`C:\Windows\System32\drivers\etc\hosts` ou `/etc/hosts`) :

```text
127.0.0.1 api.localhost front.localhost game.localhost traefik.localhost grafana.localhost prometheus.localhost
```

### Lancer la stack

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d --build
```

Services démarrés : `postgres` x1, `redis` x1, `db-migrate` (one-shot), `api-1` + `api-2`, `game-1` + `game-2`, `job-runner-match` x1, `job-runner-misc` x1, `front` x1, `traefik` x1, `mailhog` x1, `prometheus` x1, `grafana` x1.

| Service | URL via Traefik | Port direct |
|---|---:|---|
| Front | `http://front.localhost` | — |
| API (round-robin) | `http://api.localhost/health` | — |
| Game WS (sticky) | `ws://game.localhost/game` | — |
| Traefik dashboard | `http://traefik.localhost` | — |
| Grafana | `http://grafana.localhost` | `http://localhost:3002` |
| Prometheus | `http://prometheus.localhost` | `http://localhost:9090` |
| MailHog | — | `http://localhost:8025` |

Vérifier le round-robin API : `curl http://api.localhost/health` plusieurs fois et comparer le champ `instance` (`api-1` / `api-2`) dans les logs ou la réponse JSON.

Démo de résilience : arrêter une instance API puis vérifier que `/health` répond toujours :

```bash
docker stop chifoumi-api-1
curl http://api.localhost/health
docker start chifoumi-api-1
```

Arrêter la stack :

```bash
docker compose -f docker-compose.yml -f docker-compose.scale.yml down
```

## Démo multi-instances (US-032)

Procédure de soutenance (~5 min) : deux joueurs sur des replicas Game Service différents, crash d'instance, Grafana live.

```bash
# Linux / macOS / Git Bash
bash scripts/demo/run-demo.sh

# Windows
.\scripts\demo\run-demo.ps1
```

Guide détaillé avec captures : [`docs/demo/multi-instances.md`](docs/demo/multi-instances.md).

## Tech stack

| Couche | Choix |
|---|---|
| Monorepo | PNPM workspaces |
| Back | NestJS, TypeScript strict |
| Front | React, Vite |
| BDD | PostgreSQL 16, Prisma |
| Cache / queues | Redis, BullMQ |
| Temps réel | Socket.io |
| Qualité | Biome, TypeScript, lefthook |
| CI | GitHub Actions |

Biome remplace ESLint + Prettier pour ce projet, choix validé et documenté dans [`packages/biome/README.md`](packages/biome/README.md).

## Architecture

La vue d'architecture versionnée est disponible dans [`docs/architecture.md`](docs/architecture.md).

Elle couvre les replicas Front/API/Game Service/Job Runner, les dépendances PostgreSQL/Redis/Prometheus/Grafana et les protocoles REST, WS Socket.io, gRPC, BullMQ et Prisma. Elle contient aussi les séquences de match complet et d'authentification utiles pour la soutenance.

La vision fonctionnelle complète reste dans [`docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md`](docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md). Les plans d'implémentation sont dans [`docs/superpowers/plans/`](docs/superpowers/plans/).

## Commandes utiles

```bash
pnpm dev
pnpm -r typecheck
pnpm -r run --if-present build
pnpm exec biome ci .
pnpm exec biome check --write .
pnpm -r run --if-present test --coverage
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

### Couverture de tests (US-044)

La CI échoue si la couverture descend sous les seuils définis par package :

| Package | Runner | Seuils (`lines` / `branches` / `functions`) |
|---|---|---|
| `apps/api`, `apps/game-service`, `apps/job-runner` | Jest | 70 % / 60 % / 70 % |
| `packages/elo` | Jest | 95 % / 95 % / 100 % |
| `apps/front` | Vitest | 60 % / 50 % / — |

Commande locale équivalente à la CI :

```bash
pnpm -r run --if-present test --coverage
```

Les rapports `lcov.info` / `coverage/` sont uploadés en artefact GitHub Actions (`coverage-reports`) à chaque PR.

#### Ajouter une exclusion explicite

Préférer exclure un fichier ou dossier entier plutôt que baisser un seuil global.

**Back (Jest)** — éditer `coveragePathIgnorePatterns` dans le `jest.config.cjs` du package concerné, avec un commentaire inline expliquant pourquoi (DTO, bootstrap, infra, e2e-only…) :

```js
coveragePathIgnorePatterns: [
  "/dto/", // DTOs — validation-only
  "main\\.ts$", // NestJS bootstrap
],
```

**Front (Vitest)** — ajouter un glob commenté dans `apps/front/vitest.config.ts` → `test.coverage.exclude`.

**Packages purement fonctionnels (`packages/elo`)** — viser 95 %+ ; n'exclure que les barrels (`index.ts`) ou le code généré.

### Job-runner (déploiement)

Le job-runner persiste les matchs terminés et envoie les notifications. Il utilise la **même base PostgreSQL que l'API** via Prisma.

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Connexion PostgreSQL (obligatoire) — persistance des matchs, rounds, ELO et historique |
| `REDIS_URL` | Redis pour BullMQ et publication `leaderboard:invalidate` |
| `WORKER_QUEUES` | Queues à écouter, ex. `match-events,notifications` |
| `WORKER_CONCURRENCY` | Nombre de jobs traités en parallèle par worker |
| `WORKER_ROLE` | Rôle logique du processus (`match-processor`, `notifier`, etc.) |
| `BULLMQ_PREFIX` | Préfixe des queues BullMQ (isole les environnements) |

En local, copier `.env.example` vers `.env` : `DATABASE_URL` est partagée entre l'API et le job-runner. En production, pointer `DATABASE_URL` vers la base applicative et `REDIS_URL` vers le cluster Redis partagé avec l'API et le game-service.

Tests d'intégration du worker match-events (Postgres + Redis requis) :

```bash
docker compose up -d postgres redis mailhog
pnpm --filter @chifoumi/db migrate:deploy
pnpm --filter @chifoumi/job-runner test:integration
```

## Liens utiles

| Outil | URL | Statut |
|---|---|---|
| Front | `http://localhost:5173` | disponible |
| API health | `http://localhost:3000/health` | disponible |
| Game service health | `http://localhost:3001/health` | disponible |
| Swagger | `http://localhost:3000/api/docs` | disponible |
| OpenAPI JSON | `http://localhost:3000/api/docs-json` | disponible |
| MailHog | `http://localhost:8025` | disponible après `docker compose up -d postgres redis mailhog` |
| Grafana | `http://localhost:3002` | disponible avec `docker-compose.scale.yml` |
| Grafana | `http://localhost:3030` | disponible avec `docker-compose.yml` seul |

En production, la documentation Swagger est protégée par Basic Auth via `SWAGGER_USER` et `SWAGGER_PASSWORD`.
Sans ces deux variables en production, les routes `/api/docs` et `/api/docs-json` ne sont pas exposées.

## Contributing

Le workflow Git, les conventions de commit et les règles de review sont dans [`CONTRIBUTING.md`](CONTRIBUTING.md).

Résumé :

- partir de `develop` à jour ;
- créer une branche `feature/*`, `fix/*`, `docs/*` ou `chore/*` ;
- utiliser des commits Conventional Commits ;
- ouvrir une PR vers `develop` ;
- attendre une review avant merge.

## Documentation

Le sommaire documentaire est dans [`docs/README.md`](docs/README.md).
