# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts; mkdir -p node_modules

# Stage 2: Build
FROM node:20-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p dist; npm run build 2>/dev/null || true

# Stage 3: Production
FROM node:20-alpine AS rahatio-integration
WORKDIR /app
RUN apk add --no-cache tini curl
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

USER node
EXPOSE 3001
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
