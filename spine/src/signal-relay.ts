import {
  type SignalAttachment,
  type ParseDebugHook,
  parseSignalMessage,
  isRpcError,
} from "./signal/messages";

const AGENT_TOKEN = process.env.LATTICE_AGENT_TOKEN ?? "";
const SIGNAL_PHONE = process.env.SIGNAL_PHONE_NUMBER ?? "";
const RPC_HOST = process.env.SIGNAL_RPC_HOST ?? "127.0.0.1:7583";
const SPINE_URL = process.env.SPINE_URL ?? "http://127.0.0.1:3000/api/agent/capture";
const SIGNAL_ATTACHMENTS_DIR = process.env.SIGNAL_ATTACHMENTS_DIR ?? "";

if (!AGENT_TOKEN) {
  console.error("[signal-relay] LATTICE_AGENT_TOKEN is required");
  process.exit(1);
}
if (!SIGNAL_PHONE) {
  console.error("[signal-relay] SIGNAL_PHONE_NUMBER is required");
  process.exit(1);
}
if (!SIGNAL_ATTACHMENTS_DIR) {
  console.warn("[signal-relay] SIGNAL_ATTACHMENTS_DIR not set — attachments will not be stored");
}

// Derive base URL from SPINE_URL for constructing attachment endpoint paths.
const SPINE_BASE = SPINE_URL.replace(/\/api\/agent\/capture$/, "");

const colonIdx = RPC_HOST.lastIndexOf(":");
const hostname = RPC_HOST.slice(0, colonIdx);
const port = parseInt(RPC_HOST.slice(colonIdx + 1), 10);

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
      jsonrpc: "2.0",
      method: "send",
      id: Date.now(),
      params: { recipient: [SIGNAL_PHONE], message },
    }) + "\n";
  try {
    const wrote = activeSocket.write(payload);
    if (!wrote) {
      console.error("[signal-relay] reply write rejected (backpressure/closed), reply dropped");
    }
  } catch (err) {
    console.error("[signal-relay] failed to send reply:", (err as Error).message);
  }
}

// React to the original message so the user sees state directly in Signal:
// 👀 = relay parsed it, ✅ = spine saved it. Reactions are diagnostic — if
// the write fails we log and move on.
function sendReaction(emoji: string, targetAuthor: string, targetTimestamp: number): void {
  if (!activeSocket) return;
  const payload =
    JSON.stringify({
      jsonrpc: "2.0",
      method: "sendReaction",
      id: Date.now(),
      params: {
        recipient: [SIGNAL_PHONE],
        emoji,
        targetAuthor,
        targetTimestamp,
      },
    }) + "\n";
  try {
    const wrote = activeSocket.write(payload);
    if (!wrote) {
      console.error("[signal-relay] reaction write rejected (backpressure/closed), reaction dropped");
    }
  } catch (err) {
    console.error("[signal-relay] failed to send reaction:", (err as Error).message);
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
  let buffer = "";

  Bun.connect({
    hostname,
    port,
    socket: {
      open(socket) {
        console.log(`[signal-relay] connected to ${RPC_HOST}`);
        backoff = 1_000;
        connecting = false;
        // Defensive: if somehow a stale socket survived, end it before
        // overwriting the reference so the kernel can release it.
        if (activeSocket) {
          try { activeSocket.end(); } catch { /* ignore */ }
        }
        activeSocket = socket;
        socket.write(
          JSON.stringify({ jsonrpc: "2.0", method: "subscribeReceive", id: 1 }) + "\n"
        );
      },

      data(_socket, data: Buffer) {
        buffer += data.toString("utf8");
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            handleMessage(JSON.parse(trimmed));
          } catch (err) {
            console.error(
              "[signal-relay] failed to parse line:",
              line.slice(0, 120),
              (err as Error).message
            );
          }
        }
      },

      close() {
        activeSocket = null;
        connecting = false;
        console.log(`[signal-relay] disconnected`);
        scheduleReconnect("close");
      },

      error(socket, err: Error) {
        console.error("[signal-relay] socket error:", err.message);
        try { socket.end(); } catch { /* ignore */ }
        activeSocket = null;
        // close() will follow and schedule the reconnect.
      },

      connectError(_socket, err: Error) {
        console.error("[signal-relay] connect failed:", err.message);
        connecting = false;
        scheduleReconnect("connectError");
      },
    },
  }).catch((err: Error) => {
    // The TCP callbacks above usually handle failure, but Bun.connect's
    // returned promise can also reject (e.g. DNS error before a socket
    // exists). scheduleReconnect is idempotent so double-fire is safe.
    console.error("[signal-relay] connect error:", err.message);
    connecting = false;
    scheduleReconnect("promise-reject");
  });
}

