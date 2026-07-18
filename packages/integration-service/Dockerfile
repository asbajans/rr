FROM node:20-alpine AS base

WORKDIR /app

FROM base AS builder
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY packages/integration-service ./packages/integration-service
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rahatio/integration-service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/integration-service/package.json ./packages/integration-service/
RUN pnpm install --frozen-lockfile --prod --filter @rahatio/integration-service

COPY --from=builder /app/packages/integration-service/dist ./packages/integration-service/dist

EXPOSE 3002
CMD ["node", "packages/integration-service/dist/index.js"]