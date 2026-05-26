# Signal Relay Accessibility Evidence

## Scope

- User-facing artifacts: README Signal Relay setup instructions, `spine/docker-compose.relay.yml` comments, and relay terminal diagnostics.
- No graphical UI is introduced by this feature.
- Bilingual delivery is N/A because the existing project documentation and relay diagnostics are English-only.

## WCAG 2.2 AA Checks

- Documentation uses semantic Markdown headings, tables, and fenced code blocks for assistive technology navigation.
- Environment-variable names are written as text, not conveyed through color or position alone.
- Relay diagnostics are plain text with actionable variable and endpoint names.
- Compose comments describe attachment mount behavior in text and identify text-only fallback when attachments are not configured.
- No keyboard interaction or focus order changes apply because the relay has no interactive UI.

## Residual Risks

- Live Signal account setup remains external to Lattice and depends on signal-cli documentation.
- Attachment directory discovery is operator-specific; README gives the common path and points operators to their signal-cli data directory.
