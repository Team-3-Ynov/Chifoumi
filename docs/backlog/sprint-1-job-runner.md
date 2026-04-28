# EPIC-S1-JOBS — Job-runner BullMQ + moteur ELO

**Sprint :** 1
**Priorité globale :** P0
**Objectif :** un service `job-runner` configurable par variables d'environnement (cf. §6.5 du design), qui consomme les events `match-ended` pour persister + recalculer ELO + invalider le cache leaderboard, et qui envoie des mails. Le moteur ELO vit dans `packages/elo` (logique pure, testée à 95%+).
**Réf. design :** §3.1, §6.4, §6.5

---

### US-022 — Package `packages/elo` (moteur ELO pur, testé ≥95 %)

- **Epic** : EPIC-S1-JOBS
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §8 (cible 95% sur packages/elo)

#### Contexte
Logique métier critique, isolée pour être totalement testable sans I/O. Sera réutilisée par le job-runner (US-024) et potentiellement l'API (calculs prédictifs).

#### User story
En tant que **développeur**, je veux **une fonction pure `computeElo(ratingA, ratingB, winner, gamesPlayedA, gamesPlayedB)` qui retourne `{ newRatingA, newRatingB, deltaA, deltaB }`** afin de **pouvoir recalculer les ratings après un match sans dépendre de la BDD**.

#### Acceptance criteria
- **AC1** : Given deux joueurs à 1000 chacun, A gagne, K-factor 32, When `computeElo`, Then `newRatingA = 1016`, `newRatingB = 984`, `deltaA = +16`, `deltaB = -16` (formule ELO standard).
- **AC2** : Given un débutant (`gamesPlayed < 30`), Then K-factor = 40 (apprentissage rapide).
- **AC3** : Given un joueur expérimenté (`gamesPlayed ≥ 30`), Then K-factor = 32. Au-delà de 2400 de rating → K = 16 (anti-volatilité top tier).
- **AC4** : Given un draw, Then les deltas sont symétriques selon l'écart (joueur le moins fort gagne quelques points).
- **AC5** : Given des inputs invalides (rating négatif, winner inconnu), Then la fonction throw une erreur typée `EloError`.
- **AC6** : Couverture **≥ 95 %** lignes ET branches sur le package, vérifiée en CI.

#### Tâches techniques
- [ ] `packages/elo/src/computeElo.ts` — fonction pure, pas d'import I/O.
- [ ] `packages/elo/src/kFactor.ts` — fonction utilitaire.
- [ ] Types `EloInput`, `EloResult`, `Outcome = 'A' | 'B' | 'DRAW'`.
- [ ] Tests Jest : ratings égaux, ratings très éloignés, débutant vs expert, draw, edge cases (rating 0, 9999), inputs invalides.
- [ ] Snapshot test sur 100 cas pré-calculés à la main pour figer le comportement.
- [ ] Configuration Jest avec `coverageThreshold: { global: { lines: 95, branches: 95, functions: 100 } }`.

---

### US-023 — Setup BullMQ + worker `job-runner` configurable par env vars

- **Epic** : EPIC-S1-JOBS
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.5 (config par env vars)
- **Dépend de** : US-006 (bootstrap job-runner)

#### Contexte
Brief : « idéalement configuré par variables d'environnement pour différencier les types de tâches sur différentes instances ». On doit pouvoir lancer 2 instances du même binaire avec des `WORKER_QUEUES` différents.

#### User story
En tant que **DevOps**, je veux **lancer plusieurs instances de job-runner spécialisées par queue via une variable d'env** afin de **scaler indépendamment les workers lourds (matches) et légers (mails)**.

#### Acceptance criteria
- **AC1** : Given `WORKER_QUEUES=match-events`, When je démarre le job-runner, Then seul le worker `match-events` est instancié (vérifiable en logs).
- **AC2** : Given `WORKER_QUEUES=match-events,notifications`, Then les deux workers tournent dans le même process.
- **AC3** : Given `WORKER_CONCURRENCY=8`, Then chaque worker traite jusqu'à 8 jobs en parallèle.
- **AC4** : Given `BULLMQ_PREFIX=rps-staging`, Then les queues Redis sont préfixées (`bull:rps-staging:match-events:*`).
- **AC5** : Given `CRON_ENABLED=true` sur une instance et `false` sur les autres, Then les jobs cron ne sont scheduled que par celle qui a `true`. Le job lui-même prend un **lock distribué Redis** par sécurité.
- **AC6** : Given une variable manquante critique (`REDIS_URL`, `DATABASE_URL`), Then le job-runner échoue au boot avec un message clair (validation Zod du config).

