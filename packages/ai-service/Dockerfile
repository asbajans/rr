FROM node:20-alpine AS base

WORKDIR /app

FROM base AS builder
RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml turbo.json ./
COPY packages/ai-service ./packages/ai-service
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @rahatio/ai-service build

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN npm install -g pnpm@9
COPY package.json pnpm-lock.yaml* pnpm-workspace.yaml ./
COPY packages/ai-service/package.json ./packages/ai-service/
RUN pnpm install --frozen-lockfile --prod --filter @rahatio/ai-service

COPY --from=builder /app/packages/ai-service/dist ./packages/ai-service/dist
COPY --from=builder /app/packages/ai-service/workflows ./packages/ai-service/workflows

EXPOSE 3001
CMD ["node", "packages/ai-service/dist/index.js"]