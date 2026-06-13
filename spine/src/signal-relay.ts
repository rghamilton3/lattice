import {
	type SignalAttachment,
	type ParseDebugHook,
	parseSignalMessage,
	isRpcError,
} from './signal/messages';
import { type NotificationPosture } from './archiveEvents';
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
	return spineUrl.replace(/\/api\/agent\/(capture|track)$/, '');
}

export type SignalReplyEvent = 'failure' | 'classifier' | 'fallback';

export function signalNotificationPosture(): NotificationPosture {
	const v = process.env.SIGNAL_NOTIFICATION_POSTURE;
	if (v !== undefined && v !== 'quiet' && v !== 'standard' && v !== 'active') {
		console.warn(
			`[signal-relay] unknown SIGNAL_NOTIFICATION_POSTURE value "${v}", defaulting to standard`,
		);
	}
	return v === 'quiet' || v === 'standard' || v === 'active' ? v : 'standard';
}

export function shouldSendSignalReply(
	posture: NotificationPosture,
	event: SignalReplyEvent,
): boolean {
	if (posture === 'quiet') return false;
	if (event === 'fallback') return posture === 'active';
	return true;
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

	if (parsed.action === 'list-tasks') {
		fetchTasks()
			.then((tasks) => {
				sendReaction('✅', parsed.sourceNumber, parsed.sourceTimestamp);
				sendReply(formatTaskList(tasks));
			})
			.catch((err: Error) => {
				console.error('[signal-relay] failed to fetch tasks:', err.message);
				sendReply('Could not fetch tasks — check spine connectivity.');
			});
		return;
	}

	const posture = signalNotificationPosture();
	const post =
		parsed.action === 'track'
			? postTrack(
					{
						text: parsed.trackText ?? parsed.captureText,
						captured_at: parsed.capturedAt,
						displaced: parsed.displaced,
						photo_ref: firstImageAttachmentId(parsed.attachments),
					},
					{ notificationPosture: posture },
				)
			: postCapture(parsed.captureText, parsed.capturedAt, { notificationPosture: posture });

	post
		.then((result) => {
			sendReaction('✅', parsed.sourceNumber, parsed.sourceTimestamp);
			if (
				parsed.action === 'track' ||
				parsed.attachments.length === 0 ||
				!config.signalAttachmentsDir
			)
				return;
			for (const att of parsed.attachments) {
				postAttachment(result.id, att).catch((err: Error) => {
					console.error(`[signal-relay] failed to store attachment ${att.id}:`, err.message);
					if (shouldSendSignalReply(posture, 'failure'))
						sendReply(
							`⚠️ Attachment save failed (capture #${result.id}): ${err.message.slice(0, 80)}`,
						);
				});
			}
		})
		.catch((err: Error) => {
			console.error('[signal-relay] failed to post message:', err.message);
			if (shouldSendSignalReply(posture, 'failure')) {
				const label = parsed.action === 'track' ? 'Track failed' : 'Capture failed';
				sendReply(`⚠️ ${label}: ${err.message.slice(0, 120)}`);
			}
		});
}

export interface TaskItem {
	id: number;
	text: string;
	task_priority: string | null;
	task_due_date: string | null;
}

export async function fetchTasks(options: PostMessageOptions = {}): Promise<TaskItem[]> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const spineBase =
		options.spineBase ?? spineBaseFromCaptureUrl(options.spineUrl ?? config.spineUrl);
	const res = await fetchImpl(`${spineBase}/api/agent/tasks`, {
		headers: {
			authorization: `Bearer ${options.agentToken ?? config.agentToken}`,
			'x-forwarded-proto': 'https',
		},
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`GET /api/agent/tasks returned ${res.status}${body ? `: ${body}` : ''}`);
	}
	return (await res.json()) as TaskItem[];
}

export function formatTaskList(tasks: TaskItem[]): string {
	if (tasks.length === 0) return 'No active tasks.';
	// TODO: paginate if tasks.length > N to avoid Signal message size limits
	const lines = tasks.map((t, i) => {
		let line = `${i + 1}. ${t.text}`;
		if (t.task_due_date) line += ` (due ${t.task_due_date})`;
		return line;
	});
	return `Tasks (${tasks.length}):\n${lines.join('\n')}`;
}

