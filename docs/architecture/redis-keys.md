# Table des cles Redis

Ce document centralise les cles, channels et prefixes BullMQ utilises par Chifoumi Ranked. Il sert de support court pour expliquer l'usage de Redis pendant la soutenance.

## Synthese architecture

- Redis porte la scalabilite temps reel : etat de match partage, mappings user -> match, locks distribues et pub/sub inter-replicas.
- Redis sert de bus technique : channels pub/sub cross-instances et structures BullMQ pour les jobs asynchrones.
- Redis reduit la charge et renforce la securite : cache leaderboard, cache anti-race de refresh token et blacklist JWT.

## Table des cles et channels

| Cle (pattern) | Type Redis | TTL | Service | Role/justification |
|---|---|---:|---|---|
| `matchmaking:queue` | Sorted set | Aucun TTL | Game Service | File de matchmaking. Le score est le rating ELO, le membre est `userId`; permet un parcours ordonne des joueurs en attente. |
| `matchmaking:meta:<userId>` | Hash | Aucun TTL | Game Service | Metadonnees du joueur en file (`userId`, `rating`, `displayName`, `queuedAt`) lues par le worker. Supprimee au `leaveQueue` ou au pairing. |
| `matchmaking:lock:<userId>` | String lock NX | 5 s | Game Service | Lock individuel pendant `joinQueue`; evite deux inscriptions concurrentes du meme joueur. |
| `matchmaking:pair-lock:<userA>:<userB>` | String lock NX | 5 s | Game Service | Lock distribue de paire, avec ids tries, pour qu'une seule replica cree le match. |
| `matchmaking:rate:<userId>` | String compteur | 1 s | Game Service | Rate limit WS `joinQueue`; limite le spam a une tentative par seconde. |
| `matchmaking:match-found` | Pub/sub channel | N/A | Game Service | Channel d'evenements `matchFound` pour relayer une paire creee entre replicas. |
| `user:rating:<userId>` | String | Aucun TTL | Game Service | Cache local Redis du rating joueur cote matchmaking; fallback `1000` si absent. |
| `match:byUser:<userId>` | String | 3600 s | Game Service | Pointeur vers le `matchId` courant; bloque une nouvelle file et permet la reconnexion. |
| `match:<matchId>:state` | String JSON | 3600 s | Game Service | Etat serialise de la state machine BO3; rend le match recuperable par n'importe quelle replica. |
| `match:<matchId>:lock` | String lock NX | 2 s | Game Service | Lock de mutation d'un match; evite deux resolutions concurrentes sur le meme round. |
| `match:<matchId>` | Pub/sub channel | N/A | Game Service | Bus d'evenements de match (`roundStart`, `roundResolved`, `matchEnded`) entre replicas Socket.io. |
| `match:<matchId>:timeoutJob` | String | 3600 s | Game Service | Stocke l'id BullMQ du job `round-timeout`; permet d'annuler/remplacer le timeout du round. |
| `match:disconnectForfeit:<userId>` | String | 60 s | Game Service | Stocke l'id BullMQ du job de forfeit apres deconnexion; annule le forfeit si le joueur revient. |
| `leaderboard:top:<limit>` | String JSON | 30 s | API | Cache du classement public pour limiter les lectures PostgreSQL repetitives. |
| `leaderboard:invalidate` | Pub/sub channel | N/A | API + Job Runner | Invalidation cross-service du cache leaderboard apres persistance d'un match et recalcul ELO. |
| `blacklist:jwt:<jti>` | String | Duree restante du JWT access | API + Game Service | Blacklist des access tokens apres logout; chaque requete auth et verification gRPC consulte ce marqueur. |
| `refresh:lock:<refreshTokenHash>` | String lock NX | 10 s | API | Lock anti-race pendant la rotation d'un refresh token; empeche deux rotations concurrentes du meme token. |
| `refresh:rotation:<refreshTokenHash>` | String JSON | 30 s | API | Cache temporaire du resultat de rotation; renvoie les memes tokens aux requetes concurrentes gagnantes. |
| `<BULLMQ_PREFIX>:match-events:*` | Structures BullMQ | Selon retention BullMQ | Game Service + Job Runner | Queue `match-events`, job `match-ended`; persistance match, rounds, ELO puis invalidation leaderboard. Prefix par defaut `rps`. |
| `<BULLMQ_PREFIX>:match-timeouts:*` | Structures BullMQ | Selon retention BullMQ | Game Service | Queue `match-timeouts`, job `round-timeout`; resout un round si un joueur ne joue/reveal pas avant deadline. |
| `<BULLMQ_PREFIX>:match-disconnect-forfeits:*` | Structures BullMQ | Selon retention BullMQ | Game Service | Queue `match-disconnect-forfeits`, job `match-disconnect-forfeit`; declare forfait apres 10 s de deconnexion continue. |
| `<BULLMQ_PREFIX>:notifications:*` | Structures BullMQ | Selon retention BullMQ | API + Job Runner | Queue `notifications`, job `send-mail`; emails de bienvenue et reset password. |
| `<BULLMQ_PREFIX>:seasons:*` | Structures BullMQ | Selon retention BullMQ | Job Runner | Queue `seasons`, job repeatable `season-reset`; traitements planifies de saisons. |
| `<BULLMQ_PREFIX>:tournaments:*` | Structures BullMQ | Selon retention BullMQ | Job Runner | Queue reservee aux traitements asynchrones de tournois. |
| `<BULLMQ_PREFIX>:job-runner:cron-scheduler-lock` | String lock NX | 60 s | Job Runner | Lock de leader election courte pour qu'une seule instance enregistre les jobs cron repeatables. |
| `<BULLMQ_PREFIX>:lock:season-reset:<seasonId>` | String lock NX | 600 s | Job Runner | Lock distribue par saison pendant le traitement `season-reset`; empeche deux workers d'archiver/reset en parallele. |

## Notes de synchronisation avec le code

- Les TTL matchmaking viennent de `apps/game-service/src/matchmaking/matchmaking.constants.ts`.
- Les TTL de session et locks match viennent de `apps/game-service/src/match-session/match-session.types.ts`.
- Les TTL de jobs timeout/deconnexion viennent de `apps/game-service/src/match/match-timeout.constants.ts` et `apps/game-service/src/match/match-disconnect.constants.ts`.
- Le cache leaderboard et la blacklist JWT sont dans `apps/api/src/redis/redis.service.ts` et `apps/api/src/leaderboard/leaderboard.service.ts`.
- Les locks/cache de rotation refresh sont dans `apps/api/src/auth/auth.service.ts`.
- Le prefix BullMQ est `BULLMQ_PREFIX`, par defaut `rps`, configurable par service.
