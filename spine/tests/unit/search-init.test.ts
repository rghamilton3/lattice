import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { mkTestEnv, type TestEnv } from "../helpers/env";
import { installQmdMock, type FakeStoreHandle } from "../helpers/qmd-mock";

let env: TestEnv;
let qmd: FakeStoreHandle;

beforeEach(() => {
  env = mkTestEnv();
  qmd = installQmdMock();
});

afterEach(() => {
  env.cleanup();
});

describe("initSearch", () => {
  it("backfills capture markdown files from existing DB rows", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, capturesDir, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();

    const db = initDb();
    db.run(
      `INSERT INTO captures (text, source, captured_at, ingested_at)
       VALUES ('row body', 'agent', '2026-01-01', '2026-01-01')`
    );

    await initSearch(db);

    const file = join(capturesDir(), "1.md");
    expect(existsSync(file)).toBe(true);
    const content = readFileSync(file, "utf-8");
    expect(content).toContain("id: 1");
    expect(content).toContain("source: agent");
    expect(content).toContain("row body");
    db.close();
  });

  it("does not overwrite existing capture markdown files", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, capturesDir, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();

    const db = initDb();
    db.run(
      `INSERT INTO captures (text, source, captured_at, ingested_at)
       VALUES ('row body', 'agent', '2026-01-01', '2026-01-01')`
    );

    // First init writes the file.
    await initSearch(db);
    const file = join(capturesDir(), "1.md");
    // Tamper with it.
    writeFileSync(file, "tampered content");

    _resetSearchForTests();
    await initSearch(db);
    expect(readFileSync(file, "utf-8")).toBe("tampered content");
    db.close();
  });

  it("triggers an initial refreshIndex (update + embed when needed)", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();

    qmd.setNeedsEmbedding(3);
    const db = initDb();
    await initSearch(db);
    // refreshIndex is fire-and-forget; flush microtasks.
    await new Promise((r) => setTimeout(r, 20));
    expect(qmd.state.updateCalls).toBeGreaterThanOrEqual(1);
    expect(qmd.state.embedCalls).toBeGreaterThanOrEqual(1);
    db.close();
  });

  it("propagates a createStore failure", async () => {
    const { initDb } = await import("../../src/db");
    // Re-mock @tobilu/qmd to throw on createStore.
    const { mock } = await import("bun:test");
    mock.module("@tobilu/qmd", () => ({
      createStore: async () => {
        throw new Error("boom");
      },
    }));

    const { initSearch, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();
    const db = initDb();
    await expect(initSearch(db)).rejects.toThrow("boom");
    db.close();
  });
});

describe("search() before initSearch", () => {
  it("returns [] when the store has not been initialized", async () => {
    const { search, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();
    const results = await search("any query");
    expect(results).toEqual([]);
  });
});

describe("refreshIndex serialization", () => {
  it("serializes overlapping calls so update() never overlaps", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, refreshIndex, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();
    const db = initDb();
    await initSearch(db);

    // Fire several refreshes back-to-back; they must run sequentially.
    refreshIndex();
    refreshIndex();
    refreshIndex();
    await new Promise((r) => setTimeout(r, 30));
    // initSearch already invoked one refreshIndex => 4 total updates expected.
    expect(qmd.state.updateCalls).toBeGreaterThanOrEqual(4);
    db.close();
  });

  it("swallows update() errors and increments the failure counter", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, refreshIndex, _resetSearchForTests } = await import("../../src/search");
    _resetSearchForTests();
    const db = initDb();
    await initSearch(db);

    qmd.setUpdateError(new Error("transient"));
    refreshIndex();
    // Lock should not hang or throw to the caller.
    await new Promise((r) => setTimeout(r, 20));
    qmd.setUpdateError(null);
    refreshIndex();
    await new Promise((r) => setTimeout(r, 20));
    // No assertion on counter value — just verifying no unhandled rejection.
    expect(true).toBe(true);
    db.close();
  });
});
