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
read -rp "Install lattice-capture? [y/N] " _ans </dev/tty
if [[ "$_ans" =~ ^[Yy]$ ]]; then
  CAPTURE_BINARY_ASSET="lattice-capture-${TARGET}"
  cap_url=$(release_url "$CAPTURE_BINARY_ASSET")
  [[ -z "$cap_url" ]] && die "'${CAPTURE_BINARY_ASSET}' asset not found in the latest release"

  info "Downloading ${CAPTURE_BINARY_ASSET}…"
  curl -fSL --progress-bar "$cap_url" -o "${INSTALL_DIR}/lattice-capture"
  chmod +x "${INSTALL_DIR}/lattice-capture"
  info "lattice-capture installed to ${INSTALL_DIR}/lattice-capture"

  # notify-send is used for capture feedback; a dmenu is only needed when the
  # tray's "Capture…" menu item is invoked (hotkeys pass text directly).
  check_deps notify-send
fi

# ── lattice-tray (optional) ───────────────────────────────────────────────────

echo ""
read -rp "Install lattice-tray (system tray icon)? [y/N] " _ans </dev/tty
if [[ "$_ans" =~ ^[Yy]$ ]]; then
  TRAY_BINARY_ASSET="lattice-tray-${TARGET}"
  tray_url=$(release_url "$TRAY_BINARY_ASSET")
  [[ -z "$tray_url" ]] && die "'${TRAY_BINARY_ASSET}' asset not found in the latest release"

  info "Downloading ${TRAY_BINARY_ASSET}…"
  curl -fSL --progress-bar "$tray_url" -o "${INSTALL_DIR}/lattice-tray"
  chmod +x "${INSTALL_DIR}/lattice-tray"
  info "lattice-tray installed to ${INSTALL_DIR}/lattice-tray"

  # lattice-config is a GTK4 GUI tool; it ships as a dynamically linked linux-gnu
  # binary (GTK4 can't be MUSL statically linked), so the asset name differs.
  case "$(uname -m)" in
    x86_64)  CONFIG_BINARY_ASSET="lattice-config-x86_64-unknown-linux-gnu" ;;
    *)       CONFIG_BINARY_ASSET="" ;;
  esac
  if [[ -n "$CONFIG_BINARY_ASSET" ]]; then
    config_url=$(release_url "$CONFIG_BINARY_ASSET")
    if [[ -n "$config_url" ]]; then
      info "Downloading ${CONFIG_BINARY_ASSET}…"
      curl -fSL --progress-bar "$config_url" -o "${INSTALL_DIR}/lattice-config"
      chmod +x "${INSTALL_DIR}/lattice-config"
      info "lattice-config installed to ${INSTALL_DIR}/lattice-config"
    else
      warn "'${CONFIG_BINARY_ASSET}' not found in release — skipping lattice-config"
    fi
  else
    warn "lattice-config is only available for x86_64 — skipping (build from source to install)"
  fi

  TRAY_SVC_FILE="${SERVICE_DIR}/lattice-tray.service"
  tray_svc_url=$(release_url "lattice-tray.service")
  [[ -z "$tray_svc_url" ]] && die "'lattice-tray.service' asset not found in the latest release"

  mkdir -p "$SERVICE_DIR"
  curl -fSL --progress-bar "$tray_svc_url" -o "$TRAY_SVC_FILE"
  info "Tray service unit installed to ${TRAY_SVC_FILE}"

  systemctl --user daemon-reload
  systemctl --user enable --now lattice-tray
  info "lattice-tray service enabled and started."
  info "NOTE: waybar's tray module must be enabled for the icon to appear."
fi

# ── Config ────────────────────────────────────────────────────────────────────

echo ""
if [[ -f "$CONFIG_FILE" ]]; then
  info "Config already exists at ${CONFIG_FILE} — skipping config setup."
else
  mkdir -p "$CONFIG_DIR"

  echo "Spine configuration"
  read -rp "  Spine URL [https://lattice.rghsoftware.com]: " _spine_url </dev/tty
  _spine_url="${_spine_url:-https://lattice.rghsoftware.com}"

  read -rsp "  Agent token: " _agent_token </dev/tty
  echo ""
  [[ -z "$_agent_token" ]] && die "agent token cannot be empty"

  # Collect watch directories; loop until user submits an empty line.
  watch_sections=""
  echo ""
  echo "Watch directories (press Enter on an empty line when done):"
  while true; do
    read -rp "  Directory path: " _dir </dev/tty
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
echo "  Tray:    systemctl --user status lattice-tray"
echo "  Updates: lattice-agent update check"
echo "           lattice-agent update apply --all-supported"
echo "           lattice-agent update history"
