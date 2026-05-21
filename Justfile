default:
    @just --list

# Run spine + surface dev servers together (Ctrl+C stops both)
dev:
    #!/bin/bash
    (cd spine && ALLOW_HTTP=true DEV_USER=dev bun run dev) &
    (cd surface && bun run dev) &
    wait

# Run spine dev server only
spine:
    cd spine && ALLOW_HTTP=true DEV_USER=dev bun run dev

# Run surface dev server only
surface:
    cd surface && bun run dev

# Build the surface (output: surface/build/, served by spine in prod)
surface-build:
    cd surface && bun run build

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

# Build spine Docker image locally (includes surface)
docker-build:
    docker build -f spine/Dockerfile -t lattice-spine:local .

# Bring up spine via docker compose (from spine/)
up:
    cd spine && docker compose up -d

down:
    cd spine && docker compose down
