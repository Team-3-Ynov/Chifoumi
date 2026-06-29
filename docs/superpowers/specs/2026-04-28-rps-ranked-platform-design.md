# Plateforme compétitive Pierre-Feuille-Ciseaux ranked — Design

**Date :** 2026-04-28
**Module :** WebService — Évaluation Formative (YNOV, Expert Développement Web)
**Statut :** Validé pour passage à l'implémentation plan

---

## 1. Vision produit

Plateforme web compétitive de Pierre-Feuille-Ciseaux (PFC) en ligne, multi-joueur temps réel, avec :

- Matchmaking ELO (1v1, Best-of-3)
- Anti-triche serveur basée sur un protocole **commit-reveal cryptographique**
- Ligues saisonnières (sprint 2)
- Tournois à brackets (sprint 3)
- Skins de mains et économie virtuelle (sprint 4)

L'UX/UI est volontairement minimaliste — le brief précise « aucune valorisation sur l'UX/UI ». L'effort se concentre sur l'architecture, la qualité de code et les bonnes pratiques.

---

## 2. Contraintes & objectifs (résumé du brief)

Doit être **strictement couvert** :

- Monorepo **PNPM workspaces** (choix figé : PNPM uniquement, pas Yarn), avec `apps/` et `packages/`
- Chaque package partagé (`packages/*`) déclare ses dépendances tierces en **`peerDependencies` avec version `*`** (ex : `nestjs/common`, `react`, `zod`, `@prisma/client`). Les versions précises sont portées par les `apps/*` qui consomment ces packages → bundles déduplifiés, pas de conflit de version, conforme à la règle 6 du brief (« Structure du monorepo »).
- Au moins **4 apps** : API, job-runner, micro-service dédié, frontend
- **Back NestJS**, **front React**
- TypeScript strict (`noImplicitAny`, `noImplicitNull`). **Aucun `any` toléré sans commentaire de justification** au-dessus de la déclaration (`// any: <raison>` ou `/** any justifié : <raison> */`). Règle vérifiée en code review et, dans la mesure du possible, par une règle linter (`noExplicitAny` warn + revue manuelle pour les cas `// any:` admis).
- BDD principale (Postgres) avec index cohérents
- API documentée par **Swagger**
- **Job-runner** avec BullMQ
- **Redis** (cache, pub/sub, jobs, scalabilité, blacklist JWT)
- **Multi-instances démontrable** (réplicas API + Game Service)
- **JWT** pour l'authentification + gestion de rôles
- Couverture de tests front et back (sélective)
- Sécurité (SQLi, XSS, accès par rôles)
- `docker-compose` fonctionnel + script init BDD au premier lancement
- CI + déploiement continu (selon le cas)
- Linter + formatter : **Biome** (substitution officiellement validée par le prof, choix figé pour le projet)
- Conventional commits, deux branches `main` + `develop`, PR uniquement sur `main`

---

## 3. Architecture globale

### 3.1 Composantes

```text
ynov-rps/
├── apps/
│   ├── api/           ← NestJS, REST + Swagger : auth, profils, ELO, ligues, leaderboards, historique, boutique
│   ├── game-service/  ← NestJS, micro-service temps réel : WebSocket clients, matchmaking ELO,
│   │                    state machine BO3, commit-reveal anti-triche
│   ├── job-runner/    ← NestJS + BullMQ : mails, reset saisonnier, recalcul ELO en batch,
│   │                    génération de brackets, distribution de récompenses
│   └── front/         ← React + Vite : login, lobby, écran de match, leaderboard, profil, boutique
├── packages/
│   ├── biome/         ← config Biome partagée (étendue par chaque app)
│   ├── tsconfig/      ← tsconfig.base.json strict
│   ├── schemas/       ← schémas Zod partagés (DTOs API, payloads WebSocket)
│   ├── elo/           ← moteur ELO pur (logique testable à 100%, sans I/O)
│   ├── proto/         ← définitions gRPC `.proto` + stubs générés
│   └── db/            ← schéma Prisma + client généré, partagé entre API et job-runner
│                         (le Game Service n'accède pas directement à la BDD : il passe par gRPC)
├── docker-compose.yml
├── docker-compose.prod.yml
├── .github/workflows/
└── docs/
```

