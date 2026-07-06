# Stage 1: TypeScript Compile
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json tsconfig.json ./
RUN npm install && mkdir -p node_modules
COPY src/ src/
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS rahatio-ai
WORKDIR /app

RUN apk add --no-cache tini curl python3 py3-pip py3-pillow

RUN pip3 install --no-cache-dir rembg onnxruntime --quiet \
    && rm -rf /root/.cache

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
ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/index.js"]
