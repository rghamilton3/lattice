#!/usr/bin/env bash
# fetch-models.sh — download the GGUF weights for Lattice's llama-swap config.
#
# Pulls the five GGUF files (four model checkpoints + one mmproj projector) referenced by scripts/llama-swap.config.yaml into
# the llama-swap models dir, renamed to the exact filenames that config's `-m` /
# `--mmproj` paths expect. Run this on the inference host (or anywhere, then rsync
# the dir up).
#
#   MODELS_DIR=/opt/llama-swap/models ./scripts/fetch-models.sh
#
# Default MODELS_DIR is /opt/llama-swap/models (the spacelab/ai llama_swap_models_dir,
# bind-mounted to /models in the container). Override for a different host/layout.
#
# NOT fetched here: Parakeet ASR. The asr-shim loads nvidia/parakeet-tdt-0.6b-v3
# via NeMo, which downloads the .nemo from HuggingFace into its own cache on first
# request — it is not staged in the models dir. See asr-shim/README.md.
#
# All five repos are public; no HF token needed. Downloads resume (-C -) and are
# validated to start with the GGUF magic so a captive-portal/HTML error page is
# caught instead of silently saved as a "model".
set -euo pipefail

MODELS_DIR="${MODELS_DIR:-/opt/llama-swap/models}"
HF_BASE="${HF_ENDPOINT:-https://huggingface.co}"

# dest filename | repo | source filename
#   dest must match the -m / --mmproj paths in llama-swap.config.yaml.
#   Embeddings/rerank use Q8_0 (near-lossless, precision matters for retrieval);
#   the generative models use Q4_K_M (good speed/quality on a single GPU).
MODELS=(
	"bge-m3.gguf|gpustack/bge-m3-GGUF|bge-m3-Q8_0.gguf"
	"bge-reranker-v2-m3.gguf|gpustack/bge-reranker-v2-m3-GGUF|bge-reranker-v2-m3-Q8_0.gguf"
	"qwen2.5-3b-instruct-q4_k_m.gguf|Qwen/Qwen2.5-3B-Instruct-GGUF|qwen2.5-3b-instruct-q4_k_m.gguf"
	"qwen2.5-vl-7b-instruct-q4_k_m.gguf|ggml-org/Qwen2.5-VL-7B-Instruct-GGUF|Qwen2.5-VL-7B-Instruct-Q4_K_M.gguf"
	"qwen2.5-vl-7b-instruct-mmproj-f16.gguf|ggml-org/Qwen2.5-VL-7B-Instruct-GGUF|mmproj-Qwen2.5-VL-7B-Instruct-f16.gguf"
)

if ! command -v aria2c >/dev/null 2>&1 && ! command -v curl >/dev/null 2>&1; then
	echo "error: aria2c or curl is required" >&2
	exit 1
fi

download_file() {
	local url=$1 out=$2
	if command -v aria2c >/dev/null 2>&1; then
		aria2c -x 16 -s 16 -k 1M --retry-wait=2 --max-tries=3 \
			--continue=true \
			-d "$(dirname "$out")" -o "$(basename "$out")" "$url"
	else
		curl -L --fail --retry 3 --retry-delay 2 -C - -o "$out" "$url"
	fi
}

mkdir -p "$MODELS_DIR"
_dl=$(command -v aria2c >/dev/null 2>&1 && echo "aria2c (16 connections)" || echo "curl")
echo "Fetching ${#MODELS[@]} GGUF files into ${MODELS_DIR}"
echo "Downloader: ${_dl}"
echo "Endpoint: ${HF_BASE}  (override with HF_ENDPOINT, e.g. a mirror)"
echo

is_gguf() {
	# GGUF files start with the ASCII magic "GGUF". Reject anything else
	# (e.g. an HTML error page from a proxy) so we fail loud, not silent.
	[[ "$(head -c 4 "$1" 2>/dev/null)" == "GGUF" ]]
}

for entry in "${MODELS[@]}"; do
	IFS='|' read -r dest repo src <<<"$entry"
	out="${MODELS_DIR}/${dest}"
	url="${HF_BASE}/${repo}/resolve/main/${src}"

	if [[ -f "$out" ]] && is_gguf "$out"; then
		echo "✓ ${dest} (already present)"
		continue
	fi

	echo "↓ ${dest}"
	echo "    from ${repo} :: ${src}"
	download_file "$url" "$out"

	if ! is_gguf "$out"; then
		echo "error: ${out} is not a GGUF file (got an HTML/error page?)." >&2
		echo "       Removed it; re-run, or try a mirror: HF_ENDPOINT=https://hf-mirror.com $0" >&2
		rm -f "$out"
		exit 1
	fi
	echo "  ✓ $(du -h "$out" | cut -f1)  ${dest}"
done

echo
echo "Done. Models in ${MODELS_DIR}:"
ls -lh "$MODELS_DIR"/*.gguf 2>/dev/null | awk '{printf "  %-6s %s\n", $5, $NF}'
echo
echo "These match the -m / --mmproj paths in scripts/llama-swap.config.yaml."
echo "Parakeet ASR weights are NOT here: the asr-shim pulls the .nemo at runtime."
