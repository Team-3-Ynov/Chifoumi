# EPIC-S1-GAME — Game Service WS + matchmaking + BO3

**Sprint :** 1
**Priorité globale :** P0
**Objectif :** un micro-service NestJS + Socket.io qui gère la file d'attente, le matchmaking ELO et le déroulé d'un Best-of-3, **sans** commit-reveal en P0 (le commit-reveal est P1, voir tickets futurs). État partagé en Redis pour permettre le multi-instances.
**Réf. design :** §3.1, §5, §6.2

> **Note importante** : en P0 on livre le **flow `play` simple** (le coup est envoyé en clair au serveur dans le même message, le serveur tranche). Cela permet de démontrer le BO3 + multi-instances dès le sprint 1, et le commit-reveal sera ajouté en P1 par-dessus la même state machine.

---

### US-017 — Setup Game Service avec Socket.io et auth JWT (query string + check blacklist)

- **Epic** : EPIC-S1-GAME
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.2, §7 (sécurité JWT WS)
- **Dépend de** : US-007 (auth)

#### Contexte
Premier point d'entrée temps réel. Doit refuser tout client non authentifié et tout token blacklisté (cf. US-014).

#### User story
En tant que **joueur**, je veux **me connecter en WebSocket au Game Service avec mon JWT** afin de **pouvoir ensuite rejoindre la file d'attente et jouer en temps réel**.

#### Acceptance criteria
- **AC1** : Given le Game Service démarré, When un client se connecte à `ws://localhost:3001/game?token=<JWT_VALIDE>`, Then la connexion est acceptée et le serveur émet `connected { userId, displayName }` au client.
- **AC2** : Given un token absent, malformé ou signature invalide, When connexion, Then le serveur **rejette** le handshake (code WS 4001 + message `INVALID_TOKEN`).
- **AC3** : Given un token blacklisté en Redis, When connexion, Then rejet (code 4003 + message `TOKEN_REVOKED`).
- **AC4** : Given un token valide, When connexion, Then le serveur stocke `socket.data.userId` et le `socket.id` est mappé à l'userId dans Redis (`SET ws:user:{userId}:socket {socketId} EX 3600`) pour permettre le push ciblé multi-instances.
- **AC5** : En logs Pino, l'URL est **scrubbée** (`token=***`) — vérifié par grep dans les logs de test.

#### Tâches techniques
- [ ] Setup `@nestjs/platform-socket.io`, namespace `/game`.
- [ ] `WsAuthGuard` qui parse `token` du handshake, vérifie signature RS256 (clé pub partagée avec API), checke blacklist Redis, refuse sinon.
- [ ] **gRPC à l'API** désactivé en P0 (ce sera US P1) : on partage la clé publique RSA et la blacklist Redis directement.
- [ ] Pino redact (`req.url`, `query.token`) configuré.
- [ ] Tests : connexion valide, token absent, token expiré, token blacklisté.

---

### US-018 — Events `joinQueue` / `leaveQueue` + accusés `queueJoined` / `queueLeft`

- **Epic** : EPIC-S1-GAME
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §6.2
- **Dépend de** : US-017

#### Contexte
Premier rituel d'interaction côté client. Le serveur n'inscrit pas un user déjà en match.

#### User story
En tant que **joueur connecté**, je veux **rejoindre ou quitter la file d'attente d'un simple événement WS** afin de **contrôler quand je cherche un match**.

#### Acceptance criteria
- **AC1** : Given un client connecté, When il émet `joinQueue {}`, Then le serveur l'ajoute au sorted set Redis `matchmaking:queue` (score = `rating`, member = `userId`) et émet `queueJoined { queuedAt, currentRating }`.
- **AC2** : Given un client déjà en file, When il émet `joinQueue` à nouveau, Then le serveur émet `error { code: "ALREADY_IN_QUEUE" }`.
- **AC3** : Given un client déjà en match (US-020 dirá), When `joinQueue`, Then `error { code: "ALREADY_IN_MATCH" }`.
- **AC4** : Given un client en file, When il émet `leaveQueue`, Then retiré du sorted set, émet `queueLeft`.
- **AC5** : Given un client qui se déconnecte (close WS), When la déconnexion est détectée, Then il est automatiquement retiré de la file (cleanup).
- **AC6** : Throttling : max 1 `joinQueue` par seconde par user — sinon `error { code: "RATE_LIMITED" }`.

