# Quickstart: Verifying Agent Office Extraction & Pattern Reconciliation

## Prerequisites

```bash
# pandoc must be installed on the agent host for Office formats
pacman -S pandoc        # Arch
# apt install pandoc    # Debian/Ubuntu
```

## Setup

1. Add a watch entry covering the new types in `~/.config/lattice/config.toml`:

```toml
[[agent.watch]]
path = "/home/you/Documents/test-019"
patterns = ["**/*.docx", "**/*.pptx", "**/*.xlsx", "**/*.doc", "**/*.org", "**/*.zip"]
```

2. Populate the directory: one of each - a .docx, .pptx, .xlsx, .doc, an Org-mode `.org`
   note, and a binary `.zip`.

3. Run the agent: `cargo run --bin lattice-agent` (or restart the installed agent).

## Expected outcomes

| File | Outcome |
|------|---------|
| `.docx` / `.pptx` / `.xlsx` / `.doc` | Indexed; text searchable in Lattice (SC-1) |
| `.org` | Indexed as plain text (SC-2) |
| `.zip` | Skipped with a **warn-level** log naming the file and reason (SC-3) |

4. **Warn-once check**: run a second scan pass. The `.zip` warning does not repeat, and the
   scan does not re-read the file (FR-9).

5. **Missing-tool check**: uninstall/rename pandoc, touch the `.docx`, rescan. The scan
   reports an error with an actionable "install pandoc" message and agent status shows the
   error (SC-4).

6. **Search check**: open Lattice, search for distinctive phrases from the Office and Org
   files; both should return results.

## Test suite

```bash
cd agent && cargo test    # dispatch, fallback, truncation, cache-rule unit tests
just lint                 # clippy across components
```
