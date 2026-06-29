# EPIC-S0 — Setup monorepo + auth de base

**Sprint :** 0 (1 séance)
**Objectif :** poser tous les fondamentaux (monorepo, linter, BDD, Docker, CI, auth) pour que le sprint 1 puisse démarrer sans friction.
**Critères du brief couverts à la fin de l'epic :** monorepo PNPM, structure `apps/`+`packages/`, Biome, Docker-compose, CI, JWT, conventional commits, deux branches `main`/`develop`.

---

### US-001 — Initialiser le monorepo PNPM workspaces

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 3 SP
- **Réf. design** : §2 (Contraintes), §3.1 (Composantes)

#### Contexte
Tous les autres tickets dépendent du squelette du monorepo. On fige PNPM (cf. brief « PNPM ou Yarn », choix figé sur PNPM dans le design).

#### User story
En tant que **développeur de l'équipe**, je veux **un monorepo PNPM workspaces opérationnel avec les dossiers `apps/`, `packages/`, `docs/`** afin de **pouvoir installer toutes les dépendances en une commande et partager du code entre les apps**.

#### Acceptance criteria
- **AC1** : Given un poste vierge avec Node 20 + PNPM 9 installés, When je lance `pnpm install` à la racine, Then toutes les dépendances de toutes les `apps/*` et `packages/*` sont installées sans erreur.
- **AC2** : Given le repo cloné, When je liste les workspaces avec `pnpm -r list --depth -1`, Then je vois au minimum `apps/api`, `apps/game-service`, `apps/job-runner`, `apps/front`, `packages/tsconfig`, `packages/biome`, `packages/schemas`, `packages/db`, `packages/elo`, `packages/proto` (même vides).
- **AC3** : Given un `package.json` racine, When je l'ouvre, Then `packageManager` est figé sur `pnpm@9.x.x`, `engines.node` ≥ `20.0.0`, `private: true`.

#### Tâches techniques
- [ ] Créer `package.json` racine avec `workspaces` (`apps/*`, `packages/*`), `packageManager`, `engines`.
- [ ] Créer `pnpm-workspace.yaml`.
- [ ] Créer `.npmrc` racine (`shared-workspace-lockfile=true`, `strict-peer-dependencies=false` pour démarrer).
- [ ] Stub `package.json` minimal dans chaque app/package avec son `name` (`@chifoumi/api`, `@chifoumi/elo`, …).
- [ ] Mettre à jour `.gitignore` (déjà fait, vérifier `node_modules`, `.pnpm-store`, `dist`, `coverage`).

---

### US-002 — Configurer Biome + `packages/biome` + `packages/tsconfig`

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 5 SP
- **Réf. design** : §2, §9.1
- **Dépend de** : US-001

#### Contexte
Linter + formatter unifiés sur tout le monorepo. Biome remplace ESLint+Prettier (substitution **officiellement validée par le prof**). Un `packages/biome/README.md` documentera le tableau d'équivalence avec les modules ESLint listés au brief (`perfectionist`, `sonarjs`, `stylistic`, `typescript`, `unicorn`, `react`, `react-hooks`).

#### User story
En tant que **développeur**, je veux **un `biome check` qui passe à la racine et un `tsconfig.base.json` strict partagé** afin de **garantir la cohérence du code et la conformité aux règles TypeScript du brief**.

#### Acceptance criteria
- **AC1** : Given le repo, When je lance `pnpm biome check`, Then la commande analyse toutes les apps/packages et exit 0 sur le squelette vide.
- **AC2** : Given un fichier `.ts` mal formaté, When je commit, Then le hook `lefthook` lance `biome check --write` et le formatte automatiquement.
- **AC3** : Given le `tsconfig.base.json`, When je l'ouvre, Then il contient `strict: true`, `noImplicitAny: true`, `noImplicitOverride: true`, `noUncheckedIndexedAccess: true`, `target: ES2022`, `module: ESNext`. `strictNullChecks` est `true` (couvre `noImplicitNull` du brief).
- **AC4** : Given une violation `// any:` non commentée dans un PR, When la CI tourne, Then le job échoue ou produit un warning visible (règle Biome `noExplicitAny` configurée en `warn`).

