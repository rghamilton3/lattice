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
  // Fields needed to target this message with a reaction. `sourceTimestamp`
  // is the raw Signal Unix-ms value — reactions need it verbatim, not the
  // ISO string we expose via capturedAt.
  sourceNumber: string;
  sourceTimestamp: number;
}

export type ParseSkipReason =
  | "wrong-method"
  | "no-envelope"
  | "wrong-sender"
  | "no-data-message"
  | "empty-payload";

export interface ParseDebugHook {
  skip(reason: ParseSkipReason): void;
}

/** @internal */
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
// for fallback timestamps. Pass `debug` to distinguish skip reasons — Signal
// CLI envelope changes show up as a sudden spike in one bucket.
export function parseSignalMessage(
  msg: unknown,
  selfNumber: string,
  now: () => Date = () => new Date(),
  debug?: ParseDebugHook
): ParsedSignalMessage | null {
  if (
    typeof msg !== "object" ||
    msg === null ||
    (msg as Record<string, unknown>).method !== "receive"
  ) {
    debug?.skip("wrong-method");
    return null;
  }

  const params = (msg as Record<string, unknown>).params as
    | Record<string, unknown>
    | undefined;
  const envelope = params?.envelope as Record<string, unknown> | undefined;
  if (!envelope) {
    debug?.skip("no-envelope");
    return null;
  }
  if (envelope.sourceNumber !== selfNumber) {
    debug?.skip("wrong-sender");
    return null;
  }

  const dataMessage = envelope.dataMessage as Record<string, unknown> | null | undefined;
  if (!dataMessage) {
    debug?.skip("no-data-message");
    return null;
  }

  const rawText = dataMessage.message;
  const text = typeof rawText === "string" ? rawText.trim() : "";
  const attachments =
    (dataMessage.attachments as SignalAttachment[] | null | undefined) ?? [];

  if (!text && attachments.length === 0) {
    debug?.skip("empty-payload");
    return null;
  }

  const captureText = text || placeholderText(attachments);

  // Signal timestamps are Unix ms; fall back to now if absent.
  const sourceTimestamp =
    typeof envelope.timestamp === "number" ? envelope.timestamp : now().getTime();
  const capturedAt = new Date(sourceTimestamp).toISOString();

  return {
    captureText,
    capturedAt,
    attachments,
    sourceNumber: envelope.sourceNumber as string,
    sourceTimestamp,
  };
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
