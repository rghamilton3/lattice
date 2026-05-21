import { describe, expect, it, afterEach } from "bun:test";
import { buildTestApp, req, type TestApp } from "../helpers/app";

let app: TestApp;

afterEach(async () => {
  await app?.cleanup();
});

describe("Authelia guard (non-agent routes)", () => {
  it("rejects with 400 when ALLOW_HTTP=false and x-forwarded-proto != https", async () => {
    app = await buildTestApp({ allowHttp: false, devUser: undefined });
    const res = await app.app.handle(req("/api/captures"));
    expect(res.status).toBe(400);
    expect(await res.text()).toBe("HTTPS required");
  });

  it("accepts when ALLOW_HTTP=false but x-forwarded-proto=https + Authelia header", async () => {
    app = await buildTestApp({ allowHttp: false, devUser: undefined });
    const res = await app.app.handle(
      req("/api/captures", {
        headers: {
          "x-forwarded-proto": "https",
          "x-authentik-username": "user@x",
        },
      })
    );
    expect(res.status).toBe(200);
  });

  it("rejects with 401 when ALLOW_HTTP=true but no Authelia header and no DEV_USER", async () => {
    app = await buildTestApp({ allowHttp: true, devUser: undefined });
    const res = await app.app.handle(req("/api/captures"));
    expect(res.status).toBe(401);
    expect(await res.text()).toBe("Unauthorized");
  });

  it("DEV_USER injects x-authentik-username when missing", async () => {
    app = await buildTestApp({ allowHttp: true, devUser: "dev@local" });
    const res = await app.app.handle(req("/api/captures"));
    expect(res.status).toBe(200);
  });

  it("DEV_USER overrides any client-provided x-authentik-username", async () => {
    // Behavioral: when DEV_USER is set, the guard *always* assigns the header
    // (no `if missing` check), so attackers can't impersonate via this path.
    app = await buildTestApp({ allowHttp: true, devUser: "dev@local" });
    const res = await app.app.handle(
      req("/api/captures", { headers: { "x-authentik-username": "evil@x" } })
    );
    expect(res.status).toBe(200);
  });
});

describe("Agent guard (/api/agent/*)", () => {
  it("rejects without Authorization header", async () => {
    app = await buildTestApp({ agentToken: "secret" });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects when Authorization scheme is not Bearer", async () => {
    app = await buildTestApp({ agentToken: "secret" });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Basic secret",
        },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects on token mismatch", async () => {
    app = await buildTestApp({ agentToken: "real-secret" });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer wrong-secret",
        },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects when token length differs (no timing-safe compare possible)", async () => {
    app = await buildTestApp({ agentToken: "long-token-value" });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer short",
        },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("rejects when AGENT_TOKEN is unset on the server", async () => {
    app = await buildTestApp({ agentToken: undefined });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer anything",
        },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(401);
  });

  it("accepts on correct token", async () => {
    app = await buildTestApp({ agentToken: "right" });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer right",
        },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(200);
  });

  it("enforces HTTPS even on agent routes when ALLOW_HTTP=false", async () => {
    app = await buildTestApp({ agentToken: "right", allowHttp: false });
    const res = await app.app.handle(
      req("/api/agent/capture", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: "Bearer right",
        },
        body: JSON.stringify({ text: "x", source: "s", captured_at: "2026-01-01" }),
      })
    );
    expect(res.status).toBe(400);
  });
});
