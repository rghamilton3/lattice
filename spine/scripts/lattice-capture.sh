#!/usr/bin/env bash
# lattice-capture — POST text to the Lattice spine capture endpoint.
# Falls back to a local SQLite queue when spine is unreachable, and drains
# that queue at the start of each successful run.
#
# Usage:
#   lattice-capture "some thought"
#   echo "some thought" | lattice-capture
#
# Config: ~/.config/lattice/config.toml (shared with lattice-agent)
#   [spine]
#   url         = "https://lattice.rghsoftware.com"
#   agent_token = "..."
set -euo pipefail

CONFIG_TOML="${XDG_CONFIG_HOME:-$HOME/.config}/lattice/config.toml"

# Read a value from the TOML config: toml_get <section> <key>
toml_get() {
  python3 - "$CONFIG_TOML" "$1" "$2" <<'EOF'
import sys
try:
    import tomllib
except ImportError:
    sys.exit(0)
with open(sys.argv[1], "rb") as f:
    cfg = tomllib.load(f)
print(cfg.get(sys.argv[2], {}).get(sys.argv[3], ""), end="")
EOF
}

QUEUE_DB="${XDG_DATA_HOME:-$HOME/.local/share}/lattice/queue.db"
SPINE_URL="${SPINE_URL:-$(toml_get spine url)}"
SPINE_URL="${SPINE_URL:-http://localhost:3000}"
SOURCE="${SOURCE:-desktop-hotkey}"
TOKEN="${LATTICE_AGENT_TOKEN:-$(toml_get spine agent_token)}"

notify() {
  notify-send "Lattice" "$1" --urgency="${2:-low}" 2>/dev/null || true
}

if [[ -z "$TOKEN" ]]; then
  notify "agent_token not set in $CONFIG_TOML" critical
  echo "Error: spine.agent_token not set in $CONFIG_TOML" >&2
  exit 1
fi

if [[ $# -gt 0 ]]; then
  TEXT="$*"
else
  TEXT="$(cat)"
fi

[[ -z "$TEXT" ]] && exit 0

CAPTURED_AT="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

# Ensure queue DB exists
mkdir -p "$(dirname "$QUEUE_DB")"
sqlite3 "$QUEUE_DB" \
  "CREATE TABLE IF NOT EXISTS queue (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     text        TEXT    NOT NULL,
     source      TEXT    NOT NULL,
     captured_at TEXT    NOT NULL,
     queued_at   TEXT    NOT NULL
   );"

# Double single-quotes for safe SQLite string literals
sql_escape() { printf '%s' "${1//\'/\'\'}"; }

post_to_spine() {
  local payload
  payload=$(jq -n \
    --arg text "$1" \
    --arg source "$2" \
    --arg captured_at "$3" \
    '{text: $text, source: $source, captured_at: $captured_at}')
  curl -sf --max-time 5 \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "$payload" \
    "$SPINE_URL/api/agent/capture"
}

flush_queue() {
  local rows flushed=0
  rows=$(sqlite3 -json "$QUEUE_DB" \
    "SELECT id, text, source, captured_at FROM queue ORDER BY id;" \
    2>/dev/null | jq -c '.[]?' 2>/dev/null) || return 0
  [[ -z "$rows" ]] && return 0

  while IFS= read -r row; do
    local id text source captured_at
    id=$(jq -r '.id' <<< "$row")
    text=$(jq -r '.text' <<< "$row")
    source=$(jq -r '.source' <<< "$row")
    captured_at=$(jq -r '.captured_at' <<< "$row")
    post_to_spine "$text" "$source" "$captured_at" > /dev/null || break
    sqlite3 "$QUEUE_DB" "DELETE FROM queue WHERE id = $id;"
    flushed=$((flushed + 1))
  done <<< "$rows"

  if [[ $flushed -gt 0 ]]; then notify "Flushed $flushed queued capture(s)"; fi
}

# Drain any pending offline captures before sending the new one
flush_queue

if RESPONSE=$(post_to_spine "$TEXT" "$SOURCE" "$CAPTURED_AT"); then
  ID=$(jq -r '.id' <<< "$RESPONSE")
  notify "Captured #$ID"
else
  sqlite3 "$QUEUE_DB" \
    "INSERT INTO queue (text, source, captured_at, queued_at) VALUES (
       '$(sql_escape "$TEXT")',
       '$(sql_escape "$SOURCE")',
       '$(sql_escape "$CAPTURED_AT")',
       '$(date -u +%Y-%m-%dT%H:%M:%SZ)'
     );"
  notify "Spine unreachable — capture queued" normal
fi
