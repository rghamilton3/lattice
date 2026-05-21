import { describe, expect, it } from "bun:test";
import {
  placeholderText,
  parseSignalMessage,
  isRpcError,
  type ParseSkipReason,
  type ParseDebugHook,
} from "../../src/signal/messages";

const SELF = "+15551234567";

function envelope(overrides: Record<string, unknown> = {}, dataMessage: unknown = null) {
  return {
    jsonrpc: "2.0",
    method: "receive",
    params: {
      envelope: {
        sourceNumber: SELF,
        timestamp: 1_700_000_000_000,
        dataMessage,
        ...overrides,
      },
    },
  };
}

describe("placeholderText", () => {
  it("labels audio attachments as voice notes", () => {
    expect(placeholderText([{ contentType: "audio/aac" }])).toBe("[voice note]");
  });

  it("uses filename when present", () => {
    expect(placeholderText([{ filename: "image.jpg" }])).toBe(
      "[attachment: image.jpg]"
    );
  });

  it("falls back to 'attachment' when no filename and no audio match", () => {
    expect(placeholderText([{ contentType: "image/png" }])).toBe("[attachment]");
  });

  it("joins multiple labels with commas", () => {
    expect(
      placeholderText([
        { contentType: "audio/aac" },
        { filename: "doc.pdf" },
        {},
      ])
    ).toBe("[voice note, attachment: doc.pdf, attachment]");
  });
});

describe("parseSignalMessage", () => {
  it("returns null for non-receive method", () => {
    const msg = envelope({}, { message: "hi" });
    msg.method = "send";
    expect(parseSignalMessage(msg, SELF)).toBeNull();
  });

  it("returns null when message is not an object", () => {
    expect(parseSignalMessage("string", SELF)).toBeNull();
    expect(parseSignalMessage(null, SELF)).toBeNull();
    expect(parseSignalMessage(42, SELF)).toBeNull();
  });

  it("returns null when envelope is missing", () => {
    const msg = { method: "receive", params: {} };
    expect(parseSignalMessage(msg, SELF)).toBeNull();
  });

  it("returns null when sourceNumber doesn't match self", () => {
    const msg = envelope({ sourceNumber: "+19999999999" }, { message: "hi" });
    expect(parseSignalMessage(msg, SELF)).toBeNull();
  });

  it("returns null when dataMessage is null", () => {
    const msg = envelope({}, null);
    expect(parseSignalMessage(msg, SELF)).toBeNull();
  });

  it("returns null when text is empty and no attachments", () => {
    const msg = envelope({}, { message: "   " });
    expect(parseSignalMessage(msg, SELF)).toBeNull();
  });

  it("parses a plain text message", () => {
    const msg = envelope({}, { message: "  hello world  " });
    const parsed = parseSignalMessage(msg, SELF);
    expect(parsed).toEqual({
      captureText: "hello world",
      capturedAt: new Date(1_700_000_000_000).toISOString(),
      attachments: [],
    });
  });

  it("uses placeholder text when message is empty but attachments are present", () => {
    const msg = envelope({}, {
      message: "",
      attachments: [{ contentType: "audio/aac" }],
    });
    const parsed = parseSignalMessage(msg, SELF);
    expect(parsed?.captureText).toBe("[voice note]");
    expect(parsed?.attachments.length).toBe(1);
  });

  it("uses real message when both text and attachments are present", () => {
    const msg = envelope({}, {
      message: "see attached",
      attachments: [{ filename: "doc.pdf" }],
    });
    const parsed = parseSignalMessage(msg, SELF);
    expect(parsed?.captureText).toBe("see attached");
    expect(parsed?.attachments.length).toBe(1);
  });

  it("falls back to current time when envelope.timestamp is missing", () => {
    const fixed = new Date("2026-05-21T12:00:00.000Z");
    const msg = envelope({ timestamp: undefined }, { message: "hi" });
    const parsed = parseSignalMessage(msg, SELF, () => fixed);
    expect(parsed?.capturedAt).toBe(fixed.toISOString());
  });
});

describe("parseSignalMessage debug hook", () => {
  function mkHook(): { reasons: ParseSkipReason[]; hook: ParseDebugHook } {
    const reasons: ParseSkipReason[] = [];
    return { reasons, hook: { skip: (r) => reasons.push(r) } };
  }

  it("reports each skip reason exactly once per invocation", () => {
    const cases: Array<[ParseSkipReason, unknown]> = [
      ["wrong-method", { method: "send", params: {} }],
      ["no-envelope", { method: "receive", params: {} }],
      ["wrong-sender", envelope({ sourceNumber: "+19999999999" }, { message: "hi" })],
      ["no-data-message", envelope({}, null)],
      ["empty-payload", envelope({}, { message: "   " })],
    ];
    for (const [expected, msg] of cases) {
      const { reasons, hook } = mkHook();
      expect(parseSignalMessage(msg, SELF, undefined, hook)).toBeNull();
      expect(reasons).toEqual([expected]);
    }
  });

  it("does not call skip on a successful parse", () => {
    const { reasons, hook } = mkHook();
    const msg = envelope({}, { message: "hi" });
    expect(parseSignalMessage(msg, SELF, undefined, hook)).not.toBeNull();
    expect(reasons).toEqual([]);
  });
});

describe("isRpcError", () => {
  it("returns true for objects with an error key", () => {
    expect(isRpcError({ error: { code: -1, message: "boom" } })).toBe(true);
  });

  it("returns false for non-objects", () => {
    expect(isRpcError(null)).toBe(false);
    expect(isRpcError("err")).toBe(false);
  });

  it("returns false when error is not an object", () => {
    expect(isRpcError({ error: "string" })).toBe(false);
  });
});
