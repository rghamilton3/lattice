# Quickstart: Attachment Extraction and Image Description

## Tier 0: Text and Office Documents (always-on)

Install subprocess tools on the server:

```bash
# Ubuntu / Debian
apt install poppler-utils pandoc

# Arch
pacman -S poppler pandoc-cli
```

No configuration changes needed. PDF, DOCX, PPTX, XLSX, and plain text/Markdown/CSV attachments will be extracted automatically after these tools are installed and spine is restarted.

## Tier 1: Image OCR and Description (requires inference)

1. Load a vision-capable model on your inference endpoint (LM Studio, Ollama, vLLM, etc.). Models tested: `minicpm-v`, `llava`, `moondream`.

2. Add to `~/.config/lattice/config.toml`:

```toml
[spine.qmd]
# ... existing embed/rerank/expand settings ...
ocr_model = "minicpm-v"   # for OCR on images and image-only PDFs
vlm_model = "minicpm-v"   # for describing dark attachments
```

If `ocr_model` is absent, image attachments skip Tier 1 and stay `pending` (or go `dark` with no description generated, depending on the content type). Setting `ocr_model` without setting `vlm_model` means OCR runs but dark attachments get no description.

## Reprocessing existing attachments

All attachments uploaded before this feature is deployed have `extraction_status = 'pending'`. They are processed on the next spine startup (the startup sweep runs before the HTTP server accepts connections).

To reprocess a specific failed attachment, reset its status directly:

```sql
-- lattice.dev.db
UPDATE capture_attachments SET extraction_status = 'pending' WHERE id = <id>;
```

Then restart spine.
