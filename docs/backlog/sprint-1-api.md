# EPIC-S1-API — API REST ranked (profil, leaderboard, historique)

**Sprint :** 1
**Priorité globale :** P0
**Objectif :** exposer toute la surface REST nécessaire au front pour que le joueur puisse consulter son profil, son historique de matchs, le leaderboard et gérer son cycle de session (logout, refresh).
**Réf. design :** §6.1

---

### US-010 — Endpoint `GET /me` (profil complet du user authentifié)

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 2 SP
- **Réf. design** : §6.1
- **Dépend de** : US-007

#### Contexte
Première brique consommée par le front à l'arrivée sur le lobby.

#### User story
En tant que **joueur authentifié**, je veux **récupérer mon profil complet (id, email, displayName, role, rating, gamesPlayed)** afin d'**afficher mes infos dans le header et le lobby**.

#### Acceptance criteria
- **AC1** : Given un JWT valide, When je `GET /me`, Then je reçois `200 { id, email, displayName, role, rating, gamesPlayed, createdAt }`.
- **AC2** : Given pas de header Authorization, Then `401`.
- **AC3** : Given un JWT révoqué (post-US-014), Then `401`.
- **AC4** : Given un user sans `EloRating` (cas créé avant migration ELO), Then une row par défaut `{ rating: 1000, gamesPlayed: 0 }` est créée à la volée.

#### Tâches techniques
- [ ] `MeController.get()` avec `@UseGuards(JwtAuthGuard)`.
- [ ] `MeService.getProfile(userId)` : join `User` + `EloRating`.
- [ ] DTO `MeResponseDto` annoté Swagger (`@ApiProperty`).
- [ ] Test d'intégration : authentifié vs non, ELO existant vs default.

---

### US-011 — Endpoint `GET /me/history` paginé par cursor

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.1, §4 (table `matches`)
- **Dépend de** : US-027 (tables matches/rounds)

#### Contexte
Liste des derniers matchs joués avec score, opposant, delta ELO, date.

#### User story
En tant que **joueur**, je veux **paginer mes matchs récents par cursor** afin de **scroller mon historique sans charger toute la base d'un coup**.

#### Acceptance criteria
- **AC1** : Given un user avec 50 matchs, When je `GET /me/history?limit=20`, Then je reçois `200 { items: [...20], nextCursor: "..." }` triés par `ended_at DESC`.
- **AC2** : Given le `nextCursor`, When je rappelle `GET /me/history?limit=20&cursor=<cursor>`, Then je reçois la page suivante (20 items, pas de chevauchement, pas de doublon).
- **AC3** : Given `limit > 100`, Then `400` avec message `limit must be ≤ 100`.
- **AC4** : Chaque item contient `{ matchId, opponent: { displayName, ratingAtMatch }, scoreA, scoreB, isWinner, eloDelta, endedAt }`.
- **AC5** : L'index `(player_a_id, ended_at DESC)` + `(player_b_id, ended_at DESC)` est utilisé (vérifié par `EXPLAIN ANALYZE` dans la PR).

#### Tâches techniques
- [ ] `MeHistoryController` + service.
- [ ] Cursor opaque base64(`{ ts, id }`) pour stabilité même en cas d'égalité de timestamp.
- [ ] Query Prisma optimisée (un seul roundtrip, join sur `EloHistory` pour `eloDelta`).
- [ ] DTO + Swagger.
- [ ] Tests : pagination forward, dernière page, limite invalide, user sans match.

---

### US-012 — Endpoint `GET /users/:id/profile` (profil public d'un autre joueur)

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 2 SP
- **Réf. design** : §6.1

#### Contexte
Permet au front d'afficher l'écran "vs Opponent" et la fiche d'un user vu dans le leaderboard.

#### User story
En tant que **visiteur authentifié**, je veux **consulter le profil public d'un autre joueur** afin de **voir son rating et ses stats agrégées avant ou après un match**.