#### Tâches techniques
- [ ] `packages/biome/biome.json` avec règles `recommended` + équivalents `unicorn`, `sonarjs`, `perfectionist`, `react`, `react-hooks` activés.
- [ ] `packages/tsconfig/base.json`, `packages/tsconfig/nest.json`, `packages/tsconfig/react.json` (extends base).
- [ ] Chaque app/package étend ces configs via `extends`.
- [ ] Installer `lefthook`, configurer `lefthook.yml` (pre-commit : `biome check --write` + `pnpm -r typecheck` sur fichiers modifiés).
- [ ] Rédiger `packages/biome/README.md` avec tableau d'équivalence Biome ↔ modules ESLint du brief, et y citer la validation prof.

---

### US-003 — Setup Prisma + `packages/db` (schéma users + elo_ratings)

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 5 SP
- **Réf. design** : §4 (Sprint 1 — Cœur ranked)
- **Dépend de** : US-001

#### Contexte
Schéma minimal pour l'auth (US-007). Le reste des tables (`matches`, `rounds`, `elo_history`) sera ajouté en sprint 1 (US-027).

#### User story
En tant que **développeur back**, je veux **un client Prisma généré dans `packages/db` partagé entre l'API et le job-runner** afin de **n'avoir qu'une seule source de vérité du schéma de données**.

#### Acceptance criteria
- **AC1** : Given une BDD Postgres vide démarrée par Docker, When je lance `pnpm --filter @chifoumi/db prisma migrate dev`, Then les tables `users` et `elo_ratings` sont créées avec les colonnes spécifiées au §4.
- **AC2** : Given une `app/api`, When j'importe `@chifoumi/db`, Then j'ai accès à un `PrismaClient` typé avec auto-complétion sur tous les modèles.
- **AC3** : Given le conteneur API qui démarre, When son entrypoint s'exécute, Then `prisma migrate deploy` est joué automatiquement avant le démarrage du serveur.
- **AC4** : Given un `pnpm install` fresh, When je build `@chifoumi/db`, Then `prisma generate` produit le client sans erreur.

#### Tâches techniques
- [ ] `packages/db/prisma/schema.prisma` : datasource Postgres, generator client, modèles `User`, `EloRating`.
- [ ] Index uniques (`User.email`, `User.displayName`).
- [ ] Index `EloRating.rating(sort: Desc)`.
- [ ] `packages/db/src/index.ts` exporte `PrismaClient` + ré-exporte les types.
- [ ] Script `pnpm --filter @chifoumi/db migrate:deploy` pour entrypoint Docker.
- [ ] Première migration commitée (`packages/db/prisma/migrations/`).

---

### US-004 — Docker-compose dev (Postgres + Redis + MailHog) + script init BDD

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 3 SP
- **Réf. design** : §3.2, §9.2
- **Dépend de** : US-003

#### Contexte
Brief : « Configuration `docker-compose` fonctionnelle demandée. Un script d'initialisation de base de données doit être automatiquement exécuté au premier lancement (conseil : cf. images Bitnami pour les bases). »

#### User story
En tant que **nouveau développeur clonant le projet**, je veux **lancer `docker compose up -d` et avoir une stack dev complète prête en 30s** afin de **commencer à coder sans setup manuel**.

#### Acceptance criteria
- **AC1** : Given un poste vierge avec Docker, When je lance `docker compose up -d`, Then les services `postgres`, `redis`, `mailhog` démarrent et passent leurs healthchecks en moins de 30s.
- **AC2** : Given Postgres au premier démarrage (volume vide), When le conteneur démarre, Then le script `infra/postgres/init.sql` est exécuté et crée la BDD `chifoumi` + un utilisateur applicatif `app` avec mot de passe non-root.
- **AC3** : Given Redis démarré, When je fais `docker compose exec redis redis-cli ping`, Then je reçois `PONG`.
- **AC4** : Given MailHog démarré, When j'ouvre `http://localhost:8025`, Then je vois l'UI de capture des mails.