#### Tâches techniques
- [ ] Gateway Socket.io `MatchmakingGateway` avec `@SubscribeMessage('joinQueue')` / `leaveQueue`.
- [ ] `MatchmakingService.enqueue(userId, rating)` / `dequeue(userId)` avec `ZADD` / `ZREM`.
- [ ] Lock Redis (`SET nx ex` sur `matchmaking:lock:{userId}`) pour éviter doubles inscriptions concurrentes.
- [ ] Tracker `match:byUser:{userId}` pour bloquer si déjà en match.
- [ ] Throttling via `RateLimiterRedis`.
- [ ] Tests Socket.io avec deux clients simulés.

---

### US-019 — Worker matchmaking avec fenêtre ELO élargie progressive

- **Epic** : EPIC-S1-GAME
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §5.1 (étape 5)
- **Dépend de** : US-018

#### Contexte
Cœur algorithmique du matchmaking. Doit être **résistant au multi-instances** : un seul appariement peut sortir une paire donnée (lock).

#### User story
En tant que **joueur en file**, je veux **être appairé rapidement avec un adversaire de niveau proche** afin de **jouer un match équilibré sans attendre indéfiniment**.

#### Acceptance criteria
- **AC1** : Given deux joueurs en file avec ratings ±50, When le worker tourne (loop ~500ms), Then ils sont appairés et chacun reçoit `matchFound { matchId, opponent: { displayName, rating }, bestOf: 3 }`.
- **AC2** : Given un joueur seul en file 10s, When le worker élargit, Then la fenêtre passe à ±100 ; à 30s ±200 ; à 60s ±400 ; au-delà ±∞.
- **AC3** : Given deux instances de Game Service tournant en parallèle, When elles trouvent toutes deux la même paire, Then **une seule** des deux instances sort la paire (lock distribué Redis `SET matchmaking:pair-lock:{a}:{b} nx ex 5`).
- **AC4** : Given une paire appairée, When je vérifie Redis, Then les deux userIds sont retirés de `matchmaking:queue` ET ajoutés à `match:byUser` avec le `matchId`.
- **AC5** : Métrique Prometheus `matchmaking_queue_size` exposée + `matchmaking_match_duration_seconds` (temps écoulé entre `joinQueue` et `matchFound`).

#### Tâches techniques
- [ ] `MatchmakingWorker` (interval 500ms ou trigger sur `ZADD` via Redis keyspace notif).
- [ ] Algo : itérer sur `ZRANGEBYSCORE` avec fenêtre dynamique selon ancienneté (`queuedAt`).
- [ ] Génération `matchId` (UUID v4).
- [ ] Création de la session match (US-020).
- [ ] Push aux deux clients via `io.to(socketId).emit(...)` — si les sockets sont sur d'autres instances, passer par pub/sub Redis.
- [ ] Tests : appariement nominal, élargissement fenêtre (fake timers), concurrence multi-instances (mock 2 workers).

---

### US-020 — Création session match + state machine BO3 + diffusion `matchFound`

- **Epic** : EPIC-S1-GAME
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §5, §5.3
- **Dépend de** : US-019

#### Contexte
Une fois deux joueurs appairés, on instancie une "session de match" persistée en Redis (TTL 1h) et orchestrée par n'importe quelle instance Game Service.

#### User story
En tant que **système**, je veux **persister l'état complet d'un match en Redis** afin de **pouvoir reprendre l'orchestration depuis n'importe quelle instance Game Service en cas de scale-out ou de redéploiement**.

