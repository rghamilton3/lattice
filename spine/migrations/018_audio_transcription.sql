ALTER TABLE capture_attachments ADD COLUMN extraction_failure_reason TEXT NOT NULL DEFAULT '';
ALTER TABLE working_attachments ADD COLUMN extraction_failure_reason TEXT NOT NULL DEFAULT '';