#### Tâches techniques
- [ ] `docker-compose.yml` racine avec services `postgres` (Bitnami), `redis` (Bitnami), `mailhog`.
- [ ] Healthchecks sur chaque service.
- [ ] Volumes nommés (`pg_data`, `redis_data`).
- [ ] `infra/postgres/init.sql` monté dans `/docker-entrypoint-initdb.d/` (Bitnami).
- [ ] `.env.example` racine avec `DATABASE_URL`, `REDIS_URL`, `MAIL_HOST`, etc.

---

### US-005 — CI GitHub Actions (lint + typecheck + tests + build)

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 3 SP
- **Réf. design** : §9.3
- **Dépend de** : US-001, US-002

#### Contexte
Brief : « CI + déploiement continu (selon le cas) » + grille DevOps ×2 sur l'automatisation.

#### User story
En tant que **mainteneur**, je veux **une CI qui s'exécute sur chaque PR vers `develop` et `main`** afin de **bloquer les merges non conformes (lint, types, tests cassés)**.

#### Acceptance criteria
- **AC1** : Given une PR ouverte vers `develop`, When je la pousse, Then le workflow `.github/workflows/pr.yml` se déclenche et exécute en parallèle : `pnpm install --frozen-lockfile` → `biome ci` → `pnpm -r typecheck` → `pnpm -r test --coverage` → `pnpm -r build`.
- **AC2** : Given un job qui échoue, When je consulte la PR, Then le check est rouge et le merge est bloqué (branch protection à activer côté GitHub).
- **AC3** : Given le job `test`, When il finit, Then la couverture est uploadée comme artefact (Codecov optionnel).

