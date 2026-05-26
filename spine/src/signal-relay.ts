import {
	type SignalAttachment,
	type ParseDebugHook,
	parseSignalMessage,
	isRpcError,
} from './signal/messages';
import { realpath } from 'node:fs/promises';
import { resolve, sep } from 'node:path';

export interface RelayConfig {
	agentToken: string;
	signalPhone: string;
	rpcHost: string;
	spineUrl: string;
	signalAttachmentsDir: string;
}

export function loadRelayConfig(env: NodeJS.ProcessEnv = process.env): RelayConfig {
	return {
		agentToken: env.LATTICE_AGENT_TOKEN ?? '',
		signalPhone: env.SIGNAL_PHONE_NUMBER ?? '',
		rpcHost: env.SIGNAL_RPC_HOST ?? '127.0.0.1:7583',
		spineUrl: env.SPINE_URL ?? 'http://127.0.0.1:3000/api/agent/capture',
		signalAttachmentsDir: env.SIGNAL_ATTACHMENTS_DIR ?? '',
	};
}

export function validateRelayConfig(config: RelayConfig): string[] {
	const errors: string[] = [];
	if (!config.agentToken) errors.push('LATTICE_AGENT_TOKEN is required');
	if (!config.signalPhone) errors.push('SIGNAL_PHONE_NUMBER is required');
	return errors;
}

// Derive base URL from SPINE_URL for constructing attachment endpoint paths.
export function spineBaseFromCaptureUrl(spineUrl: string): string {
	return spineUrl.replace(/\/api\/agent\/capture$/, '');
}

let config = loadRelayConfig();

function parseRpcHost(rpcHost: string): { hostname: string; port: number } {
	const colonIdx = rpcHost.lastIndexOf(':');
	return {
		hostname: rpcHost.slice(0, colonIdx),
		port: parseInt(rpcHost.slice(colonIdx + 1), 10),
	};
}

// State machine invariant: at most one of {activeSocket, connecting,
// reconnectTimer} is set. The trio together prevents the runaway socket
// leak that took out the VPS: previously connectError + the outer
// Promise .catch each scheduled a retry, doubling parallel connects per
// failure until ephemeral ports were exhausted.
type RelaySocket = { write(data: string): number | void; end(): void };
let backoff = 1_000;
let activeSocket: RelaySocket | null = null;
let connecting = false;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

function sendReply(message: string): void {
	if (!activeSocket) return;
	const payload =
		JSON.stringify({
			jsonrpc: '2.0',
			method: 'send',
			id: Date.now(),
			params: { recipient: [config.signalPhone], message },
		}) + '\n';
	try {
		const wrote = activeSocket.write(payload);
		if (!wrote) {
			console.error('[signal-relay] reply write rejected (backpressure/closed), reply dropped');
		}
	} catch (err) {
		console.error('[signal-relay] failed to send reply:', (err as Error).message);
	}
}

// React to the original message so the user sees state directly in Signal:
// 👀 = relay parsed it, ✅ = spine saved it. Reactions are diagnostic — if
// the write fails we log and move on.
function sendReaction(emoji: string, targetAuthor: string, targetTimestamp: number): void {
	if (!activeSocket) return;
	const payload =
		JSON.stringify({
			jsonrpc: '2.0',
			method: 'sendReaction',
			id: Date.now(),
			params: {
				recipient: [config.signalPhone],
				emoji,
				targetAuthor,
				targetTimestamp,
			},
		}) + '\n';
	try {
		const wrote = activeSocket.write(payload);
		if (!wrote) {
			console.error(
				'[signal-relay] reaction write rejected (backpressure/closed), reaction dropped',
			);
		}
	} catch (err) {
		console.error('[signal-relay] failed to send reaction:', (err as Error).message);
	}
}

// De-duped reconnect scheduler. If a timer is already pending, callers
// from different failure paths (connectError + outer .catch, or close +
// error) collapse into one retry. Backoff doubles per failure, capped.
function scheduleReconnect(reason: string): void {
	if (reconnectTimer !== null) return;
	console.log(`[signal-relay] reconnect in ${backoff / 1000}s (${reason})`);
	const delay = backoff;
	backoff = Math.min(backoff * 2, 60_000);
	reconnectTimer = setTimeout(() => {
		reconnectTimer = null;
		connect();
	}, delay);
}

