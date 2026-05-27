# Contract: Release Artifacts For Product Updates

Product updates reuse the existing agent release workflow and asset naming conventions.

## Release Source

- Stable channel metadata comes from the project's approved release channel.
- Current installer behavior uses GitHub releases for repository `rghamilton3/lattice`.
- Agent releases are tagged as `agent-v*`.

The updater must not transmit private user content while checking metadata or downloading artifacts.

## Required Metadata

For each offered automatic update, metadata must provide:

- Release tag
- Product id
- Target version
- Platform target triple or platform name
- Asset name
- Download URL
- Verification checksum or manifest entry
- Optional high-level release summary

## Existing Asset Names

Linux musl binaries:

```text
lattice-agent-x86_64-unknown-linux-musl
lattice-agent-aarch64-unknown-linux-musl
lattice-tray-x86_64-unknown-linux-musl
lattice-tray-aarch64-unknown-linux-musl
lattice-capture-x86_64-unknown-linux-musl
lattice-capture-aarch64-unknown-linux-musl
```

Linux config GUI:

```text
lattice-config-x86_64-unknown-linux-gnu
```

Windows binaries:

```text
lattice-agent-x86_64-pc-windows-msvc.exe
lattice-tray-x86_64-pc-windows-msvc.exe
lattice-capture-x86_64-pc-windows-msvc.exe
```

Service/installer assets:

```text
lattice-agent.service
lattice-tray.service
install.ps1
```

## Verification Contract

- Every downloaded executable artifact must be verified before replacement.
- Verification failure must produce outcome `failed-verification` and leave installed files untouched.
- Missing checksum or manifest data must prevent automatic apply for that artifact.
- Verification messages must identify the product, asset, and next action in plain text.

## Product Coverage Contract

Automatic update capable in the first slice:

- `lattice-agent`
- `lattice-capture`
- `lattice-tray`
- `lattice-config` where an artifact exists for the current platform

Manual guidance only in the first slice:

- `spine`
- `surface`
- Docker deployment files
- installer scripts and service units when replacing them would overwrite user customizations
- unknown or development-build products

## Compatibility Rules

- Installed development builds newer than the latest stable release must not be downgraded automatically.
- Unknown installed versions may show an available update but require confirmation that the operator wants to replace the binary.
- Platform-mismatched artifacts must never be offered for apply.
