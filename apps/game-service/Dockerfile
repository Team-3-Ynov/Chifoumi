FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
WORKDIR /app
RUN npm install -g pnpm@9.15.9

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/package.json apps/api/package.json
COPY apps/front/package.json apps/front/package.json
COPY apps/game-service/package.json apps/game-service/package.json
COPY apps/job-runner/package.json apps/job-runner/package.json
COPY packages/biome/package.json packages/biome/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/elo/package.json packages/elo/package.json
COPY packages/proto/package.json packages/proto/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
COPY apps ./apps
COPY packages ./packages
RUN pnpm --filter @chifoumi/game-service build

FROM base AS runner
ENV NODE_ENV=production
ENV GAME_SERVICE_PORT=3001
COPY --from=builder /app /app
USER node
EXPOSE 3001
CMD ["node", "apps/game-service/dist/main.js"]