#### Tâches techniques
- [ ] `apps/job-runner/src/config/env.ts` : schéma Zod pour env vars (toutes celles du tableau §6.5).
- [ ] Factory `WorkerFactory` qui instancie dynamiquement les workers selon `WORKER_QUEUES`.
- [ ] Métriques Prometheus par worker : `bullmq_jobs_processed_total{queue,role,status}`.
- [ ] Logs Pino structurés avec `worker_role`, `queue`.
- [ ] Mise à jour `docker-compose.yml` : 2 services `job-runner-match` et `job-runner-misc` avec env différentes.
- [ ] Tests unitaires : factory ne lance que les queues demandées, validation env échoue si manquant.

---

### US-024 — Worker `match-events` : persiste match + calcule ELO + invalide cache

- **Epic** : EPIC-S1-JOBS
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.4 (queue match-events), §5.1 (étape 8)
- **Dépend de** : US-021 (le Game Service produit l'event), US-022 (computeElo), US-023 (worker setup), US-027 (tables matches/rounds/elo_history)

#### Contexte
Cœur du flow asynchrone : à chaque match terminé, on persiste, on recalcule, on invalide. Doit être **idempotent** (si BullMQ rejoue le job, pas de double-écriture).

#### User story
En tant que **système**, je veux **traiter chaque event `match-ended` une seule fois** afin de **mettre à jour les ratings, l'historique et invalider le cache leaderboard de manière fiable même en cas de retry**.

#### Acceptance criteria
- **AC1** : Given un job `match-ended { matchId, players, rounds, winnerId, finalScore }`, When le worker le traite, Then en transaction Prisma : `matches` est upsert, `rounds` sont upsert, `elo_ratings` mis à jour, `elo_history` ajouté pour les deux joueurs.
- **AC2** : Given le même job rejoué (idempotence), When traité une 2e fois, Then aucune ligne dupliquée n'est créée (clé d'idempotence : `matchId` unique en BDD + check préalable).
- **AC3** : Given un job traité avec succès, When fini, Then le worker **publie sur Redis** `PUBLISH leaderboard:invalidate "*"` → l'API consomme et DEL ses clés cache (cf. US-013 AC3).
- **AC4** : Given un job qui échoue (BDD down), When BullMQ le retry (3 essais, backoff exp), Then les retries sont visibles en métriques Prometheus.
- **AC5** : Given un job qui échoue 3 fois, When il bascule en `failed`, Then une alerte log Pino niveau `error` avec `matchId` et stack trace.
- **AC6** : Le calcul ELO utilise **`packages/elo`** (US-022) — pas de logique dupliquée.

#### Tâches techniques
- [ ] `MatchEventsWorker` (`bullmq` `Worker`) sur queue `match-events`.
- [ ] Service `MatchPersistenceService` avec une méthode `persistMatchEnded(payload)` exécutée en `prisma.$transaction(...)`.
- [ ] Idempotence : `INSERT ... ON CONFLICT DO NOTHING` ou check `matches.findUnique(matchId)` avant insert.
- [ ] Récupération des ratings + gamesPlayed avant le calcul, écriture après.
- [ ] Pub/sub Redis pour invalidation cache.
- [ ] Tests d'intégration : event nominal, retry idempotent, BDD down → retry, payload invalide → reject sans retry (job → `failed`).

---

### US-025 — Worker `notifications` : mail de bienvenue à l'inscription

- **Epic** : EPIC-S1-JOBS
- **Priorité** : **P0**
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §6.4 (queue notifications), §3.2 (MailHog dev), §10.1 (P0)
- **Dépend de** : US-007 (register déclenche le job), US-023 (worker setup)

#### Contexte
Premier flow asynchrone **exigé par le brief** comme exemple de tâche async (et explicitement classé en P0 par §10.1 du design). Le mail est capturé par MailHog en dev, par un SMTP réel en prod (config via env).

#### User story
En tant que **nouveau joueur**, je veux **recevoir un mail de bienvenue après mon inscription** afin de **valider que je peux être contacté et avoir accès à un éventuel onboarding**.

