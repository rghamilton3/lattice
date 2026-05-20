const AGENT_TOKEN = process.env.LATTICE_AGENT_TOKEN ?? "";
const SIGNAL_PHONE = process.env.SIGNAL_PHONE_NUMBER ?? "";
const RPC_HOST = process.env.SIGNAL_RPC_HOST ?? "127.0.0.1:7583";
const SPINE_URL = "http://127.0.0.1:3000/api/agent/capture";

if (!AGENT_TOKEN) {
  console.error("[signal-relay] LATTICE_AGENT_TOKEN is required");
  process.exit(1);
}
if (!SIGNAL_PHONE) {
  console.error("[signal-relay] SIGNAL_PHONE_NUMBER is required");
  process.exit(1);
}

const colonIdx = RPC_HOST.lastIndexOf(":");
const hostname = RPC_HOST.slice(0, colonIdx);
const port = parseInt(RPC_HOST.slice(colonIdx + 1), 10);

let backoff = 1_000;

function connect(): void {
  let buffer = "";

  Bun.connect({
    hostname,
    port,
    socket: {
      open(socket) {
        console.log(`[signal-relay] connected to ${RPC_HOST}`);
        backoff = 1_000;
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
  const text = dataMessage?.message;
  if (typeof text !== "string" || !text.trim()) return;

  // Signal timestamps are Unix ms; fall back to now if absent.
  const ts = typeof envelope.timestamp === "number"
    ? new Date(envelope.timestamp).toISOString()
    : new Date().toISOString();

  postCapture(text, ts).catch((err: Error) =>
    console.error("[signal-relay] failed to post capture:", err.message)
  );
}

async function postCapture(text: string, captured_at: string): Promise<void> {
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
}

connect();
