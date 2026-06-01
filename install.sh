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
UNINSTALL=false
PURGE_CONFIG=false

while [[ $# -gt 0 ]]; do
  case "$1" in
    --uninstall)
      UNINSTALL=true
      ;;
    --purge-config)
      PURGE_CONFIG=true
      ;;
    *)
      echo "error: unknown option: $1" >&2
      exit 1
      ;;
  esac
  shift
done

if [[ "$PURGE_CONFIG" == true && "$UNINSTALL" != true ]]; then
  echo "error: --purge-config requires --uninstall" >&2
  exit 1
fi

# ── Helpers ───────────────────────────────────────────────────────────────────

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
warn() { echo "warning: $*" >&2; }

removed_items=()
preserved_items=()
skipped_items=()
failed_items=()
next_actions=()

record_removed() { removed_items+=("$1"); }
record_preserved() { preserved_items+=("$1"); }
record_skipped() { skipped_items+=("$1"); }
record_failed() {
  failed_items+=("$1")
  next_actions+=("$2")
}

print_uninstall_section() {
  local title="$1"
  shift
  echo "${title}:"
  if [[ $# -eq 0 ]]; then
    echo "  None"
    return
  fi
  local item
  for item in "$@"; do
    echo "  - ${item}"
  done
}

print_uninstall_summary() {
  echo ""
  echo "Uninstall summary"
  echo "-----------------"
  print_uninstall_section "Removed" "${removed_items[@]}"
  print_uninstall_section "Preserved" "${preserved_items[@]}"
  print_uninstall_section "Skipped" "${skipped_items[@]}"
  print_uninstall_section "Failed" "${failed_items[@]}"
  print_uninstall_section "Next actions" "${next_actions[@]}"
}

remove_path() {
  local name="$1"
  local path="$2"
  local next_action="$3"
  local output

  if [[ ! -e "$path" && ! -L "$path" ]]; then
    record_skipped "${name}: already absent at ${path}"
    return
  fi

  if output=$(rm -rf "$path" 2>&1); then
    record_removed "${name}: ${path}"
  else
    record_failed "${name}: could not remove ${path}: ${output}" "$next_action"
  fi
}

systemctl_missing_unit_output() {
  local output="$1"
  [[ "$output" == *"not loaded"* || "$output" == *"not found"* || "$output" == *"could not be found"* ]]
}

systemctl_not_enabled_output() {
  local output="$1"
  [[ "$output" == *"No such file or directory"* || "$output" == *"not loaded"* || "$output" == *"not found"* || "$output" == *"does not exist"* ]]
}

remove_user_service() {
  local service="$1"
  local service_file="$2"

  if [[ ! -e "$service_file" && ! -L "$service_file" ]]; then
    record_skipped "${service}: service unit already absent at ${service_file}"
    return
  fi

  if command -v systemctl &>/dev/null; then
    local output
    if ! output=$(systemctl --user stop "$service" 2>&1); then
      if ! systemctl_missing_unit_output "$output"; then
        record_failed "${service}: could not stop user service: ${output}" "Close running ${service} processes or run systemctl --user stop ${service} manually."
      fi
    fi
    if ! output=$(systemctl --user disable "$service" 2>&1); then
      if ! systemctl_not_enabled_output "$output"; then
        record_failed "${service}: could not disable user service: ${output}" "Run systemctl --user disable ${service} manually, then rerun uninstall."
      fi
    fi
  fi

  remove_path "${service} service unit" "$service_file" "Run systemctl --user disable ${service}, then remove ${service_file} manually."
}

run_uninstall() {
  info "Uninstalling Lattice local user installation"

  remove_user_service "lattice-agent" "$SERVICE_FILE"
  remove_user_service "lattice-tray" "${SERVICE_DIR}/lattice-tray.service"

  remove_path "lattice-agent binary" "${INSTALL_DIR}/lattice-agent" "Close running lattice-agent processes and remove ${INSTALL_DIR}/lattice-agent manually."
  remove_path "lattice-capture binary" "${INSTALL_DIR}/lattice-capture" "Close running lattice-capture processes and remove ${INSTALL_DIR}/lattice-capture manually."
  remove_path "lattice-tray binary" "${INSTALL_DIR}/lattice-tray" "Close running lattice-tray processes and remove ${INSTALL_DIR}/lattice-tray manually."
  remove_path "lattice-config binary" "${INSTALL_DIR}/lattice-config" "Close running lattice-config processes and remove ${INSTALL_DIR}/lattice-config manually."

  if [[ "$PURGE_CONFIG" == true ]]; then
    remove_path "Lattice configuration" "$CONFIG_DIR" "Check permissions or remove ${CONFIG_DIR} manually."
  elif [[ -e "$CONFIG_DIR" || -L "$CONFIG_DIR" ]]; then
    record_preserved "Lattice configuration: ${CONFIG_DIR}"
    next_actions+=("To remove preserved configuration, rerun with --uninstall --purge-config.")
  else
    record_skipped "Lattice configuration: already absent at ${CONFIG_DIR}"
  fi

  if command -v systemctl &>/dev/null; then
    systemctl --user daemon-reload >/dev/null 2>&1 || true
  fi

  print_uninstall_summary
  [[ ${#failed_items[@]} -eq 0 ]]
}

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

if [[ "$UNINSTALL" == true ]]; then
  run_uninstall
  exit $?
fi

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
