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

let backoff = 1_000;
let activeSocket: { write(data: string): void } | null = null;

function sendReply(message: string): void {
  if (!activeSocket) return;
  activeSocket.write(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "send",
      id: Date.now(),
      params: { recipient: [SIGNAL_PHONE], message },
    }) + "\n"
  );
}

interface SignalAttachment {
  id?: string;
  contentType?: string;
  filename?: string;
  size?: number;
}

function placeholderText(attachments: SignalAttachment[]): string {
  const labels = attachments.map((a) => {
    if (a.contentType?.startsWith("audio/")) return "voice note";
    return a.filename ? `attachment: ${a.filename}` : "attachment";
  });
  return `[${labels.join(", ")}]`;
}

function connect(): void {
  let buffer = "";

  Bun.connect({
    hostname,
    port,
    socket: {
      open(socket) {
        console.log(`[signal-relay] connected to ${RPC_HOST}`);
        backoff = 1_000;
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
          } catch {
            console.error("[signal-relay] failed to parse line:", line.slice(0, 120));
          }
        }
      },

      close() {
        activeSocket = null;
        console.log(`[signal-relay] disconnected — retrying in ${backoff / 1000}s`);
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 60_000);
      },

      error(_socket, err: Error) {
        console.error("[signal-relay] socket error:", err.message);
      },

      connectError(_socket, err: Error) {
        console.error(`[signal-relay] connect failed — retrying in ${backoff / 1000}s:`, err.message);
        setTimeout(connect, backoff);
        backoff = Math.min(backoff * 2, 60_000);
      },
    },
  }).catch((err: Error) => {
    console.error(`[signal-relay] connect error — retrying in ${backoff / 1000}s:`, err.message);
    setTimeout(connect, backoff);
    backoff = Math.min(backoff * 2, 60_000);
  });
}

function handleMessage(msg: unknown): void {
  if (
    typeof msg !== "object" ||
    msg === null ||
    (msg as Record<string, unknown>).method !== "receive"
  ) {
    return;
  }

  const params = (msg as Record<string, unknown>).params as Record<string, unknown> | undefined;
  const envelope = params?.envelope as Record<string, unknown> | undefined;
  if (!envelope) return;

  if (envelope.sourceNumber !== SIGNAL_PHONE) return;

  const dataMessage = envelope.dataMessage as Record<string, unknown> | null | undefined;
  if (!dataMessage) return;

  const rawText = dataMessage.message;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const attachments = (dataMessage.attachments as SignalAttachment[] | null | undefined) ?? [];

  if (!text && attachments.length === 0) return;

  const captureText = text || placeholderText(attachments);

  // Signal timestamps are Unix ms; fall back to now if absent.
  const ts = typeof envelope.timestamp === "number"
    ? new Date(envelope.timestamp).toISOString()
    : new Date().toISOString();

  postCapture(captureText, ts)
    .then((captureId) => {
      if (attachments.length === 0 || !SIGNAL_ATTACHMENTS_DIR) return;
      for (const att of attachments) {
        postAttachment(captureId, att).catch((err: Error) =>
          console.error(`[signal-relay] failed to store attachment ${att.id}:`, err.message)
        );
      }
    })
    .catch((err: Error) =>
      console.error("[signal-relay] failed to post capture:", err.message)
    );
}

async function postCapture(text: string, captured_at: string): Promise<number> {
  const res = await fetch(SPINE_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${AGENT_TOKEN}`,
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
