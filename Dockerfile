# syntax=docker/dockerfile:1
# Bản build cho Coolify (và mọi máy có Docker). Dữ liệu nằm ở /app/data (gắn volume).

# --- Giai đoạn 1: cài thư viện và build CSS Tailwind ---
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --include=dev
COPY src ./src
COPY public ./public
RUN npm run build
RUN npm prune --omit=dev

# --- Giai đoạn 2: ảnh chạy thật, nhỏ gọn, không chạy bằng root ---
FROM node:22-bookworm-slim
ENV NODE_ENV=production \
    PORT=3000
WORKDIR /app
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/public ./public
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
RUN mkdir -p /app/data && chown node:node /app/data
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--disable-warning=ExperimentalWarning", "src/server.js"]