### 3.2 Dépendances externes

- **PostgreSQL 16** (image Bitnami) — BDD principale
- **Redis 7** (image Bitnami) — queue matchmaking, pub/sub WS, cache, blacklist JWT, locks distribués, BullMQ
- **MailHog** (dev) — capture des mails
- **Prometheus + Grafana** — métriques et dashboards

### 3.3 Communication inter-services

| Lien | Protocole | Justification |
|---|---|---|
| Client → API | REST + Swagger | Imposé par le brief. CRUD froid. |
| Client → Game Service | WebSocket (Socket.io) | Temps réel bidirectionnel. Auth JWT en query string. |
| Game Service → API | gRPC | Synchrone, type-safe, contrats `.proto` versionnés. Vérif JWT, lecture rating. |
| Game Service → Job-runner | BullMQ (Redis) | Async, idempotent. Events `match-ended` → calcul ELO + persistence. |
| API → Job-runner | BullMQ (Redis) | Mails, jobs déclenchés par actions utilisateur. |

---

## 4. Schéma de données (Postgres / Prisma)

### Sprint 1 — Cœur ranked

| Table | Champs principaux | Index |
|---|---|---|
| `users` | `id (uuid)`, `email (unique)`, `password_hash`, `display_name`, `role (enum: player\|admin)`, `created_at` | `email`, `display_name` |
| `elo_ratings` | `user_id (fk pk)`, `rating (int, default 1000)`, `games_played`, `updated_at` | `rating DESC` |
| `matches` | `id`, `player_a_id`, `player_b_id`, `winner_id?`, `score_a`, `score_b`, `started_at`, `ended_at`, `status (enum)` | `(player_a_id, ended_at DESC)`, `(player_b_id, ended_at DESC)` |
| `rounds` | `id`, `match_id`, `round_number`, `commit_a`, `commit_b`, `move_a?`, `move_b?`, `nonce_a?`, `nonce_b?`, `winner (enum: a\|b\|draw)`, `resolved_at` | `(match_id, round_number)` unique |
| `elo_history` | `id`, `user_id`, `match_id`, `rating_before`, `rating_after`, `delta`, `created_at` | `(user_id, created_at DESC)` |

> Conservation des `commit/reveal/nonce` dans `rounds` : audit trail cryptographique. N'importe qui peut rejouer un match a posteriori et vérifier qu'aucun joueur n'a triché. Coût stockage négligeable (~150 octets par round).

### Sprint 2 — Ligues saisonnières

| Table | Champs principaux |
|---|---|
| `seasons` | `id`, `name`, `started_at`, `ends_at`, `status (enum: upcoming\|active\|closed)`. **Une seule active à la fois.** |
| `leagues` | `id`, `name (Bronze/Silver/Gold/...)`, `min_rating`, `max_rating`, `tier (int)` |
| `season_standings` | `id`, `season_id`, `user_id`, `final_rating`, `final_league_id`, `rank`, `rewards_distributed (bool)` |

### Sprint 3 — Tournois

| Table | Champs principaux |
|---|---|
| `tournaments` | `id`, `name`, `format (enum: single_elim\|double_elim)`, `bracket_size`, `registration_opens_at`, `starts_at`, `status`, `winner_id?` |
| `tournament_registrations` | `tournament_id`, `user_id`, `seed?` (PK composite) |
| `tournament_matches` | `id`, `tournament_id`, `round`, `match_id (fk→matches)`, `slot_a`, `slot_b` |

### Sprint 4 — Skins & économie

| Table | Champs principaux |
|---|---|
| `wallets` | `user_id (pk)`, `coins (int)` (solde mémoïsé) |
| `wallet_txs` | `id`, `user_id`, `delta`, `reason (enum)`, `ref_id?`, `created_at`. Source de vérité. |
| `skins` | `id`, `name`, `rarity`, `price_coins`, `image_url`, `available (bool)` |
| `user_skins` | `user_id`, `skin_id`, `acquired_at`, `equipped (bool)` (PK composite) |

**ORM :** Prisma. Schéma déclaratif dans `packages/db/prisma/schema.prisma`, client généré exporté par `packages/db` et importé par l'API et le job-runner. Migrations versionnées, jouées automatiquement au démarrage du conteneur API (via `prisma migrate deploy` en entrypoint).

