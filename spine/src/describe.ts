import type { Database } from 'bun:sqlite';
import { readFileSync } from 'node:fs';
import { getVlmModel, getQmdBaseUrl, getQmdApiKey } from './config';
import { writeAttachmentIndex, writeWorkingAttachmentIndex, refreshIndex } from './search';

export async function generateDescription(
	attachmentId: number,
	kind: 'capture' | 'working',
	storedFullPath: string,
	db: Database,
): Promise<void> {
	const model = getVlmModel();
	if (!model) return;

	const baseUrl = getQmdBaseUrl();
	if (!baseUrl) return;

	const existing = db
		.query(
			`SELECT id, confirmed FROM attachment_descriptions
         WHERE attachment_kind = ? AND attachment_id = ? AND supersedes IS NULL`,
		)
		.get(kind, attachmentId) as { id: number; confirmed: number } | null;

	if (existing?.confirmed) return;

	const bytes = readFileSync(storedFullPath);
	const b64 = bytes.toString('base64');
	const mimeRow = db
		.query(
			`SELECT content_type FROM ${kind === 'capture' ? 'capture_attachments' : 'working_attachments'} WHERE id = ?`,
		)
		.get(attachmentId) as { content_type: string } | null;
	if (!mimeRow) {
		console.error(
			'[describe] attachment row not found for id',
			attachmentId,
			'- skipping description',
		);
		return;
	}
	const mime = mimeRow.content_type;

	const resp = await fetch(`${baseUrl}/chat/completions`, {
		method: 'POST',
		signal: AbortSignal.timeout(30_000),
		headers: {
			'Content-Type': 'application/json',
			...(getQmdApiKey() ? { Authorization: `Bearer ${getQmdApiKey()}` } : {}),
		},
		body: JSON.stringify({
			model,
			messages: [
				{
					role: 'user',
					content: [
						{ type: 'image_url', image_url: { url: `data:${mime};base64,${b64}` } },
						{
							type: 'text',
							text: 'Describe this image in 2-3 sentences. Focus on what is shown: objects, diagrams, text style, or visual content. Be concise and factual.',
						},
					],
				},
			],
			max_tokens: 500,
		}),
	});

	if (!resp.ok) throw new Error(`VLM inference ${resp.status}: ${await resp.text()}`);
	const json = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
	const text = (json.choices[0]?.message?.content ?? '').trim();
	if (!text) {
		console.warn('[describe] VLM returned empty response for attachment', attachmentId);
		return;
	}

	const now = new Date().toISOString();
	db.transaction(() => {
		const { lastInsertRowid } = db
			.prepare(
				`INSERT INTO attachment_descriptions
               (attachment_kind, attachment_id, produced_text, final_text, confirmed, model_id, supersedes, created_at)
             VALUES (?, ?, ?, ?, 0, ?, NULL, ?)`,
			)
			.run(kind, attachmentId, text, text, model, now);

		if (existing) {
			db.prepare('UPDATE attachment_descriptions SET supersedes = ? WHERE id = ?').run(
				lastInsertRowid,
				existing.id,
			);
		}

		if (kind === 'capture') {
			const row = db
				.query(
					'SELECT id, capture_id, filename, content_type, size_bytes, created_at FROM capture_attachments WHERE id = ?',
				)
				.get(attachmentId) as {
				id: number;
				capture_id: number;
				filename: string;
				content_type: string;
				size_bytes: number;
				created_at: string;
			} | null;
			if (row)
				writeAttachmentIndex(
					row.id,
					row.capture_id,
					row.filename,
					row.content_type,
					row.size_bytes,
					row.created_at,
					text,
				);
		} else {
			const row = db
				.query(
					'SELECT id, slug, filename, content_type, size_bytes, created_at FROM working_attachments WHERE id = ?',
				)
				.get(attachmentId) as {
				id: number;
				slug: string;
				filename: string;
				content_type: string;
				size_bytes: number;
				created_at: string;
			} | null;
			if (row)
				writeWorkingAttachmentIndex(
					row.id,
					row.slug,
					row.filename,
					row.content_type,
					row.size_bytes,
					row.created_at,
					text,
				);
		}
	})();

	refreshIndex();
}