function connect(): void {
	if (connecting || activeSocket) return;
	connecting = true;
	let buffer = '';
	const { hostname, port } = parseRpcHost(config.rpcHost);

	Bun.connect({
		hostname,
		port,
		socket: {
			open(socket) {
				console.log(`[signal-relay] connected to ${config.rpcHost}`);
				backoff = 1_000;
				connecting = false;
				// Defensive: if somehow a stale socket survived, end it before
				// overwriting the reference so the kernel can release it.
				if (activeSocket) {
					try {
						activeSocket.end();
					} catch {
						/* ignore */
					}
				}
				activeSocket = socket;
				socket.write(JSON.stringify({ jsonrpc: '2.0', method: 'subscribeReceive', id: 1 }) + '\n');
			},

			data(_socket, data: Buffer) {
				buffer += data.toString('utf8');
				const lines = buffer.split('\n');
				buffer = lines.pop() ?? '';
				for (const line of lines) {
					const trimmed = line.trim();
					if (!trimmed) continue;
					try {
						handleMessage(JSON.parse(trimmed));
					} catch (err) {
						console.error(
							'[signal-relay] failed to parse line:',
							line.slice(0, 120),
							(err as Error).message,
						);
					}
				}
			},

			close() {
				activeSocket = null;
				connecting = false;
				console.log(`[signal-relay] disconnected`);
				scheduleReconnect('close');
			},

			error(socket, err: Error) {
				console.error('[signal-relay] socket error:', err.message);
				try {
					socket.end();
				} catch {
					/* ignore */
				}
				activeSocket = null;
				// close() will follow and schedule the reconnect.
			},

			connectError(_socket, err: Error) {
				console.error('[signal-relay] connect failed:', err.message);
				connecting = false;
				scheduleReconnect('connectError');
			},
		},
	}).catch((err: Error) => {
		// The TCP callbacks above usually handle failure, but Bun.connect's
		// returned promise can also reject (e.g. DNS error before a socket
		// exists). scheduleReconnect is idempotent so double-fire is safe.
		console.error('[signal-relay] connect error:', err.message);
		connecting = false;
		scheduleReconnect('promise-reject');
	});
}

const debugHook: ParseDebugHook | undefined =
	process.env.SIGNAL_RELAY_DEBUG === '1'
		? { skip: (reason) => console.debug(`[signal-relay] skipped: ${reason}`) }
		: undefined;

function handleMessage(msg: unknown): void {
	const parsed = parseSignalMessage(msg, config.signalPhone, undefined, debugHook);
	if (!parsed) {
		if (isRpcError(msg)) {
			console.error(
				'[signal-relay] RPC error:',
				JSON.stringify((msg as Record<string, unknown>).error),
			);
		}
		return;
	}

	sendReaction('👀', parsed.sourceNumber, parsed.sourceTimestamp);

	postCapture(parsed.captureText, parsed.capturedAt)
		.then((result) => {
			sendReaction('✅', parsed.sourceNumber, parsed.sourceTimestamp);
			if (parsed.attachments.length === 0 || !config.signalAttachmentsDir) return;
			for (const att of parsed.attachments) {
				postAttachment(result.id, att).catch((err: Error) =>
					console.error(`[signal-relay] failed to store attachment ${att.id}:`, err.message),
				);
			}
		})
		.catch((err: Error) => console.error('[signal-relay] failed to post capture:', err.message));
}

// Spine's agent guard enforces `X-Forwarded-Proto: https` as defense in
// depth — the assumption being that Caddy is the only legitimate way in.
// The relay runs on the same VPS host and hits spine over loopback, so it
// asserts the header itself: this is trusted local traffic that already
// holds the bearer token.
interface CaptureResult {
	id: number;
	triage_action: string | null;
	text: string;
}

