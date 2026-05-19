# US-006 Bootstrap Apps Implementation Plan

**Goal:** Replace the current placeholder apps with four independently runnable applications:

- `@chifoumi/api`: NestJS HTTP service on port `3000`, `GET /health`.
- `@chifoumi/game-service`: NestJS HTTP service on port `3001`, `GET /health`, Socket.io initialized for future game events.
- `@chifoumi/job-runner`: NestJS standalone application context, no HTTP port, logs `ready`.
- `@chifoumi/front`: Vite + React app on port `5173`, minimal home page that displays API health.

**Authoritative backlog:** `docs/backlog/sprint-0-setup.md` — US-006.

**Current base:** `develop` already includes US-003 Prisma setup, US-004 infra compose, and US-005 CI jobs. Keep this ticket focused on app bootstraps and Dockerfiles; do not implement auth, gameplay, queues, Swagger, or production compose.

---

## File Map

| Path | Role |
|------|------|
| `apps/api/**` | NestJS REST bootstrap, health endpoint, Dockerfile |
| `apps/game-service/**` | NestJS realtime service bootstrap, health endpoint, Socket.io gateway placeholder, Dockerfile |
| `apps/job-runner/**` | NestJS application context bootstrap, ready log, Dockerfile |
| `apps/front/**` | Vite React bootstrap, API health display, Dockerfile |
| `.dockerignore` | Shared monorepo Docker build exclusions |
| `package.json`, `pnpm-lock.yaml` | Root scripts and dependency lock updates |

---

## Design Decisions

| Topic | Decision |
|-------|----------|
| Nest build | Use `tsc -p tsconfig.json` and execute `node dist/main.js`, matching AC3 without requiring Nest CLI. |
| Nest module shape | Keep each Nest app minimal: `AppModule`, `HealthModule`, `HealthController`. |
| Health payload | Return `{ status: "ok", service: "<name>", version: "<package version>" }`. |
| Ports | API `API_PORT ?? 3000`, game service `GAME_SERVICE_PORT ?? 3001`, front `VITE_PORT ?? 5173`. |
| Job runner | Use `NestFactory.createApplicationContext(AppModule)` and log `[job-runner] ready`; no HTTP server. |
| Front health call | Fetch `${VITE_API_BASE_URL ?? "http://localhost:3000"}/health`; show loading, ok, and error states. |
| Docker build context | Build from repo root with per-app Dockerfiles: `docker build -f apps/api/Dockerfile .`. This keeps workspace packages available. |
| Compose integration | Do not add app containers to `docker-compose.yml` in this ticket unless explicitly requested; US-004 is infra-only and later devops tickets compose the full stack. |

---

## Task 0: Preflight

- [ ] Ensure branch starts from updated `develop`.
- [ ] Confirm existing checks are green before changing app bootstraps:

```powershell
pnpm install --frozen-lockfile
pnpm exec biome ci .
pnpm -r typecheck
```

- [ ] Confirm current placeholders can be removed or replaced:
  - `apps/*/src/placeholder.*`
  - `apps/api/src/test.ts` is Prisma smoke-test scaffolding from US-003 and should not remain the app entrypoint.

---

## Task 1: Shared Dependency Strategy

- [ ] Add Nest runtime deps where needed:

```powershell
pnpm --filter @chifoumi/api add @nestjs/common @nestjs/core @nestjs/platform-express reflect-metadata rxjs
pnpm --filter @chifoumi/game-service add @nestjs/common @nestjs/core @nestjs/platform-express @nestjs/platform-socket.io @nestjs/websockets reflect-metadata rxjs socket.io
pnpm --filter @chifoumi/job-runner add @nestjs/common @nestjs/core reflect-metadata rxjs
```

- [ ] Add shared Node dev deps where needed:

```powershell
pnpm --filter @chifoumi/api add -D @types/node tsx
pnpm --filter @chifoumi/game-service add -D @types/node tsx
pnpm --filter @chifoumi/job-runner add -D @types/node tsx
```

