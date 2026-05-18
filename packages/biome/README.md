# @chifoumi/biome

Shared [Biome](https://biomejs.dev/) configuration for the Chifoumi Ranked monorepo.

Preset file: `packages/biome/shared-preset.json` (extended from the root `biome.json`; the filename avoids Biome treating `packages/biome/biome.json` as a second **root**, which breaks monorepo discovery).

## Professor validation

Biome replaces **ESLint + Prettier** for this YNOV project; that substitution was **explicitly approved by the course instructor** (see project brief and `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` § 9.1).

## ESLint-module equivalence (brief list)

| Brief module / concern | Biome coverage |
|------------------------|----------------|
| `eslint-plugin-unicorn` | Many rules map to Biome `complexity`, `style`, `correctness`, and `suspicious` groups enabled via `linter.rules.recommended` (see [rules sources](https://biomejs.dev/linter/rules-sources/)). |
| `eslint-plugin-sonarjs` | Cognitive-complexity / branch-quality style rules are covered by the same recommended groups and additional security/performance advisories. |
| `@typescript-eslint` | TypeScript linting + `noExplicitAny` (`warn` here; compiler still enforces `strict`). |
| `eslint-plugin-perfectionist` | Import ordering via `assist.actions.source.organizeImports` + related style rules. |
| `eslint-plugin-react` + `eslint-plugin-react-hooks` | `linter.domains.react: "recommended"` enables React-oriented lint rules. |
| `eslint-plugin-stylistic` | Biome’s built-in formatter + `style` group recommended rules. |

## Usage

- Full-repo check from root: `pnpm run biome:check` (runs `biome check .`).
- Autofix: `pnpm run biome:fix`
- Equivalent without scripts: `pnpm exec biome check .`
- CI uses `pnpm exec biome ci .` (see `.github/workflows/pr.yml`).
