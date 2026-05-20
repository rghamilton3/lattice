default:
    @just --list

# Run spine dev server with hot reload
dev:
    cd spine && bun run dev

# Run spine in non-watch mode
spine-start:
    cd spine && bun run start

# Run the Signal -> spine relay
relay:
    cd spine && bun run relay

# Run all tests
test:
    cd spine && bun test

# Run a single spine test file
test-file FILE:
    cd spine && bun test {{FILE}}

# Install all dependencies
install:
    cd spine && bun install

# Build spine Docker image locally
docker-build:
    docker build -f spine/Dockerfile -t lattice-spine:local spine/

# Bring up spine via docker compose (from spine/)
up:
    cd spine && docker compose up -d

down:
    cd spine && docker compose down
