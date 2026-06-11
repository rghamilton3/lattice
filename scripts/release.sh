#!/usr/bin/env bash
# release.sh — cut a Lattice release for one or more artifacts.
#
# Usage:
#   scripts/release.sh prepare [--dry-run] <artifact>@<version> [...]
#   scripts/release.sh tag     [--dry-run] <artifact>@<version> [...]
#
# Artifacts: agent  spine  surface
# Version:   semver without leading "v" — e.g. 0.12.0
#
# prepare: bumps version manifests, creates a release branch, commits,
#          pushes, and opens a draft PR on GitHub.
# tag:     verifies manifest versions match, creates annotated tags, and
#          pushes them to origin (CI builds and publishes from there).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# ── helpers ──────────────────────────────────────────────────────────────────

die()  { echo "error: $*" >&2; exit 1; }
info() { echo "» $*"; }
ok()   { echo "  ✓ $*"; }

dry_run=false

run() {
    if $dry_run; then
        echo "  [dry-run] $*"
    else
        "$@"
    fi
}

semver_re='^[0-9]+\.[0-9]+\.[0-9]+$'
validate_semver() {
    [[ "$1" =~ $semver_re ]] || die "invalid version '$1' (expected X.Y.Z)"
}

# ── manifest helpers ──────────────────────────────────────────────────────────

current_version() {
    local artifact="$1"
    case "$artifact" in
        agent)
            grep '^version = ' "$REPO_ROOT/agent/Cargo.toml" \
                | head -1 | sed 's/version = "\(.*\)"/\1/'
            ;;
        spine)
            node -e "process.stdout.write(require('$REPO_ROOT/spine/package.json').version)"
            ;;
        surface)
            node -e "process.stdout.write(require('$REPO_ROOT/surface/package.json').version)"
            ;;
        *) die "unknown artifact '$artifact'" ;;
    esac
}

bump_version() {
    local artifact="$1" new_ver="$2"
    case "$artifact" in
        agent)
            info "bumping agent/Cargo.toml to $new_ver"
            # Replace only the first [package] version line (not dependency versions)
            run sed -i "0,/^version = \".*\"/{s/^version = \".*\"/version = \"$new_ver\"/}" \
                "$REPO_ROOT/agent/Cargo.toml"
            # Update Cargo.lock without building
            if $dry_run; then
                echo "  [dry-run] cargo update --workspace (in agent/)"
            elif command -v cargo >/dev/null 2>&1; then
                (cd "$REPO_ROOT/agent" && cargo update --workspace)
            else
                echo "  warning: cargo not on PATH — Cargo.lock not updated (CI will catch drift)"
            fi
            ;;
        spine)
            info "bumping spine/package.json to $new_ver"
            run node -e "
                const fs = require('fs'), p = '$REPO_ROOT/spine/package.json';
                const pkg = JSON.parse(fs.readFileSync(p));
                pkg.version = '$new_ver';
                fs.writeFileSync(p, JSON.stringify(pkg, null, '\t') + '\n');
            "
            ;;
        surface)
            info "bumping surface/package.json to $new_ver"
            run node -e "
                const fs = require('fs'), p = '$REPO_ROOT/surface/package.json';
                const pkg = JSON.parse(fs.readFileSync(p));
                pkg.version = '$new_ver';
                fs.writeFileSync(p, JSON.stringify(pkg, null, '\t') + '\n');
            "
            ;;
        *) die "unknown artifact '$artifact'" ;;
    esac
}

tag_for() { echo "$1-v$2"; }

manifest_files() {
    local artifact="$1"
    case "$artifact" in
        agent)   echo "agent/Cargo.toml" "agent/Cargo.lock" ;;
        spine)   echo "spine/package.json" ;;
        surface) echo "surface/package.json" ;;
    esac
}

# ── parse args ────────────────────────────────────────────────────────────────

[[ $# -ge 1 ]] || { echo "usage: release.sh <prepare|tag> [--dry-run] <artifact>@<version> [...]"; exit 1; }
subcmd="$1"; shift

# Accept --dry-run anywhere in the remaining args
declare -a remaining_args=()
for arg in "$@"; do
    if [[ "$arg" == "--dry-run" ]]; then
        dry_run=true
    else
        remaining_args+=("$arg")
    fi
done
set -- "${remaining_args[@]}"
$dry_run && info "dry-run mode — no files will be modified, no git/gh commands run"

declare -a artifacts=()
declare -A versions=()

for pair in "$@"; do
    [[ "$pair" == *@* ]] || die "expected artifact@version, got '$pair'"
    art="${pair%%@*}"
    ver="${pair##*@}"
    validate_semver "$ver"
    case "$art" in
        agent|spine|surface) ;;
        *) die "unknown artifact '$art' (valid: agent spine surface)" ;;
    esac
    artifacts+=("$art")
    versions["$art"]="$ver"
done

