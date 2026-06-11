---
parent_branch: worktree-feat+agent-updates
feature_number: "019"
status: In Progress
created_at: 2026-06-10T19:08:50-05:00
references_consulted:
  - specs/017-attachment-extraction/spec.md
  - spine/src/extract.ts (current behavior baseline)
  - agent/src/extract.rs (current behavior baseline)
  - agent/src/scan.rs (current behavior baseline)
---

# Feature: Agent Office Document Extraction & Watch Pattern Reconciliation

## Overview

The local file indexer (agent) lags behind the central server (spine) in what it can extract,
and it can silently ignore filetypes the user explicitly configured.

Two gaps, one outcome: files the user expects to be searchable never show up in search, and
nothing tells them why.

1. **Office document extraction parity.** The spine extracts text from Word (.docx, legacy .doc),
   PowerPoint (.pptx), and Excel (.xlsx) attachments (per spec 017, attachment extraction). The
   agent only extracts plain text and PDF. A user who watches a documents folder containing
   Office files gets PDFs indexed but Word/PowerPoint/Excel files silently dropped.

2. **Watch pattern / type-detection reconciliation.** A file can match a configured watch
   pattern yet still be skipped by the agent's file-type check, with only a debug-level log.
   Canonical example: a user adds `**/*.org` (Emacs Org-mode notes) to their watch patterns.
   The agent's type detection classifies `.org` as a legacy Lotus Organizer format, finds no
   extractor for it, and skips every file - silently. The user opted in to a filetype by
   configuring it; the agent must honor that intent or say loudly that it can't.

## Clarifications

### Session 2026-06-10

- Q: What should happen when a pattern-matched file has no extractor for its detected type? → A: Attempt plain-text read; index if valid UTF-8, otherwise warn and skip. No new config keys.
- Q: Include legacy .doc alongside docx/pptx/xlsx? → A: Yes - full parity with the spine's supported set.
- Q: How should repeat scans treat files already skipped as unextractable? → A: Cache the skip decision; unchanged unextractable files take the cheap fast path on later scans and warn only once (re-warn if the file changes).

## User Scenarios

### Scenario 1: Office documents become searchable
Robert watches `~/Documents` with patterns including `**/*.docx`, `**/*.pptx`, `**/*.xlsx`.
After the next scan pass, the text content of those files is indexed and findable via Lattice
search, exactly as it would be if he had uploaded the same files as working-doc attachments.

### Scenario 2: Org-mode notes are indexed (the .org case)
Robert adds `**/*.org` to a watch entry for his notes directory. On the next scan, his
Org-mode files are indexed as plain text and appear in search results. No file matching a
configured pattern is dropped without a visible trace.

### Scenario 3: A configured filetype the agent truly cannot read
Robert adds `**/*.zip` to a watch pattern. The agent cannot extract meaningful text from a
binary archive. Instead of silence, the scan reports these files as skipped with a visible
warning identifying the path and the reason, so Robert learns his configuration won't do what
he hoped.

### Scenario 4: Extraction tooling missing on the machine
The agent encounters a `.docx` file but the external conversion tool is not installed on that
machine. The scan records an error with an actionable message naming the missing tool and how
to install it (same experience as the existing missing-PDF-tool case), and the agent status
reflects that errors occurred.

## Functional Requirements

- **FR-1**: The agent MUST extract text from `.docx`, `.pptx`, and `.xlsx` files, producing
  text equivalent to the spine's extraction for the same file types.
- **FR-2**: The agent MUST also handle legacy `.doc` files, matching the spine's supported set
  (confirmed in clarification session 2026-06-10).
- **FR-3**: When extraction for a supported type fails (tool missing, tool error, corrupt
  file), the failure MUST be counted as an error in scan results and surfaced in agent status
  with an actionable message - never silently swallowed.
- **FR-4**: Any file that matches a configured watch pattern but has no dedicated extractor
  MUST be attempted as plain text when its content is readable as text; only if the content is
  not readable as text may it be skipped.
- **FR-5**: When a pattern-matched file is skipped because no extraction is possible, the skip
  MUST be logged at a visibility level the user will actually see (warning, not debug), naming
  the file and reason.
- **FR-6**: `.org` files (and similar plain-text formats with misleading or unknown type
  detection) matched by a configured pattern MUST be indexed as plain text.
- **FR-7**: Existing behavior MUST be preserved: text and PDF extraction, size limits, change
  detection (unchanged files still skipped cheaply), and idempotent re-sends to the spine.
- **FR-9**: Files skipped as unextractable MUST have that decision remembered, so unchanged
  files are not re-read, re-hashed, or re-warned on subsequent scans. The warning fires once
  per file, and again only if the file's content changes.
- **FR-8**: Extracted text MUST respect the same truncation ceiling the spine applies
  (100,000 characters, per spec 017), so the indexer never sends payloads the spine would
  have to truncate or reject.

## Success Criteria

- **SC-1**: A watch directory containing .docx, .pptx, .xlsx, and .doc files has 100% of those
  files' text content searchable after one scan pass.
- **SC-2**: A watch entry with `**/*.org` results in 100% of matched Org-mode files being
  indexed as text; zero are silently skipped.
- **SC-3**: For any file matching a configured pattern, the scan outcome is always one of:
  indexed, skipped-with-visible-reason, or errored-with-visible-reason. Zero pattern-matched
  files end a scan in a state invisible to the user.
- **SC-4**: When the external conversion tool is absent, the user can identify the missing tool
  and the install remedy from the agent's status/log output alone, without reading source code.
- **SC-5**: Scan time for directories with no new/changed files is unchanged (change-detection
  fast path still applies before any extraction).

## Key Entities

- **Watch entry**: a configured directory plus glob patterns expressing user intent about which
  files must be indexed.
- **File index payload**: the unit sent to the spine - path, content hash, detected type,
  extracted text, modification time, size.
- **Scan result counters**: indexed / skipped / errors totals reported per pass and reflected
  in agent status.

## Assumptions

- The same external conversion tool the spine uses (pandoc) is the appropriate mechanism for
  the agent's Office extraction; it follows the established precedent of shelling out to
  `pdftotext` for PDFs. Machines without it get the actionable-error experience (FR-3), not a
  hard agent failure.
- "Readable as text" for FR-4 means the file content is valid UTF-8; binary files are excluded.
  This is the reconciliation behavior confirmed in clarification: a pattern match expresses
  user intent, so text-like content is indexed rather than dropped on the basis of
  type-detection guesses.
- Pattern-matched binary files with no extractor (Scenario 3) are warned about and counted as
  skipped, not treated as errors - the configuration is legal, just not fully actionable.
- The truncation ceiling (100k chars) mirrors the spine's documented limit from spec 017; the
  agent adopting it changes no spine behavior.
- No new configuration keys are required; behavior is driven entirely by existing watch
  patterns.

## Sources

This spec was generated by consulting the following references (per `.specswarm/references.md`):

| Source | Sections informing this spec |
|--------|------------------------------|
| `specs/017-attachment-extraction/spec.md` | Tiered extraction capability; pandoc/pdftotext as documented external tools; 100,000-character truncation ceiling |
| `spine/src/extract.ts` | Canonical supported-type set: docx, pptx, xlsx, msword (doc), pdf, inline text - FR-1/FR-2 parity target |
| `agent/src/extract.rs`, `agent/src/scan.rs` | Current agent behavior: text/* + pdf only; pattern-matched files with unsupported detected types skipped at debug level (the silent-skip defect) |

No section was fabricated without a corresponding source citation or documented assumption.
