ALTER TABLE capture_attachments ADD COLUMN upload_source TEXT NOT NULL DEFAULT 'signal';
CREATE INDEX idx_capture_attachments_capture_id ON capture_attachments(capture_id);
