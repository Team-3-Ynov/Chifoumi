# US-002 — Biome + tsconfig partages (durci production)

**Date :** 2026-04-28  
**Story :** US-002  
**Statut :** Design valide, pret pour plan d'implementation

---

## 1. Objectif

Mettre en place une base de qualite monorepo robuste des le sprint 0:

- lint + format unifies via Biome pour toutes les apps/packages
- configuration TypeScript stricte partagee via `packages/tsconfig`
- hooks git fiables pour bloquer les regressions avant commit
- execution locale et CI coherentes pour supprimer les ecarts d'environnement

Le design suit l'approche **A** validee: baseline stricte + garde-fous progressifs.

---

## 2. Contraintes validees

- Positionnement: **durcie production** (pas un simple MVP)
- Hook pre-commit: **typecheck monorepo complet**
- Regle `any`: **reste en warning** (`noExplicitAny: warn`) avec visibilite en CI
- Alignement backlog sprint 0 et conventions projet (PNPM, Biome, strict TS)

---

## 3. Architecture de configuration

### 3.1 Package `packages/tsconfig`

`packages/tsconfig` devient la source unique des regles TypeScript:

- `base.json` contient les regles communes strictes:
  - `strict: true`
  - `noImplicitAny: true`
  - `noImplicitOverride: true`
  - `noUncheckedIndexedAccess: true`
  - `strictNullChecks: true`
  - `target: ES2022`
  - `module: ESNext`
- `nest.json` et `react.json` etendent `base.json` et ne declarent que les differences runtime/outillage.
- Chaque app/package consommatrice etend l'un de ces profils, sans recopier les regles globales.

### 3.2 Package `packages/biome`

`packages/biome/biome.json` porte une config partagee repo-wide:

- socle `recommended`
- regles additionnelles pour coller au brief (equivalences vis-a-vis des modules ESLint cites)
- comportement pragmatique:
  - `noExplicitAny` en `warn`
  - politique de formatage stable et deterministe

Un document `packages/biome/README.md` reference:

- la justification du choix Biome (substitution validee)
- un tableau d'equivalence Biome <-> modules ESLint du brief
- les limites connues et conventions d'equipe

---

## 4. Flux de validation qualite

### 4.1 Pre-commit local (lefthook)

`pre-commit` execute, dans cet ordre:

1. `pnpm biome check --write`
2. `pnpm -r typecheck`

Effets attendus:

- auto-correction immediate des problemes format/lint corrigibles
- blocage du commit en cas d'erreur TypeScript sur n'importe quel workspace
- feedback rapide et unifie pour tous les contributeurs

### 4.2 CI

La CI rejoue les controles structurants afin d'eviter les differences local/PR:

- `pnpm biome check`
- `pnpm -r typecheck`

Les warnings `any` restent non bloquants, mais doivent etre visibles dans les sorties de checks pour guider les revues.

---

## 5. Strategie d'erreurs et comportements attendus

- **Erreur Biome auto-fixable**: corrigee automatiquement par `--write`, puis l'utilisateur recommit.
- **Erreur TypeScript**: commit refuse tant que la correction n'est pas faite.
- **Warning `any`**: commit autorise, mais trace visible en local/CI; traitement progressif via review.

Ce choix privilegie la fiabilite immediate sans freiner le demarrage du sprint 0.

---

## 6. Mapping vers acceptance criteria US-002

- **AC1**: `pnpm biome check` depuis la racine analyse tout le monorepo et passe sur le squelette sain.
- **AC2**: un fichier `.ts` mal formate est auto-corrige en pre-commit via `biome check --write`.
- **AC3**: `packages/tsconfig/base.json` porte les options strictes requises.
- **AC4**: `noExplicitAny` remonte en warning visible dans les checks.

---

## 7. Perimetre explicite

Inclus dans US-002:

- mise en place des packages de config partages (`biome`, `tsconfig`)
- branchement des apps/packages sur ces configs
- hook `lefthook` pre-commit robuste
- documentation d'equivalence Biome/ESLint

Hors perimetre (traite dans stories ulterieures):

- durcissement `noExplicitAny` en erreur bloquante
- optimisation fine du hook par fichiers modifies
- politiques avancees de quality gates supplementaires (coverage thresholds consolides, etc.)

---

## 8. Risques et mitigations

- **Risque: lenteur du pre-commit** (typecheck complet)  
  **Mitigation:** accepte volontairement pour garantir la fiabilite early-stage; optimisation possible plus tard.

- **Risque: accumulation de `any`** (`warn` non bloquant)  
  **Mitigation:** visibilite CI + convention de justification explicite + vigilance review.

- **Risque: divergence de config entre workspaces**  
  **Mitigation:** centralisation stricte dans `packages/tsconfig` et `packages/biome`.

---

## 9. Definition de done specifique a ce design

Le design US-002 est considere pret pour implementation quand:

- les choix de strictesse sont figes et acceptes
- le flux local/CI est coherent et sans contradiction
- les AC sont mappes explicitement a des validations techniques
- le perimetre et les exclusions sont clairs

Ce document est maintenant la reference de conception pour la phase de planification d'implementation.
