# Architecture Chifoumi Ranked

Ce document donne une vue versionnée des composants déployés, des flux réseau et des traitements asynchrones utiles pour la soutenance.

## Vue d'ensemble

```mermaid
graph LR
  User[Navigateur joueur]
  Front[Front React + Vite]
  Traefik[Traefik reverse proxy]
  API1[API NestJS api-1]
  API2[API NestJS api-2]
  Game1[Game Service Socket.io game-1]
  Game2[Game Service Socket.io game-2]
  JobMatch[Job Runner match-events]
  JobMisc[Job Runner notifications + tournaments]
  Postgres[(PostgreSQL 16)]
  Redis[(Redis 7)]
  Prometheus[Prometheus]
  Grafana[Grafana]
  MailHog[MailHog SMTP]

  User -->|HTTP| Front
  Front -->|REST /auth /me /leaderboard| Traefik
  Front -->|WS Socket.io namespace /game| Traefik
  Traefik -->|HTTP round-robin| API1
  Traefik -->|HTTP round-robin| API2
  Traefik -->|WS sticky cookie| Game1
  Traefik -->|WS sticky cookie| Game2

  API1 -->|Prisma| Postgres
  API2 -->|Prisma| Postgres
  API1 -->|Redis cache + JWT blacklist| Redis
  API2 -->|Redis cache + JWT blacklist| Redis
  API1 -->|BullMQ notifications| Redis
  API2 -->|BullMQ notifications| Redis

  Game1 -->|gRPC Auth.VerifyToken| API1
  Game2 -->|gRPC Auth.VerifyToken| API2
  Game1 -->|Redis matchmaking, sessions, pub/sub| Redis
  Game2 -->|Redis matchmaking, sessions, pub/sub| Redis
  Game1 -->|BullMQ match-events| Redis
  Game2 -->|BullMQ match-events| Redis

  JobMatch -->|BullMQ consume match-events| Redis
  JobMatch -->|Prisma persist match + ELO| Postgres
  JobMatch -->|Redis publish leaderboard:invalidate| Redis
  JobMisc -->|BullMQ consume notifications + tournaments| Redis
  JobMisc -->|SMTP dev| MailHog
  JobMisc -->|Prisma tournaments| Postgres

  Prometheus -->|scrape /metrics| API1
  Prometheus -->|scrape /metrics| API2
  Prometheus -->|scrape /metrics| Game1
  Prometheus -->|scrape /metrics| Game2
  Prometheus -->|scrape /metrics| JobMatch
  Prometheus -->|scrape /metrics| JobMisc
  Grafana -->|datasource| Prometheus
```

## Flux match complet

```mermaid
sequenceDiagram
  autonumber
  actor PlayerA as Joueur A
  actor PlayerB as Joueur B
  participant Front as Front React
  participant API as API NestJS
  participant Game as Game Service /game
  participant Redis as Redis
  participant Jobs as Job Runner match-events
  participant DB as PostgreSQL

  PlayerA->>Front: register
  Front->>API: POST /auth/register
  API->>DB: create user + refresh token hash
  API-->>Front: JWT RS256 + refresh opaque
  PlayerB->>Front: login
  Front->>API: POST /auth/login
  API->>DB: verify password hash + store refresh token hash
  API-->>Front: JWT RS256 + refresh opaque

  Front->>Game: WS connect /game?token=JWT
  Game->>API: gRPC Auth.VerifyToken
  API->>Redis: check blacklist:jwt:jti
  API-->>Game: userId, role, displayName
  Front->>Game: joinQueue
  Game->>Redis: ZADD matchmaking:queue + user metadata
  Game-->>Front: queueJoined

  Redis-->>Game: two compatible players found
  Game->>Redis: create match state + user mappings
  Game-->>Front: matchFound
  Game-->>Front: roundStart

  Front->>Game: play {matchId, roundNumber, move}
  Game->>Redis: lock match + store round state
  Game-->>Front: roundResolved
  alt best of 3 not finished
    Game-->>Front: roundStart
  else match finished
    Game-->>Front: matchEnded
    Game->>Redis: BullMQ add match-events:match-ended
    Jobs->>Redis: consume match-ended
    Jobs->>DB: persist match, rounds, ELO
    Jobs->>Redis: publish leaderboard:invalidate
  end
```

## Flux authentification