---

## 5. Flux du match ranked (sprint 1)

### 5.1 Vue d'ensemble

```text
1. Login HTTP → API renvoie JWT (RS256, 15min) + refresh token (long, opaque)
2. Client ouvre WS au Game Service avec JWT en query string
3. Game Service appelle Auth.VerifyToken(jwt) en gRPC sur l'API → reçoit { userId, rating }
4. Client `joinQueue` → Game Service insère { userId, rating, ts } dans le sorted set Redis
5. Worker matchmaking (loop ~500ms ou sur ajout) trouve une paire dans une fenêtre ELO
   (ex: ±50 au début, ±100 après 10s, ±200 après 30s) → crée une session de match
6. Round joué via commit-reveal (voir 5.2)
7. Best-of-3 jusqu'à ce qu'un joueur atteigne 2 victoires
8. Match terminé :
   - Game Service publie event BullMQ `match-ended` (avec rounds détaillés)
   - Job-runner consomme : persiste match + rounds, calcule ELO via packages/elo,
     met à jour elo_ratings, écrit elo_history, invalide cache leaderboard
9. Front rafraîchit profil et leaderboard
```

### 5.2 Protocole commit-reveal d'un round

**State machine :**

```text
WAITING_COMMITS  ── les deux commits reçus ──>  WAITING_REVEALS
WAITING_COMMITS  ── timeout (5s) ───────────>  RESOLVED (forfeit du manquant)
WAITING_REVEALS  ── les deux reveals reçus ─>  RESOLVED (vérif hash, calcul gagnant)
WAITING_REVEALS  ── timeout (5s) ───────────>  RESOLVED (forfeit du manquant)
WAITING_REVEALS  ── hash invalide ──────────>  RESOLVED (forfeit du tricheur)
```

**Phase 1 — Commit :**
- Chaque client génère un nonce aléatoire (16 octets hex).
- Chaque client envoie `commit = SHA256(move + ":" + nonce)` au serveur.
- Le serveur ne sait rien du coup à ce stade.
- Quand les **deux** commits sont reçus, le serveur broadcast `commitsReceived` et démarre la phase reveal (deadline +5s).

**Phase 2 — Reveal :**
- Chaque client envoie `(move, nonce)`.
- Le serveur recalcule `SHA256(move + ":" + nonce)` et vérifie que ça correspond au commit stocké.
- Hash invalide → forfeit immédiat du tricheur.
- Les deux reveals reçus → résolution standard PFC, broadcast `roundResolved`.

**Garantie :** un client ne peut pas adapter son coup en fonction de celui de l'adversaire, parce qu'il s'est *engagé* cryptographiquement avant que l'autre coup ne soit observable.

### 5.3 Persistence d'état multi-instances

L'état du match est stocké dans Redis (clé `match:{matchId}:state`, TTL 1h) en plus d'être en mémoire de l'instance qui orchestre. Pub/sub Redis (`channel: match:{matchId}`) permet à deux clients connectés à des réplicas différents de Game Service de recevoir les mêmes events. Si un client se déconnecte/reconnecte, n'importe quelle réplique peut récupérer l'état depuis Redis.

---

## 6. Contrats d'API

### 6.1 REST (Client ↔ API)

**Auth :**
- `POST /auth/register` — `{ email, password, displayName }` → `{ user, tokens }`
- `POST /auth/login` — `{ email, password }` → `{ user, tokens }`
- `POST /auth/refresh` — `{ refreshToken }` → `{ tokens }`
- `POST /auth/logout` — header Bearer → blacklist JWT dans Redis
- `POST /auth/forgot-password` — déclenche job mail
- `POST /auth/reset-password` — `{ token, newPassword }`

**Profil :**
- `GET /me` — profil complet
- `GET /me/history?limit=&cursor=` — historique de matchs paginé
- `GET /users/:id/profile` — profil public (rating, displayName, stats agrégées)

**Leaderboard :**
- `GET /leaderboard?limit=50&league=` — cache Redis (TTL 30s, invalidation par event)

**Saisons (sprint 2), Tournois (sprint 3), Boutique (sprint 4)** — détaillés dans plans de sprint.

