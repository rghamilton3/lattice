# Custom llama-swap image for Lattice's GPU inference host.
#
# Built and pushed to GHCR by .github/workflows/llama-swap-docker.yml (mirrors
# spine-docker.yml). spacelab pulls it by ref — no repo clone, no host build.
#
# Extends the pinned llama-swap CUDA base (which bundles llama-server at
# /app/llama-server for the GGUF models) with the asr-shim: ffmpeg + a NeMo
# Parakeet venv at /opt/asr-shim/.venv, serving /v1/audio/transcriptions behind
# the same /v1 front door. The config and GGUF models are EXTERNAL: the config is
# bind-mounted to /app/config.yaml at runtime (fetched from the tagged release or
# raw.githubusercontent), and the models come from a /models volume.
#
# Build context is the REPO ROOT (like spine/Dockerfile), so COPY paths are
# repo-relative:
#   docker build -t lattice-llama-swap:local -f asr-shim/Dockerfile .
#
# NOTE: heavy build — pulls torch-CUDA + NeMo (multi-GB). Expect several minutes.

ARG LLAMA_SWAP_IMAGE=ghcr.io/mostlygeek/llama-swap:v224-cuda-b9603
FROM ${LLAMA_SWAP_IMAGE}

# ffmpeg: the shim normalizes any Signal audio to mono 16 kHz WAV before NeMo.
# curl/ca-certificates: bootstrap uv and let huggingface_hub fetch the checkpoint.
RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg ca-certificates curl \
    && rm -rf /var/lib/apt/lists/*

# uv provisions its own Python 3.12 and builds the venv reproducibly, so we do
# not depend on the base image's Python version.
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /usr/local/bin/

# Build the shim venv with the real NeMo backend at /opt/asr-shim/.venv.
# Not --frozen: the lockfile is resolved without the (CI-excluded) nemo extra,
# so let uv resolve nemo at build time.
ENV UV_PYTHON_INSTALL_DIR=/opt/uv-python \
    UV_PROJECT_ENVIRONMENT=/opt/asr-shim/.venv
COPY asr-shim/ /opt/asr-shim/
RUN cd /opt/asr-shim \
    && uv sync --extra nemo \
    && /opt/asr-shim/.venv/bin/python -c "import asr_shim.main"

# Bake only the model-fetch helper onto PATH (a generic downloader, not config).
# The config stays EXTERNAL and is bind-mounted to /app/config.yaml at runtime.
# Populate the models volume with:
#   docker run --rm -v <vol>:/models <image> fetch-models.sh
COPY scripts/fetch-models.sh /usr/local/bin/fetch-models.sh
RUN chmod +x /usr/local/bin/fetch-models.sh

# Restore the base image's working directory so llama-swap starts as it expects
# (it reads /app/config.yaml). The shim is launched by absolute path and imported
# from its venv, so its own cwd does not matter.
WORKDIR /app
