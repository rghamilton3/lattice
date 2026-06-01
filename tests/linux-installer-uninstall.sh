#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)

fail() {
  echo "linux-installer-uninstall.sh: FAIL: $*" >&2
  exit 1
}

assert_contains() {
  local haystack="$1"
  local needle="$2"
  [[ "$haystack" == *"$needle"* ]] || fail "missing expected output: $needle"
}

assert_missing() {
  local path="$1"
  [[ ! -e "$path" && ! -L "$path" ]] || fail "expected path to be removed: $path"
}

assert_exists() {
  local path="$1"
  [[ -e "$path" || -L "$path" ]] || fail "expected path to exist: $path"
}

run_installer() {
  local temp_home="$1"
  local temp_config="$2"
  local temp_path="$3"
  shift 3

  HOME="$temp_home" XDG_CONFIG_HOME="$temp_config" PATH="$temp_path:$PATH" bash "$REPO_ROOT/install.sh" "$@"
}

make_tool_stub() {
  local dir="$1"
  local name="$2"
  local body="$3"
  {
    printf '#!/usr/bin/env bash\n'
    printf '%s\n' "$body"
  } > "${dir}/${name}"
  chmod +x "${dir}/${name}"
}

test_default_uninstall_removes_artifacts() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  local home_dir="${tmp}/home"
  local xdg_dir="${tmp}/xdg"
  local stub_dir="${tmp}/bin"
  mkdir -p "${home_dir}/.local/bin" "${home_dir}/.config/systemd/user" "${xdg_dir}/lattice" "$stub_dir"
  touch \
    "${home_dir}/.local/bin/lattice-agent" \
    "${home_dir}/.local/bin/lattice-capture" \
    "${home_dir}/.local/bin/lattice-tray" \
    "${home_dir}/.local/bin/lattice-config" \
    "${home_dir}/.config/systemd/user/lattice-agent.service" \
    "${home_dir}/.config/systemd/user/lattice-tray.service" \
    "${xdg_dir}/lattice/config.toml"
  make_tool_stub "$stub_dir" systemctl 'exit 0'
  make_tool_stub "$stub_dir" curl 'echo curl should not run >&2; exit 99'
  make_tool_stub "$stub_dir" jq 'echo jq should not run >&2; exit 99'

  local output
  output=$(run_installer "$home_dir" "$xdg_dir" "$stub_dir" --uninstall)

  assert_missing "${home_dir}/.local/bin/lattice-agent"
  assert_missing "${home_dir}/.local/bin/lattice-capture"
  assert_missing "${home_dir}/.local/bin/lattice-tray"
  assert_missing "${home_dir}/.local/bin/lattice-config"
  assert_missing "${home_dir}/.config/systemd/user/lattice-agent.service"
  assert_missing "${home_dir}/.config/systemd/user/lattice-tray.service"
  assert_exists "${xdg_dir}/lattice/config.toml"
  assert_contains "$output" "Removed:"
  assert_contains "$output" "Preserved:"
  assert_contains "$output" "Lattice configuration: ${xdg_dir}/lattice"
}

test_purge_config_removes_config() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  local home_dir="${tmp}/home"
  local xdg_dir="${tmp}/xdg"
  local stub_dir="${tmp}/bin"
  mkdir -p "${home_dir}/.local/bin" "${home_dir}/.config/systemd/user" "${xdg_dir}/lattice" "$stub_dir"
  touch "${xdg_dir}/lattice/config.toml"
  make_tool_stub "$stub_dir" systemctl 'exit 0'
  make_tool_stub "$stub_dir" curl 'echo curl should not run >&2; exit 99'
  make_tool_stub "$stub_dir" jq 'echo jq should not run >&2; exit 99'

  local output
  output=$(run_installer "$home_dir" "$xdg_dir" "$stub_dir" --uninstall --purge-config)

  assert_missing "${xdg_dir}/lattice"
  assert_contains "$output" "Removed:"
  assert_contains "$output" "Lattice configuration: ${xdg_dir}/lattice"
}

test_missing_artifacts_are_skipped() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  local home_dir="${tmp}/home"
  local xdg_dir="${tmp}/xdg"
  local stub_dir="${tmp}/bin"
  mkdir -p "$home_dir" "$xdg_dir" "$stub_dir"
  make_tool_stub "$stub_dir" systemctl 'exit 0'
  make_tool_stub "$stub_dir" curl 'echo curl should not run >&2; exit 99'
  make_tool_stub "$stub_dir" jq 'echo jq should not run >&2; exit 99'

  local output
  output=$(run_installer "$home_dir" "$xdg_dir" "$stub_dir" --uninstall)

  assert_contains "$output" "Skipped:"
  assert_contains "$output" "lattice-agent binary: already absent"
  assert_contains "$output" "Failed:"
  assert_contains "$output" "Next actions:"
}

test_service_stop_disable_failures_are_reported() {
  local tmp
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' RETURN

  local home_dir="${tmp}/home"
  local xdg_dir="${tmp}/xdg"
  local stub_dir="${tmp}/bin"
  mkdir -p "${home_dir}/.config/systemd/user" "$xdg_dir" "$stub_dir"
  touch "${home_dir}/.config/systemd/user/lattice-agent.service"
  make_tool_stub "$stub_dir" systemctl 'if [[ "$1 $2 $3" == "--user stop lattice-agent" || "$1 $2 $3" == "--user disable lattice-agent" ]]; then echo "Access denied" >&2; exit 1; fi; exit 0'
  make_tool_stub "$stub_dir" curl 'echo curl should not run >&2; exit 99'
  make_tool_stub "$stub_dir" jq 'echo jq should not run >&2; exit 99'

  local output
  if output=$(run_installer "$home_dir" "$xdg_dir" "$stub_dir" --uninstall 2>&1); then
    fail "expected uninstall to fail when service stop/disable fails"
  fi

  assert_contains "$output" "lattice-agent: could not stop user service: Access denied"
  assert_contains "$output" "lattice-agent: could not disable user service: Access denied"
  assert_contains "$output" "Next actions:"
}

test_remove_failures_include_platform_reason() {
  local tmp
  tmp=$(mktemp -d)
  trap 'chmod -R u+w "$tmp" 2>/dev/null || true; rm -rf "$tmp"' RETURN

  local home_dir="${tmp}/home"
  local xdg_dir="${tmp}/xdg"
  local stub_dir="${tmp}/bin"
  mkdir -p "${home_dir}/.local/bin" "$xdg_dir" "$stub_dir"
  touch "${home_dir}/.local/bin/lattice-agent"
  chmod u-w "${home_dir}/.local/bin"
  make_tool_stub "$stub_dir" systemctl 'exit 0'
  make_tool_stub "$stub_dir" curl 'echo curl should not run >&2; exit 99'
  make_tool_stub "$stub_dir" jq 'echo jq should not run >&2; exit 99'

  local output
  if output=$(run_installer "$home_dir" "$xdg_dir" "$stub_dir" --uninstall 2>&1); then
    fail "expected uninstall to fail when binary removal fails"
  fi

  chmod u+w "${home_dir}/.local/bin"
  assert_exists "${home_dir}/.local/bin/lattice-agent"
  assert_contains "$output" "lattice-agent binary: could not remove ${home_dir}/.local/bin/lattice-agent:"
  assert_contains "$output" "Permission denied"
}

test_default_uninstall_removes_artifacts
test_purge_config_removes_config
test_missing_artifacts_are_skipped
test_service_stop_disable_failures_are_reported
test_remove_failures_include_platform_reason

echo "linux-installer-uninstall.sh: PASS"
