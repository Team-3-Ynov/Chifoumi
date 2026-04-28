# EPIC-S1-DATA — Persistence Prisma + index

**Sprint :** 1
**Priorité globale :** P0
**Objectif :** étendre le schéma Prisma de l'US-003 (sprint 0) avec les tables nécessaires au cycle ranked (`matches`, `rounds`, `elo_history`) et garantir des index cohérents pour l'historique paginé et le leaderboard.
**Réf. design :** §4

---

### US-027 — Schéma Prisma sprint 1 : `matches`, `rounds`, `elo_history` + migrations

- **Epic** : EPIC-S1-DATA
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §4 (Sprint 1 — Cœur ranked)
- **Dépend de** : US-003 (schéma initial users + elo_ratings)

#### Contexte
Données nécessaires pour : enregistrer un match terminé (US-024), afficher l'historique d'un joueur (US-011), tracer la dérive ELO (US-024 + analytics).

#### User story
En tant que **développeur back**, je veux **les tables `matches`, `rounds`, `elo_history` créées avec contraintes et types corrects** afin de **pouvoir persister les matchs terminés et requêter l'historique avec garantie d'intégrité**.

#### Acceptance criteria
- **AC1** : Given le schéma Prisma à jour, When je lance `prisma migrate dev --name sprint-1-ranked-tables`, Then les tables `matches`, `rounds`, `elo_history` sont créées sans erreur.
- **AC2** : Table `matches` avec colonnes : `id (uuid pk)`, `player_a_id (fk users)`, `player_b_id (fk users)`, `winner_id (fk users, null)`, `score_a (int)`, `score_b (int)`, `started_at`, `ended_at (null)`, `status (enum: in_progress | ended | aborted)`. Contraintes : `player_a_id != player_b_id`.
- **AC3** : Table `rounds` avec colonnes : `id (uuid pk)`, `match_id (fk matches)`, `round_number (int)`, `move_a (enum: rock|paper|scissors, null)`, `move_b (...)`, `commit_a (text, null)`, `commit_b (text, null)`, `nonce_a (text, null)`, `nonce_b (text, null)`, `winner (enum: a|b|draw)`, `resolved_at`. **Index unique** sur `(match_id, round_number)`.
- **AC4** : Table `elo_history` : `id (uuid pk)`, `user_id (fk)`, `match_id (fk)`, `rating_before`, `rating_after`, `delta`, `created_at`.
- **AC5** : Migration committée et reproductible (lancée 2 fois sur DB clean = même résultat).
- **AC6** : `packages/db` ré-exporte tous les nouveaux types (`Match`, `Round`, `EloHistory`).

#### Tâches techniques
- [ ] Étendre `packages/db/prisma/schema.prisma`.
- [ ] Définir les enums Prisma (`MatchStatus`, `Move`, `RoundWinner`).
- [ ] Migration nommée `sprint-1-ranked-tables`.
- [ ] Vérifier la migration en local (BDD propre via `docker-compose down -v && up`).
- [ ] Doc dans `packages/db/README.md` listant les tables.

---

### US-028 — Index Postgres ciblés pour leaderboard et historique

- **Epic** : EPIC-S1-DATA
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §4 (colonnes "Index"), §6.1 leaderboard, §6.1 history
- **Dépend de** : US-027

#### Contexte
Brief : « base de données principale, optimisée avec **des index cohérents** ». L'index leaderboard et les index historique sont les plus sollicités.