[[ ${#artifacts[@]} -ge 1 ]] || die "no artifact@version pairs provided"

# ── subcommands ───────────────────────────────────────────────────────────────

cmd_prepare() {
    cd "$REPO_ROOT"

    # Must be on main with a clean tree
    local branch; branch=$(git rev-parse --abbrev-ref HEAD)
    [[ "$branch" == "main" ]] || die "prepare must run on main (currently on '$branch')"
    # --untracked-files=no: untracked files don't block a release
    local dirty; dirty=$(git status --porcelain --untracked-files=no)
    [[ -z "$dirty" ]] || die "working tree has uncommitted changes — commit or stash first"

    # Assemble branch name
    local parts=()
    for art in "${artifacts[@]}"; do
        parts+=("$(tag_for "$art" "${versions[$art]}")")
    done
    local branch_name="release/$(IFS=+; echo "${parts[*]}")"

    info "creating branch $branch_name"
    run git checkout -b "$branch_name"

    # Bump each artifact
    for art in "${artifacts[@]}"; do
        local cur; cur=$(current_version "$art")
        local new="${versions[$art]}"
        info "  $art: $cur → $new"
        bump_version "$art" "$new"
    done

    # Commit
    local commit_msg
    if [[ ${#artifacts[@]} -eq 1 ]]; then
        local art="${artifacts[0]}"
        commit_msg="chore: bump $art to v${versions[$art]} for release"
    else
        local parts_str
        parts_str=""
        for art in "${artifacts[@]}"; do parts_str+="$art v${versions[$art]}, "; done
        parts_str="${parts_str%, }"
        commit_msg="chore: bump versions for release — $parts_str"
    fi

    info "staging manifest files"
    for art in "${artifacts[@]}"; do
        local files; mapfile -t files < <(manifest_files "$art")
        run git add "${files[@]}"
    done

    info "committing"
    run git commit -m "$commit_msg"

    info "pushing $branch_name"
    run git push -u origin "$branch_name"

    # PR title and body
    local pr_title
    if [[ ${#artifacts[@]} -eq 1 ]]; then
        pr_title="Release ${artifacts[0]} v${versions[${artifacts[0]}]}"
    else
        local label_parts=()
        for art in "${artifacts[@]}"; do label_parts+=("$art v${versions[$art]}"); done
        pr_title="Release $(IFS=', '; echo "${label_parts[*]}")"
    fi

    local pr_body="## Release checklist\n\n"
    for art in "${artifacts[@]}"; do
        local tag; tag=$(tag_for "$art" "${versions[$art]}")
        pr_body+="- [ ] \`$tag\` — version bump committed\n"
        case "$art" in
            agent)   pr_body+="  - After merge: push tag \`$tag\` → CI builds Linux/Windows binaries and publishes GitHub Release\n" ;;
            spine)   pr_body+="  - After merge: push tag \`$tag\` → CI builds and pushes Docker image to GHCR\n" ;;
            surface) pr_body+="  - After merge: push tag \`$tag\` (version tracking only — bundled in spine Docker image)\n" ;;
        esac
    done
    pr_body+="\n### Next step\n\nOnce this PR is merged, run:\n\`\`\`\n"
    local tag_args=()
    for art in "${artifacts[@]}"; do tag_args+=("$art@${versions[$art]}"); done
    pr_body+="scripts/release.sh tag ${tag_args[*]}\n\`\`\`"

    info "opening PR"
    run gh pr create \
        --base main \
        --title "$pr_title" \
        --body "$(printf '%b' "$pr_body")"

    ok "prepare complete — merge the PR, then run: scripts/release.sh tag ${tag_args[*]}"
}

cmd_tag() {
    cd "$REPO_ROOT"

    local branch; branch=$(git rev-parse --abbrev-ref HEAD)
    [[ "$branch" == "main" ]] || die "tag must run on main (currently on '$branch')"
    local dirty; dirty=$(git status --porcelain --untracked-files=no)
    [[ -z "$dirty" ]] || die "working tree has uncommitted changes"

    # Verify manifest versions match what we're tagging
    for art in "${artifacts[@]}"; do
        local expected="${versions[$art]}"
        local actual; actual=$(current_version "$art")
        [[ "$actual" == "$expected" ]] \
            || die "$art manifest version is $actual but tagging $expected — did the PR merge?"
    done

    # Create and push tags
    for art in "${artifacts[@]}"; do
        local tag; tag=$(tag_for "$art" "${versions[$art]}")
        local cur; cur=$(current_version "$art")
        info "creating tag $tag (manifest: $cur)"
        run git tag -a "$tag" -m "Release $tag"
        run git push origin "$tag"
        ok "pushed $tag — CI will handle the rest"
    done

    echo ""
    info "All tags pushed. Monitor CI at: https://github.com/$(gh repo view --json nameWithOwner -q .nameWithOwner)/actions"
}

# ── dispatch ──────────────────────────────────────────────────────────────────

case "$subcmd" in
    prepare) cmd_prepare ;;
    tag)     cmd_tag ;;
    *) die "unknown subcommand '$subcmd' (valid: prepare tag)" ;;
esac