```mermaid
sequenceDiagram
  autonumber
  actor User as Joueur
  participant Front as Front React
  participant API as API NestJS
  participant Password as PasswordService
  participant JWT as TokenService
  participant DB as PostgreSQL
  participant Redis as Redis

  User->>Front: register(email, password, displayName)
  Front->>API: POST /auth/register
  API->>Password: argon2id hash(password)
  Password-->>API: passwordHash
  API->>DB: INSERT user + refresh token hash
  API->>JWT: sign access token RS256
  API-->>Front: access JWT + opaque refresh token

  User->>Front: login(email, password)
  Front->>API: POST /auth/login
  API->>DB: SELECT user by email
  API->>Password: argon2id verify(password)
  API->>JWT: sign access token RS256
  API->>DB: INSERT refresh token hash
  API-->>Front: access JWT + opaque refresh token

  Front->>API: POST /auth/refresh
  API->>DB: find non-revoked refresh token hash
  API->>Redis: SETNX refresh rotation lock
  API->>DB: revoke old refresh + insert new hash
  API->>JWT: sign new access token RS256
  API->>Redis: cache rotation result
  API-->>Front: new access JWT + new refresh token

  Front->>API: POST /auth/logout with Bearer JWT
  API->>Redis: SET blacklist:jwt:jti until JWT expiry
  API->>DB: revoke active refresh tokens for user
  API-->>Front: 204 No Content
```

## Table des services

| Service | Rôle | Port local | URL scale | Dépendances |
|---|---|---:|---|---|
| Front | Interface React/Vite servie en HTTP | `5173` en dev, `80` en conteneur | `http://front.localhost` | API REST, Game WS |
| API `api-1` | API REST NestJS, Swagger, metrics, gRPC auth interne | `3000:3000`, gRPC `50051` interne | `http://api.localhost/health` | PostgreSQL, Redis, BullMQ, clés JWT |
| API `api-2` | Replica API REST pour round-robin | `3002:3000`, gRPC `50051` interne | `http://api.localhost/health` | PostgreSQL, Redis, BullMQ, clés JWT |
| Game Service `game-service-1` | Socket.io `/game`, matchmaking, sessions BO3 en compose de base | `3001:3001` | Non routé par Traefik | Redis, API gRPC `api-1:50051`, BullMQ |
| Game Service `game-service-2` | Replica temps réel en compose de base | `3003:3001` | Non routé par Traefik | Redis, API gRPC `api-2:50051`, BullMQ |
| Game Service `game-1` | Replica temps réel avec sticky routing Traefik | Pas de port direct en scale | `ws://game.localhost/game` | Redis, API gRPC, BullMQ |
| Game Service `game-2` | Replica temps réel avec sticky routing Traefik | Pas de port direct en scale | `ws://game.localhost/game` | Redis, API gRPC, BullMQ |
| Job Runner `match-events` | Persistance des matchs terminés, recalcul ELO, invalidation leaderboard | metrics `3002` interne | Non exposé | Redis BullMQ, PostgreSQL |
| Job Runner `notifications` / `tournaments` | Emails, notifications et jobs planifiés | metrics `3002` interne | Non exposé | Redis BullMQ, PostgreSQL, MailHog |
| PostgreSQL | Stockage users, refresh tokens, matchs, rounds, ELO | `5432` | Non exposé via Traefik | Volume `pg_data` |
| Redis | Cache, blacklist JWT, matchmaking, pub/sub, BullMQ | `6379` | Non exposé via Traefik | Volume `redis_data` |
| Prometheus | Scraping des endpoints `/metrics` | `9090` | `http://prometheus.localhost` | API, Game Service, Job Runner |
| Grafana | Dashboards observabilité pré-provisionnés | `3002:3000` en scale | `http://grafana.localhost` | Prometheus |
| MailHog | SMTP et UI mail de développement | `1025`, `8025` | Non exposé via Traefik | Job Runner, API notifications |

## Notes de lecture

- La stack scale passe par Traefik pour `front.localhost`, `api.localhost`, `game.localhost`, `prometheus.localhost` et `grafana.localhost`.
- L'override de démo `docker-compose.demo.yml` expose seulement `game-1` et `game-2` sur `3101:3001` et `3102:3001` pour forcer un joueur sur chaque replica.
- Le Game Service ne lit pas directement la base applicative pour l'authentification en temps réel : il délègue la vérification JWT à l'API via gRPC.
- Le protocole WebSocket public de jeu utilise l'événement `play`; les champs commit/reveal appartiennent à l'état interne des phases avancées.
- Redis porte à la fois les files BullMQ, la file de matchmaking, les sessions de match, le pub/sub inter-instances et la blacklist des JWT déconnectés.
- La table détaillée des clés Redis est disponible dans [docs/architecture/redis-keys.md](architecture/redis-keys.md).
- Les jobs `match-events` terminent le flux métier après `matchEnded` : persistance, calcul ELO et invalidation du cache leaderboard.