#### Tâches techniques
- [ ] `.github/workflows/pr.yml` (matrix Node 20).
- [ ] Cache PNPM via `actions/setup-node` ou `pnpm/action-setup`.
- [ ] Job `lint`, job `typecheck`, job `test`, job `build` (peuvent dépendre les uns des autres ou tourner en parallèle).
- [ ] Ajouter badge CI dans le README racine.
- [ ] Configurer la branch protection sur `main` et `develop` côté GitHub (à documenter, fait dans l'UI).

---

### US-006 — Bootstrap apps (NestJS api/game-service/job-runner + Vite/React front) avec health endpoints

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 5 SP
- **Réf. design** : §3.1
- **Dépend de** : US-001, US-002

#### Contexte
Avoir 4 apps lançables (même quasi-vides) avant le sprint 1 — exigence du brief « a minima quatre applications ».

#### User story
En tant que **développeur**, je veux **chaque app démarrable indépendamment avec un endpoint `/health` qui répond `{status: "ok"}`** afin de **pouvoir vérifier l'environnement local et les conteneurs Docker**.

#### Acceptance criteria
- **AC1** : Given un terminal, When je lance `pnpm --filter @chifoumi/api dev`, Then NestJS démarre sur le port `3000` et `GET /health` renvoie `200 {status:"ok", service:"api", version:"x.y.z"}`.
- **AC2** : Idem pour `@chifoumi/game-service` (port `3001`), `@chifoumi/job-runner` (pas de port HTTP, log "ready"), `@chifoumi/front` (port `5173`).
- **AC3** : Given chaque app NestJS, When je build, Then la sortie `dist/` est exécutable via `node dist/main.js`.
- **AC4** : Chaque app a un `Dockerfile` multi-stage (`builder` → `runner`) prêt à être consommé par `docker-compose`.

#### Tâches techniques
- [ ] `apps/api` : `nest new` minimal, `HealthModule`, `main.ts` avec `app.listen(process.env.API_PORT ?? 3000)`.
- [ ] `apps/game-service` : idem + `Socket.io` brièvement initialisé (pas d'events encore).
- [ ] `apps/job-runner` : Nest standalone application (`NestFactory.createApplicationContext`) avec un log "ready".
- [ ] `apps/front` : `pnpm create vite` template `react-ts` + page d'accueil minimaliste affichant `health` API.
- [ ] Dockerfile par app + `.dockerignore`.

---

### US-007 — Auth de base : register / login / JWT RS256 + refresh token

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 5 SP
- **Réf. design** : §6.1, §7
- **Dépend de** : US-003, US-006

#### Contexte
Brief : « Système d'authentification et de gestion de rôles demandé. Privilégiez les JWT. » Sprint 0 livre la base, le sprint 1 ajoutera `logout` (blacklist) et `refresh` (US-014, US-015).

#### User story
En tant que **joueur**, je veux **pouvoir créer un compte avec email/mot de passe et me connecter pour recevoir un JWT** afin de **pouvoir accéder ensuite aux endpoints protégés et au matchmaking**.

#### Acceptance criteria
- **AC1** : Given une BDD vide, When je `POST /auth/register` avec `{ email, password (≥10 chars), displayName }`, Then je reçois `201 { user: {id, email, displayName, role:"player"}, tokens: { access, refresh } }` et un user est créé en BDD avec un `password_hash` Argon2id.
- **AC2** : Given un user existant, When je `POST /auth/register` avec le même email, Then je reçois `409 Conflict` et le payload n'expose pas si c'est l'email ou le displayName qui est en conflit (anti énumération).
- **AC3** : Given un user existant, When je `POST /auth/login` avec mot de passe valide, Then je reçois `200 { user, tokens }`. Avec mot de passe invalide → `401`.
- **AC4** : Given un access token, When je décode le payload, Then il contient `{ sub: userId, role, iat, exp }` et `exp - iat = 900` (15 min). Signature **RS256** (clé publique exposée à `GET /.well-known/jwks.json` ou simplement embarquée dans le service).
- **AC5** : Given un refresh token retourné, When je l'inspecte, Then c'est une chaîne **opaque** (UUID v4 ou random base64), persistée hashée en BDD (table `refresh_tokens`).
- **AC6** : Given un endpoint protégé `GET /me` (stub), When j'appelle sans Authorization, Then `401`. Avec Authorization Bearer valide, Then `200 { user }`.

#### Tâches techniques
- [ ] Module `AuthModule` dans `apps/api` avec `AuthController`, `AuthService`, `JwtStrategy` (passport-jwt RS256), `JwtAuthGuard`.
- [ ] Module `UsersModule` minimal (`UsersService.findById`, `findByEmail`, `create`).
- [ ] DTO `RegisterDto` / `LoginDto` validés par `class-validator` (email format, password min 10, displayName 3-30 alphanum).
- [ ] Hash Argon2id via `argon2` package, paramètres OWASP 2024 (`memoryCost: 19456, timeCost: 2, parallelism: 1`).
- [ ] Génération de paire RSA pour signer (clés stockées dans `infra/keys/` dev, env vars en prod).
- [ ] Migration Prisma : table `refresh_tokens(id, user_id, token_hash, expires_at, revoked_at?, created_at)`.
- [ ] Tests unitaires `AuthService` (hash, vérification, génération JWT).
- [ ] Tests d'intégration `register` + `login` + accès `/me` (Supertest).
- [ ] Swagger pour les endpoints (US-008 le packagera proprement).

#### Definition of Done (en plus de la DoD globale)
- [ ] Aucun mot de passe en clair dans les logs (vérifié par grep).
- [ ] Throttler `@nestjs/throttler` activé sur `/auth/*` (5 req/min/IP).

---

### US-008 — Swagger initial vide publié sur `/api/docs` (squelette)

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 2 SP
- **Réf. design** : §10 (sprint 0 livrable)
- **Dépend de** : US-006, US-007

#### Contexte
Le brief impose que l'API soit documentée par Swagger. On pose la mécanique dès le sprint 0 (UI accessible, auth Bearer configurée), et US-016 enrichira les endpoints en sprint 1.

#### User story
En tant que **développeur front et le reste de l'équipe**, je veux **une page Swagger fonctionnelle dès le sprint 0 listant les endpoints d'auth (`register`, `login`)** afin de **valider la mécanique de doc et avoir un référentiel partagé immédiat**.

#### Acceptance criteria
- **AC1** : Given l'API démarrée, When je `GET http://localhost:3000/api/docs`, Then je vois Swagger UI avec au moins le tag `auth` et les endpoints `POST /auth/register` + `POST /auth/login` documentés (request schema, responses 2xx/4xx).
- **AC2** : Le bouton "Authorize" Bearer est présent et fonctionnel.
- **AC3** : `GET /api/docs-json` renvoie un OpenAPI 3 valide (validable via `swagger-cli validate`).
- **AC4** : Le `package.json` racine expose un script `pnpm docs:openapi` qui dump le JSON dans `docs/openapi.json` (utile pour générer un client TS plus tard).

#### Tâches techniques
- [ ] `pnpm --filter @chifoumi/api add @nestjs/swagger`.
- [ ] `SwaggerModule.setup('api/docs', app, document)` dans `apps/api/src/main.ts` avec `DocumentBuilder().setTitle('Chifoumi API').setVersion('0.1.0').addBearerAuth()`.
- [ ] Annotations `@ApiTags('auth')`, `@ApiOperation()`, `@ApiResponse()` sur le `AuthController`.
- [ ] Annotations `@ApiProperty()` sur les DTOs `RegisterDto`, `LoginDto`, `TokensDto`.
- [ ] Script CI : `pnpm docs:openapi` génère `docs/openapi.json` et un check de non-régression peut être ajouté plus tard.

---

### US-009 — README racine + arbre `docs/` documenté + bootstrap onboarding

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 2 SP
- **Réf. design** : §1, §2 (Documentation), grille `docs/consignes/notation.md` (Documentation ×1)
- **Dépend de** : US-001, US-004, US-006

#### Contexte
Brief : « Fournir une documentation technique adaptée et claire qui permet à tout nouveau développeur d'appréhender facilement le projet ». C'est la porte d'entrée du repo, et le jury la consultera en premier.

#### User story
En tant que **nouveau membre de l'équipe (ou jury)**, je veux **un README racine clair qui me dit en 5 minutes : ce que fait le projet, comment le lancer, où trouver la doc** afin de **devenir productif immédiatement**.

#### Acceptance criteria
- **AC1** : Given le repo cloné, When j'ouvre le `README.md` racine, Then je trouve : titre + 1 phrase de pitch, badge CI, sommaire, sections "Pré-requis", "Démarrage rapide" (`pnpm install` → `docker compose up -d` → `pnpm dev`), "Architecture" (diagramme ou lien vers `docs/superpowers/specs/...`), "Contributing" (branches, conventional commits, PR), "Liens utiles" (Swagger, Grafana, MailHog).
- **AC2** : Le sommaire `docs/README.md` (déjà existant) est mis à jour pour pointer vers `docs/backlog/`, `docs/superpowers/specs/`, et toutes les futures sections.
- **AC3** : Un fichier `CONTRIBUTING.md` racine décrit : workflow Git (branche `feature/*` → PR vers `develop`), format conventional-commits avec exemples, exigence de review.
- **AC4** : Un fichier `.env.example` racine contient toutes les variables nécessaires avec valeurs par défaut commentées.
- **AC5** : Une section "Tech stack" dans le README liste les choix (NestJS, React, PNPM, Prisma, Postgres, Redis, BullMQ, Biome, Socket.io) en mentionnant que **Biome remplace ESLint+Prettier** (choix validé) et renvoie vers `packages/biome/README.md` pour le détail.

#### Tâches techniques
- [ ] Créer/écrire `README.md` racine.
- [ ] Mettre à jour `docs/README.md`.
- [ ] Créer `CONTRIBUTING.md`.
- [ ] Créer `.env.example` consolidé.
- [ ] Ajouter le badge GitHub Actions dans le README.

---

### US-044 — CI : configuration des seuils de couverture consolidés (back ≥70 %, front ≥60 %)

- **Epic** : EPIC-S0
- **Priorité** : P0
- **Sprint** : 0
- **Estimation** : 2 SP
- **Réf. design** : §8 (cible ~70 % global, 95 % packages/elo)
- **Dépend de** : US-005 (CI en place)

#### Contexte
Le brief impose une couverture front et back avec exclusions explicites. Sans seuils configurés en CI, on peut passer la PR avec 0 % de tests. On met en place les seuils dès le sprint 0 pour que toutes les stories sprint 1 « tirent » naturellement vers la couverture.

#### User story
En tant que **mainteneur**, je veux **que la CI échoue si la couverture descend sous les seuils définis** afin de **garantir que la dette de tests ne s'accumule pas et que le critère "Couverture ciblée" du brief reste tenu**.

#### Acceptance criteria
- **AC1** : Given une PR qui ajoute du code sans tests faisant chuter la couverture **back globale < 70 %**, When la CI tourne, Then le job `test` échoue avec un message clair pointant le seuil non respecté.
- **AC2** : Given `packages/elo`, When tests, Then **`coverageThreshold.lines = 95, branches = 95, functions = 100`** (Jest config). Sous le seuil → CI rouge.
- **AC3** : Given `apps/front`, When tests Vitest, Then **`coverage.thresholds.lines = 60, branches = 50`**.
- **AC4** : Given des fichiers exclus (DTOs, bootstrap, fichiers générés Prisma/proto, pages CRUD basiques front), When la couverture est calculée, Then ces fichiers sont **ignorés** via `coveragePathIgnorePatterns` (Jest) et `coverage.exclude` (Vitest), avec listes commentées dans les configs.
- **AC5** : Given la CI passée, When je consulte la PR, Then un commentaire automatique (action `actions/upload-artifact` + `coveralls` ou simplement `lcov.info` en artefact) m'indique la couverture actuelle.
- **AC6** : Le seuil global du monorepo (`pnpm -r test --coverage`) est documenté dans `README.md` racine.

#### Tâches techniques
- [ ] `apps/api/jest.config.ts` : `coverageThreshold.global = { lines: 70, branches: 60, functions: 70 }`.
- [ ] `apps/game-service/jest.config.ts` : idem (ajustable plus haut sur la state machine en US-035).
- [ ] `apps/job-runner/jest.config.ts` : idem.
- [ ] `packages/elo/jest.config.ts` : `coverageThreshold.global = { lines: 95, branches: 95, functions: 100 }`.
- [ ] `apps/front/vitest.config.ts` : `test.coverage.thresholds = { lines: 60, branches: 50 }`.
- [ ] Mise à jour du job `test` dans `.github/workflows/pr.yml` avec `--coverage` et upload artefacts.
- [ ] Documentation README sur "Comment ajouter une exclusion explicite".

---

### Récap Epic S0

| Story | SP | Priorité |
|---|---|---|
| US-001 Monorepo PNPM | 3 | P0 |
| US-002 Biome + tsconfig | 5 | P0 |
| US-003 Prisma + packages/db | 5 | P0 |
| US-004 Docker-compose dev | 3 | P0 |
| US-005 CI GitHub Actions | 3 | P0 |
| US-006 Bootstrap 4 apps | 5 | P0 |
| US-007 Auth de base | 5 | P0 |
| US-008 Swagger initial | 2 | P0 |
| US-009 README + onboarding | 2 | P0 |
| US-044 CI seuils de couverture | 2 | P0 |
| **Total** | **35 SP** | — |

> Ajustement : 35 SP sur 1 séance c'est très tendu. Si la séance déborde : **US-005 (CI)**, **US-009 (README)** et **US-044 (seuils coverage)** peuvent glisser au début du sprint 1 sans bloquer le développement local — mais doivent être livrés avant la fin du sprint 1.