#### Acceptance criteria
- **AC1** : Given une paire appairée, When le worker crée la session, Then une clé `match:{matchId}:state` existe en Redis avec `{ matchId, players: [a, b], scoreA: 0, scoreB: 0, currentRound: 1, status: "WAITING_PLAYS", startedAt }`, TTL 1h.
- **AC2** : Les deux clients reçoivent `matchFound { matchId, opponent, bestOf: 3 }` puis immédiatement `roundStart { matchId, roundNumber: 1, deadline: ISO+5s }`.
- **AC3** : La session expose une **state machine** documentée :
  - `WAITING_PLAYS` → (les 2 plays reçus) → `RESOLVING` → `WAITING_PLAYS` (round suivant) ou `ENDED` (BO3 terminé).
  - `WAITING_PLAYS` → (timeout 5s) → `ENDED` (forfeit du joueur silencieux).
- **AC4** : Toute mutation d'état passe par un lock Redis sur la clé du match (`SET match:{matchId}:lock nx ex 2`) pour éviter les conflits multi-instances.
- **AC5** : Pub/sub Redis (`channel: match:{matchId}`) : les events sont diffusés via le pub/sub pour qu'une instance qui ne porte pas le socket d'un client puisse quand même push (cross-instance routing).

#### Tâches techniques
- [ ] `MatchSessionService` avec `create`, `loadState`, `mutateState (avec lock)`.
- [ ] Enum + transitions formalisées (`MatchStatus`).
- [ ] Sérialisation JSON pour Redis (clé unique `match:{matchId}:state`).
- [ ] Souscription pub/sub à la connexion d'un client : `SUBSCRIBE match:{matchId}` pour relayer.
- [ ] Émetteur générique `broadcastToMatch(matchId, event, payload)` qui pub sur le channel.
- [ ] Tests state machine (transitions valides/invalides), tests de concurrence (deux mutations parallèles → sérialisées).

---

### US-021 — Round BO3 simplifié `play` + `roundResolved` + `matchEnded`

- **Epic** : EPIC-S1-GAME
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 8 SP
- **Réf. design** : §5 (sans 5.2 commit-reveal en P0)
- **Dépend de** : US-020

#### Contexte
Version P0 du round : chaque joueur émet `play { matchId, roundNumber, move }` et le serveur tranche dès que les deux sont reçus. Le commit-reveal sera ajouté en P1 par-dessus cette base.

#### User story
En tant que **joueur en match**, je veux **envoyer mon coup (rock / paper / scissors) à chaque round et recevoir le résultat dès que l'adversaire a aussi joué** afin de **dérouler un Best-of-3 jusqu'à la victoire**.

#### Acceptance criteria
- **AC1** : Given un match `WAITING_PLAYS` round N, When je `play { matchId, roundNumber: N, move: "rock" }`, Then le serveur stocke mon coup et n'émet rien d'autre jusqu'à recevoir celui de l'adversaire.
- **AC2** : Given les deux plays reçus, When le serveur résout, Then les deux clients reçoivent `roundResolved { matchId, roundNumber, yourMove, theirMove, winner: "a"|"b"|"draw", scoreA, scoreB }`.
- **AC3** : Given un score atteint 2 victoires (BO3), When le round est résolu, Then les clients reçoivent `matchEnded { matchId, winner: userId, finalScore: { a, b }, eloDelta: { a, b } }` (eloDelta calculé après US-024).
- **AC4** : Given un draw, When résolu, Then `scoreA == scoreB++ NON` — un draw **n'incrémente pas le score** ; on rejoue un round (max 5 rounds totaux pour éviter les infinis, sinon nul à `2-2-1`).
- **AC5** : Given un play avec mauvais `roundNumber`, Then `error { code: "WRONG_ROUND" }`.
- **AC6** : Given un play avec move invalide (pas dans `["rock","paper","scissors"]`), Then `error { code: "INVALID_MOVE" }`.
- **AC7** : Given un timeout 5s sans play, When le timer expire, Then forfeit du silencieux : `matchEnded { winner: <autre>, reason: "FORFEIT_TIMEOUT" }`.
- **AC8** : À la fin du match, le service publie un job BullMQ `match-events.match-ended` avec le payload complet (US-024 le consomme).

