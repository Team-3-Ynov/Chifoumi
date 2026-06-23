# ADR-002 — Biome a la place d'ESLint et Prettier

## Statut

Accepte.

## Contexte

Le brief projet demandait une qualite de code verifiable avec lint, format et CI. La stack initiale attendait ESLint et Prettier, mais l'equipe a demande puis obtenu la validation explicite du professeur pour utiliser Biome comme substitution.

## Options envisagées

| Option | Avantages | Limites |
|---|---|---|
| ESLint + Prettier separes | Ecosysteme mature, tres configurable, conforme au brief initial. | Deux outils a configurer, conflits possibles formatter/linter, execution plus lente. |
| Biome | Outil unique lint + format, performance native Rust, configuration unifiee, CI plus simple. | Couverture de certaines regles ESLint moins exhaustive, choix a justifier au jury. |

## Décision

Nous utilisons Biome pour remplacer ESLint + Prettier. La decision est encadree par `packages/biome/README.md`, par `CLAUDE.md`, et par la spec projet section 9.1 qui mentionne la validation explicite du professeur.

L'alternative principale rejetee est ESLint + Prettier separes : elle reste viable, mais apporte plus de configuration et de temps d'execution pour une valeur limitee sur ce projet.

## Conséquences

- Un seul outil gere formatage, lint et import ordering.
- Les hooks et la CI sont plus simples a expliquer et a maintenir.
- Les equivalences avec les plugins du brief sont documentees dans `packages/biome/README.md`.
- Si une regle ESLint precise manque, elle doit etre compensee par TypeScript strict, revue de code ou test cible.

## Références

- `CLAUDE.md` section Stack technique.
- `packages/biome/README.md`.
- `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` section 9.1.