Tout documenté via **`@nestjs/swagger`** sur `/api/docs`. DTOs REST validés par **`class-validator`** (source unique côté API). Les schémas Zod de `packages/schemas` couvrent les **payloads WebSocket** (§6.2) ; les DTO REST sont en class-validator pur pour des raisons de compatibilité Swagger/NestJS.

### 6.2 WebSocket (Client ↔ Game Service)

**Namespace :** `/game`. Auth : JWT en query string `?token=`.

**Client → Serveur :**
| Event | Payload | Réponse attendue |
|---|---|---|
| `joinQueue` | `{}` | `queueJoined` ou `error` |
| `leaveQueue` | `{}` | `queueLeft` |
| `commit` | `{ matchId, roundNumber, commit }` | (silencieux jusqu'à `commitsReceived`) |
| `reveal` | `{ matchId, roundNumber, move, nonce }` | `roundResolved` quand les deux reveal sont là |
| `forfeit` | `{ matchId }` | `matchEnded` |

**Serveur → Client :**
| Event | Payload |
|---|---|
| `queueJoined` / `queueLeft` | `{}` |
| `matchFound` | `{ matchId, opponent: { displayName, rating }, bestOf: 3 }` |
| `roundStart` | `{ matchId, roundNumber, commitDeadline: ISO }` |
| `commitsReceived` | `{ matchId, roundNumber, revealDeadline: ISO }` |
| `roundResolved` | `{ matchId, roundNumber, yourMove, theirMove, winner, scoreA, scoreB }` |
| `matchEnded` | `{ matchId, winner, finalScore, eloDelta }` |
| `error` | `{ code, message }` |

### 6.3 gRPC (API ↔ Game Service)

`packages/proto/auth.proto` :

```proto
service Auth {
  rpc VerifyToken(VerifyTokenRequest) returns (VerifyTokenResponse);
}

service Users {
  rpc GetRating(GetRatingRequest) returns (GetRatingResponse);
}
```

### 6.4 BullMQ (events asynchrones)

| Queue | Job | Payload | Consommateur |
|---|---|---|---|
| `match-events` | `match-ended` | `{ matchId, players, rounds[], winnerId }` | job-runner : persiste, calcule ELO, invalide cache |
| `notifications` | `send-mail` | `{ to, template, data }` | job-runner : SMTP via Nodemailer |
| `seasons` (sprint 2) | `season-reset` | `{ seasonId }` | job-runner cron, lock distribué Redis |
| `tournaments` (sprint 3) | `generate-bracket` | `{ tournamentId }` | job-runner : seeding + brackets |

### 6.5 Configuration du job-runner par variables d'environnement

Le job-runner est un binaire unique mais son **comportement est paramétré via env vars**, ce qui permet de **lancer plusieurs instances spécialisées** (différents containers `job-runner` dans `docker-compose`) sans dupliquer le code. Conforme à l'objectif technique 3.3 du brief : « *idéalement configuré par variables d'environnement pour différencier les types de tâches sur différentes instances* ».

| Variable | Valeurs | Effet |
|---|---|---|
| `WORKER_QUEUES` | `match-events,notifications,seasons,tournaments` ou sous-ensemble | Liste des queues BullMQ que cette instance consomme. Permet d'isoler les workers lourds (ELO/persistence) des workers I/O-bound (mails). |
| `WORKER_CONCURRENCY` | int (défaut `4`) | Nombre de jobs traités en parallèle par cette instance. |
| `WORKER_ROLE` | `match-processor` \| `notifier` \| `cron` \| `bracket-generator` | Étiquette logique pour métriques Prometheus + logs Pino. |
| `BULLMQ_PREFIX` | string (défaut `rps`) | Préfixe Redis des queues, permet plusieurs environnements sur un même Redis (dev/staging). |
| `REDIS_URL` | URL | Connexion Redis (mutualisée avec API/Game Service). |
| `DATABASE_URL` | URL | Connexion Postgres (Prisma). Le job-runner est l'écrivain principal pour les events `match-ended`. |
| `MAIL_TRANSPORT` | `smtp` \| `mailhog` | Backend Nodemailer. |
| `CRON_ENABLED` | `true` \| `false` | Active le scheduler interne (reset saisonnier, etc.). À `true` sur **une seule instance** ; les jobs cron eux-mêmes utilisent un **lock distribué Redis** pour rester idempotents même si plusieurs instances le feraient (défense en profondeur). |

**Exemple `docker-compose` :**

```yaml
job-runner-match:
  environment:
    WORKER_QUEUES: match-events
    WORKER_CONCURRENCY: 8
    WORKER_ROLE: match-processor
    CRON_ENABLED: false

job-runner-misc:
  environment:
    WORKER_QUEUES: notifications,tournaments
    WORKER_CONCURRENCY: 4
    WORKER_ROLE: notifier
    CRON_ENABLED: true
```

---

## 7. Sécurité

- **Mots de passe :** Argon2id (paramètres OWASP 2024).
- **JWT :** RS256, courts (15 min). Refresh tokens opaques en BDD. Blacklist Redis sur logout.
- **JWT côté WebSocket (Game Service) :** le JWT est passé en **query string** (`wss://.../game?token=...`) à l'upgrade WS. Choix assumé pour la simplicité de Socket.io et la compatibilité navigateur (impossible d'ajouter un header `Authorization` lors d'un upgrade WS depuis le navigateur sans extension). Risques mitigés :
  - **TLS obligatoire en prod** (`wss://` uniquement, jamais `ws://`) → l'URL et donc le token ne sont pas observables sur le réseau.
  - **TTL court** (15 min) : un token capté est rapidement périmé.
  - **Re-vérification serveur à l'upgrade** : le Game Service appelle `Auth.VerifyToken` en gRPC à l'API et **vérifie la blacklist Redis** avant d'accepter la connexion → un logout invalide immédiatement les WS ouverts.
  - **Pas de log du token** : middleware Pino qui scrub `token=` des URLs loggées (configuration `redact` de Pino).
  - **Pas de Referer leak** : aucune navigation cross-origin depuis l'écran de match (le front reste sur son domaine pendant la session WS).
  - **Reverse proxy** configuré pour ne pas conserver l'URL complète dans ses access logs (`access_log off` sur `/game` ou réécriture).
  - **Alternative envisagée** (post-soutenance) : auth via premier message WS après `connect` plutôt que query string, ou ticket éphémère échangé contre le JWT via `POST /auth/ws-ticket` (token usage unique 30s). Documenté comme évolution si le jury challenge.
- **Rate limiting :** `@nestjs/throttler` sur `/auth/*` (5 req/min/IP) et sur le `joinQueue` WS (anti-spam).
- **Validation entrées :** Zod / class-validator partout, rejet strict.
- **CORS :** whitelist d'origines explicite.
- **Helmet** activé sur l'API.
- **SQLi :** Prisma utilise des requêtes paramétrées par défaut, pas de raw queries non sanitizées.
- **XSS :** React échappe par défaut, jamais de `dangerouslySetInnerHTML` sans sanitization.
- **Rôles :** guards NestJS `@Roles('admin')` + décorateur custom + `RolesGuard` global.
- **Anti-triche :** voir 5.2.

---

## 8. Tests

Cible : **~70% global**, **~95% sur `packages/elo` et la state machine commit-reveal**.

**Back (Jest + Nest testing utilities) :**
- `packages/elo` : 100% — logique pure, edge cases ratings extrêmes, première partie, K-factor variable.
- `apps/game-service` : transitions valides/invalides de la state machine (avec `jest.useFakeTimers` pour les timeouts), vérification de hash, tests d'intégration BO3 complet avec deux clients Socket.io simulés.
- `apps/api` : flow auth complet, achat skin avec wallet, pas de tests sur CRUD triviaux.
- Exclusions explicites via `/* istanbul ignore next */` ou config Jest sur DTOs, bootstrap, configs, fichiers générés Prisma/proto.

**Front (Vitest + React Testing Library) :**
- Composants de jeu (compte à rebours, écran de match, hook WebSocket avec mock).
- Helpers (formattage ELO, calcul de progression de ligue).
- Pas de tests sur pages CRUD basiques.

---

## 9. DevOps

### 9.1 Linter & formatter

**Biome** — choix officiellement validé pour le projet en remplacement d'ESLint+Prettier. À expliciter dans le README et en soutenance comme parti pris assumé (un seul outil pour lint + format, performance native Rust, configuration unifiée).
- Package `packages/biome/` exposant un `biome.json` de base, étendu par chaque app via `extends`.
- Règles équivalentes aux modules du brief activées : `unicorn`, `sonarjs`, `perfectionist`, `react`, `react-hooks` (Biome a des règles natives inspirées de ces sources). Tableau d'équivalence à publier dans `packages/biome/README.md` pour répondre aux questions du jury.
- Hook pre-commit via `lefthook` : `biome check --write` + tests rapides.
- CI : `biome ci` qui fail le pipeline en cas de non-conformité.

### 9.2 Docker-compose (dev local)

Services :
- `postgres` (Bitnami, init script monté pour seed initial : ligues, skins de base)
- `redis` (Bitnami)
- `api` ×2 (réplicas, derrière reverse proxy)
- `game-service` ×2 (réplicas)
- `job-runner` ×1
- `front` (vite preview ou nginx)
- `mailhog`
- `prometheus` + `grafana` (avec dashboards pré-provisionnés)
- Healthchecks + `depends_on: condition: service_healthy`

### 9.3 CI/CD (GitHub Actions)

**`pr.yml`** sur PR vers `develop` et `main` :
1. `pnpm install --frozen-lockfile`
2. `biome ci`
3. `pnpm -r tsc --noEmit`
4. `pnpm -r test --coverage`
5. `pnpm -r build`

**`deploy.yml`** sur push `main` :
- Build + push images Docker (registry GHCR ou Docker Hub)
- Déploiement par SSH sur VPS : `docker compose pull && docker compose up -d`
- (Option bonus : Coolify/Dokploy pour avoir une UI de déploiement)

### 9.4 Observabilité

- **Logs structurés** : Pino, corrélation par `requestId` / `matchId`.
- **Métriques Prometheus** sur `/metrics` chaque app (compteurs matchs joués, taille queue matchmaking, durée moyenne round, jobs traités/échoués).
- **Grafana** : 1 dashboard par service, pré-provisionnés dans Docker. Utilisable en démo soutenance.

### 9.5 Conventions Git

- Branches : `main` (eval) + `develop` (intégration) + `feature/*` (PR).
- Commits : `conventional-commits` strict (`feat(api): ...`, `fix(game-service): ...`).
- PR review obligatoire avant merge `develop` → `main`.
- Merge non fast-forward (pas de squash).

---

## 10. Plan de sprints (10 séances)

| Sprint | Séances | Livrable principal | Critères du brief couverts à la fin |
|---|---|---|---|
| **0 — Setup** | 1 | Monorepo PNPM, Biome, Prisma, Docker-compose dev, CI lint+test, packages partagés (biome, tsconfig, schemas, db), README, Swagger vide. **Auth basique** (register/login JWT). | Monorepo, Biome, Docker-compose, CI, JWT |
| **1 — Ranked core** | 3 | Voir découpage **P0 / P1 / P2** ci-dessous. **Démo multi-instances** en fin de sprint (P0). | + Micro-service, Job-runner, Redis, Tests core, Swagger, Multi-instances (P0) ; gRPC, Anti-triche (P1) |
| **2 — Saisons & ligues** | 2 | Tables seasons/leagues/standings, cron job de reset saisonnier, distribution récompenses (mail + bonus coins), endpoint leaderboard par ligue, UI ligue dans le profil. | + Cron jobs, tâches asynchrones complexes |
| **3 — Tournois** | 2 | Inscription, génération brackets via job, orchestration des matchs de tournoi (réutilise Game Service), bracket UI. | + Sous-système métier complexe |
| **4 — Skins & économie** | 1 | Wallet, transactions, boutique, équipement, animation skin pendant match. | + Couche cosmétique optionnelle |
| **Buffer / Polish** | 1 | Observabilité Grafana, tests manquants, docs finales, préparation soutenance. | + Measurement, Documentation |

**Flexibilité :** si sprint 1 prend 4 séances, sprint 4 saute sans dégât (reste un bonus). Si tout va vite, on enrichit (animations, dashboards plus complets, anti-cheat plus poussé, etc.).

### 10.1 Découpage P0 / P1 / P2 du sprint 1 (Ranked core)

Le sprint 1 est dense. Pour ne pas s'engager sur un « tout-ou-rien » irréaliste sur 3 séances, on classe explicitement chaque livrable. **P0 = bloquant pour la note (couvre les exigences imposées par le brief)**. **P1 = forte valeur ajoutée notamment pour la défense en soutenance (bonus technicité)**. **P2 = nice-to-have, peut glisser au buffer**.

| Priorité | Livrable | Justification |
|---|---|---|
| **P0** | API REST : `auth/*`, `me`, `leaderboard`, `users/:id/profile`, `me/history`, Swagger publié | Brief : « API documentée par Swagger » + auth/rôles. |
| **P0** | Game Service WS : `joinQueue`, `matchFound`, BO3 simplifié sans commit-reveal (juste `play` envoyant le coup en clair) | Démontre le micro-service dédié temps réel et le BO3 fonctionnel. **Indispensable pour le Fonctionnel ×4.** |
| **P0** | Matchmaking ELO via sorted set Redis | Brief : Redis pour scalabilité + temps réel. |
| **P0** | Job-runner BullMQ : queue `match-events` (persistence + calcul ELO) + queue `notifications` (mail welcome) | Brief : job-runner + BullMQ obligatoires. |
| **P0** | Persistence : `users`, `elo_ratings`, `matches`, `rounds`, `elo_history` + index | Brief : BDD principale + index cohérents. |
| **P0** | **Démo multi-instances** : 2 réplicas API + 2 réplicas Game Service derrière reverse proxy, deux clients sur réplicas différents jouent un match complet | Brief : « il faudra absolument montrer un système fonctionnel avec plusieurs instances ». **Critère ×10 architecture.** |
| **P0** | Tests : `packages/elo` ≥95 %, smoke tests auth + flow match | Brief : couverture ciblée avec exclusions. |
| **P1** | **Commit-reveal cryptographique** complet (commit/reveal/hash check/forfeit triche) | Différentiation soutenance + bonus haute technicité. Si pas livré, on dégrade gracieusement vers le `play` direct du P0. |
| **P1** | **gRPC API ↔ Game Service** (`Auth.VerifyToken`, `Users.GetRating`) | Cité dans les technos additionnelles autorisées. Si pas livré, fallback REST interne avec un secret partagé. |
| **P1** | State machine formalisée avec timeouts BullMQ `delayed` ou `setTimeout` propre + tests `jest.useFakeTimers` | Solidité du noyau anti-triche. |
| **P1** | Reset password mail (job-runner + template) | Démontre un deuxième flow async. |
| **P2** | Reconnexion WS d'un client en cours de match (récup état depuis Redis) | Démo multi-instances « plus » : robustesse aux disconnects. |
| **P2** | Métriques Prometheus dédiées matchmaking (taille queue, temps moyen d'appariement) | Glisse dans le sprint Buffer / observabilité. |
| **P2** | Audit trail public : endpoint `GET /matches/:id/audit` qui renvoie commits/reveals/nonces pour rejeu | Carte de soutenance, mais pas requis. |

**Règle de glissement :** si à la fin de la séance 2 du sprint 1 les P0 ne sont pas tous traités, **on fige les P1/P2 et on focalise la séance 3 sur P0 + tests**. Les P1 non livrés deviennent du sprint Buffer ou sautent. Aucun P0 ne saute : ils sont la condition de couverture du brief.

---

## 11. Cartes à jouer en soutenance (bonus possibles)

1. **Anti-triche commit-reveal cryptographique** — solution originale et de haute technicité, défendable du point de vue cryptographique (engagement de Pedersen-like simplifié).
2. **Audit trail des matchs** — n'importe qui peut rejouer un match a posteriori et vérifier qu'aucun joueur n'a triché grâce aux nonces et commits stockés.
3. **Démo multi-instances live** — 4 fenêtres de navigateur, 2 réplicas API, 2 réplicas Game Service, on montre que les joueurs sont matchés et synchronisés peu importe quelle instance les sert.
4. **Observabilité Grafana** — dashboards live pendant la démo, montrant en direct le flux de matchs, la queue de matchmaking, les jobs.
5. **Couverture de tests ciblée** — narratif « on a testé là où ça compte », 95% sur les parties critiques, exclusions explicites assumées.
6. **Découpage clair API / Game Service** — vraie séparation stateful/stateless, justifiable architecturalement.
