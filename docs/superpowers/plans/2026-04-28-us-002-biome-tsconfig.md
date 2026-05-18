# US-002 Biome + Tsconfig Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Mettre en place une chaine qualite monorepo stricte et reproductible avec Biome, tsconfig partages, hook pre-commit et verification CI.

**Architecture:** Les regles de lint/format et de typage sont centralisees dans `packages/biome` et `packages/tsconfig`, puis consommees par tous les workspaces via `extends`. Le hook `lefthook` impose un garde-fou local (`biome --write` puis typecheck complet) et la CI rejoue les memes controles pour eviter les ecarts entre machine dev et PR.

**Tech Stack:** PNPM workspaces, TypeScript strict, Biome, Lefthook, GitHub Actions.

---

### Task 1: Poser les prerequis monorepo minimaux

**Files:**
- Create: `package.json`
- Create: `pnpm-workspace.yaml`
- Create: `.npmrc`
- Create: `apps/api/package.json`
- Create: `apps/game-service/package.json`
- Create: `apps/job-runner/package.json`
- Create: `apps/front/package.json`
- Create: `packages/biome/package.json`
- Create: `packages/tsconfig/package.json`
- Create: `packages/schemas/package.json`
- Create: `packages/db/package.json`
- Create: `packages/elo/package.json`
- Create: `packages/proto/package.json`
- Test: verification commande workspace

- [ ] **Step 1: Ecrire un test d'acceptance shell (squelette workspaces attendu)**

```bash
pnpm -r list --depth -1
```

Critere attendu: la commande doit lister les workspaces `apps/*` et `packages/*` ci-dessus.

- [ ] **Step 2: Verifier que le test echoue au depart**

Run: `pnpm -r list --depth -1`  
Expected: echec ou liste vide tant que les fichiers workspace n'existent pas.

- [ ] **Step 3: Creer les fichiers minimaux monorepo**

```json
{
  "name": "chifoumi",
  "private": true,
  "packageManager": "pnpm@9.0.0",
  "engines": {
    "node": ">=20.0.0"
  },
  "scripts": {
    "biome:check": "pnpm biome check",
    "typecheck": "pnpm -r typecheck"
  }
}
```

```yaml
packages:
  - apps/*
  - packages/*
```

```ini
shared-workspace-lockfile=true
strict-peer-dependencies=false
```

Exemple de `apps/api/package.json` (repeter meme structure pour chaque workspace):

```json
{
  "name": "@chifoumi/api",
  "version": "0.0.0",
  "private": true,
  "scripts": {
    "typecheck": "tsc --noEmit -p tsconfig.json"
  }
}
```

- [ ] **Step 4: Rejouer le test workspace**

Run: `pnpm -r list --depth -1`  
Expected: PASS avec tous les workspaces visibles.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc apps packages
git commit -m "chore(repo): scaffold pnpm workspace layout (#2)"
```

---

### Task 2: Implementer `packages/tsconfig` strict partage

**Files:**
- Create: `packages/tsconfig/base.json`
- Create: `packages/tsconfig/nest.json`
- Create: `packages/tsconfig/react.json`
- Create: `apps/api/tsconfig.json`
- Create: `apps/game-service/tsconfig.json`
- Create: `apps/job-runner/tsconfig.json`
- Create: `apps/front/tsconfig.json`
- Create: `packages/biome/tsconfig.json`
- Create: `packages/schemas/tsconfig.json`
- Create: `packages/db/tsconfig.json`
- Create: `packages/elo/tsconfig.json`
- Create: `packages/proto/tsconfig.json`
- Test: `pnpm -r typecheck`

- [ ] **Step 1: Ecrire le test d'acceptance AC3**

```bash
node -e "const fs=require('node:fs');const cfg=JSON.parse(fs.readFileSync('packages/tsconfig/base.json','utf8'));const o=cfg.compilerOptions;const ok=o.strict===true&&o.noImplicitAny===true&&o.noImplicitOverride===true&&o.noUncheckedIndexedAccess===true&&o.strictNullChecks===true&&o.target==='ES2022'&&o.module==='ESNext';if(!ok){process.exit(1)}"
```

- [ ] **Step 2: Verifier que le test echoue**

Run: commande ci-dessus  
Expected: FAIL tant que `base.json` n'est pas cree.

- [ ] **Step 3: Ecrire les configs TS partagees et les extends**

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "strict": true,
    "noImplicitAny": true,
    "noImplicitOverride": true,
    "noUncheckedIndexedAccess": true,
    "strictNullChecks": true,
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "skipLibCheck": true
  }
}
```

