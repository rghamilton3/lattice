FROM oven/bun:1 AS deps
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY src ./src
COPY migrations ./migrations
COPY package.json ./

ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/lattice.db
ENV XDG_CACHE_HOME=/data/.cache

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ping || exit 1

CMD ["bun", "run", "src/index.ts"]
