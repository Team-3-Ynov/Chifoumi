# ADR-003 — Commit-reveal pour l'anti-triche

## Statut

Accepte.

## Contexte

Dans un Pierre-Feuille-Ciseaux temps reel, si un joueur peut connaitre le coup adverse avant de choisir le sien, il peut toujours gagner. Le serveur doit donc arbitrer les rounds sans donner d'information prematuree et fournir une preuve verifiable apres match.

## Options envisagées

| Option | Avantages | Limites |
|---|---|---|
| Arbitrage pur serveur avec coup en clair | Simple, peu de messages, facile a implementer en P0. | Requiert une confiance totale dans le serveur, ne produit pas de preuve publique rejouable. |
| Commit-reveal | Engage chaque joueur avant revelation, empeche l'adaptation au coup adverse, produit un audit trail cryptographique. | Plus de transitions, timeouts et tests; UX un peu plus complexe. |

## Décision

Nous utilisons un protocole commit-reveal : chaque joueur envoie d'abord `SHA256(move + ":" + nonce)`, puis revele `move` et `nonce`. Le serveur verifie le hash avant de resoudre le round.

L'alternative principale rejetee est l'arbitrage pur serveur avec coups en clair. Elle suffit pour une demo fonctionnelle, mais ne repond pas au niveau d'argumentation attendu sur l'anti-triche.

## Conséquences

- Un joueur ne peut pas changer son coup apres avoir observe l'adversaire.
- Les `commit`, `move` et `nonce` conserves dans les rounds permettent de rejouer et verifier un match a posteriori.
- La state machine doit gerer `WAITING_COMMITS`, `WAITING_REVEALS`, les timeouts et les forfeits sur hash invalide.
- Les tests de state machine deviennent critiques et doivent couvrir les transitions avec timers.

## Références

- `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` sections 5.2 et 11.
- `docs/backlog/sprint-1-game-service.md` US-035.
- `docs/backlog/sprint-1-api.md` US-034.