- [ ] Add Vite/React deps:

```powershell
pnpm --filter @chifoumi/front add @vitejs/plugin-react vite react react-dom
pnpm --filter @chifoumi/front add -D @types/react @types/react-dom typescript
```

Expected: `pnpm-lock.yaml` updates once, no duplicate package-manager files inside app folders.

---

## Task 2: API App

**Files:** `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/**`, `apps/api/Dockerfile`

- [ ] Replace placeholder entrypoints with:
  - `src/main.ts`
  - `src/app.module.ts`
  - `src/health/health.module.ts`
  - `src/health/health.controller.ts`
- [ ] `main.ts` must:
  - import `reflect-metadata`
  - create Nest app from `AppModule`
  - enable CORS for the Vite dev server
  - listen on `Number(process.env.API_PORT ?? 3000)`
- [ ] Health response:

```json
{ "status": "ok", "service": "api", "version": "1.0.0" }
```

- [ ] Package scripts:

```json
{
  "dev": "tsx watch src/main.ts",
  "build": "tsc -p tsconfig.json",
  "start": "node dist/main.js",
  "typecheck": "tsc -p tsconfig.json --noEmit"
}
```

- [ ] Keep Prisma deps from US-003; do not wire Prisma into the Nest app yet.

---

## Task 3: Game Service App

**Files:** `apps/game-service/package.json`, `apps/game-service/tsconfig.json`, `apps/game-service/src/**`, `apps/game-service/Dockerfile`

- [ ] Create the same minimal Nest module and health endpoint shape as API, but:
  - port is `Number(process.env.GAME_SERVICE_PORT ?? 3001)`
  - health service is `"game-service"`
- [ ] Add a placeholder Socket.io gateway:
  - `src/game.gateway.ts`
  - `@WebSocketGateway({ cors: { origin: true } })`
  - log connection/disconnection only
  - no matchmaking/game events yet
- [ ] Package scripts mirror API.
- [ ] Build output must run with `node dist/main.js`.

---

## Task 4: Job Runner App

**Files:** `apps/job-runner/package.json`, `apps/job-runner/tsconfig.json`, `apps/job-runner/src/**`, `apps/job-runner/Dockerfile`

- [ ] Create:
  - `src/main.ts`
  - `src/app.module.ts`
  - optional `src/runner.service.ts`
- [ ] `main.ts` must:
  - import `reflect-metadata`
  - call `NestFactory.createApplicationContext(AppModule)`
  - log `[job-runner] ready`
  - handle `SIGINT` / `SIGTERM` by closing the Nest context cleanly
- [ ] Package scripts mirror API, except no HTTP smoke endpoint.
- [ ] Do not add BullMQ workers in US-006; that belongs to sprint 1 job-runner tickets.

---

## Task 5: Front App

**Files:** `apps/front/package.json`, `apps/front/tsconfig.json`, `apps/front/index.html`, `apps/front/src/**`, `apps/front/Dockerfile`

- [ ] Create Vite React structure:
  - `index.html`
  - `src/main.tsx`
  - `src/App.tsx`
  - `src/App.css` or minimal CSS module
  - `src/vite-env.d.ts`
  - `vite.config.ts`
- [ ] Package scripts:

```json
{
  "dev": "vite --host 0.0.0.0 --port 5173",
  "build": "tsc -p tsconfig.json && vite build",
  "preview": "vite preview --host 0.0.0.0 --port 5173",
  "typecheck": "tsc -p tsconfig.json --noEmit"
}
```

- [ ] Minimal page behavior:
  - shows project/app name
  - calls API `/health`
  - displays service, status, and version when API is reachable
  - displays a compact error state if API is offline

Keep UI simple and functional; US-006 is bootstrap, not the sprint 1 front experience.

---

## Task 6: Dockerfiles

**Files:** `.dockerignore`, `apps/api/Dockerfile`, `apps/game-service/Dockerfile`, `apps/job-runner/Dockerfile`, `apps/front/Dockerfile`

