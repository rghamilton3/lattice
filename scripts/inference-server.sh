#!/usr/bin/env bash
# inference-server.sh — run a local stand-in for Lattice's remote inference endpoint.
#
# Starts three llama-server processes that serve the OpenAI-compatible API QMD talks to:
#
#   embed   bge-m3              :8081/v1   (--embeddings)
#   rerank  bge-reranker-v2-m3  :8082/v1   (--reranking)
#   expand  qwen2.5-3b-instruct :8083/v1   (chat completions for query expansion)
#
# Point spine at it by adding the block printed at the end to ~/.config/lattice/config.toml
# (or run with --print-config to see it without starting anything).
#
# Ctrl+C stops all three. Killing the endpoint this way is the intended way to exercise
# Lattice's keyword-only degradation (see specs/016-remote-inference).
set -euo pipefail

# Directory holding the .gguf weights. Override with LATTICE_MODELS_DIR.
MODELS_DIR="${LATTICE_MODELS_DIR:-${HOME}/.cache/lattice/models}"
# Bind address for the servers. localhost keeps them off the network by default.
HOST="${LATTICE_INFERENCE_HOST:-127.0.0.1}"
# Extra args forwarded verbatim to every llama-server (e.g. "--n-gpu-layers 99").
read -r -a EXTRA_ARGS <<<"${LLAMA_SERVER_EXTRA_ARGS:-}"

# name | model file | port | mode-specific flags
SERVERS=(
	"embed|bge-m3.gguf|8081|--embeddings"
	"rerank|bge-reranker-v2-m3.gguf|8082|--reranking"
	"expand|qwen2.5-3b-instruct.gguf|8083|"
)

print_config() {
	cat <<EOF
[spine.qmd]
embed_api_url    = "http://${HOST}:8081/v1"
embed_api_model  = "bge-m3"
rerank_api_url   = "http://${HOST}:8082/v1"
rerank_api_model = "bge-reranker-v2-m3"
expand_api_url   = "http://${HOST}:8083/v1"
expand_api_model = "qwen2.5-3b-instruct"
EOF
}

if [[ "${1:-}" == "--print-config" ]]; then
	print_config
	exit 0
fi

if ! command -v llama-server >/dev/null 2>&1; then
	echo "error: 'llama-server' not found on PATH (install llama.cpp)" >&2
	exit 1
fi

# Validate every model file up front so we fail before starting a partial set.
missing=0
for entry in "${SERVERS[@]}"; do
	IFS='|' read -r name file _ _ <<<"$entry"
	if [[ ! -f "${MODELS_DIR}/${file}" ]]; then
		echo "error: missing ${name} model: ${MODELS_DIR}/${file}" >&2
		missing=1
	fi
done
if [[ "$missing" -ne 0 ]]; then
	echo "Set LATTICE_MODELS_DIR to the directory holding the .gguf files (current: ${MODELS_DIR})." >&2
	exit 1
fi

PIDS=()
cleanup() {
	echo ""
	echo "Stopping inference servers..."
	for pid in "${PIDS[@]}"; do
		kill "$pid" 2>/dev/null || true
	done
	wait 2>/dev/null || true
}
trap cleanup EXIT INT TERM

for entry in "${SERVERS[@]}"; do
	IFS='|' read -r name file port flags <<<"$entry"
	# shellcheck disable=SC2206 — intentional word-splitting of the per-server flags.
	flag_args=($flags)
	echo "Starting ${name} (${file}) on http://${HOST}:${port}/v1"
	llama-server \
		-m "${MODELS_DIR}/${file}" \
		--host "${HOST}" \
		--port "${port}" \
		"${flag_args[@]}" \
		"${EXTRA_ARGS[@]}" &
	PIDS+=("$!")
done

# Wait for each /health to report ready so the config is usable when this returns.
echo "Waiting for servers to become ready..."
for entry in "${SERVERS[@]}"; do
	IFS='|' read -r name _ port _ <<<"$entry"
	for _ in $(seq 1 60); do
		if curl -sf "http://${HOST}:${port}/health" >/dev/null 2>&1; then
			echo "  ${name} ready (:${port})"
			break
		fi
		sleep 1
	done
done

echo ""
echo "Inference servers up. Add this to ~/.config/lattice/config.toml:"
echo ""
print_config
echo ""
echo "Press Ctrl+C to stop all three."

# Block until any child exits (then the trap tears the rest down).
wait -n 2>/dev/null || wait
