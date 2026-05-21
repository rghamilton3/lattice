#!/usr/bin/env bash
# install.sh — Install lattice-agent and optionally lattice-capture.
#
# Downloads the latest release from GitHub, writes ~/.config/lattice/config.toml
# if one does not already exist, installs the systemd user service, and starts it.
set -euo pipefail

REPO="rghamilton3/lattice"
INSTALL_DIR="${HOME}/.local/bin"
CONFIG_DIR="${XDG_CONFIG_HOME:-${HOME}/.config}/lattice"
CONFIG_FILE="${CONFIG_DIR}/config.toml"
SERVICE_DIR="${HOME}/.config/systemd/user"
SERVICE_FILE="${SERVICE_DIR}/lattice-agent.service"
DEFAULT_PATTERNS='["**/*.md", "**/*.txt", "**/*.pdf"]'

# ── Helpers ───────────────────────────────────────────────────────────────────

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
warn() { echo "warning: $*" >&2; }

# Escape a value for a TOML basic double-quoted string.
toml_escape() {
  local v="${1//\\/\\\\}"   # backslash first
  printf '%s' "${v//\"/\\\"}"
}

# Return the browser_download_url for a named asset in the latest release.
release_url() {
  curl -fsSL "https://api.github.com/repos/${REPO}/releases/latest" \
    | jq -r --arg name "$1" \
        '.assets[] | select(.name == $name) | .browser_download_url'
}

detect_target() {
  case "$(uname -m)" in
    x86_64)  echo "x86_64-unknown-linux-musl" ;;
    aarch64) echo "aarch64-unknown-linux-musl" ;;
    *)       die "Unsupported architecture: $(uname -m)" ;;
  esac
}

detect_pkg_manager() {
  if   command -v pacman  &>/dev/null; then echo "pacman -S"
  elif command -v apt-get &>/dev/null; then echo "apt-get install"
  elif command -v dnf     &>/dev/null; then echo "dnf install"
  else echo ""
  fi
}

# Warn about any missing commands; print the install hint if possible.
check_deps() {
  local missing=() dep
  for dep in "$@"; do
    command -v "$dep" &>/dev/null || missing+=("$dep")
  done
  if [[ ${#missing[@]} -gt 0 ]]; then
    local pm; pm=$(detect_pkg_manager)
    warn "missing runtime dependencies: ${missing[*]}"
    [[ -n "$pm" ]] && warn "  install with: ${pm} ${missing[*]}"
  fi
}

# ── Preflight ─────────────────────────────────────────────────────────────────

for tool in curl jq; do
  command -v "$tool" &>/dev/null || die "installer requires ${tool}"
done

echo ""
echo "lattice-agent installer"
echo "-----------------------"

# ── Download agent binary ─────────────────────────────────────────────────────

TARGET=$(detect_target)
BINARY_ASSET="lattice-agent-${TARGET}"

info "Fetching latest release…"
url=$(release_url "$BINARY_ASSET")
[[ -z "$url" ]] && die "no asset '${BINARY_ASSET}' found in the latest release — has a tagged release been published?"

mkdir -p "$INSTALL_DIR"
info "Downloading ${BINARY_ASSET}…"
curl -fSL --progress-bar "$url" -o "${INSTALL_DIR}/lattice-agent"
chmod +x "${INSTALL_DIR}/lattice-agent"
info "lattice-agent installed to ${INSTALL_DIR}/lattice-agent"

# Warn if pdftotext is absent (agent logs a hard error per missing PDF otherwise).
check_deps pdftotext

# ── lattice-capture (optional) ────────────────────────────────────────────────

echo ""
read -rp "Install lattice-capture? [y/N] " _ans
if [[ "$_ans" =~ ^[Yy]$ ]]; then
  check_deps curl jq sqlite3 python3

  cap_url=$(release_url "lattice-capture")
  [[ -z "$cap_url" ]] && die "'lattice-capture' asset not found in the latest release"

  info "Downloading lattice-capture…"
  curl -fSL --progress-bar "$cap_url" -o "${INSTALL_DIR}/lattice-capture"
  chmod +x "${INSTALL_DIR}/lattice-capture"
  info "lattice-capture installed to ${INSTALL_DIR}/lattice-capture"
fi

# ── Config ────────────────────────────────────────────────────────────────────

echo ""
if [[ -f "$CONFIG_FILE" ]]; then
  info "Config already exists at ${CONFIG_FILE} — skipping config setup."
else
  mkdir -p "$CONFIG_DIR"

  echo "Spine configuration"
  read -rp "  Spine URL [https://lattice.rghsoftware.com]: " _spine_url
  _spine_url="${_spine_url:-https://lattice.rghsoftware.com}"

  read -rsp "  Agent token: " _agent_token
  echo ""
  [[ -z "$_agent_token" ]] && die "agent token cannot be empty"

  # Collect watch directories; loop until user submits an empty line.
  watch_sections=""
  echo ""
  echo "Watch directories (press Enter on an empty line when done):"
  while true; do
    read -rp "  Directory path: " _dir
    [[ -z "$_dir" ]] && break
    _dir="${_dir/#\~/${HOME}}"   # expand leading tilde
    watch_sections+="[[agent.watch]]"$'\n'
    watch_sections+="path     = \"$(toml_escape "$_dir")\""$'\n'
    watch_sections+="patterns = ${DEFAULT_PATTERNS}"$'\n\n'
  done

  [[ -z "$watch_sections" ]] && warn "no watch directories configured — agent will start but not index anything"

  {
    printf '[spine]\n'
    printf 'url         = "%s"\n' "$(toml_escape "$_spine_url")"
    printf 'agent_token = "%s"\n' "$(toml_escape "$_agent_token")"
    printf '\n[agent]\n\n'
    printf '%s' "$watch_sections"
  } > "$CONFIG_FILE"

  info "Config written to ${CONFIG_FILE}"
fi

# ── Systemd user service ──────────────────────────────────────────────────────

echo ""
svc_url=$(release_url "lattice-agent.service")
[[ -z "$svc_url" ]] && die "'lattice-agent.service' asset not found in the latest release"

mkdir -p "$SERVICE_DIR"
curl -fSL --progress-bar "$svc_url" -o "$SERVICE_FILE"
info "Service unit installed to ${SERVICE_FILE}"

# Enable lingering so the user service survives logout.
# This may require polkit authorization on some distros; failure is non-fatal.
if ! loginctl enable-linger "$USER" 2>/dev/null; then
  warn "could not enable user lingering — service will stop on logout"
  warn "  to fix: sudo loginctl enable-linger ${USER}"
fi

systemctl --user daemon-reload
systemctl --user enable --now lattice-agent
info "Service enabled and started."

# Warn if ~/.local/bin is not on PATH.
if [[ ":${PATH}:" != *":${INSTALL_DIR}:"* ]]; then
  warn "${INSTALL_DIR} is not in \$PATH — add it to your shell profile:"
  warn "  export PATH=\"\${HOME}/.local/bin:\${PATH}\""
fi

echo ""
echo "Installation complete."
echo "  Status:  systemctl --user status lattice-agent"
echo "  Logs:    journalctl --user -u lattice-agent -f"
echo "  Config:  ${CONFIG_FILE}"