export function firstImageAttachmentId(attachments: SignalAttachment[]): string | null {
	return attachments.find((att) => att.id && att.contentType?.startsWith('image/'))?.id ?? null;
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

export interface PostMessageOptions {
	spineUrl?: string;
	spineBase?: string;
	agentToken?: string;
	notificationPosture?: NotificationPosture;
	fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
	retryDelaysMs?: number[];
	sleep?: (ms: number) => Promise<void>;
}

// SR-5: a voice note is not handled until the spine durably accepts it. The
// spine sharing this host means outages are momentary (restarts, deploys);
// bounded backoff covers them without a durable spool. signal-cli's attachment
// directory keeps the bytes on disk throughout.
const SPINE_RETRY_DELAYS_MS = [5_000, 15_000, 45_000];

export async function fetchWithSpineRetry(
	fetchImpl: (input: string | URL | Request, init?: RequestInit) => Promise<Response>,
	input: string | URL | Request,
	init?: RequestInit,
	delaysMs: number[] = SPINE_RETRY_DELAYS_MS,
	sleep: (ms: number) => Promise<void> = (ms) => new Promise((r) => setTimeout(r, ms)),
): Promise<Response> {
	let lastError: unknown = null;
	for (let attempt = 0; attempt <= delaysMs.length; attempt++) {
		try {
			const res = await fetchImpl(input, init);
			// 5xx means the spine is up but unhealthy; 4xx is our bug, not retryable.
			if (res.status >= 500 && attempt < delaysMs.length) {
				lastError = new Error(`spine returned ${res.status}`);
				await sleep(delaysMs[attempt]);
				continue;
			}
			return res;
		} catch (e) {
			lastError = e;
			if (attempt < delaysMs.length) {
				console.warn(`[signal-relay] spine unreachable (attempt ${attempt + 1}):`, e);
				await sleep(delaysMs[attempt]);
			}
		}
	}
	throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

export async function postCapture(
	text: string,
	captured_at: string,
	options: PostMessageOptions = {},
): Promise<CaptureResult> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const res = await fetchWithSpineRetry(
		fetchImpl,
		options.spineUrl ?? config.spineUrl,
		{
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${options.agentToken ?? config.agentToken}`,
				'x-forwarded-proto': 'https',
			},
			body: JSON.stringify({ text, source: 'signal', captured_at }),
		},
		options.retryDelaysMs,
		options.sleep,
	);

	if (!res.ok) {
		const body = await res.text().catch(() => '');
		throw new Error(`POST /api/agent/capture returned ${res.status}${body ? `: ${body}` : ''}`);
	}

	const result = (await res.json()) as CaptureResult;
	console.log(`[signal-relay] captured id=${result.id}: ${result.text.slice(0, 80)}`);

	const posture = options.notificationPosture ?? signalNotificationPosture();
	if (result.triage_action === 'task') {
		if (shouldSendSignalReply(posture, 'classifier')) sendReply(`Task queued: ${result.text}`);
	} else if (result.triage_action === 'keep') {
		if (shouldSendSignalReply(posture, 'classifier')) sendReply(`Note saved: ${result.text}`);
	} else if (result.triage_action === 'promote') {
		if (shouldSendSignalReply(posture, 'classifier')) sendReply(`Promoted to doc: ${result.text}`);
	} else if (result.triage_action === 'skip') {
		// intentionally silent
	} else {
		if (shouldSendSignalReply(posture, 'fallback')) sendReply(`✓ #${result.id}`);
	}

	return result;
}

export interface TrackPostBody {
	text: string;
	captured_at: string;
	displaced: boolean;
	photo_ref?: string | null;
}

export async function postTrack(
	body: TrackPostBody,
	options: PostMessageOptions = {},
): Promise<{ id: number }> {
	const fetchImpl = options.fetchImpl ?? fetch;
	const spineBase =
		options.spineBase ?? spineBaseFromCaptureUrl(options.spineUrl ?? config.spineUrl);
	const source = body.photo_ref ? 'signal-photo' : 'signal-text';
	const res = await fetchImpl(`${spineBase}/api/agent/track`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${options.agentToken ?? config.agentToken}`,
			'x-forwarded-proto': 'https',
		},
		body: JSON.stringify({ ...body, source }),
	});

	if (!res.ok) {
		const responseBody = await res.text().catch(() => '');
		throw new Error(
			`POST /api/agent/track returned ${res.status}${responseBody ? `: ${responseBody}` : ''}`,
		);
	}

	const result = (await res.json()) as { id: number };
	console.log(`[signal-relay] tracked id=${result.id}: ${body.text.slice(0, 80)}`);
	const posture = options.notificationPosture ?? signalNotificationPosture();
	if (shouldSendSignalReply(posture, 'classifier')) sendReply(`Tracked: ${body.text}`);
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
	fetchImpl?: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
	retryDelaysMs?: number[];
	sleep?: (ms: number) => Promise<void>;
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

	const res = await fetchWithSpineRetry(
		fetchImpl,
		url,
		{
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${agentToken}`,
				'x-forwarded-proto': 'https',
			},
			body: JSON.stringify(body),
		},
		options.retryDelaysMs,
		options.sleep,
	);

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
