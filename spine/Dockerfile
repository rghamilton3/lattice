# ── Stage 1: build surface SPA ───────────────────────────────────────────────
FROM oven/bun:1 AS surface-build
WORKDIR /surface
COPY surface/package.json surface/bun.lock ./
RUN bun install --frozen-lockfile
COPY surface/ .
RUN bun run build

# ── Stage 2: install spine production deps ────────────────────────────────────
FROM oven/bun:1 AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY spine/package.json spine/bun.lock ./
RUN bun install --frozen-lockfile --production

# ── Stage 3: runtime ──────────────────────────────────────────────────────────
FROM oven/bun:1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY spine/src ./src
COPY spine/migrations ./migrations
COPY spine/package.json ./
COPY --from=surface-build /surface/build ./public

ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/lattice.db
ENV XDG_CACHE_HOME=/data/.cache
ENV SURFACE_BUILD=/app/public

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ping || exit 1

CMD ["bun", "run", "src/index.ts"]
