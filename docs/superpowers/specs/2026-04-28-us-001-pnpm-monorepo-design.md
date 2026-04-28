# Design — US-001 PNPM monorepo skeleton

**Date:** 2026-04-28  
**Ticket:** GitHub [#1](https://github.com/Team-3-Ynov/Chifoumi/issues/1) — US-001 (EPIC-S0)  
**Backlog:** `docs/backlog/sprint-0-setup.md` (US-001)  
**Platform design:** `docs/superpowers/specs/2026-04-28-rps-ranked-platform-design.md` (stack: PNPM workspaces, `apps/*`, `packages/*`)

## Goal

Provide a **minimal, reproducible PNPM workspace layout** so a clean machine with Node 20+ and PNPM 9 can run `pnpm install` once and see all future apps and shared packages as workspaces. No application code, linter, or TypeScript config in this ticket (deferred to US-002).

## Approach

**Backlog-minimal (option 1):** Implement only what US-001 lists. Do not add root devDependencies, Biome, `tsconfig`, lefthook, or CI changes here. This keeps the PR aligned with #1 and avoids scope overlap with US-002.

## Workspace inventory

Each row is a directory containing **only** a stub `package.json` in US-001.

### Apps (`apps/*`)

| Path | Package name |
|------|----------------|
| `apps/api` | `@chifoumi/api` |
| `apps/game-service` | `@chifoumi/game-service` |
| `apps/job-runner` | `@chifoumi/job-runner` |
| `apps/front` | `@chifoumi/front` |

### Packages (`packages/*`)

| Path | Package name |
|------|----------------|
| `packages/tsconfig` | `@chifoumi/tsconfig` |
| `packages/biome` | `@chifoumi/biome` |
| `packages/schemas` | `@chifoumi/schemas` |
| `packages/db` | `@chifoumi/db` |
| `packages/elo` | `@chifoumi/elo` |
| `packages/proto` | `@chifoumi/proto` |

Existing repo content (`docs/`, `.cursor/`, `CLAUDE.md`, `SETUP.md`, `.gitignore`) is unchanged by this ticket.

## Root `package.json`

| Field | Value |
|-------|--------|
| `name` | `@chifoumi/root` |
| `version` | `0.0.0` |
| `private` | `true` |
| `packageManager` | `pnpm@9.15.9` (exact pin; any `pnpm@9.x.y` acceptable if team standardizes elsewhere) |
| `engines.node` | `>=20.0.0` |
| `workspaces` | `["apps/*", "packages/*"]` |

**Excluded in US-001:** `dependencies`, `devDependencies`, and `scripts` (optional scripts may be added in later tickets).

## `pnpm-workspace.yaml`

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

Must match the workspace globs used in root `package.json`.

## `.npmrc` (repository root)

- `shared-workspace-lockfile=true` — single `pnpm-lock.yaml` at root.
- `strict-peer-dependencies=false` — startup posture per backlog; may be tightened later.

## Stub `package.json` shape

Every workspace under `apps/*` and `packages/*` has exactly:

- `"name"` — scoped name from the inventory table
- `"version"` — `"0.0.0"`
- `"private"` — `true`

No `main`, `types`, `exports`, `scripts`, or dependency fields in US-001.

## Verification (acceptance criteria)

| AC | Verification |
|----|----------------|
| **AC1** | From repo root: `pnpm install` exits 0; all workspace projects resolve. |
| **AC2** | `pnpm -r list --depth -1` lists every workspace; each path appears under `apps/` or `packages/` (display as `@chifoumi/*` is acceptable). |
| **AC3** | Root `package.json` includes `private: true`, `packageManager` with `pnpm@9.x.x`, `engines.node` ≥ `20.0.0`. |

**Version control:** Commit `pnpm-lock.yaml` with the change set so installs are reproducible.

## Out of scope

- Biome, shared TypeScript configs, lefthook, GitHub Actions (US-002 and follow-ons).
- Application source, NestJS/React scaffolding, Prisma, Docker Compose (later US).
- `.gitignore` updates unless review finds a gap vs. US-001 tasks; current root `.gitignore` already lists `node_modules/`, `.pnpm-store/`, `dist/`, `coverage/`.

## Error handling and risks

- **PNPM / Node version drift:** `packageManager` field documents the intended PNPM major; CI should eventually enforce it (out of scope for US-001).
- **Empty workspaces:** PNPM accepts workspaces with only `package.json`; no build step required for this ticket.

## Testing

Manual checks only for US-001: `pnpm install` and `pnpm -r list --depth -1` as above. Automated tests are not required for skeleton-only files.
