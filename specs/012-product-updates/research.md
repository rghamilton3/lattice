# Research: Product Updates

## Decision: Scope automatic updates to local agent and desktop companions first

**Rationale**: The highest-priority user stories name `lattice-agent`, `lattice-capture`, `lattice-tray`, and `lattice-config`. These are installed as local binaries, share local config/state paths, and already have release artifacts. Updating them locally avoids changing spine/surface deployment behavior before those products have concrete install contracts.

**Alternatives considered**: Updating every Lattice component automatically in one pass was rejected because spine/surface deployments are Docker/static-site oriented and need separate rollback/deployment contracts. Building a generic plugin-like product updater was rejected as premature abstraction.

## Decision: Reuse the existing GitHub release channel and asset names

**Rationale**: `install.sh`, `install.ps1`, and `.github/workflows/agent-release.yml` already publish and consume agent/desktop companion release assets. Reusing that channel avoids new infrastructure and keeps self-hosting burden unchanged because update checks do not transmit private user data.

**Alternatives considered**: A new hosted update service was rejected by the constitution. A self-hosted spine update registry was rejected for the first slice because it would add server endpoints and persistence without a current need. Package-manager repositories were rejected because the existing install path is direct binary assets.

## Decision: Add release manifest/checksum verification before replacement

**Rationale**: The spec requires corrupted or incomplete artifacts to be rejected before installed files are replaced. A release manifest or checksum asset allows the updater to validate staged downloads using existing Rust hashing/IO without adding a dependency. Verification should happen in a staging directory before any installed binary is touched.

**Alternatives considered**: Trusting TLS/download completion was rejected because it does not catch wrong, truncated, or locally corrupted artifacts. Introducing full signing infrastructure was deferred because it needs key-management policy outside this first planning slice.

## Decision: Preserve user state by staging binaries separately and replacing only executable assets

**Rationale**: Config lives under platform config directories, queue/cache/history under platform data directories, and service/task definitions may be user-customized. The updater should stage artifacts in local data storage, verify them, stop/restart services only when needed, and avoid overwriting config, queues, caches, or customized service/task definitions unless explicitly confirmed by a documented migration.

**Alternatives considered**: Re-running the installer wholesale was rejected because it risks rewriting config or service definitions. In-place overwrite without staging was rejected because interrupted downloads could leave unusable binaries.

## Decision: Store update attempt history locally

**Rationale**: Operators need readable history even if terminal output is gone. A compact local JSONL or SQLite history file under the platform data directory is enough for single-user installs and avoids spine storage. The implementation can choose the simplest local format during tasks while preserving the data-model fields.

**Alternatives considered**: Storing history in spine was rejected because update attempts are local machine state and should not require server connectivity. Writing only service logs was rejected because logs are harder to query and may rotate.

## Decision: Report non-automatic products with manual guidance

**Rationale**: The spec asks for all possible products to be visible but prioritizes automatic support for agents and desktop capture. Reporting spine, surface, installers, and unknown products as manual or unsupported satisfies discovery without creating unsafe automated server deployment behavior.

**Alternatives considered**: Hiding unsupported products was rejected because it conflicts with update discoverability. Attempting Docker/surface updates from the local agent was rejected because it crosses deployment boundaries and can break self-hosted server ownership.

## Decision: Service restart uses platform-native controls with clear fallback instructions

**Rationale**: Linux installs already use `systemctl --user` services and Windows installs use Task Scheduler. Update apply should restart or instruct restarts through those native controls, and if they are unavailable, leave the new binary staged/applied with clear next steps.

**Alternatives considered**: Embedding a persistent privileged updater service was rejected as unnecessary and outside the approved simple local model. Assuming service manager availability was rejected because the spec covers missing service managers and partial installs.

## Decision: Failure and interruption handling favors roll-forward plus clear recovery

**Rationale**: The safest minimal update path is staged download, verification, replacement, and restart. If failure occurs before replacement, keep the current binary. If failure occurs after replacement, record exact product/version/outcome and provide roll-forward/reinstall commands using the release channel.

**Alternatives considered**: Full rollback was considered but deferred because binary backup and service rollback semantics add complexity. Silent retry was rejected because updates require explicit operator action.

## Decision: Accessibility evidence focuses on CLI/installer/log output unless persistent controls are added

**Rationale**: The first slice changes terminal, installer, service-log, and notification output. Evidence should cover readable plain text, no color/icon-only state, and recovery instructions. WCAG 2.2 AA evidence for persistent controls is required only if implementation adds tray/config/web update controls.

**Alternatives considered**: Treating accessibility as N/A was rejected because user-facing terminal and notification output changes still need review. Bilingual delivery was marked N/A because current Lattice setup and diagnostic copy is English-only and no translation resource is in scope.
