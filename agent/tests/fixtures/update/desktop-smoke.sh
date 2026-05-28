#!/usr/bin/env bash
set -euo pipefail

command -v lattice-capture >/dev/null || { echo "lattice-capture is not installed" >&2; exit 1; }
command -v lattice-tray >/dev/null || { echo "lattice-tray is not installed" >&2; exit 1; }
command -v lattice-config >/dev/null || { echo "lattice-config is not installed" >&2; exit 1; }

timeout 30s lattice-capture "post-update smoke" || {
  echo "lattice-capture did not complete within 30 seconds" >&2
  exit 1
}

echo "Desktop companion smoke check passed. Quick capture completed and companion binaries are on PATH."
