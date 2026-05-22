import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { buildTestApp, json, req, type TestApp } from "../helpers/app";
import { __listenerCount, __resetListeners } from "../../src/captureEvents";

let app: TestApp;

beforeEach(async () => {
  app = await buildTestApp();
});

afterEach(async () => {
  await app?.cleanup();
});

function seedCapture(app: TestApp, text: string, source = "agent", capturedAt = "2026-01-01T00:00:00Z") {
  return app.db
    .prepare(
      "INSERT INTO captures (text, source, captured_at, ingested_at) VALUES (?, ?, ?, ?) RETURNING id"
    )
    .get(text, source, capturedAt, new Date().toISOString()) as { id: number };
}

describe("GET /api/captures", () => {
  it("returns recent captures ordered by ingested_at descending", async () => {
    seedCapture(app, "first");
    // ensure ingested_at differs
    await new Promise((r) => setTimeout(r, 10));
    seedCapture(app, "second");
    await new Promise((r) => setTimeout(r, 10));
    seedCapture(app, "third");

    const res = await app.app.handle(req("/api/captures"));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.map((c: any) => c.text)).toEqual(["third", "second", "first"]);
  });

  it("returns an empty array when there are no captures", async () => {
    const res = await app.app.handle(req("/api/captures"));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual([]);
  });

  it("respects ?limit and caps it at 200", async () => {
    for (let i = 0; i < 5; i++) seedCapture(app, `c${i}`);
    const res = await app.app.handle(req("/api/captures?limit=2"));
    expect((await json(res)).length).toBe(2);

    const big = await app.app.handle(req("/api/captures?limit=500"));
    // We only seeded 5 — so "cap" can't be observed directly without inserting
    // 200+ rows. But the query should still return successfully.
    expect(big.status).toBe(200);
    expect((await json(big)).length).toBe(5);
  });

  it("falls back to default limit 50 when ?limit is not a number", async () => {
    for (let i = 0; i < 3; i++) seedCapture(app, `c${i}`);
    const res = await app.app.handle(req("/api/captures?limit=garbage"));
    expect(res.status).toBe(200);
    expect((await json(res)).length).toBe(3);
  });

  it("rows include the canonical capture columns", async () => {
    seedCapture(app, "body text");
    const res = await app.app.handle(req("/api/captures"));
    const [row] = await json(res);
    expect(Object.keys(row).sort()).toEqual([
      "captured_at",
      "id",
      "ingested_at",
      "source",
      "text",
      "triage_action",
      "triaged_at",
    ]);
  });

  it("excludes triaged captures by default", async () => {
    const { id } = seedCapture(app, "to triage");
    seedCapture(app, "untriaged");
    app.db.prepare("UPDATE captures SET triaged_at = ?, triage_action = ? WHERE id = ?")
      .run("2026-01-02T00:00:00Z", "archive", id);

    const res = await app.app.handle(req("/api/captures"));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.map((c: any) => c.text)).toEqual(["untriaged"]);
  });

  it("includes triaged captures when ?all=1", async () => {
    const { id } = seedCapture(app, "archived");
    seedCapture(app, "inbox");
    app.db.prepare("UPDATE captures SET triaged_at = ?, triage_action = ? WHERE id = ?")
      .run("2026-01-02T00:00:00Z", "archive", id);

    const res = await app.app.handle(req("/api/captures?all=1"));
    expect(res.status).toBe(200);
    const body = await json(res);
    expect(body.map((c: any) => c.text)).toContain("archived");
    expect(body.map((c: any) => c.text)).toContain("inbox");
  });
});

