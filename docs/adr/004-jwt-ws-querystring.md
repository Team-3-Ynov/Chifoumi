# ADR-004 — JWT WebSocket en query string

## Statut

Accepte avec mitigations.

## Contexte

Le navigateur ne permet pas d'ajouter librement un header `Authorization` lors de l'upgrade WebSocket/Socket.io. Le Game Service doit pourtant authentifier la connexion avant d'accepter `joinQueue` ou un event de match.

## Options envisagées

| Option | Avantages | Limites |
|---|---|---|
| JWT dans la query string `?token=` | Compatible navigateur et Socket.io, authentification disponible des le handshake. | Risque de fuite dans logs, historiques ou outils proxy si mal configure. |
| Premier message Socket.io `authenticate` | Evite le token dans l'URL. | La connexion existe deja avant authentification; il faut gerer un etat temporaire et fermer les sockets non authentifies. |
| Ticket ephemere `POST /auth/ws-ticket` | Token usage unique court, reduit l'exposition du JWT principal. | Endpoint et stockage supplementaires; complexite non indispensable pour le sprint courant. |

## Décision

Nous passons le JWT en query string au handshake WebSocket, avec mitigations explicites. L'alternative principale rejetee pour l'instant est le ticket ephemere `POST /auth/ws-ticket` : plus propre a long terme, mais disproportionne pour le besoin actuel.

Les six mitigations retenues sont :

1. TLS obligatoire en production : `wss://`, jamais `ws://`.
2. TTL court des access tokens : 15 minutes.
3. Re-verification serveur a l'upgrade via `Auth.VerifyToken` et blacklist Redis.
4. Redaction des logs applicatifs : ne jamais logger `token=`.
5. Pas de fuite `Referer` : l'ecran de match ne navigue pas vers un domaine tiers pendant la session.
6. Reverse proxy configure pour ne pas conserver l'URL complete dans ses access logs ou pour la reecrire.

## Conséquences

- L'authentification est disponible avant d'accepter les events metier.
- Le choix reste defensible en soutenance car les risques sont identifies et controles.
- Une evolution vers un ticket ephemere reste possible si le niveau de securite attendu augmente.
- Toute configuration de logs ou proxy doit etre revue pour ne pas exposer la query string.

## Références

- `CLAUDE.md` section Securite.
- `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` sections 6.2 et 7.
- `docs/backlog/sprint-1-game-service.md` US-017.

