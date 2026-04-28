# EPIC-S1-OPS — Multi-instances + démo + smoke E2E

**Sprint :** 1
**Priorité globale :** P0
**Objectif :** transformer le `docker-compose` dev (sprint 0) en stack multi-réplicas démontrable, livrer un script de démo reproductible et des smoke tests E2E qui couvrent un BO3 complet entre deux clients connectés à des **réplicas différents** du Game Service. C'est le livrable phare attendu par le brief : « il faudra absolument montrer un système fonctionnel avec plusieurs instances ».
**Réf. design :** §3.3, §5.3, §9.2, §11 carte 3 (Démo multi-instances live)

---

### US-030 — Docker-compose multi-réplicas + reverse proxy (Traefik ou nginx)

- **Epic** : EPIC-S1-OPS
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §9.2, §5.3
- **Dépend de** : US-006, US-017, US-020 (state Redis)

#### Contexte
Permet la démo : 2 réplicas API + 2 réplicas Game Service + 2 réplicas job-runner spécialisés (cf. US-023). Un reverse proxy distribue le trafic. **Sticky session** sur les WS Game Service pour ne pas balader un même client entre instances en cours de match (l'état est dans Redis donc tolérant, mais sticky simplifie la démo).

#### User story
En tant que **DevOps**, je veux **lancer toute la stack en multi-réplicas en une commande** afin de **pouvoir démontrer la scalabilité horizontale en soutenance**.

#### Acceptance criteria
- **AC1** : Given le repo, When je lance `docker compose -f docker-compose.yml -f docker-compose.scale.yml up -d`, Then les services démarrent : `postgres` ×1, `redis` ×1, `api` ×2, `game-service` ×2, `job-runner-match` ×1, `job-runner-misc` ×1, `front` ×1, `traefik` ×1, `mailhog` ×1, `prometheus` ×1, `grafana` ×1.
- **AC2** : Given le proxy Traefik, When je `GET http://api.localhost/health`, Then la requête est routée vers une des 2 instances API en round-robin (vérifiable en consultant les logs des deux conteneurs).
- **AC3** : Given le proxy, When un client ouvre une WS sur `ws://game.localhost/game?token=...`, Then la connexion est routée et **sticky** (même client = même instance pour la durée de la connexion WS).
- **AC4** : Given une instance API stoppée (`docker stop api-1`), When je rappelle `GET http://api.localhost/health`, Then ça répond toujours (l'autre instance prend le relais).
- **AC5** : Healthchecks Docker `depends_on: condition: service_healthy` partout pour ne pas tenter le démarrage avant que les dépendances ne soient prêtes.

#### Tâches techniques
- [ ] `docker-compose.scale.yml` avec `deploy.replicas` ou multiples services (`api-1`, `api-2`, `game-1`, `game-2`).
- [ ] Config Traefik (labels Docker) : routes `api.localhost`, `game.localhost`, `front.localhost`, `traefik.localhost` (dashboard).
- [ ] Sticky sessions Traefik : `traefik.http.services.game.loadBalancer.sticky.cookie=true`.
- [ ] Variables d'env différentes par instance (ex. `INSTANCE_ID=api-1` / `api-2` pour logs).
- [ ] Documentation dans README : URL d'accès, port mapping, comment killer une instance pour la démo.

---

### US-031 — Smoke tests E2E : BO3 complet entre 2 clients sur réplicas différents

- **Epic** : EPIC-S1-OPS
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §8 (tests), §5.3
- **Dépend de** : US-030, US-021 (BO3), US-024 (persistence)

#### Contexte
Test ultime qui valide tout le sprint 1 P0 d'un coup : auth → file → match → BO3 → persistence → leaderboard mis à jour. Doit passer **en CI** dans un environnement docker-compose éphémère.

#### User story
En tant que **mainteneur**, je veux **un test E2E qui simule deux joueurs jouant un BO3 complet sur des instances Game Service différentes** afin de **garantir à chaque PR que le multi-instances ne casse pas**.

#### Acceptance criteria
- **AC1** : Given la stack lancée en CI (job dédié `e2e`), When le test exécute le scénario, Then les étapes suivantes passent toutes :
  1. Register player A → token A.
  2. Register player B → token B.
  3. WS connect A à `game-1` (forcé via env).
  4. WS connect B à `game-2` (forcé via env).
  5. A `joinQueue`.
  6. B `joinQueue`.
  7. Les 2 reçoivent `matchFound` avec le **même** matchId.
  8. Boucle BO3 : A play `rock`, B play `scissors` → A gagne round, etc., jusqu'à ce qu'un joueur atteigne 2.
  9. Les 2 reçoivent `matchEnded`.
  10. Polling `GET /me` côté A : son `rating` a augmenté, `gamesPlayed` est à 1 — **dans un délai max de 5s** (le job-runner a traité l'event).
  11. `GET /leaderboard` retourne A en premier (rating supérieur).
  12. `GET /me/history` côté B retourne le match avec `isWinner: false`.
- **AC2** : Le test tourne en `< 30s` (sinon flaky).
- **AC3** : Le test est marqué `@e2e` et exclu des tests unitaires (`pnpm test --testPathIgnorePatterns=e2e`).
- **AC4** : En CI, le job `e2e` lance la stack via `docker compose up -d`, attend le healthcheck, exécute, puis `docker compose down -v`.

#### Tâches techniques
- [ ] Setup `apps/api/test/e2e/` ou un package `tests/e2e/` à la racine (à arbitrer).
- [ ] Helpers `createPlayer()`, `connectWs(target, token)`, `playMatch(socketA, socketB, scenario)`.
- [ ] Workflow GitHub Actions `.github/workflows/e2e.yml` (ou job dans `pr.yml`).
- [ ] Logs détaillés sur échec : screenshot des logs des conteneurs uploadés en artefact.

---

### US-032 — Documentation démo multi-instances + script de démo reproductible

- **Epic** : EPIC-S1-OPS
- **Priorité** : P0
- **Sprint** : 1
- **Estimation** : 3 SP
- **Réf. design** : §11 carte 3
- **Dépend de** : US-030

#### Contexte
La soutenance va passer ou échouer sur cette démo. Il faut un script joué et rejoué, et une doc qui permet à n'importe quel membre du jury (ou intervenant) de la rejouer après le rendu.

#### User story
En tant que **présentateur en soutenance**, je veux **une procédure pas à pas (5 minutes max) avec captures d'écran qui démontre le multi-instances en live** afin de **convaincre le jury et marquer le critère Architecture ×10**.

#### Acceptance criteria
- **AC1** : Given le repo cloné, When je suis le `docs/demo/multi-instances.md`, Then en moins de 5 min je :
  1. Lance la stack scale (US-030).
  2. Ouvre 4 fenêtres navigateur (2 joueurs A, 2 joueurs B — l'idée est de montrer que ça marche cross-instance).
  3. Force la répartition (cookie/header) : A → `game-1`, B → `game-2`.
  4. Joue un match complet entre A et B.
  5. Tue `game-1` (kill -9 ou docker stop) en plein round suivant : le client A est notifié, peut se reconnecter, le match continue (P2 — sinon "match aborted" gracieux).
  6. Montre le dashboard Grafana avec les métriques en live (file, jobs traités).
- **AC2** : Le doc contient des **captures d'écran** ou un GIF court à chaque étape clé.
- **AC3** : Un script bash/PS `scripts/demo/run-demo.sh` automatise le démarrage et l'ouverture des onglets (best effort).
- **AC4** : La doc liste les commandes de "récupération" si la démo plante (ex. `docker compose restart game-1`).

#### Tâches techniques
- [ ] Rédiger `docs/demo/multi-instances.md` avec sections : Pré-requis, Stack, Scénario, Cas de récupération.
- [ ] Captures d'écran (placeholder OK pour l'instant, à remplacer en sprint Buffer).
- [ ] Script `scripts/demo/run-demo.sh` (et version PS1 si dev Windows).
- [ ] Mention de cette démo dans `README` racine + dans le slide deck soutenance (à venir).

---

### US-039 — Métriques Prometheus + dashboard Grafana matchmaking & jobs

- **Epic** : EPIC-S1-OPS
- **Priorité** : **P2**
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §9.4, §11 carte 4
- **Dépend de** : US-019 (matchmaking), US-023 (worker), US-024 (match-events)

#### Contexte
Couvre le critère **DevOps "Measurement"** de la grille (×2). Excellent narratif de soutenance ("on regarde le dashboard pendant qu'on joue, on voit la queue grossir et les jobs se traiter en live").

#### User story
En tant que **DevOps et présentateur en soutenance**, je veux **un dashboard Grafana pré-provisionné qui montre en temps réel l'état de la file de matchmaking, le débit de matchs joués, le débit de jobs traités et leurs erreurs** afin de **démontrer l'observabilité et la santé du système live**.

#### Acceptance criteria
- **AC1** : Given chaque app (API, Game Service, job-runner), When je `GET /metrics`, Then je reçois un export Prometheus formatté avec au minimum :
  - `http_requests_total{method, route, status}` (API)
  - `matchmaking_queue_size` (gauge, Game Service)
  - `matchmaking_match_duration_seconds` (histogram, du `joinQueue` à `matchFound`, Game Service)
  - `match_played_total{outcome="win"|"draw"|"forfeit"}` (counter, Game Service)
  - `bullmq_jobs_processed_total{queue, status="completed"|"failed"}` (counter, job-runner)
  - `bullmq_job_duration_seconds{queue}` (histogram, job-runner)
- **AC2** : Given Prometheus configuré dans `docker-compose`, When je vais sur `http://localhost:9090/targets`, Then les 3 apps (API ×2, Game Service ×2, job-runner ×N) sont up.
- **AC3** : Given Grafana démarré, When je vais sur `http://localhost:3030` (port distinct du Game Service `3001`), Then je trouve un dashboard pré-provisionné "Chifoumi Overview" avec : panel queue size (gauge), panel match rate (timeseries), panel job throughput (stacked bar), panel error rate (timeseries).
- **AC4** : Le dashboard est **versionné en JSON** dans `infra/grafana/dashboards/chifoumi-overview.json` et auto-importé via provisioning Grafana au démarrage.
- **AC5** : Datasource Prometheus auto-provisionnée (`infra/grafana/provisioning/datasources/prometheus.yml`).

#### Tâches techniques
- [ ] `pnpm add prom-client` dans chaque app.
- [ ] Endpoint `/metrics` avec `MetricsModule` Nest dédié.
- [ ] Définir les métriques dans des modules dédiés (`MatchmakingMetrics`, `JobsMetrics`).
- [ ] Configurer Prometheus (`infra/prometheus/prometheus.yml`) avec scraping des services Docker.
- [ ] Configurer Grafana provisioning (datasources + dashboards).
- [ ] Importer un dashboard initial (peut partir d'un template communautaire BullMQ + custom).
- [ ] Capture du dashboard live ajoutée à `docs/demo/multi-instances.md` (US-032).

---

### US-045 — Pipeline CD : `deploy.yml` (build images + push GHCR + déploiement + smoke post-deploy)

- **Epic** : EPIC-S1-OPS
- **Priorité** : **P1**
- **Sprint** : 1
- **Estimation** : 5 SP
- **Réf. design** : §9.3 (`deploy.yml`)
- **Dépend de** : US-005 (CI), US-030 (compose multi-réplicas)

#### Contexte
Le brief mentionne « CI + déploiement continu (selon le cas) » — le critère DevOps ×2 valorise explicitement « mise en place d'outils de déploiement continu ». Sans pipeline CD, on perd des points même avec une CI excellente.

#### User story
En tant que **mainteneur**, je veux **qu'un push sur `main` déclenche automatiquement le build des images Docker, leur push sur GHCR et le déploiement sur le serveur cible** afin de **démontrer une vraie boucle DevOps fonctionnelle et avoir une URL publique consultable par le jury**.

#### Acceptance criteria
- **AC1** : Given un push (post-merge PR) sur `main`, When le workflow `.github/workflows/deploy.yml` se déclenche, Then : checkout, login GHCR (via `GITHUB_TOKEN`), build des 4 images Docker (`api`, `game-service`, `job-runner`, `front`) en multi-stage, tagging avec `:sha-<short>` + `:latest`, push sur `ghcr.io/team-3-ynov/chifoumi-<service>`.
- **AC2** : Given les images poussées, When la phase deploy se lance, Then connexion SSH au VPS (clé en secret GitHub) et exécution de `docker compose pull && docker compose up -d --remove-orphans` avec rolling restart (un service à la fois pour éviter le downtime complet).
- **AC3** : Given le déploiement terminé, When le smoke test post-deploy s'exécute, Then : `GET https://<domain>/health` API répond `200`, `GET https://<domain>/api/docs-json` répond `200`. Sinon le job échoue et alerte via la notification GitHub.
- **AC4** : Secrets GitHub configurés et documentés dans `docs/devops/deploy-setup.md` : `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_SSH_KEY`, `DEPLOY_PATH`, `JWT_PRIVATE_KEY`, `DATABASE_URL`, `REDIS_URL`, `MAIL_*`, etc.
- **AC5** : Given une PR (pas un push sur main), When le workflow `deploy.yml` est évalué, Then **pas de déclenchement** (filtre `on.push.branches: [main]` strict).
- **AC6** : Documentation dans `docs/devops/deploy-setup.md` : pré-requis VPS (Docker installé, fichier `docker-compose.prod.yml` en place, dossier `.env.prod`), procédure de rollback (`docker compose pull <image>:sha-<previous>`).
- **AC7** : (**Option bonus**) — alternative Coolify/Dokploy mentionnée dans la doc, mais l'AC1-AC3 reste la voie principale (plus pédagogique pour la soutenance).

#### Tâches techniques
- [ ] `.github/workflows/deploy.yml` : jobs `build` (matrix sur les 4 services) + `deploy` (séquentiel, depends on build).
- [ ] `Dockerfile.prod` par app si différent du dev (multi-stage avec `node:20-alpine` runner).
- [ ] `docker-compose.prod.yml` à la racine (similaire à `docker-compose.yml` mais pointant sur les images GHCR au lieu de `build:`).
- [ ] Action `appleboy/ssh-action` pour la phase deploy SSH.
- [ ] Smoke test inline (`curl` + `jq` ou `wait-on`).
- [ ] `docs/devops/deploy-setup.md` rédigée.

#### Definition of Done (en plus de la DoD globale)
- [ ] Démo : un commit sur `main` → 5 minutes plus tard, l'URL publique reflète le changement.

---

### Récap Epic S1-OPS

| Story | SP | Priorité |
|---|---|---|
| US-030 Docker-compose multi-réplicas | 5 | P0 |
| US-031 Smoke tests E2E cross-instance | 5 | P0 |
| US-032 Doc + script démo | 3 | P0 |
| US-039 Prometheus + Grafana matchmaking | 5 | P2 |
| US-045 Pipeline CD `deploy.yml` | 5 | P1 |
| **Total** | **23 SP** | — |