#### Acceptance criteria
- **AC1** : Given un `POST /auth/register` réussi, When le user est créé, Then l'API publie un job `notifications.send-mail` avec `{ to, template: "welcome", data: { displayName } }`.
- **AC2** : Given le worker `notifications` qui consomme, When le job est traité, Then un mail HTML+texte est envoyé via Nodemailer au transport configuré (`MAIL_TRANSPORT=mailhog` en dev).
- **AC3** : Given MailHog ouvert, When je consulte `http://localhost:8025`, Then je vois le mail avec sujet "Bienvenue sur Chifoumi", body contenant le `displayName` interpolé.
- **AC4** : Given un échec SMTP, When BullMQ retry (3 essais, backoff exp), Then les retries sont visibles. Après 3 échecs → `failed` + log `error`.
- **AC5** : Templates HTML+texte stockés dans `apps/job-runner/src/notifications/templates/welcome.{html,txt}` avec interpolation simple (Handlebars ou template literals).
- **AC6** : Tests : payload OK, template manquant → erreur claire, transport down → retry.

#### Tâches techniques
- [ ] `pnpm --filter @chifoumi/job-runner add nodemailer handlebars` (ou `eta`).
- [ ] `NotificationsWorker` sur queue `notifications`.
- [ ] `MailService.send({ to, template, data })` avec sélection du transport selon `MAIL_TRANSPORT`.
- [ ] Templates `welcome.html`, `welcome.txt`.
- [ ] Côté API : `AuthService.register` publie le job après commit BDD.
- [ ] Tests unitaires + intégration.

---

### US-026 — Flow "mot de passe oublié" complet (endpoint API + job mail + reset)

- **Epic** : EPIC-S1-JOBS
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §6.1 (`/auth/forgot-password`, `/auth/reset-password`), §6.4 queue notifications
- **Dépend de** : US-025 (mécanique mail), US-007 (auth)

#### Contexte
Story **cross-cutting** (API + job-runner + BDD). Couvre un flow async réaliste exigible en soutenance.

#### User story
En tant que **joueur ayant oublié son mot de passe**, je veux **demander un lien de réinitialisation par mail et pouvoir choisir un nouveau mot de passe** afin de **récupérer l'accès à mon compte sans contacter le support**.

#### Acceptance criteria
- **AC1** : Given un email connu, When `POST /auth/forgot-password { email }`, Then `200` (idempotent silencieux : **toujours** 200 même si email inconnu, anti-énumération) et un job `notifications.send-mail { template: "reset-password", data: { resetUrl } }` est publié.
- **AC2** : Given un email **inconnu**, When `POST /auth/forgot-password`, Then `200` également, mais **aucun job** n'est publié (vérifié en logs).
- **AC3** : Token de reset = chaîne opaque (UUID v4), persisté **hashé** en BDD `password_reset_tokens(id, user_id, token_hash, expires_at, used_at?, created_at)`, expiration 1h.
- **AC4** : Given un token valide, When `POST /auth/reset-password { token, newPassword }`, Then mot de passe mis à jour (Argon2id), token marqué `used_at`, **tous les refresh tokens du user révoqués** (sécurité), `204`.
- **AC5** : Given un token expiré ou déjà utilisé ou inconnu, When `reset-password`, Then `401`.
- **AC6** : Le mail contient un lien `${FRONTEND_URL}/reset-password?token=...` et un texte d'accompagnement.
- **AC7** : Throttler `@nestjs/throttler` sur `/auth/forgot-password` (3 req/min/IP, anti-spam).
- **AC8** : Tests : nominal complet, email inconnu (silencieux), token expiré, token réutilisé, anti-énumération.

#### Tâches techniques
- [ ] Migration Prisma : table `password_reset_tokens`.
- [ ] Endpoints `AuthController.forgotPassword`, `AuthController.resetPassword`.
- [ ] `AuthService.requestPasswordReset(email)` — lookup, génère token, hash, persist, publie job.
- [ ] `AuthService.resetPassword(token, newPassword)` — vérifie token, update password, révoque refresh.
- [ ] Templates `reset-password.html`, `reset-password.txt`.
- [ ] Throttler.
- [ ] Tests d'intégration.

---

### Récap Epic S1-JOBS

| Story | SP | Priorité |
|---|---|---|
| US-022 packages/elo (moteur pur 95%) | 3 | P0 |
| US-023 Worker setup config par env | 5 | P0 |
| US-024 Worker match-events | 5 | P0 |
| US-025 Worker notifications mail welcome | 3 | P0 |
| US-026 Flow forgot/reset password | 5 | P1 |
| **Total** | **21 SP** | — |