const debugHook: ParseDebugHook | undefined =
  process.env.SIGNAL_RELAY_DEBUG === "1"
    ? { skip: (reason) => console.debug(`[signal-relay] skipped: ${reason}`) }
    : undefined;

function handleMessage(msg: unknown): void {
  const parsed = parseSignalMessage(msg, SIGNAL_PHONE, undefined, debugHook);
  if (!parsed) {
    if (isRpcError(msg)) {
      console.error("[signal-relay] RPC error:", JSON.stringify((msg as Record<string, unknown>).error));
    }
    return;
  }

  sendReaction("👀", parsed.sourceNumber, parsed.sourceTimestamp);

  postCapture(parsed.captureText, parsed.capturedAt)
    .then((captureId) => {
      sendReaction("✅", parsed.sourceNumber, parsed.sourceTimestamp);
      if (parsed.attachments.length === 0 || !SIGNAL_ATTACHMENTS_DIR) return;
      for (const att of parsed.attachments) {
        postAttachment(captureId, att).catch((err: Error) =>
          console.error(`[signal-relay] failed to store attachment ${att.id}:`, err.message)
        );
      }
    })
    .catch((err: Error) =>
      console.error("[signal-relay] failed to post capture:", err.message)
    );
}

// Spine's agent guard enforces `X-Forwarded-Proto: https` as defense in
// depth — the assumption being that Caddy is the only legitimate way in.
// The relay runs on the same VPS host and hits spine over loopback, so it
// asserts the header itself: this is trusted local traffic that already
// holds the bearer token.
async function postCapture(text: string, captured_at: string): Promise<number> {
  const res = await fetch(SPINE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${AGENT_TOKEN}`,
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({ text, source: "signal", captured_at }),
  });

  if (!res.ok) {
    throw new Error(`POST /api/agent/capture returned ${res.status}`);
  }

  const { id } = (await res.json()) as { id: number };
  console.log(`[signal-relay] captured id=${id}: ${text.slice(0, 80)}`);
  sendReply(`✓ #${id}`);
  return id;
}

async function postAttachment(captureId: number, att: SignalAttachment): Promise<void> {
  if (!att.id) {
    console.warn("[signal-relay] attachment missing id, skipping");
    return;
  }

  const filePath = `${SIGNAL_ATTACHMENTS_DIR}/${att.id}`;
  let bytes: ArrayBuffer;
  try {
    bytes = await Bun.file(filePath).arrayBuffer();
  } catch (err) {
    throw new Error(`could not read ${filePath}: ${(err as Error).message}`);
  }

  const data = Buffer.from(bytes).toString("base64");
  const url = `${SPINE_BASE}/api/agent/capture/${captureId}/attachments`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${AGENT_TOKEN}`,
      "x-forwarded-proto": "https",
    },
    body: JSON.stringify({
      signal_id: att.id,
      content_type: att.contentType ?? "application/octet-stream",
      filename: att.filename ?? "",
      data,
      size_bytes: att.size ?? bytes.byteLength,
    }),
  });

  if (!res.ok) {
    throw new Error(`POST /api/agent/capture/${captureId}/attachments returned ${res.status}`);
  }

  const { id } = (await res.json()) as { id: number };
  console.log(
    `[signal-relay] stored attachment id=${id} (${att.contentType ?? "unknown"}) for capture id=${captureId}`
  );
}

connect();
