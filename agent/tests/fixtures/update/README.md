Update fixtures cover the product update release contract used by `agent/src/update.rs`.

- `releases.json` mirrors the GitHub release payload shape used by the updater.
- `manual-guidance.txt` captures the expected plain-language guidance for products that are visible in discovery but not updated automatically.
- `desktop-smoke.sh` is a local smoke check for installed desktop companion commands after an update.

The updater verifies executable artifacts with BLAKE3 checksums before replacement. Fixtures should include both matching and failing checksum cases so tests can prove installed files remain unchanged on verification failure.