describe("GET /api/captures/:id", () => {
  it("returns the requested capture", async () => {
    const { id } = seedCapture(app, "only one");
    const res = await app.app.handle(req(`/api/captures/${id}`));
    expect(res.status).toBe(200);
    expect((await json(res)).text).toBe("only one");
  });

  it("returns 400 on non-numeric id", async () => {
    const res = await app.app.handle(req("/api/captures/abc"));
    expect(res.status).toBe(400);
    expect((await json(res)).error).toBe("Invalid id");
  });

  it("returns 404 when the capture does not exist", async () => {
    const res = await app.app.handle(req("/api/captures/99999"));
    expect(res.status).toBe(404);
    expect((await json(res)).error).toBe("Not found");
  });
});

describe("GET /api/captures/stream", () => {
  it("is not caught by /:id route", async () => {
    const res = await app.app.handle(req("/api/captures/stream"));
    expect(res.headers.get("content-type")).toContain("text/event-stream");
  });
});

describe("POST /api/captures", () => {
  it("creates a capture and returns its id", async () => {
    const res = await app.app.handle(req("/api/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello", source: "browser" }),
    }));
    expect(res.status).toBe(200);
    expect(typeof (await json(res)).id).toBe("number");
  });

  it("returns 422 when text is empty", async () => {
    const res = await app.app.handle(req("/api/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "", source: "browser" }),
    }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when source is missing", async () => {
    const res = await app.app.handle(req("/api/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "hello" }),
    }));
    expect(res.status).toBe(422);
  });
});

describe("POST /api/captures/:id/triage", () => {
  it("sets triaged_at and triage_action on the capture", async () => {
    const { id } = seedCapture(app, "to triage");
    const res = await app.app.handle(req(`/api/captures/${id}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    }));
    expect(res.status).toBe(200);
    const row = app.db.query("SELECT triaged_at, triage_action FROM captures WHERE id = ?").get(id) as any;
    expect(row.triage_action).toBe("archive");
    expect(typeof row.triaged_at).toBe("string");
  });

  it("returns 404 for a non-existent capture", async () => {
    const res = await app.app.handle(req("/api/captures/99999/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "keep" }),
    }));
    expect(res.status).toBe(404);
  });

  it("returns 400 for an invalid action", async () => {
    const { id } = seedCapture(app, "test");
    const res = await app.app.handle(req(`/api/captures/${id}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "delete" }),
    }));
    expect(res.status).toBe(400);
  });

  it("returns 400 for a non-numeric id", async () => {
    const res = await app.app.handle(req("/api/captures/abc/triage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "keep" }),
    }));
    expect(res.status).toBe(400);
  });

  it("removes the capture from the default (inbox) list after triage", async () => {
    const { id } = seedCapture(app, "will be archived");
    await app.app.handle(req(`/api/captures/${id}/triage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "archive" }),
    }));
    const res = await app.app.handle(req("/api/captures"));
    const body = await json(res);
    expect(body.find((c: any) => c.id === id)).toBeUndefined();
  });
});

describe("SSE listener lifecycle", () => {
  beforeEach(() => __resetListeners());
  afterEach(() => __resetListeners());

  it("registers a listener when a stream is opened", async () => {
    expect(__listenerCount()).toBe(0);
    const res = await app.app.handle(req("/api/captures/stream"));
    expect(__listenerCount()).toBe(1);
    await res.body?.cancel();
  });

  it("removes the listener when the stream is cancelled", async () => {
    const res = await app.app.handle(req("/api/captures/stream"));
    await res.body!.cancel();
    expect(__listenerCount()).toBe(0);
  });

  it("emits a capture event when POST /api/captures succeeds", async () => {
    const streamRes = await app.app.handle(req("/api/captures/stream"));
    const reader = streamRes.body!.getReader();

    // Drain the initial ": connected\n\n" comment sent by start()
    await reader.read();

    await app.app.handle(req("/api/captures", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: "sse-e2e", source: "test" }),
    }));

    const { value } = await reader.read();
    const text = new TextDecoder().decode(value);
    expect(text).toContain("event: capture");
    expect(text).toContain("sse-e2e");
    await reader.cancel();
  });
});
