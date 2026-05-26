# Quickstart: Signal Relay

## Automated Validation

```bash
cd spine
bun test tests/unit/signal-messages.test.ts tests/unit/signal-relay.test.ts
```

## Manual Validation

1. Configure `LATTICE_AGENT_TOKEN`, `SIGNAL_PHONE_NUMBER`, and `SIGNAL_RPC_HOST` in the relay environment.
2. If testing attachments, mount the signal-cli attachment directory read-only and set `SIGNAL_ATTACHMENTS_DIR` to the in-container mount path.
3. Start spine locally with an agent token accepted by `/api/agent/*`.
4. Start the relay with `cd spine && docker compose -f docker-compose.relay.yml up -d` or `bun run src/signal-relay.ts` in a controlled development environment.
5. Send a Signal Note-to-Self text message and verify it appears in the Lattice capture inbox with source `signal`.
6. Send a voice note or file and verify a placeholder/text capture is created and readable attachments are associated with the capture.
7. Stop Signal RPC temporarily and verify relay logs show bounded reconnect attempts rather than runaway parallel connections.

## Accessibility Evidence Checklist

- README relay instructions use clear headings and tables.
- Compose comments explain required attachment mount changes without relying on color or visual-only cues.
- Relay diagnostics are plain text and include actionable variable or endpoint names.
- Bilingual delivery remains N/A because the project documentation and diagnostics are English-only.