#### Tâches techniques
- [ ] Gateway `MatchGateway` avec `@SubscribeMessage('play')`.
- [ ] Logique de résolution PFC pure (peut vivre dans `packages/elo` ou `packages/rps`).
- [ ] Timer par round (setTimeout par session, recréé sur chaque round).
- [ ] Cleanup Redis à la fin du match : suppression `match:byUser:{userId}` pour permettre une nouvelle file.
- [ ] Émission BullMQ via `bullmq` lib (queue `match-events`).
- [ ] Tests : BO3 nominal (2-0, 2-1), draw, forfeit timeout, move invalide, mauvais roundNumber, déconnexion en cours.

---

### US-035 — Commit-reveal cryptographique complet (remplace `play` simple par `commit` + `reveal`)

- **Epic** : EPIC-S1-GAME
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 8 SP
- **Réf. design** : §5.2 (protocole), §11 carte 1
- **Dépend de** : US-021 (BO3 simple en place), US-027 (colonnes commit/reveal/nonce dans `rounds`)

#### Contexte
Bonus différenciant et défendable. Sur la base du `play` simple du P0, on ajoute la mécanique en deux phases : **commit** (hash du coup + nonce) puis **reveal** (coup + nonce). Le serveur ne peut pas connaître le coup avant les deux commits, et un client ne peut pas adapter son coup à celui de l'adversaire.

#### User story
En tant que **joueur**, je veux **m'engager cryptographiquement sur mon coup avant d'apprendre celui de l'adversaire** afin de **garantir qu'aucun joueur ne peut tricher en regardant le coup de l'autre avant de jouer le sien**.

#### Acceptance criteria
- **AC1** : Given un round démarré, When les 2 clients émettent `commit { matchId, roundNumber, commit }` (commit = hex SHA256 64 chars), Then le serveur stocke les deux commits, **n'émet rien à l'adversaire** (pas de leak), et émet aux deux `commitsReceived { matchId, roundNumber, revealDeadline: ISO+5s }` quand les deux sont là.
- **AC2** : Given la phase reveal, When un client émet `reveal { matchId, roundNumber, move, nonce }`, Then le serveur recalcule `SHA256(move + ":" + nonce)` et compare au commit stocké.
- **AC3** : Given hash invalide, When `reveal`, Then **forfeit immédiat du tricheur** : `roundResolved { winner: <autre>, reason: "INVALID_REVEAL" }` puis poursuite ou `matchEnded` selon score.
- **AC4** : Given les deux reveals valides, When résolution, Then `roundResolved { yourMove, theirMove, winner, scoreA, scoreB }` (même contrat que le `play` du P0).
- **AC5** : Given timeout commit (5s sans recevoir un commit), Then forfeit du silencieux.
- **AC6** : Given timeout reveal (5s sans reveal après `commitsReceived`), Then forfeit du silencieux.
- **AC7** : Les colonnes `commit_a/b`, `move_a/b`, `nonce_a/b` sont **toutes** persistées dans `rounds` (pas seulement le winner) → US-034 audit trail peut les exposer.
- **AC8** : Tests d'intégration avec deux clients Socket.io simulés : flow nominal, hash invalide injecté, timeout commit, timeout reveal.

#### Tâches techniques
- [ ] Étendre la state machine de US-020 : ajouter état `WAITING_COMMITS` (initial du round) et `WAITING_REVEALS`.
- [ ] Gateway events `@SubscribeMessage('commit')` et `@SubscribeMessage('reveal')`.
- [ ] Validation Zod du `commit` (regex `^[a-f0-9]{64}$`) et du `nonce` (≥ 16 octets hex).
- [ ] Helper `verifyCommit(commit, move, nonce)` (Node `crypto`).
- [ ] Persistance des commit/reveal/nonce dans le payload BullMQ `match-ended` pour US-024.
- [ ] **Désactiver** l'event `play` du P0 (ou le maintenir derrière un feature flag `MATCH_PROTOCOL=plain|commit-reveal` pour faciliter le dev).
- [ ] Couverture tests **≥ 95 %** sur la state machine (cf. cible §8).

