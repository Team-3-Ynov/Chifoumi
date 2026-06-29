# CLAUDE.md

> Guide projet pour les agents IA (Claude Code, Cursor, Codex…). Lis ce fichier **avant toute modification**. Il complète, sans le remplacer, le design figé dans [`docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md`](docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md) et le brief [`docs/consignes/projet.md`](docs/consignes/projet.md).
>
> 🛠 **Setup poste contributeur** (Cursor + skills `superpowers` & `impeccable`) : voir [`SETUP.md`](SETUP.md) à la racine.

---

## 1. Vue d'ensemble du projet

**Nom :** Chifoumi Ranked — plateforme web compétitive Pierre-Feuille-Ciseaux.
**Contexte :** projet d'évaluation YNOV (Expert Développement Web), module WebService.
**Priorité absolue :** **qualité de code, architecture et bonnes pratiques** > nombre de fonctionnalités (cf. grille de notation, coefficient Architecture ×10).

Fonctionnalités principales : matchmaking ELO, BO3 temps réel, anti-triche commit-reveal, ligues saisonnières, tournois, économie de skins.

---

## 2. Stack technique (figée)

| Couche | Choix | Notes |
|---|---|---|
| Monorepo | **PNPM workspaces** (pas Yarn) | `apps/*` + `packages/*` |
| Back | **NestJS** (TypeScript strict) | API, game-service, job-runner |
| Front | **React + Vite** | UX/UI volontairement minimaliste |
| BDD | **PostgreSQL 16** (Bitnami) + **Prisma** | Migrations versionnées |
| Cache / Pub-Sub / Queues | **Redis 7** (Bitnami) | Mutualisé entre apps |
| Jobs async | **BullMQ** | Workers paramétrés par env vars |
| Temps réel | **Socket.io** | Namespace `/game` |
| Inter-services | **gRPC** (`packages/proto`) | API ↔ Game Service |
| Auth | **JWT RS256** (15 min) + refresh opaque | Argon2id pour les mots de passe |
| Lint + Format | **Biome** (substitution validée par le prof, pas ESLint+Prettier) | Config dans `packages/biome` |
| Tests | **Jest** (back) + **Vitest** + **RTL** (front) | Couverture sélective |
| Logs | **Pino** | Structurés, corrélés par `requestId` / `matchId` |
| Observabilité | **Prometheus + Grafana** | Dashboards pré-provisionnés |
| CI/CD | **GitHub Actions** | `pr.yml` + `deploy.yml` |
| Hooks Git | **lefthook** | `biome check --write` + typecheck |

> Toute déviation de cette stack doit être justifiée et validée explicitement par l'équipe avant ouverture d'une PR.

---

## 3. Structure du monorepo

```text
ynov-rps/
├── apps/
│   ├── api/           ← NestJS REST + Swagger
│   ├── auth-service/  ← NestJS gRPC auth + JWT + refresh/reset
│   ├── game-service/  ← NestJS WebSocket + state machine BO3
│   ├── user-service/  ← NestJS gRPC profils/users/ratings
│   ├── job-runner/    ← NestJS standalone + BullMQ
│   └── front/         ← React + Vite
├── packages/
│   ├── biome/         ← config Biome partagée
│   ├── tsconfig/      ← tsconfig.base.json strict
│   ├── schemas/       ← schémas Zod (payloads WebSocket partagés)
│   ├── elo/           ← moteur ELO pur, 100 % testable
│   ├── proto/         ← définitions gRPC + stubs générés
│   └── db/            ← schéma Prisma + client généré
├── docs/              ← spec, backlog, ADRs
├── infra/             ← scripts init Postgres, clés JWT dev, etc.
├── docker-compose.yml
├── docker-compose.prod.yml
└── .github/workflows/
```

**Règles de structure :**

