# Documentation Chifoumi Ranked

Ce dossier regroupe la documentation projet : consignes, backlog, specs d'architecture et plans d'implementation.

## Sommaire

| Dossier | Contenu |
|---|---|
| [`backlog/`](backlog/) | User stories par sprint, acceptance criteria et taches techniques. |
| [`consignes/`](consignes/) | Sujet, grille de notation et contraintes d'oral. |
| [`superpowers/specs/`](superpowers/specs/) | Specs de design et decisions structurantes. |
| [`superpowers/plans/`](superpowers/plans/) | Plans d'execution issus des specs et des tickets. |
| [`demo/`](demo/) | Script et procedure de demonstration multi-instances (US-032). |
| [`adr/`](adr/) | Architecture Decision Records pour les choix techniques challengeables. |
| [`devops/`](devops/) | Deploiement production, variables `.env.prod` et runbook VPS. |
| [`architecture/`](architecture/) | Details techniques transverses, dont les cles Redis. |

## Entrees principales

- [`backlog/sprint-0-setup.md`](backlog/sprint-0-setup.md) : fondations sprint 0, dont US-009.
- [`backlog/sprint-1-api.md`](backlog/sprint-1-api.md) : stories API.
- [`backlog/sprint-1-game-service.md`](backlog/sprint-1-game-service.md) : stories temps reel.
- [`backlog/sprint-1-front.md`](backlog/sprint-1-front.md) : stories front.
- [`backlog/sprint-1-data.md`](backlog/sprint-1-data.md) : stories data et Prisma.
- [`backlog/sprint-1-job-runner.md`](backlog/sprint-1-job-runner.md) : workers et jobs asynchrones.
- [`backlog/sprint-1-devops-demo.md`](backlog/sprint-1-devops-demo.md) : devops, demo et observabilite.
- [`architecture.md`](architecture.md) : vue d'ensemble technique de la plateforme.
- [`demo/multi-instances.md`](demo/multi-instances.md) : demo soutenance multi-replicas (US-032).
- [`devops/deploy-setup.md`](devops/deploy-setup.md) : setup de deploiement production.
- [`openapi.json`](openapi.json) : export OpenAPI/Swagger versionne.
- [`adr/001-grpc-game-to-api.md`](adr/001-grpc-game-to-api.md) : gRPC entre Game Service et API.
- [`adr/002-biome-over-eslint.md`](adr/002-biome-over-eslint.md) : Biome a la place d'ESLint et Prettier.
- [`adr/003-commit-reveal-anticheat.md`](adr/003-commit-reveal-anticheat.md) : commit-reveal pour l'anti-triche.
- [`adr/004-jwt-ws-querystring.md`](adr/004-jwt-ws-querystring.md) : JWT WebSocket en query string.
- [`adr/005-match-state-redis.md`](adr/005-match-state-redis.md) : etat de match dans Redis.

## Notes

Les anciens fichiers de specs et plans restent volontairement versionnes : ils documentent les decisions et les tickets au fil du projet. Pour lancer le projet au quotidien, utiliser en priorite le [`README.md`](../README.md) racine.
