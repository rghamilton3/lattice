# Quality Standards - Lattice

**Last Updated**: 2026-06-07
**Auto-Generated**: Yes

<!--
  Sections wrapped in the `ss:user-additions` ... `ss:end` HTML comment markers
  (see below) are preserved verbatim when /ss:init is re-run. Edit freely inside
  those blocks. The rest of the file is regenerated from project detection + your
  accepted reconciliation prompts on each /ss:init.
-->

---

## Quality Gates

These thresholds are enforced by `/ss:ship` before allowing merge to parent branch.

```yaml
# Overall Quality
min_quality_score: 80  # 0-100 scale (default: 80)
min_test_coverage: 80   # Percentage (default: 80)
enforce_gates: true           # true/false (default: true)
```

> Note: no coverage instrumentation is wired up yet (spine uses `bun test`,
> surface uses Vitest, agent uses `cargo test`). Treat `min_test_coverage` as a
> target until a coverage reporter is added; lint, type-check, and the test
> suites are the hard gates today.

---

## Performance Budgets

```yaml
# Bundle Size Limits (surface is the only browser-shipped bundle)
enforce_budgets: true     # true/false
max_bundle_size: 500     # KB per bundle (default: 500)
max_initial_load: 1000   # KB initial load (default: 1000)
max_chunk_size: 200      # KB per code-split chunk (default: 200)
```

---

## Code Quality Metrics

```yaml
# Complexity Thresholds
complexity_threshold: 10  # Cyclomatic complexity (default: 10)
max_file_lines: 300             # Lines per file (default: 300)
max_function_lines: 50     # Lines per function (default: 50)
max_function_params: 5    # Parameters per function (default: 5)
```

---

## Testing Requirements

```yaml
# Test Coverage
require_tests: true  # true/false (default: true)
test_types:
  - unit          # Required
  - integration   # Recommended
  - e2e           # For critical flows

# Test Quality
min_assertions_per_test: 1
max_test_duration: 5000  # milliseconds per test
require_test_descriptions: true
```

---

## Code Review Standards

```yaml
# Review Requirements (solo-maintained repo: human review not gated)
require_code_review: false  # true/false (default: true)
min_reviewers: 0             # Number of required reviewers (default: 1)
require_tests_for_features: true
require_tests_for_bugfixes: true
```

---

## CI/CD Requirements

```yaml
# Build & Deploy
block_merge_on_failure: true  # true/false (default: true)
require_passing_tests: true
require_lint_pass: true
require_type_check_pass: true  # tsc --noEmit (spine + surface), svelte-check, clippy
```

---

## Security Standards

```yaml
# Security Requirements
require_security_scan: false  # Run /ss:analyze-quality before merge
block_on_critical_vulns: true
block_on_high_vulns: false
max_dependency_age: 365  # days (warn if dependency >1 year old)
```

---

## Documentation Standards

```yaml
# Documentation Requirements
require_readme_updates: false  # For new features
require_api_docs: false        # For public APIs
require_changelog_entry: true  # For all features/fixes
```

---

## Custom Quality Checks

### Per-component lint and type-check (run via `just lint` and `just check`)
- spine: `oxlint src/` + `prettier --check` + `tsc --noEmit`
- surface: `eslint .` + `prettier --check` + `svelte-check`
- agent: `cargo clippy -- -D warnings` + `cargo fmt --check`

### Pre-commit hooks (prek.toml)
- trailing-whitespace, end-of-file-fixer, check-yaml/toml/json, check-merge-conflict, detect-private-key
- Per-component fmt/lint gates must pass before commit

### Accessibility
- WCAG 2.1 Level AA is the target for surface (see `docs/accessibility/`)
- Keyboard-first interactions in the working-doc editor (CodeMirror)

*Add project-specific checks here*

<!-- ss:user-additions -->
<!-- Add project-specific quality checks below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Exemptions

Projects can request exemptions for specific standards. Document exemptions here:

*No exemptions currently granted. Request exemptions via team discussion.*

<!-- ss:user-additions -->
<!-- Document accepted exemptions below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

## Notes

- Quality level: Standard
- Created by `/ss:init`
- Enforced by `/ss:ship` before merge
- Review and adjust these standards for your team's needs

<!-- ss:user-additions -->
<!-- Add project-specific notes below. Content here is preserved on /ss:init re-run. -->
<!-- ss:end -->

---

**Quality Enforcement**: These standards are enforced by SpecSwarm commands:
- `/ss:ship` - Blocks merge if quality gates fail
- `/ss:analyze-quality` - Reports quality score against these standards
- `/ss:build` - Can enforce quality gates with `--quality-gate` flag