#### User story
En tant que **DBA / dev back**, je veux **les index nécessaires aux queries chaudes (leaderboard top 50, historique d'un joueur)** afin que **les performances tiennent même avec 100k users / 1M matchs**.

#### Acceptance criteria
- **AC1** : Given la migration appliquée, When je `\d+ elo_ratings` en psql, Then je vois un index sur `(rating DESC, games_played DESC)` (couvrant le tri leaderboard).
- **AC2** : Given `matches`, When je `\d+ matches`, Then je vois deux index : `(player_a_id, ended_at DESC)` et `(player_b_id, ended_at DESC)` (couvrant `GET /me/history`).
- **AC3** : Given `elo_history`, When je `\d+`, Then index `(user_id, created_at DESC)`.
- **AC4** : Given un dump de 10 000 matchs seedés, When je `EXPLAIN ANALYZE` sur la query d'historique, Then le plan utilise un Index Scan (PAS un Seq Scan).
- **AC5** : Given le top 50 leaderboard, When je `EXPLAIN ANALYZE`, Then Index Scan sur `elo_ratings_rating_desc_idx`.

#### Tâches techniques
- [ ] Ajouter `@@index([rating(sort: Desc), gamesPlayed(sort: Desc)])` sur `EloRating`.
- [ ] Ajouter les `@@index` correspondants sur `Match` et `EloHistory`.
- [ ] Migration nommée `sprint-1-ranked-indexes`.
- [ ] Script `scripts/seed-bench.ts` qui crée 10 000 matchs aléatoires + script `scripts/explain-leaderboard.sh` documenté.
- [ ] Capture d'écran ou log du `EXPLAIN ANALYZE` collé dans la PR (preuve).

---

### US-029 — Seed BDD initial (admin user + données référentielles minimales)

- **Epic** : EPIC-S1-DATA
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 2 SP
- **Réf. design** : §9.2 (« init script monté pour seed initial : ligues, skins de base ») + objectifs techniques 8 du brief (« script d'initialisation de base de données … au premier lancement »)
- **Dépend de** : US-027

#### Contexte
Le brief impose un script d'init au premier lancement. En sprint 1, on a besoin a minima d'un compte **admin** pour tester les routes protégées par `@Roles('admin')`, et on prépare les futures données référentielles (ligues sprint 2, skins sprint 4) avec des stubs vides ou commentés.

#### User story
En tant que **développeur ou jury**, je veux **qu'au premier lancement de la stack, un compte admin soit créé avec des credentials documentés** afin de **pouvoir tester immédiatement les fonctionnalités protégées sans manipulation manuelle**.

#### Acceptance criteria
- **AC1** : Given une BDD vide, When `prisma migrate deploy` puis `pnpm --filter @chifoumi/db seed` (ou seed automatique en entrypoint Docker), Then un user `{ email: "admin@chifoumi.local", password: "admin-CHANGE-ME!", role: "admin" }` existe en BDD avec `password_hash` Argon2id.
- **AC2** : Le seed est **idempotent** : relancé sur une BDD non vide, il ne duplique rien (`upsert` sur `email`).
- **AC3** : Les credentials admin par défaut sont **clairement documentés** dans le `README.md` racine ET marqués comme **à changer obligatoirement en prod** via env `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD`.
- **AC4** : Le seed crée également une `EloRating` à 1000 pour l'admin (pour cohérence).
- **AC5** : Le seed est intégré au flow Docker : entrypoint API exécute `prisma migrate deploy && pnpm db:seed` au premier démarrage (skip si user admin existe déjà).
- **AC6** : Tests : seed depuis BDD vide, seed sur BDD existante (idempotence).

#### Tâches techniques
- [ ] `packages/db/prisma/seed.ts` (script TS exécutable via `prisma db seed` ou `tsx`).
- [ ] Configuration `prisma.seed` dans `packages/db/package.json`.
- [ ] Lecture des env vars `ADMIN_DEFAULT_EMAIL`, `ADMIN_DEFAULT_PASSWORD` (avec fallback dev).
- [ ] Commentaires placeholder pour les futures données référentielles (ligues, skins) avec marqueur `// TODO sprint 2:` / `// TODO sprint 4:`.
- [ ] Doc dans `README.md` (US-009) section "Premier lancement".

---

### Récap Epic S1-DATA

| Story | SP | Priorité |
|---|---|---|
| US-027 Schéma Prisma sprint 1 | 5 | P0 |
| US-028 Index Postgres ciblés | 3 | P0 |
| US-029 Seed BDD initial (admin) | 2 | P0 |
| **Total** | **10 SP** | — |
