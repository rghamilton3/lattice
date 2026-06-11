import { readFileSync } from 'node:fs';
import { getOcrModel, getQmdBaseUrl, getQmdApiKey } from './config';

const INLINE_TYPES = new Set([
	'text/plain',
	'text/csv',
	'text/markdown',
	'text/x-markdown',
	'application/csv',
	'text/tab-separated-values',
]);

const IMAGE_TYPES = new Set([
	'image/jpeg',
	'image/png',
	'image/gif',
	'image/webp',
	'image/tiff',
	'image/bmp',
	'image/avif',
]);

const SUBPROCESS_TYPES: Record<string, { cmd: string; args: (path: string) => string[] }> = {
	'application/pdf': { cmd: 'pdftotext', args: (p) => [p, '-'] },
	'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {
		cmd: 'pandoc',
		args: (p) => ['--from=docx', '--to=plain', p],
	},
	'application/vnd.openxmlformats-officedocument.presentationml.presentation': {
		cmd: 'pandoc',
		args: (p) => ['--from=pptx', '--to=plain', p],
	},
	'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
		cmd: 'pandoc',
		args: (p) => ['--from=xlsx', '--to=plain', p],
	},
	'application/msword': { cmd: 'pandoc', args: (p) => ['--from=doc', '--to=plain', p] },
};

const MAX_TEXT_CHARS = 100_000;

function truncate(text: string): string {
	if (text.length <= MAX_TEXT_CHARS) return text;
	const cut = text.lastIndexOf(' ', MAX_TEXT_CHARS);
	return text.slice(0, cut > 0 ? cut : MAX_TEXT_CHARS);
}

export function isInlineType(contentType: string): boolean {
	return INLINE_TYPES.has(contentType.split(';')[0].trim().toLowerCase());
}

export function isImageType(contentType: string): boolean {
	return IMAGE_TYPES.has(contentType.split(';')[0].trim().toLowerCase());
}

export function isSubprocessType(contentType: string): boolean {
	return Object.prototype.hasOwnProperty.call(
		SUBPROCESS_TYPES,
		contentType.split(';')[0].trim().toLowerCase(),
	);
}

export function extractInline(storedFullPath: string): string {
	return truncate(readFileSync(storedFullPath, 'utf-8'));
}

export async function extractSubprocess(
	storedFullPath: string,
	contentType: string,
): Promise<string> {
	const norm = contentType.split(';')[0].trim().toLowerCase();
	const spec = SUBPROCESS_TYPES[norm];
	if (!spec) throw new Error(`No subprocess handler for ${contentType}`);

	const proc = Bun.spawn([spec.cmd, ...spec.args(storedFullPath)], {
		stdout: 'pipe',
		stderr: 'pipe',
	});
	const [stdout, exitCode] = await Promise.all([new Response(proc.stdout).text(), proc.exited]);
	if (exitCode !== 0) {
		const stderr = await new Response(proc.stderr).text();
		throw new Error(`${spec.cmd} exited ${exitCode}: ${stderr.slice(0, 200)}`);
	}
	return truncate(stdout);
}

export async function ocrImage(storedFullPath: string, contentType: string): Promise<string> {
	const model = getOcrModel();
	if (!model) return '';

	const baseUrl = getQmdBaseUrl();
	if (!baseUrl) return '';

	const bytes = readFileSync(storedFullPath);
	const b64 = bytes.toString('base64');
	const mime = contentType.split(';')[0].trim();

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
							text: 'Extract all text from this image exactly as it appears. Return only the extracted text with no commentary. If there is no text, return an empty response.',
						},
					],
				},
			],
			max_tokens: 2000,
		}),
	});

	if (!resp.ok) throw new Error(`OCR inference ${resp.status}: ${await resp.text()}`);
	const json = (await resp.json()) as { choices: Array<{ message: { content: string } }> };
	return truncate((json.choices[0]?.message?.content ?? '').trim());
}

export async function extractText(
	storedFullPath: string,
	contentType: string,
): Promise<{ text: string; tier: 0 | 1 }> {
	const norm = contentType.split(';')[0].trim().toLowerCase();
	if (isInlineType(norm)) {
		return { text: extractInline(storedFullPath), tier: 0 };
	}
	if (isSubprocessType(norm)) {
		const text = await extractSubprocess(storedFullPath, norm);
		return { text, tier: 0 };
	}
	if (isImageType(norm)) {
		const text = await ocrImage(storedFullPath, norm);
		return { text, tier: 1 };
	}
	return { text: '', tier: 0 };
}
