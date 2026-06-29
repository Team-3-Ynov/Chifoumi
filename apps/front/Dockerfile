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
COPY apps/user-service/package.json apps/user-service/package.json
COPY packages/biome/package.json packages/biome/package.json
COPY packages/db/package.json packages/db/package.json
COPY packages/elo/package.json packages/elo/package.json
COPY packages/leagues/package.json packages/leagues/package.json
COPY packages/proto/package.json packages/proto/package.json
COPY packages/schemas/package.json packages/schemas/package.json
COPY packages/tsconfig/package.json packages/tsconfig/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS builder
ARG VITE_API_BASE_URL=http://localhost:3000
ARG VITE_GAME_SERVICE_URL=http://localhost:3001
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_GAME_SERVICE_URL=$VITE_GAME_SERVICE_URL
COPY apps ./apps
COPY packages ./packages
RUN pnpm --filter @chifoumi/front build
RUN mkdir -p apps/front/dist/vendor \
  && cp "$(find node_modules -path '*/socket.io-client/dist/socket.io.min.js' -print -quit)" apps/front/dist/vendor/socket.io.min.js

FROM nginx:1.27-alpine AS runner
COPY apps/front/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/front/dist /usr/share/nginx/html
EXPOSE 80
