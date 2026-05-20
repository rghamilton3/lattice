#!/usr/bin/env bash
# lattice-capture — POST text to the Lattice spine capture endpoint.
#
# Usage:
#   lattice-capture "some thought"
#   echo "some thought" | lattice-capture
#
# Environment:
#   LATTICE_AGENT_TOKEN  — bearer token; falls back to ~/.config/lattice/token
#   SPINE_URL            — spine base URL (default: http://localhost:3000)
#   SOURCE               — capture source tag (default: desktop-hotkey)
set -euo pipefail

SPINE_URL="${SPINE_URL:-http://localhost:3000}"
SOURCE="${SOURCE:-desktop-hotkey}"
TOKEN="${LATTICE_AGENT_TOKEN:-$(cat "$HOME/.config/lattice/token" 2>/dev/null)}"

notify() {
  notify-send "Lattice" "$1" --urgency="${2:-low}" 2>/dev/null || true
}

if [[ -z "$TOKEN" ]]; then
  notify "LATTICE_AGENT_TOKEN not set" critical
  echo "Error: LATTICE_AGENT_TOKEN not set" >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  TEXT="$*"
else
  TEXT="$(cat)"
fi

[[ -z "$TEXT" ]] && exit 0

CAPTURED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

PAYLOAD=$(
  jq -n \
    --arg text "$TEXT" \
    --arg source "$SOURCE" \
    --arg captured_at "$CAPTURED_AT" \
    '{text: $text, source: $source, captured_at: $captured_at}'
)

RESPONSE=$(
  curl -sf \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$PAYLOAD" \
    "$SPINE_URL/api/agent/capture"
) || {
  notify "Capture failed — is spine running?" normal
  exit 1
}

ID=$(echo "$RESPONSE" | jq -r '.id')
notify "Captured #$ID"
