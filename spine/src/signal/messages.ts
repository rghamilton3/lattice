export interface SignalAttachment {
  id?: string;
  contentType?: string;
  filename?: string;
  size?: number;
}

export interface ParsedSignalMessage {
  captureText: string;
  capturedAt: string;
  attachments: SignalAttachment[];
}

export function placeholderText(attachments: SignalAttachment[]): string {
  const labels = attachments.map((a) => {
    if (a.contentType?.startsWith("audio/")) return "voice note";
    return a.filename ? `attachment: ${a.filename}` : "attachment";
  });
  return `[${labels.join(", ")}]`;
}

// Inspect a Signal JSON-RPC frame and decide whether it should be relayed.
// Returns null on skip (wrong method, wrong sender, empty payload). Returns
// a normalized payload otherwise. `now` is injected so callers can use a clock
// for fallback timestamps.
export function parseSignalMessage(
  msg: unknown,
  selfNumber: string,
  now: () => Date = () => new Date()
): ParsedSignalMessage | null {
  if (
    typeof msg !== "object" ||
    msg === null ||
    (msg as Record<string, unknown>).method !== "receive"
  ) {
    return null;
  }

  const params = (msg as Record<string, unknown>).params as
    | Record<string, unknown>
    | undefined;
  const envelope = params?.envelope as Record<string, unknown> | undefined;
  if (!envelope) return null;
  if (envelope.sourceNumber !== selfNumber) return null;

  const dataMessage = envelope.dataMessage as Record<string, unknown> | null | undefined;
  if (!dataMessage) return null;

  const rawText = dataMessage.message;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const attachments =
    (dataMessage.attachments as SignalAttachment[] | null | undefined) ?? [];

  if (!text && attachments.length === 0) return null;

  const captureText = text || placeholderText(attachments);

  // Signal timestamps are Unix ms; fall back to now if absent.
  const capturedAt =
    typeof envelope.timestamp === "number"
      ? new Date(envelope.timestamp).toISOString()
      : now().toISOString();

  return { captureText, capturedAt, attachments };
}

// True when the frame appears to be a JSON-RPC error response (`error` key
// present) — callers may want to log these.
export function isRpcError(msg: unknown): boolean {
  return (
    typeof msg === "object" &&
    msg !== null &&
    typeof (msg as Record<string, unknown>).error === "object"
  );
}
