# Quickstart: Resurfacing & Clustering (018)

## Enable the feature

Add to your `.env` / dev launch:
```
PUBLIC_LATTICE_FEATURE_RESURFACING=true
PUBLIC_LATTICE_FEATURE_CLUSTERS=true
```

Or enable both from the surface Settings overlay.

## Trigger a resurfacing pass manually

During development, call the internal test helper or hit the spine process directly.
There is no public trigger endpoint — the pass runs via a background timer.

In test environments, import `__runResurfaceForTests` from `spine/src/resurface.ts`.

## Verify the database

```bash
sqlite3 lattice.dev.db "SELECT * FROM surfaced ORDER BY surfaced_at DESC LIMIT 10;"
sqlite3 lattice.dev.db "SELECT c.id, COUNT(m.target_id) as members FROM clusters c JOIN cluster_memberships m ON m.cluster_id = c.id GROUP BY c.id;"
```

## QMD vector count

```bash
sqlite3 lattice.qmd.db "SELECT COUNT(*) FROM vectors_vec;"
sqlite3 lattice.qmd.db "SELECT collection, COUNT(*) FROM documents WHERE active=1 GROUP BY collection;"
```

At least one embedded document is required for the clustering pass to produce output.
The surface panel appears only when `resurfacing` is enabled AND at least one non-dismissed
item exists for today.