```json
{
  "extends": "../../packages/tsconfig/nest.json"
}
```

```json
{
  "extends": "../../packages/tsconfig/react.json"
}
```

- [ ] **Step 4: Verifier typecheck monorepo**

Run: `pnpm -r typecheck`  
Expected: PASS (ou erreurs explicites a corriger dans les tsconfig references).

- [ ] **Step 5: Commit**

```bash
git add packages/tsconfig apps/*/tsconfig.json packages/*/tsconfig.json
git commit -m "feat(tsconfig): add strict shared tsconfig profiles (#2)"
```

---

### Task 3: Implementer `packages/biome` partage + regles warning any

**Files:**
- Create: `packages/biome/biome.json`
- Create: `packages/biome/README.md`
- Create: `apps/api/biome.json`
- Create: `apps/game-service/biome.json`
- Create: `apps/job-runner/biome.json`
- Create: `apps/front/biome.json`
- Create: `packages/schemas/biome.json`
- Create: `packages/db/biome.json`
- Create: `packages/elo/biome.json`
- Create: `packages/proto/biome.json`
- Modify: `package.json`
- Test: `pnpm biome check`

- [ ] **Step 1: Ecrire le test d'acceptance AC1 + AC4**

Creer un fichier de test temporaire `apps/api/src/any-warning.ts`:

```ts
export const unsafeValue: any = "demo";
```

Puis lancer:

```bash
pnpm biome check
```

Critere attendu: la commande doit tourner sur tous les workspaces et remonter un warning `noExplicitAny` (non bloquant).

- [ ] **Step 2: Verifier que le test echoue avant config**

Run: `pnpm biome check`  
Expected: FAIL car config Biome inexistante.

- [ ] **Step 3: Ajouter la config partagee et les extends**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": {
        "noExplicitAny": "warn"
      }
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
```

Exemple d'extend workspace (`apps/api/biome.json`):

```json
{
  "extends": ["../../packages/biome/biome.json"]
}
```

Ajouter dans `package.json` racine:

```json
{
  "scripts": {
    "biome": "biome",
    "biome:check": "biome check ."
  },
  "devDependencies": {
    "@biomejs/biome": "latest"
  }
}
```

Ajouter `packages/biome/README.md` avec:
- rationale Biome (validation prof)
- tableau equivalence Biome / modules ESLint du brief
- regle `noExplicitAny: warn` et convention de justification `// any: raison`

- [ ] **Step 4: Verifier la commande Biome**

Run: `pnpm install && pnpm biome:check`  
Expected: PASS global, warning visible sur `any-warning.ts`.

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-lock.yaml packages/biome apps/*/biome.json packages/*/biome.json
git commit -m "feat(biome): add shared lint-format baseline with any warning (#2)"
```

---

### Task 4: Configurer lefthook pre-commit (autofix + typecheck complet)

**Files:**
- Create: `lefthook.yml`
- Modify: `package.json`
- Test: pre-commit end-to-end

- [ ] **Step 1: Ecrire le test d'acceptance AC2**

Creer `apps/api/src/misformatted.ts` volontairement mal formate:

```ts
export   const   foo={bar:"baz"}
```

Lancer un commit test:

```bash
git add apps/api/src/misformatted.ts
git commit -m "test(hooks): verify biome autofix pre-commit (#2)"
```

Critere attendu: avant impl, le commit ne passe pas (lefthook absent).

- [ ] **Step 2: Verifier l'echec du test**

Run: commande de commit ci-dessus  
Expected: aucun hook executé ou echec absence config.

- [ ] **Step 3: Implementer lefthook**

Ajouter au `package.json`:

```json
{
  "devDependencies": {
    "lefthook": "latest"
  },
  "scripts": {
    "prepare": "lefthook install",
    "typecheck": "pnpm -r typecheck"
  }
}
```

Creer `lefthook.yml`:

```yaml
pre-commit:
  parallel: false
  commands:
    biome:
      run: pnpm biome check --write
    typecheck:
      run: pnpm -r typecheck