#### Acceptance criteria
- **AC1** : Given un userId existant, When je `GET /users/:id/profile`, Then je reçois `200 { id, displayName, rating, gamesPlayed, winRate, createdAt }` — **PAS d'email** ni de données privées.
- **AC2** : Given un userId inconnu, Then `404 { error: "USER_NOT_FOUND" }` (pas de fuite par message d'erreur différent).
- **AC3** : `winRate` est `wins / gamesPlayed` arrondi à 2 décimales, `0` si `gamesPlayed = 0`.

#### Tâches techniques
- [ ] `UsersController.getPublicProfile(:id)` protégé par JWT.
- [ ] DTO `PublicProfileDto` (whitelist explicite).
- [ ] Calcul `wins` via aggregate sur `matches.winner_id`.
- [ ] Tests : profil OK, 404, pas de leak email.

---

### US-013 — Endpoint `GET /leaderboard` avec cache Redis (TTL 30s)

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.1, §3.2 (Redis cache)
- **Dépend de** : US-024 (invalidation depuis job-runner)

#### Contexte
Vitrine publique du jeu, fortement consultée. Mise en cache Redis pour ne pas marteler Postgres.

#### User story
En tant que **joueur**, je veux **voir le top 50 mondial trié par rating** afin de **comparer ma position et viser une place**.

#### Acceptance criteria
- **AC1** : Given une BDD avec 200 users, When je `GET /leaderboard?limit=50`, Then je reçois `200 { items: [{ rank, userId, displayName, rating, gamesPlayed }] }` triés par `rating DESC, gamesPlayed DESC` (tie-breaker).
- **AC2** : Given un appel récent (<30s), When je rappelle `GET /leaderboard`, Then la réponse provient de Redis (vérifiable via header `X-Cache: HIT`).
- **AC3** : Given un job `match-events` qui finit (US-024), When il publie l'event d'invalidation, Then la prochaine requête `GET /leaderboard` est `MISS` et recalcule.
- **AC4** : Given `limit > 100`, Then `400`.
- **AC5** : Endpoint accessible **sans authentification** (publique) — décorateur `@Public()`.

#### Tâches techniques
- [ ] Service Redis (lib `ioredis`).
- [ ] `LeaderboardService.get(limit)` avec pattern Cache-Aside (`GET key` → si miss → query DB → `SETEX key 30 payload`).
- [ ] Clé Redis : `leaderboard:top:{limit}`.
- [ ] Subscriber Redis pub/sub sur channel `leaderboard:invalidate` qui DEL les clés.
- [ ] Header `X-Cache: HIT|MISS` (utile en démo).
- [ ] Tests unitaires service avec mock Redis (`ioredis-mock`), tests d'intégration de bout en bout.

---

### US-014 — Endpoint `POST /auth/logout` (blacklist JWT dans Redis)

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 2 SP
- **Réf. design** : §6.1, §7
- **Dépend de** : US-007

#### Contexte
Brief : « Redis pour la gestion d'invalidation de jetons d'authentification ». Critère sécurité.

#### User story
En tant que **joueur**, je veux **pouvoir me déconnecter et invalider immédiatement mon JWT** afin que **personne ne puisse réutiliser un token volé après ma déconnexion**.

#### Acceptance criteria
- **AC1** : Given un JWT valide, When je `POST /auth/logout`, Then je reçois `204 No Content` et le `jti` du token est ajouté à la blacklist Redis (`SETEX blacklist:jwt:{jti} <ttl restant> 1`).
- **AC2** : Given le même JWT, When je rappelle `GET /me` après le logout, Then je reçois `401` (le `JwtStrategy` consulte la blacklist).
- **AC3** : Given un refresh token utilisé par ce user, Then il est aussi marqué `revoked_at` en BDD.
- **AC4** : Given un JWT déjà expiré, When je tente le logout, Then `401` (pas la peine de blacklister un token déjà mort).

#### Tâches techniques
- [ ] Ajouter `jti` (UUID v4) lors de la signature des access tokens (US-007 à amender).
- [ ] `AuthController.logout()` + `AuthService.revokeAccessToken(jti, expiresAt)` + `revokeRefreshTokens(userId)`.
- [ ] `JwtStrategy.validate()` : check Redis avant de valider.
- [ ] Tests : logout puis appel protégé → 401, double logout idempotent.

---

### US-015 — Endpoint `POST /auth/refresh` (rotation refresh token)

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 2 SP
- **Réf. design** : §6.1, §7
- **Dépend de** : US-007

#### Contexte
Permet au front de rester connecté au-delà de 15 min sans demander à l'utilisateur de se reconnecter.

#### User story
En tant que **joueur**, je veux **échanger mon refresh token contre un nouveau couple access+refresh** afin de **rester connecté tant que ma session est légitime, sans saisir mon mot de passe toutes les 15 min**.

#### Acceptance criteria
- **AC1** : Given un refresh token valide non révoqué non expiré, When je `POST /auth/refresh { refreshToken }`, Then je reçois `200 { tokens: { access, refresh } }` avec un **nouveau** refresh (rotation), l'ancien est révoqué.
- **AC2** : Given un refresh token révoqué (déjà utilisé), When je l'envoie, Then `401` ET tous les refresh tokens du user sont révoqués (détection de réutilisation = potentiel vol → on déconnecte tout).
- **AC3** : Given un refresh token expiré, Then `401`.
- **AC4** : Given un refresh token bien formé mais introuvable en BDD, Then `401`.

#### Tâches techniques
- [ ] `AuthService.refresh(refreshToken)` : lookup hashé en BDD, vérif expiration, marque `revoked_at`, génère nouveau couple.
- [ ] Détection de réutilisation : si `revoked_at IS NOT NULL` → révoquer tous les tokens du user.
- [ ] DTO Swagger.
- [ ] Tests : nominal, réutilisation, expiré, inconnu.

---

### US-016 — Documentation Swagger complète et publiée sur `/api/docs`

- **Epic** : EPIC-S1-API
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 2 SP
- **Réf. design** : §2 (Contraintes), §6.1
- **Dépend de** : US-010 → US-015

#### Contexte
Brief : « API documentée par Swagger » — critère explicite et coefficienté.

#### User story
En tant que **développeur front (et le jury en soutenance)**, je veux **une page Swagger interactive listant tous les endpoints, leurs DTOs et exemples** afin de **pouvoir tester l'API sans Postman et démontrer la conformité au brief**.

#### Acceptance criteria
- **AC1** : Given l'API démarrée, When je `GET http://localhost:3000/api/docs`, Then je vois une UI Swagger UI listant tous les endpoints groupés par tag (`auth`, `me`, `users`, `leaderboard`).
- **AC2** : Chaque endpoint a : description, paramètres, body schema, réponses 2xx + 4xx avec exemples.
- **AC3** : Le bouton "Authorize" permet de coller un Bearer JWT et de tester les endpoints protégés.
- **AC4** : Le JSON brut est accessible à `/api/docs-json` (utilisable pour générer un client TS).
- **AC5** : En production, `/api/docs` est protégé par auth basique (`SWAGGER_USER` / `SWAGGER_PASSWORD` env) ou désactivé selon `NODE_ENV`.

#### Tâches techniques
- [ ] Installer `@nestjs/swagger`.
- [ ] `SwaggerModule.setup('api/docs', ...)` dans `main.ts` avec `DocumentBuilder` (titre, version, JWT bearer).
- [ ] Vérifier que tous les DTOs sont annotés `@ApiProperty()` (et Zod-derived where applicable, US futur).
- [ ] Middleware basic auth conditionnelle pour `/api/docs` en prod.
- [ ] README mentionne l'URL Swagger.

---

### US-033 — Serveur gRPC côté API (`Auth.VerifyToken` + `Users.GetRating`)

- **Epic** : EPIC-S1-API
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §3.3, §6.3
- **Dépend de** : US-007 (auth), US-027 (table elo_ratings)

#### Contexte
En P0, le Game Service vérifie le JWT directement avec la clé publique partagée + lecture Redis pour la blacklist (US-017). En P1 on rebascule sur le **vrai pattern micro-services** : le Game Service appelle l'API en gRPC. Bénéfice : un seul endroit qui sait valider les tokens et lire les ratings, contrats versionnés.

#### User story
En tant que **Game Service**, je veux **vérifier un JWT et lire le rating d'un user via un appel gRPC à l'API** afin de **respecter la séparation des responsabilités et avoir un contrat type-safe versionné**.

#### Acceptance criteria
- **AC1** : Given le package `@chifoumi/proto` avec `auth.proto` (`Auth.VerifyToken`, `Users.GetRating`), When je lance la génération, Then les stubs TS sont générés et committés (ou générés en pre-build CI).
- **AC2** : Given l'API démarrée, When le Game Service appelle `Auth.VerifyToken({ token })`, Then la réponse est `{ valid: bool, userId, role, displayName }` en moins de 50 ms (p99 sur 100 calls).
- **AC3** : Given un token blacklisté, When `VerifyToken`, Then `{ valid: false, reason: "REVOKED" }`.
- **AC4** : Given un token invalide ou expiré, When `VerifyToken`, Then `{ valid: false, reason: "INVALID" | "EXPIRED" }`.
- **AC5** : Given un userId existant, When `Users.GetRating({ userId })`, Then `{ rating, gamesPlayed }`.
- **AC6** : Given un userId inconnu, When `Users.GetRating`, Then erreur gRPC `NOT_FOUND`.
- **AC7** : Le serveur gRPC écoute sur un port distinct (`API_GRPC_PORT=50051`), pas exposé publiquement (intra docker network).
- **AC8** : Tests d'intégration : appel valide, token expiré, user inconnu, propagation correcte des erreurs.

#### Tâches techniques
- [ ] `packages/proto/auth.proto` : définir services + messages.
- [ ] Setup `ts-proto` ou `@grpc/proto-loader` pour la génération.
- [ ] `apps/api/src/grpc/` : `AuthGrpcController` + `UsersGrpcController` avec décorateurs `@GrpcMethod`.
- [ ] `main.ts` API : `app.connectMicroservice<MicroserviceOptions>({ transport: Transport.GRPC, options: ... })` + `app.startAllMicroservices()`.
- [ ] Tests via client gRPC dans `apps/api/test/grpc.e2e-spec.ts`.

---

### US-034 — Endpoint `GET /matches/:id/audit` (audit trail public commit-reveal)

- **Epic** : EPIC-S1-API
- **Priorité** : **P2**
- **Sprint** : 1
- **Réf. design** : §4 (note audit trail), §11 carte 2
- **Estimation** : 3 SP
- **Dépend de** : US-027 (rounds avec commit/reveal/nonce), US-035 (commit-reveal écrit dans rounds)

#### Contexte
N'importe qui peut rejouer un match a posteriori et vérifier qu'aucun joueur n'a triché grâce aux nonces et commits stockés. Très **défendable en soutenance** comme bonus haute technicité (carte 2 du §11).

#### User story
En tant que **joueur, observateur ou jury**, je veux **récupérer le détail cryptographique d'un match terminé (commits, reveals, nonces, hashes vérifiables)** afin de **pouvoir prouver qu'aucun des deux joueurs n'a adapté son coup en fonction de l'adversaire**.

#### Acceptance criteria
- **AC1** : Given un match terminé, When je `GET /matches/:id/audit` (sans auth, public), Then je reçois `200 { matchId, players: [a, b], rounds: [{ roundNumber, commitA, commitB, moveA, moveB, nonceA, nonceB, hashCheck: { a: "match", b: "match" } }], finalScore, winner }`.
- **AC2** : Le serveur recalcule `SHA256(move + ":" + nonce)` côté API pour chaque reveal et expose le résultat de la vérification dans `hashCheck` (`"match"` ou `"mismatch"`).
- **AC3** : Given un match `in_progress`, When je `GET /matches/:id/audit`, Then `403 { error: "MATCH_NOT_ENDED" }` (pas de leak en cours de partie).
- **AC4** : Given un match inconnu, Then `404`.
- **AC5** : Rate limiting : 10 req/min/IP (anti-scraping).

#### Tâches techniques
- [ ] `MatchesController.getAudit(:id)` `@Public()`.
- [ ] `AuditService.buildAudit(matchId)` : load round, recalcul hash, build payload.
- [ ] DTO Swagger.
- [ ] Tests : match ended, in_progress, inconnu, hash mismatch artificiellement injecté → `hashCheck: "mismatch"`.

---

### Récap Epic S1-API

| Story | SP | Priorité |
|---|---|---|
| US-010 GET /me | 2 | P0 |
| US-011 GET /me/history | 5 | P0 |
| US-012 GET /users/:id/profile | 2 | P0 |
| US-013 GET /leaderboard cache Redis | 5 | P0 |
| US-014 POST /auth/logout blacklist | 2 | P0 |
| US-015 POST /auth/refresh rotation | 2 | P0 |
| US-016 Swagger docs complet | 2 | P0 |
| US-033 gRPC server (Auth/Users) | 5 | P1 |
| US-034 Audit trail public | 3 | P2 |
| **Total** | **28 SP** | — |