- [ ] Add root `.dockerignore`:

```dockerignore
node_modules
**/node_modules
dist
**/dist
coverage
**/coverage
.git
.env
.env.*
!.env.example
```

- [ ] Each Dockerfile must be multi-stage:
  - `base`: `node:20-alpine`, enable `corepack`, set PNPM version `9.15.9`
  - `deps`: copy workspace manifests and install with `pnpm install --frozen-lockfile`
  - `builder`: copy source and run filtered build
  - `runner`: copy built app and required workspace deps, run as non-root where practical
- [ ] API runner:

```dockerfile
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]
```

- [ ] Game runner:

```dockerfile
EXPOSE 3001
CMD ["node", "apps/game-service/dist/main.js"]
```

- [ ] Job runner has no exposed port.
- [ ] Front runner can use `nginx:1.27-alpine` serving `apps/front/dist`, or `node:20-alpine` with Vite preview. Prefer `nginx` for a smaller static runner.

Note: If Dockerfile dependency pruning becomes too heavy for this sprint, use the full workspace install in `runner` and document it as acceptable for bootstrap; optimize image size in later devops tickets.

---

## Task 7: Verification

- [ ] Install and build:

```powershell
pnpm install --frozen-lockfile
pnpm exec biome ci .
pnpm -r typecheck
pnpm -r run --if-present build
```

- [ ] API:

```powershell
pnpm --filter @chifoumi/api dev
Invoke-RestMethod http://localhost:3000/health
```

Expected:

```json
{ "status": "ok", "service": "api", "version": "1.0.0" }
```

- [ ] Game service:

```powershell
pnpm --filter @chifoumi/game-service dev
Invoke-RestMethod http://localhost:3001/health
```

Expected:

```json
{ "status": "ok", "service": "game-service", "version": "0.0.0" }
```

- [ ] Job runner:

```powershell
pnpm --filter @chifoumi/job-runner dev
```

Expected logs include:

```text
[job-runner] ready
```

- [ ] Front:

```powershell
pnpm --filter @chifoumi/front dev
```

Expected: `http://localhost:5173` loads and displays API health when API is running.

- [ ] Built Nest output:

```powershell
pnpm --filter @chifoumi/api build
node apps/api/dist/main.js

pnpm --filter @chifoumi/game-service build
node apps/game-service/dist/main.js

pnpm --filter @chifoumi/job-runner build
node apps/job-runner/dist/main.js
```

- [ ] Docker builds:

```powershell
docker build -f apps/api/Dockerfile -t chifoumi-api:us-006 .
docker build -f apps/game-service/Dockerfile -t chifoumi-game-service:us-006 .
docker build -f apps/job-runner/Dockerfile -t chifoumi-job-runner:us-006 .
docker build -f apps/front/Dockerfile -t chifoumi-front:us-006 .
```

- [ ] Optional Docker smoke:

```powershell
docker run --rm -p 3000:3000 chifoumi-api:us-006
docker run --rm -p 3001:3001 chifoumi-game-service:us-006
docker run --rm chifoumi-job-runner:us-006
docker run --rm -p 5173:80 chifoumi-front:us-006
```

---

## PR Checklist

- [ ] PR title: `feat(apps): bootstrap api game job-runner and front (#6)`
- [ ] PR body includes:
  - `Closes #6`
  - list of four runnable apps
  - health endpoint examples
  - build and Docker verification commands
  - explicit note that auth, gameplay, BullMQ jobs, Swagger, and full compose integration are out of scope
- [ ] CI `lint`, `typecheck`, `test`, `build` stays green.

---

## Out Of Scope

- Auth/register/login/JWT (US-007)
- Swagger/OpenAPI (US-008)
- README onboarding (US-009)
- BullMQ workers and queues
- Real Socket.io gameplay events
- Full multi-service Docker Compose with app containers
- Traefik, Prometheus, Grafana, scale/demo compose
