# Contributing

Merci de garder les contributions petites, lisibles et reliees a une user story.

## Workflow Git

1. Mettre `develop` a jour.

   ```bash
   git checkout develop
   git pull --ff-only origin develop
   ```

2. Creer une branche depuis `develop`.

   ```bash
   git checkout -b feature/us-xxx-short-name
   ```

   Prefixes autorises :

   - `feature/` pour une fonctionnalite.
   - `fix/` pour une correction.
   - `docs/` pour la documentation.
   - `chore/` pour l'outillage ou la maintenance.

3. Commiter regulierement avec Conventional Commits.
4. Pousser la branche et ouvrir une PR vers `develop`.
5. Attendre au moins une review avant merge.

## Conventional Commits

Format attendu :

```text
type(scope): description courte (#issue)
```

Exemples :

```text
feat(api): add auth register endpoint (#12)
fix(game): reject expired round moves (#21)
docs(readme): add onboarding guide (#9)
chore(ci): tighten coverage thresholds (#44)
```

Types courants :

- `feat` : nouvelle fonctionnalite.
- `fix` : correction de bug.
- `docs` : documentation uniquement.
- `test` : tests.
- `refactor` : refactor sans changement fonctionnel.
- `chore` : maintenance, CI, tooling.

## Pull requests

Chaque PR doit contenir :

- un titre Conventional Commit ;
- un lien vers l'issue ou l'US (`Closes #...` si applicable) ;
- un resume des changements ;
- les commandes lancees localement ;
- les limites ou elements hors scope.

Ne pas merger sa propre PR sans review. Les commentaires reviewers doivent etre traites ou explicitement discutes avant merge.

## Qualite locale

Avant de demander une review :

```bash
pnpm exec biome ci .
pnpm -r typecheck
pnpm -r run --if-present build
```

Si une app ou un package ajoute des tests, lancer aussi la commande de test associee avec coverage.
