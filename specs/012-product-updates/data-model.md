# Data Model: Product Updates

## Product

**Purpose**: Represents a Lattice installable or deployable unit visible in update status.

**Fields**:

- `id`: stable identifier such as `lattice-agent`, `lattice-capture`, `lattice-tray`, `lattice-config`, `spine`, `surface`, or `installer`
- `display_name`: user-facing product name
- `kind`: `local-binary`, `service-unit`, `desktop-companion`, `server-component`, `web-surface`, `installer`, or `unknown`
- `install_path`: local binary/config/service path when detectable
- `version_source`: binary version output, manifest, config marker, release tag, or unknown
- `installed_version`: detected semantic version, release tag, dev-build marker, or unknown
- `automatic_update`: boolean indicating whether this implementation can apply updates automatically
- `manual_guidance`: plain-language next step when automatic update is unavailable

**Validation rules**:

- `id` must be stable and non-empty.
- Unknown versions must be reported as `unknown`, not coerced to current.
- Products without automatic support must include manual guidance or an explicit unsupported reason.

## Available Update

**Purpose**: Describes an approved target release for a product.

**Fields**:

- `product_id`
- `release_tag`
- `target_version`
- `channel`: initially `stable`
- `summary`: high-level release/change text when available
- `artifacts`: one or more artifact references for the current platform
- `eligibility`: platform, architecture, feature, or product constraints
- `published_at`

**Validation rules**:

- Target version must compare newer than installed version unless the installed version is unknown or a dev build.
- Artifact references must match the current platform and product before they are offered for apply.
- Missing summaries are allowed, but product and version must still be shown.

## Update Artifact

**Purpose**: Represents one staged file intended to replace an installed executable or service asset.

**Fields**:

- `product_id`
- `asset_name`
- `download_url`
- `expected_checksum`
- `size_bytes`
- `staged_path`
- `target_path`
- `verified_at`
- `verification_status`: `pending`, `verified`, `failed`, or `not-available`

**Validation rules**:

- Replacement cannot start unless verification status is `verified`.
- Staged paths must live under the local Lattice data directory.
- Target paths must be known install locations for the matched product.

## User State

**Purpose**: Captures state that must be preserved across update checks and applies.

**Fields**:

- `config_path`: platform config TOML path
- `agent_cache_path`: local index cache path when present
- `capture_queue_path`: local capture queue path when present
- `history_path`: update attempt history location
- `service_definitions`: user service/task definitions detected for agent and tray
- `customized_service_definitions`: boolean or reason when definitions differ from expected release asset

**Validation rules**:

- Config, queues, caches, and history must not be deleted during update apply.
- Customized service/task definitions require explicit user confirmation before replacement.
- Capture queue text must remain readable after interrupted or failed updates.

## Update Attempt

**Purpose**: Records a check or apply operation for audit and troubleshooting.

**Fields**:

- `id`: local unique id or monotonic timestamp
- `operation`: `check` or `apply`
- `products`: list of product ids included in the attempt
- `starting_versions`: product to version map before operation
- `target_versions`: product to version map when available
- `outcome`: `success`, `already-current`, `unsupported`, `offline`, `failed-verification`, `failed-installation`, `interrupted`, or `manual-action-required`
- `started_at`
- `completed_at`
- `message`: plain-language product/outcome/next-action text
- `error_detail`: optional diagnostic detail suitable for logs

**Validation rules**:

- Every attempt must include product, outcome, time, and next-action text.
- Debug-only errors cannot be the only failure explanation.
- Skipped current products are recorded as non-error outcomes.

## State Transitions

### Product Update Status

```text
unknown -> current
unknown -> update-available
unknown -> unsupported
unknown -> offline
update-available -> staged
staged -> verified
verified -> applying
applying -> updated
applying -> failed-installation
verified -> failed-installation
staged -> failed-verification
```

### Attempt Outcome

```text
started -> success
started -> already-current
started -> unsupported
started -> offline
started -> failed-verification
started -> failed-installation
started -> interrupted
started -> manual-action-required
```
