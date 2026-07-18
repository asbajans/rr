FROM node:20-alpine AS base

WORKDIR /app

FROM base AS builder
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY packages/core ./packages/core
COPY packages/ai-service ./packages/ai-service
COPY packages/integration-service ./packages/integration-service
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rahatio/core build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/core/package.json ./packages/core/
RUN pnpm install --frozen-lockfile --prod --filter @rahatio/core

COPY --from=builder /app/packages/core/dist ./packages/core/dist
COPY --from=builder /app/packages/core/src/config ./packages/core/src/config

EXPOSE 3000
CMD ["node", "packages/core/dist/server.js"]