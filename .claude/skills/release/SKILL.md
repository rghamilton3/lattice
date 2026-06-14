---
name: release
description: Cut a new release — bump versions, create release branch, open PR, push tags, trigger CI publish. Use when asked to release, cut a release, bump version, publish, or tag a new version of agent, spine, surface, or llama-swap.
---

# Lattice release workflow

The release script at `scripts/release.sh` handles two phases: **prepare** (version bump
PR) and **tag** (trigger CI to build and publish). CI takes over after the tag is pushed —
agent tags build Linux/Windows binaries and a GitHub Release; spine and llama-swap tags build
and push Docker images to GHCR.

## Artifacts

| Artifact | Version file | Tag pattern | CI action |
|---|---|---|---|
| `agent` | `agent/Cargo.toml` | `agent-v*` | builds binaries → GitHub Release |
| `spine` | `spine/package.json` | `spine-v*` | builds Docker image → GHCR |
| `surface` | `surface/package.json` | `surface-v*` | version tracking only (bundled in spine) |
| `llama-swap` | `asr-shim/pyproject.toml` | `llama-swap-v*` | builds image → GHCR + attaches config/fetch assets to the release |

`llama-swap` is the custom inference image (llama-swap base + the ASR shim); it's versioned
off the shim's `pyproject.toml` since that's the only Lattice-authored content in it. The
GPU host (spacelab) pulls `ghcr.io/rghamilton3/lattice-llama-swap:<version>` and the matching
`llama-swap.config.yaml` release asset — no repo clone.

Current versions (as of last check): agent `0.11.2`, spine `1.2.1`, surface `0.11.1`,
llama-swap `0.1.0`. Always verify with the script itself — it reads manifests directly.

## Prerequisites

```bash
# gh CLI and bun must be on PATH (already present in this repo's dev setup)
gh auth status
node --version   # needed for package.json bumps
```

## Phase 1 — prepare (bump + PR)

Must be run from **main** with a clean working tree.

```bash
# Single artifact
scripts/release.sh prepare agent@0.12.0

# Multiple artifacts in one PR
scripts/release.sh prepare spine@1.3.0 surface@0.12.0 agent@0.12.0
```

What this does:
1. Creates branch `release/agent-v0.12.0` (or `release/spine-v1.3.0+surface-v0.12.0+agent-v0.12.0`)
2. Bumps version in the manifest(s)
3. Commits, pushes, opens a draft PR via `gh pr create`
4. Prints the exact `tag` command to run after merge

Dry-run (validates, prints every command, touches nothing):
```bash
scripts/release.sh prepare --dry-run agent@0.12.0
```

## Phase 2 — tag (trigger CI)

Run **after the PR has been merged to main** and you've pulled the latest main.

```bash
git checkout main && git pull
scripts/release.sh tag agent@0.12.0

# Multiple artifacts — each gets its own tag, one push each
scripts/release.sh tag spine@1.3.0 surface@0.12.0 agent@0.12.0
```

What this does:
1. Verifies manifest version matches the requested tag (guards against tagging before merge)
2. Creates an annotated git tag per artifact
3. Pushes each tag to origin — CI fires from there

Dry-run:
```bash
scripts/release.sh tag --dry-run agent@0.12.0
```

## Monitoring after tag

The `tag` command prints a direct link:
```
https://github.com/rghamilton3/lattice/actions
```

- **agent-v\*** tag: watch `Release lattice-agent` workflow — builds Linux (x86/aarch64 musl),
  Windows (msvc), and publishes a GitHub Release with binaries + checksums.
- **spine-v\*** tag: watch `Build and push spine Docker image` — pushes to
  `ghcr.io/rghamilton3/lattice-spine:<version>` and `:latest`.
- **surface-v\*** tag: no CI workflow; tag is version-tracking only.
- **llama-swap-v\*** tag: watch `Build and push llama-swap Docker image` — pushes to
  `ghcr.io/rghamilton3/lattice-llama-swap:<version>` and `:latest`, and attaches
  `llama-swap.config.yaml` + `fetch-models.sh` to the GitHub Release for that tag.

## Gotchas

- **Tag manifest mismatch**: `tag` refuses to run if `Cargo.toml` or `package.json` doesn't
  match the requested version. This means the PR hasn't merged yet, or you forgot to `git pull`.
- **Re-releasing the same version**: git will reject pushing a tag that already exists. Use
  `git tag -d <tag> && git push origin :refs/tags/<tag>` to delete first — only do this if the
  release hasn't been published yet.
- **`cargo update --workspace`** runs automatically after bumping `Cargo.toml` to keep
  `Cargo.lock` in sync. If Cargo isn't on PATH the script warns but continues (lock drift is
  caught by CI).
- **Surface has no release CI**: bumping surface version and pushing `surface-v*` creates a tag
  and nothing else. The Docker image built from `spine-v*` is what ships the surface SPA.
- **Branch naming with multiple artifacts uses `+` as separator**:
  `release/spine-v1.3.0+agent-v0.12.0` — this is intentional and valid as a git branch name.
