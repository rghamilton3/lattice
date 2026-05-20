FROM oven/bun:1

WORKDIR /app

COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

COPY src ./src
COPY migrations ./migrations

ENV HOST=0.0.0.0
ENV DATABASE_PATH=/data/lattice.db
ENV XDG_CACHE_HOME=/data/.cache

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -qO- http://localhost:3000/ping || exit 1

CMD ["bun", "run", "src/index.ts"]