1. Une app dans `apps/` = un binaire lançable.
2. Un package dans `packages/` = code partagé. Ses dépendances tierces (`nestjs/common`, `react`, `zod`…) sont déclarées en **`peerDependencies` avec version `*`**. Les versions précises sont portées par les apps consommatrices.
3. Chaque app/package a son propre `package.json` nommé `@chifoumi/<nom>`, son `tsconfig.json` (étendant `packages/tsconfig`), et son `biome.json` (étendant `packages/biome`).
4. Le **Game Service n'accède pas à la BDD directement** : il vérifie les JWT via gRPC vers l'Auth Service et garde son état temps réel dans Redis.
5. L'**API** est le BFF REST public : elle expose Swagger/DTO/guards HTTP et délègue l'auth profonde à `auth-service` et les profils/users à `user-service` via gRPC.
6. `auth-service` et `user-service` sont des microservices internes : ils ne doivent pas être exposés par le gateway public, hors endpoints `/health` accessibles dans le réseau Docker.

---

## 4. Commandes essentielles

```bash
pnpm install                          # installe tout le monorepo
docker compose up -d                  # Postgres + Redis + MailHog
pnpm --filter @chifoumi/db prisma migrate dev  # migration BDD
pnpm --filter @chifoumi/<app> dev     # lancer une app en dev
pnpm -r typecheck                     # typecheck tout le repo
pnpm biome check                      # lint + format check
pnpm biome check --write              # auto-fix
pnpm -r test --coverage               # tests + coverage
pnpm -r build                         # build de toutes les apps/packages
```

Ports locaux par défaut :

| Service | HTTP | gRPC | Notes |
|---|---:|---:|---|
| `api` | 3000 | 50051 | BFF REST public + Swagger |
| `game-service` | 3001 | 50052 | Socket.io `/game` |
| `user-service` | 3004 | 50053 | Interne, profils/users/ratings |
| `auth-service` | 3006 | 50054 | Interne, JWT/refresh/reset |

Variables gRPC principales :

```bash
AUTH_SERVICE_GRPC_URL=localhost:50054
USER_SERVICE_GRPC_URL=localhost:50053
API_GRPC_URL=localhost:50054 # côté game-service, pointe vers auth-service
```

---

## 5. Règles de code non négociables

### TypeScript

- **`strict: true`** + `noImplicitAny`, `noImplicitOverride`, `noUncheckedIndexedAccess`, `strictNullChecks`.
- **Aucun `any` sans justification**. Si vraiment indispensable, commenter au-dessus :
  ```ts
  // any: lib externe sans typings, fallback acceptable ici
  const payload: any = parseLegacyFormat(input);
  ```
- Préfère les **types nominaux** (`type UserId = Brand<string, 'UserId'>`) pour les IDs critiques.
- Les DTO REST de l'API restent en `class-validator` + Swagger ; les schémas Zod de `packages/schemas` couvrent les payloads WebSocket partagés.

### NestJS

- Un module = un domaine fonctionnel, pas un fichier fourre-tout.
- Validation systématique via `class-validator` + `ValidationPipe` global avec `whitelist: true, forbidNonWhitelisted: true`.
- Guards de rôles via `@Roles('admin')` + `RolesGuard` global.
- Tous les endpoints sont annotés Swagger (`@ApiOperation`, `@ApiResponse`, `@ApiTags`).

### React

- Composants **fonctionnels** uniquement.
- Pas de `dangerouslySetInnerHTML` sans sanitization explicite (DOMPurify).
- Hooks personnalisés pour la logique réutilisable, colocalisés avec les composants.
- Pas de logique métier dans les composants : déléguer aux hooks ou aux services.

### Sécurité (rappel critique)

- **Mots de passe** : Argon2id (`memoryCost: 19456, timeCost: 2, parallelism: 1`).
- **JWT WS** : query string `?token=` accepté **uniquement en `wss://`**, jamais loggé (Pino `redact`), re-vérifié contre la blacklist Redis à chaque upgrade.
- **Rate limiting** : `@nestjs/throttler` sur `/auth/*` (5 req/min/IP) et `joinQueue` WS.
- **CORS** : whitelist explicite, jamais `*`.
- **Helmet** activé sur l'API.
- **Gateway** : Traefik est le seul point d'entrée public en mode scale. Il expose `front.localhost`, `api.localhost` et `game.localhost`, applique headers sécurité + rate limiting, et garde `auth-service` / `user-service` internes.
- **Anti-triche** : protocole commit-reveal, voir spec §5.2. Toute modification de la state machine **impose** de mettre à jour les tests `jest.useFakeTimers`.

