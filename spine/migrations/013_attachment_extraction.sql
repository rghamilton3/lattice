ALTER TABLE capture_attachments ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE capture_attachments ADD COLUMN extracted_text    TEXT NOT NULL DEFAULT '';

ALTER TABLE working_attachments ADD COLUMN extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE working_attachments ADD COLUMN extracted_text    TEXT NOT NULL DEFAULT '';
