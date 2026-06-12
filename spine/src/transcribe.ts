import { readFileSync } from 'node:fs';
import { getAsrModel, getAsrTimeoutMs, getQmdBaseUrl, getQmdApiKey } from './config';

// Undecodable/zero-length audio or other contract violations: retrying cannot help.
export class TerminalTranscriptionError extends Error {}
// AI server down, timeout, backpressure, 5xx: retrying later is expected to help.
export class TransientTranscriptionError extends Error {}

export interface TranscriptionResult {
	text: string;
	modelId: string;
}

export type FetchLike = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

export interface TranscribeOptions {
	storedFullPath: string;
	filename: string;
	contentType: string;
	fetchImpl?: FetchLike;
	retryDelaysMs?: number[];
	sleep?: (ms: number) => Promise<void>;
}

const DEFAULT_RETRY_DELAYS_MS = [2_000, 8_000, 30_000];

function defaultSleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isTransientStatus(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

async function requestOnce(
	opts: TranscribeOptions,
	baseUrl: string,
	model: string,
	fetchImpl: FetchLike,
): Promise<string> {
	const bytes = readFileSync(opts.storedFullPath);
	const form = new FormData();
	form.append('file', new Blob([bytes], { type: opts.contentType }), opts.filename || 'audio');
	form.append('model', model);

	let resp: Response;
	try {
		resp = await fetchImpl(`${baseUrl}/audio/transcriptions`, {
			method: 'POST',
			signal: AbortSignal.timeout(getAsrTimeoutMs()),
			headers: getQmdApiKey() ? { Authorization: `Bearer ${getQmdApiKey()}` } : {},
			body: form,
		});
	} catch (e) {
		throw new TransientTranscriptionError(`ASR request failed: ${e}`);
	}

	if (!resp.ok) {
		const body = await resp.text().catch(() => '');
		const detail = `ASR ${resp.status}: ${body.slice(0, 500)}`;
		if (isTransientStatus(resp.status)) throw new TransientTranscriptionError(detail);
		throw new TerminalTranscriptionError(detail);
	}

	const json = (await resp.json().catch(() => null)) as { text?: unknown } | null;
	if (!json || typeof json.text !== 'string') {
		throw new TransientTranscriptionError('ASR returned a malformed response body');
	}
	return json.text;
}

/**
 * Transcribe an audio attachment through the /v1 front door (llama-swap routes
 * on the model form field). Transient failures retry in-job with bounded
 * backoff; exhaustion rethrows TransientTranscriptionError so the caller can
 * persist a `transient:` failure reason for later reconciliation.
 */
export async function transcribeAudioFile(opts: TranscribeOptions): Promise<TranscriptionResult> {
	const model = getAsrModel();
	if (!model) throw new TerminalTranscriptionError('asr_model is not configured');
	const baseUrl = getQmdBaseUrl();
	if (!baseUrl) throw new TransientTranscriptionError('inference endpoint is not configured');

	const fetchImpl = opts.fetchImpl ?? fetch;
	const delays = opts.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;
	const sleep = opts.sleep ?? defaultSleep;

	let lastTransient: TransientTranscriptionError | null = null;
	for (let attempt = 0; attempt <= delays.length; attempt++) {
		try {
			const text = await requestOnce(opts, baseUrl, model, fetchImpl);
			return { text, modelId: model };
		} catch (e) {
			if (e instanceof TransientTranscriptionError) {
				lastTransient = e;
				if (attempt < delays.length) await sleep(delays[attempt]);
				continue;
			}
			throw e;
		}
	}
	throw lastTransient ?? new TransientTranscriptionError('ASR retries exhausted');
}