---

## 6. Tests

Cible : **~70 % global**, **~95 % sur `packages/elo` et la state machine commit-reveal**.

- **Back** : Jest + `@nestjs/testing`. Tests d'intégration avec Supertest pour les flows critiques.
- **Front** : Vitest + React Testing Library. Mocks WebSocket via `vi.fn()`.
- **Exclusions explicites** via `coveragePathIgnorePatterns` (Jest) ou `coverage.exclude` (Vitest) :
  - DTOs, fichiers de bootstrap, configs
  - Code généré (Prisma, gRPC stubs)
  - Pages CRUD triviales du front
- Marquer les exclusions ponctuelles avec `/* istanbul ignore next */` + commentaire de justification.

**Règle TDD :** pour toute correction de bug, écrire d'abord un test rouge qui reproduit le bug, puis le faire passer.

---

## 7. Git & PRs (résumé — voir `.cursor/rules/git-conventions.mdc` pour le détail)

- Deux branches principales : **`main`** (évaluation) et **`develop`** (intégration).
- Branches de travail : `feature/<scope>-<courte-description>`, `fix/...`, `chore/...`, `docs/...`.
- **Conventional commits obligatoires**. Format strict, sinon le commit est retiré de la codebase finale (cf. brief).
- PR review **obligatoire** avant tout merge `develop` → `main`.
- **Merge non fast-forward** sur `main` (pas de squash, conserve la traçabilité des contributions individuelles — coefficient Suivi ×4).
- Préférer **plusieurs petits commits intermédiaires** à un gros commit monolithique.

---

## 8. Workflow recommandé pour un agent IA

1. **Lire la spec et le ticket** avant toute action (`docs/superpowers/specs/...` et le ticket `docs/backlog/...`).
2. **Identifier les fichiers impactés** avec une recherche ciblée plutôt qu'une exploration au hasard.
3. **Écrire ou ajuster les tests d'abord** quand c'est un bug ou une nouvelle règle métier (TDD).
4. **Implémenter** en respectant la stack et les conventions ci-dessus.
5. **Lancer la triade locale** : `pnpm biome check` + `pnpm -r typecheck` + `pnpm -r test --coverage`.
6. **Vérifier les seuils de couverture** : back ≥ 70 %, `packages/elo` ≥ 95 %, front ≥ 60 %.
7. **Commiter en conventional commits**, un changement = un commit logique.
8. **Ouvrir la PR vers `develop`** avec description claire (ticket lié, captures si UI, checklist DoD).

---

## 9. Définition de "Done" (DoD globale)

Un ticket n'est terminé que si **toutes** ces conditions sont vraies :

- [ ] Code écrit, revu, mergé sur `develop`.
- [ ] Tests ajoutés et passants ; couverture conforme aux seuils.
- [ ] `pnpm biome check` et `pnpm -r typecheck` verts en CI.
- [ ] Endpoints API documentés Swagger (si applicable).
- [ ] Aucun secret en clair, aucun mot de passe dans les logs.
- [ ] Acceptance criteria du ticket vérifiés un par un.
- [ ] Documentation à jour si comportement public modifié.

---

## 10. Ce qu'il NE faut PAS faire

- Introduire ESLint, Prettier, Yarn ou npm — Biome + PNPM sont figés.
- Utiliser `any` sans commentaire `// any: <raison>`.
- Mettre la logique métier directement dans un contrôleur NestJS ou un composant React.
- Squash-merger sur `main` (le brief impose **non-fast-forward**, traçabilité individuelle).
- Push direct sur `main` ou `develop` — **toujours** passer par PR.
- Désactiver une règle linter sans justification commentée.
- Ajouter une dépendance lourde sans validation de l'équipe (référent technique).
- Faire un commit qui mélange plusieurs changements logiques (ex. refacto + feature + fix).
- Logger un JWT, un mot de passe, un refresh token ou un nonce de commit-reveal.
