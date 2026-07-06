# Stage 1: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install && mkdir -p node_modules
COPY src/ src/
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS rahatio-integration
WORKDIR /app
RUN apk add --no-cache tini curl
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./

ENV REDIS_URL=redis://redis:6379
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