async function postCapture(text: string, captured_at: string): Promise<CaptureResult> {
	const res = await fetch(config.spineUrl, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${config.agentToken}`,
			'x-forwarded-proto': 'https',
		},
		body: JSON.stringify({ text, source: 'signal', captured_at }),
	});

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`POST /api/agent/capture returned ${res.status}${body ? `: ${body}` : ''}`);
	}

	const result = (await res.json()) as CaptureResult;
	console.log(`[signal-relay] captured id=${result.id}: ${result.text.slice(0, 80)}`);

	if (result.triage_action === 'task') {
		sendReply(`Task queued: ${result.text}`);
	} else if (result.triage_action === 'keep') {
		sendReply(`Note saved: ${result.text}`);
	} else if (result.triage_action === 'skip') {
		// silent — no text reply for discarded captures
	} else {
		sendReply(`✓ #${result.id}`);
	}

	return result;
}

export async function resolveAttachmentPath(
	attachmentsDir: string,
	attachmentId: string,
): Promise<string> {
	if (!attachmentsDir) throw new Error('SIGNAL_ATTACHMENTS_DIR is not configured');
	if (!attachmentId || attachmentId.includes('\0')) throw new Error('attachment id is invalid');

	const base = await realpath(attachmentsDir);
	const candidate = resolve(base, attachmentId);
	const resolved = await realpath(candidate);
	const baseWithSep = base.endsWith(sep) ? base : `${base}${sep}`;
	if (resolved !== base && !resolved.startsWith(baseWithSep)) {
		throw new Error(`attachment path escapes configured directory: ${attachmentId}`);
	}
	return resolved;
}

export interface AttachmentUploadBody {
	signal_id: string;
	content_type: string;
	filename: string;
	data: string;
	size_bytes: number;
}

export async function buildAttachmentUploadBody(
	att: SignalAttachment & { id: string },
	filePath: string,
): Promise<AttachmentUploadBody> {
	const bytes = await Bun.file(filePath).arrayBuffer();
	return {
		signal_id: att.id,
		content_type: att.contentType ?? 'application/octet-stream',
		filename: att.filename ?? '',
		data: Buffer.from(bytes).toString('base64'),
		size_bytes: att.size ?? bytes.byteLength,
	};
}

export interface PostAttachmentOptions {
	attachmentsDir?: string;
	spineBase?: string;
	agentToken?: string;
	fetchImpl?: typeof fetch;
}

export async function postAttachment(
	captureId: number,
	att: SignalAttachment,
	options: PostAttachmentOptions = {},
): Promise<void> {
	if (!att.id) {
		console.warn('[signal-relay] attachment missing id, skipping');
		return;
	}

	const attachmentsDir = options.attachmentsDir ?? config.signalAttachmentsDir;
	const spineBase = options.spineBase ?? spineBaseFromCaptureUrl(config.spineUrl);
	const agentToken = options.agentToken ?? config.agentToken;
	const fetchImpl = options.fetchImpl ?? fetch;
	let body: AttachmentUploadBody;
	try {
		const filePath = await resolveAttachmentPath(attachmentsDir, att.id);
		body = await buildAttachmentUploadBody(att as SignalAttachment & { id: string }, filePath);
	} catch (err) {
		throw new Error(`could not read attachment ${att.id}: ${(err as Error).message}`);
	}

	const url = `${spineBase}/api/agent/capture/${captureId}/attachments`;

	const res = await fetchImpl(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${agentToken}`,
			'x-forwarded-proto': 'https',
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const responseBody = await res.text().catch(() => '');
		throw new Error(
			`POST /api/agent/capture/${captureId}/attachments returned ${res.status}${responseBody ? `: ${responseBody}` : ''}`,
		);
	}

	const { id } = (await res.json()) as { id: number };
	console.log(
		`[signal-relay] stored attachment id=${id} (${att.contentType ?? 'unknown'}) for capture id=${captureId}`,
	);
}

export function main(): void {
	config = loadRelayConfig();
	const errors = validateRelayConfig(config);
	for (const error of errors) {
		console.error(`[signal-relay] ${error}`);
	}
	if (errors.length > 0) process.exit(1);
	if (!config.signalAttachmentsDir) {
		console.warn('[signal-relay] SIGNAL_ATTACHMENTS_DIR not set - attachments will not be stored');
	}
	connect();
}

if (import.meta.main) {
	main();
}