#### Definition of Done (en plus de la DoD globale)
- [ ] Documentation cryptographique courte ajoutée dans `docs/anti-cheat.md` (à créer).
- [ ] Démo manuelle réussie avec un client malveillant qui envoie un mauvais reveal → forfeit OK.

---

### US-036 — State machine durcie : timers via BullMQ `delayed` jobs (multi-instances safe)

- **Epic** : EPIC-S1-GAME
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §5.2 (timeouts), §5.3 (multi-instances)
- **Dépend de** : US-020, US-035

#### Contexte
En P0, les timers de timeout sont `setTimeout` en mémoire de l'instance qui orchestre. **Problème multi-instances** : si l'instance crashe ou redémarre, le timer est perdu, le match reste bloqué. **Solution** : déclencher les timeouts via des jobs BullMQ `delayed` (Redis) → n'importe quelle instance peut les consommer.

#### User story
En tant que **système**, je veux **que les timeouts de match (commit, reveal) survivent au redémarrage d'une instance Game Service** afin que **aucun match ne reste bloqué et que la démo multi-instances soit robuste face au scaling/crash**.

#### Acceptance criteria
- **AC1** : Given un round qui passe en `WAITING_COMMITS`, When le serveur démarre le timer, Then un job BullMQ `delayed: 5000ms` est ajouté à la queue `match-timeouts` avec payload `{ matchId, roundNumber, expectedState: "WAITING_COMMITS" }`.
- **AC2** : Given le job qui se déclenche, When un worker (sur n'importe quelle instance Game Service) le consomme, Then il vérifie l'état actuel via Redis : si encore `WAITING_COMMITS` → forfeit ; sinon (état avancé) → no-op.
- **AC3** : Given un commit reçu avant le timeout, When le serveur passe à `WAITING_REVEALS`, Then le job pending est **annulé** (`job.remove()`) et un nouveau job pour `WAITING_REVEALS` est planifié.
- **AC4** : Given une instance Game Service tuée pendant `WAITING_REVEALS`, When le timer arrive à échéance, Then une autre instance consomme le job et applique le forfeit. Vérifié par un test E2E (kill + verif).
- **AC5** : Idempotence : si deux workers consomment le même job (rare mais possible), un seul doit appliquer la mutation grâce au lock Redis sur la session match (US-020 AC4).

#### Tâches techniques
- [ ] Nouvelle queue BullMQ `match-timeouts` consommée par chaque instance Game Service (et pas par le job-runner).
- [ ] Helper `scheduleTimeout(matchId, roundNumber, state, delayMs)` + `cancelTimeout(jobId)`.
- [ ] Worker `MatchTimeoutWorker` qui charge l'état + applique forfeit si nécessaire.
- [ ] Tests : flow nominal annulation, déclenchement après crash simulé.

---

### US-037 — Client gRPC vers l'API depuis le Game Service (remplace verif JWT directe)

- **Epic** : EPIC-S1-GAME
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §3.3, §6.3
- **Dépend de** : US-033 (serveur gRPC API), US-017 (verif JWT actuelle à remplacer)

#### Contexte
Pendant en miroir du US-033 côté API. Le Game Service abandonne la lecture directe de la clé publique RSA + Redis blacklist au profit d'un appel `Auth.VerifyToken` à l'API.

#### User story
En tant que **Game Service**, je veux **déléguer la vérification du JWT à l'API via gRPC** afin de **n'avoir qu'une seule source de vérité auth et bénéficier des futurs ajouts (révocation user, etc.) sans modification du Game Service**.

#### Acceptance criteria
- **AC1** : Given un client qui ouvre une WS avec un token, When `WsAuthGuard` est invoqué, Then il appelle `apiClient.verifyToken({ token })` en gRPC et accepte/refuse selon la réponse.
- **AC2** : Given l'API down, When `verifyToken` timeout (1s), Then la connexion est refusée avec `error: "AUTH_UNAVAILABLE"` (fail-closed).
- **AC3** : Cache local éphémère (TTL 30s) sur la réponse `valid: true` pour réduire la charge gRPC sur reconnexions rapides — invalidé immédiatement si `valid: false` reçu.
- **AC4** : Métriques Prometheus : `grpc_calls_total{method, status}`, `grpc_call_duration_seconds`.
- **AC5** : Tests : auth OK, auth refused, API down → fail-closed, cache hit.

#### Tâches techniques
- [ ] Module `GrpcClientModule` dans le Game Service utilisant `@grpc/grpc-js` ou `@nestjs/microservices` côté client.
- [ ] Refactor `WsAuthGuard` : remplacer la lecture clé pub + Redis par `apiClient.verifyToken`.
- [ ] Cache via `cache-manager-ioredis-yet` ou simple Map en mémoire avec TTL.
- [ ] Tests intégration avec mock du serveur gRPC.

---

### US-038 — Reconnexion WS d'un client en cours de match (récupération état Redis)

- **Epic** : EPIC-S1-GAME
- **Priorité** : **P2**
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §5.3
- **Dépend de** : US-020 (état en Redis), US-036 (timers résilients)

#### Contexte
Permet à un joueur de fermer son onglet par accident et de revenir continuer le match. Excellent narratif soutenance ("démontrer la résilience multi-instances").

#### User story
En tant que **joueur dont la connexion a sauté en plein match**, je veux **me reconnecter en moins de 10s et reprendre le match dans son état exact** afin de **ne pas perdre par forfait pour un simple aléa réseau**.

#### Acceptance criteria
- **AC1** : Given un client en match qui se déconnecte (close WS), When il se reconnecte avec le même JWT dans une fenêtre de **10s**, Then il reçoit `matchResumed { matchId, currentRound, scoreA, scoreB, currentState: "WAITING_COMMITS"|"WAITING_REVEALS", deadline }` et peut continuer.
- **AC2** : Given une déconnexion > 10s, When fin de la fenêtre, Then forfeit automatique (event `matchEnded { winner: <autre>, reason: "DISCONNECT_FORFEIT" }`).
- **AC3** : Given une reconnexion sur une **autre** instance Game Service (load balancing), Then le client retrouve son match grâce à l'état Redis (preuve = test E2E avec sticky session désactivé).
- **AC4** : Given un client en file d'attente (pas en match) qui se déconnecte, Then retrait immédiat de la file (US-018 AC5 inchangé).
- **AC5** : Métrique Prometheus `match_reconnect_total{outcome="resumed"|"forfeited"}`.

#### Tâches techniques
- [ ] Hook `handleDisconnect` du gateway : si user en match, **ne pas** cleanup, programmer un job `match-disconnect-forfeit` à `+10s`.
- [ ] Hook `handleConnection` : check si user a un match actif → émettre `matchResumed`.
- [ ] Annulation du job forfeit si reconnexion dans la fenêtre.
- [ ] Mise à jour mapping `ws:user:{userId}:socket` (US-017 AC4).
- [ ] Tests E2E : reconnexion sur même instance, sur autre instance, hors fenêtre.

---

### Récap Epic S1-GAME

| Story | SP | Priorité |
|---|---|---|
| US-017 Setup WS + auth JWT | 5 | P0 |
| US-018 joinQueue / leaveQueue | 3 | P0 |
| US-019 Worker matchmaking ELO | 5 | P0 |
| US-020 Session match + state machine | 5 | P0 |
| US-021 Round BO3 simple `play` | 8 | P0 |
| US-035 Commit-reveal cryptographique | 8 | P1 |
| US-036 Timers via BullMQ delayed | 3 | P1 |
| US-037 gRPC client vers API | 3 | P1 |
| US-038 Reconnexion WS en cours de match | 5 | P2 |
| **Total** | **45 SP** | — |
