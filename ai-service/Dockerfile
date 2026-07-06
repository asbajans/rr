# Stage 1: TypeScript Compile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install && mkdir -p node_modules
COPY src/ src/
RUN npm run build

# Stage 2: Python deps (glibc-based for onnxruntime wheels)
FROM python:3.11-slim AS py-deps
RUN pip install --no-cache-dir rembg --quiet \
    && rm -rf /root/.cache

# Stage 3: Production
FROM node:20-slim AS rahatio-ai
WORKDIR /app

RUN apt-get update -qq \
    && apt-get install -y -qq --no-install-recommends curl tini python3 \
    && rm -rf /var/lib/apt/lists/*

COPY --from=py-deps /usr/local/lib/python3.11 /usr/local/lib/python3.11
COPY --from=py-deps /usr/local/bin /usr/local/bin

COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY package.json ./
COPY workflows/ workflows/
COPY scripts/ scripts/

ENV COMFY_URL=http://localhost:8188
ENV OLLAMA_URL=http://localhost:11434
ENV VISION_MODEL=llama3.2-vision
ENV LLM_MODEL=llama3
EXPOSE 3000
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist/index.js"]
