import { describe, expect, it, afterEach } from "bun:test";
import { buildTestApp, json, req, type TestApp } from "../helpers/app";

let app: TestApp;

afterEach(async () => {
  await app?.cleanup();
});

describe("GET /ping", () => {
  it("returns { ok: true } without any auth headers", async () => {
    app = await buildTestApp({ allowHttp: false, devUser: undefined });
    const res = await app.app.handle(req("/ping"));
    expect(res.status).toBe(200);
    expect(await json(res)).toEqual({ ok: true });
  });
});
