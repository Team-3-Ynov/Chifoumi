# ADR-001 — gRPC entre Game Service et API

## Statut

Accepte.

## Contexte

Le Game Service orchestre le temps reel mais ne doit pas acceder directement a la base applicative. Il a besoin de verifier un JWT, connaitre le rating d'un joueur et garder un contrat stable avec l'API. Ces appels sont internes, synchrones et sensibles au typage.

## Options envisagées

| Option | Avantages | Limites |
|---|---|---|
| REST interne | Simple, deja connu, facile a debugger avec curl. | Contrats moins stricts, DTOs a synchroniser manuellement, erreurs moins typees. |
| tRPC | Type-safe en TypeScript, DX confortable. | Couple fortement les deux services a un runtime TS et sort du contrat inter-service standard du projet. |
| gRPC avec `.proto` | Contrats versionnes, codegen type-safe, erreurs standardisees, streaming possible plus tard. | Setup plus lourd qu'un endpoint REST et outillage de debug moins immediat. |

## Décision

Nous utilisons gRPC entre le Game Service et l'API pour `Auth.VerifyToken` et `Users.GetRating`. Le contrat vit dans `packages/proto`, ce qui rend l'interface explicite et versionnable.

L'alternative principale rejetee est REST interne : acceptable comme fallback, mais moins robuste pour un contrat entre deux services deployes separement.

## Conséquences

- Le Game Service reste isole de PostgreSQL et delegue l'autorite auth/user a l'API.
- Les changements de contrat passent par les fichiers `.proto`, ce qui rend les ruptures visibles en CI.
- Le projet garde une porte ouverte vers du streaming gRPC si des besoins temps reel internes apparaissent.
- Les developpeurs doivent maintenir la generation des stubs et connaitre les codes d'erreur gRPC.

## Références

- `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` sections 3.3 et 6.3.
- `docs/backlog/sprint-1-api.md` US-033.
- `docs/backlog/sprint-1-game-service.md` US-037.