```

- [ ] **Step 4: Rejouer le test de commit**

Run:

```bash
pnpm install
git add .
git commit -m "test(hooks): verify biome autofix pre-commit (#2)"
```

Expected:
- Biome reformate `misformatted.ts`
- typecheck s'execute sur tout le monorepo
- commit autorise si aucun bloquant

- [ ] **Step 5: Commit**

```bash
git add lefthook.yml package.json pnpm-lock.yaml apps/api/src/misformatted.ts
git commit -m "chore(ci): enforce pre-commit biome write and full typecheck (#2)"
```

---

### Task 5: Aligner CI et verifier la definition of done de US-002

**Files:**
- Create: `.github/workflows/pr.yml` (si absent)
- Modify: `.github/workflows/pr.yml` (si existant)
- Test: execution locale des commandes CI

- [ ] **Step 1: Ecrire le test d'acceptance CI**

Commandes a rejouer localement:

```bash
pnpm biome:check
pnpm -r typecheck
```

Critere attendu: meme resultat local et CI (checks verts, warning `any` visible).

- [ ] **Step 2: Verifier echec initial (si workflow absent/incomplet)**

Run: `rg "biome|typecheck" .github/workflows/pr.yml`  
Expected: FAIL ou couverture partielle.

- [ ] **Step 3: Ajouter/mettre a jour le workflow**

Snippet cible:

```yaml
name: PR Checks
on:
  pull_request:
    branches: [develop, main]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm biome:check
      - run: pnpm -r typecheck
```

- [ ] **Step 4: Verifier la DoD US-002 localement**

Run:

```bash
pnpm biome:check && pnpm -r typecheck && pnpm -r list --depth -1
```

Expected:
- AC1 OK
- AC3 OK
- workflow CI aligne
- warning `any` visible quand present

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/pr.yml
git commit -m "ci(quality): run biome and monorepo typecheck on PRs (#2)"
```

---

### Task 6: Validation finale et hygiene de branche

**Files:**
- Modify: `docs/superpowers/specs/2026-04-28-us-002-biome-tsconfig-design.md` (si ajustements necessaires)
- Test: commandes finales de verification

- [ ] **Step 1: Verifier commandes finales projet**

```bash
pnpm biome:check
pnpm -r typecheck
```

- [ ] **Step 2: Verifier warning `any` visible (non bloquant)**

```bash
pnpm biome:check 2>&1 | rg "any|noExplicitAny"
```

Expected: au moins une sortie warning lorsque present, exit code global non bloque par warn.

- [ ] **Step 3: Nettoyer fichiers de test temporaires**

Supprimer les artefacts utilises uniquement pour verification (`any-warning.ts`, etc.) ou les convertir en fixtures de test si utiles.

- [ ] **Step 4: Verifier etat git**

```bash
git status
git log --oneline -n 6
```

Expected: historique propre en petits commits logiques conformes conventional commits.

- [ ] **Step 5: Commit final de doc (si necessaire)**

```bash
git add docs/superpowers/specs/2026-04-28-us-002-biome-tsconfig-design.md
git commit -m "docs(spec): sync US-002 design with final quality workflow (#2)"
```

---

## Self-review checklist (effectue)

- Couverture spec: chaque exigence de la spec US-002 est mappee a au moins une task.
- Placeholder scan: aucun TODO/TBD dans les etapes.
- Coherence: memes conventions de scripts (`biome:check`, `typecheck`) utilisees partout.

