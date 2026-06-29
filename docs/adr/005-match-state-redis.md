# ADR-005 — Etat de match dans Redis

## Statut

Accepte.

## Contexte

Un match BO3 est un etat temps reel, ephemere et fortement mute pendant quelques secondes : coups, commits, reveals, deadlines, score courant, reconnexion possible. Le Game Service peut etre replique; l'etat ne doit donc pas rester uniquement en memoire d'une instance.

## Options envisagées

| Option | Avantages | Limites |
|---|---|---|
| Memoire locale Game Service | Tres rapide et simple. | Perdu au redemarrage; incompatible avec multi-instances et reconnexion cross-replica. |
| PostgreSQL comme etat temps reel | Durable, transactionnel, requetable. | Latence et contention inutiles pour des rounds inferieurs a 5 s; melange etat ephemere et historique durable. |
| Redis avec TTL | Rapide, partage entre replicas, TTL natif, locks et pub/sub disponibles. | Donnee volatile; necessite persistance finale vers PostgreSQL via job. |

## Décision

Nous stockons l'etat courant dans Redis sous `match:<matchId>:state` avec TTL 1 h, et nous utilisons `match:<matchId>:lock` pour serialiser les mutations. PostgreSQL reste la source durable apres fin de match, via le job `match-ended`.

L'alternative principale rejetee est PostgreSQL pour l'etat temps reel : robuste pour l'historique, mais trop lourd pour orchestrer les transitions de round et les deadlines courtes.

## Conséquences

- N'importe quelle replica Game Service peut reprendre ou diffuser l'etat d'un match.
- Les reconnects peuvent retrouver le match courant via Redis.
- Les locks Redis protegent les mutations concurrentes.
- La durabilite finale depend du job-runner; il faut publier `match-ended` et persister matches/rounds/ELO en PostgreSQL.
- Le TTL limite les fuites d'etat si un match reste bloque.

## Références

- `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` sections 5.3 et 6.4.
- `docs/backlog/sprint-1-game-service.md` US-020, US-036 et US-038.
- `docs/architecture/redis-keys.md`.

