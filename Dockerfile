# NextLevel API image (D56): the API on Node 24 (TypeScript run directly), with the built admin
# console served from ADMIN_DIST. Build: docker build -t nextlevel-api .
# The same image runs the daily backup (deploy/compose.yaml, service `backup`).

# --- Admin console build -----------------------------------------------------------------------
FROM node:24-slim AS admin
WORKDIR /app
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/launcher/package.json apps/launcher/
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/system-catalog/package.json packages/system-catalog/
COPY packages/themes/package.json packages/themes/
COPY packages/ui/package.json packages/ui/
# Scripts off: the console needs no native modules (and the launcher's Electron is skipped).
RUN npm ci --ignore-scripts
COPY tsconfig*.json ./
COPY packages packages
COPY apps/admin apps/admin
RUN npm run build -w apps/admin

# --- API runtime dependencies --------------------------------------------------------------------
FROM node:24-slim AS deps
WORKDIR /app
# better-sqlite3 uses its prebuilt binary; these build it from source if there is none.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*
ENV ELECTRON_SKIP_BINARY_DOWNLOAD=1
# Every workspace's package.json: npm ci checks them all against the lockfile.
COPY package.json package-lock.json ./
COPY apps/admin/package.json apps/admin/
COPY apps/api/package.json apps/api/
COPY apps/launcher/package.json apps/launcher/
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY packages/system-catalog/package.json packages/system-catalog/
COPY packages/themes/package.json packages/themes/
COPY packages/ui/package.json packages/ui/
RUN npm ci --omit=dev --workspace apps/api --include-workspace-root=false

# --- Runtime -------------------------------------------------------------------------------------
FROM node:24-slim
WORKDIR /app
ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=4000 \
    DATABASE_URL=file:/data/nextlevel.db \
    FILES_DIR=/data/files \
    ADMIN_DIST=/app/admin-dist
COPY --from=deps /app/node_modules node_modules
COPY package.json ./
COPY packages/shared packages/shared
COPY packages/system-catalog packages/system-catalog
COPY apps/api apps/api
COPY --from=admin /app/apps/admin/dist admin-dist
RUN mkdir -p /data && chown node:node /data
USER node
VOLUME ["/data"]
EXPOSE 4000
CMD ["node", "apps/api/src/server.ts"]
