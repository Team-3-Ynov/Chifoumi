# @chifoumi/biome

Configuration Biome partagee du monorepo Chifoumi Ranked.

## Pourquoi Biome (et pas ESLint + Prettier)

Le brief YNOV impose linter + formatter. Le choix **Biome** remplace **ESLint + Prettier** apres validation explicite par l'enseignant (substitution officielle). Un seul outil couvre lint + format avec une config unifiee et des performances natives.

## Usage

```bash
# Depuis la racine du monorepo
pnpm biome:check      # verification locale
pnpm biome:ci         # mode CI (echec sur erreurs, warnings visibles)
```

## Regle `any`

- `suspicious/noExplicitAny` est en **`warn`** (non bloquant en local/CI).
- Tout `any` doit etre justifie en review avec un commentaire explicite au-dessus :
  `// any: <raison>`

## Equivalence Biome vs modules ESLint du brief

| Module ESLint (brief) | Equivalent Biome (approche) | Notes |
|---|---|---|
| `@typescript-eslint` | `recommended` + regles `style`/`suspicious` | Typage strict gere par `packages/tsconfig` |
| `eslint-plugin-unicorn` | regles `complexity`, `style`, `nursery` | Bonnes pratiques JS/TS |
| `eslint-plugin-sonarjs` | regles `complexity`/`suspicious` | Detections de code smell |
| `eslint-plugin-perfectionist` | `organizeImports` + tri imports Biome | Ordre imports automatise |
| `eslint-plugin-stylistic` | `formatter` Biome | Formatage unifie |
| `eslint-plugin-react` | profil `biome.react.json` + `a11y.recommended` | Active sur `apps/front` |
| `eslint-plugin-react-hooks` | `correctness/useHookAtTopLevel`, `useExhaustiveDependencies` | Profil React front |

## Extension par workspace

Chaque app/package etend la config partagee via `biome.json` local :

- NestJS (`apps/api`, `apps/game-service`, `apps/job-runner`) -> `packages/biome/biome.json`
- React (`apps/front`) -> `packages/biome/biome.react.json`
- Packages partages -> `../biome/biome.json`
