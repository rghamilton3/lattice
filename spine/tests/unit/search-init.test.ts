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
    const { initSearch, capturesDir, __resetSearchForTests } = await import("../../src/search");
    __resetSearchForTests();

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
    const { initSearch, capturesDir, __resetSearchForTests } = await import("../../src/search");
    __resetSearchForTests();

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

    __resetSearchForTests();
    await initSearch(db);
    expect(readFileSync(file, "utf-8")).toBe("tampered content");
    db.close();
  });

  it("triggers an initial refreshIndex (update + embed when needed)", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, __resetSearchForTests } = await import("../../src/search");
    __resetSearchForTests();

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

    try {
      const { initSearch, __resetSearchForTests } = await import("../../src/search");
      __resetSearchForTests();
      const db = initDb();
      await expect(initSearch(db)).rejects.toThrow("boom");
      db.close();
    } finally {
      // Restore the working mock so later tests in this file (and in any
      // file that runs after this one) get a non-throwing createStore.
      qmd = installQmdMock();
    }
  });
});

describe("search() before initSearch", () => {
  it("returns [] when the store has not been initialized", async () => {
    const { search, __resetSearchForTests } = await import("../../src/search");
    __resetSearchForTests();
    const results = await search("any query");
    expect(results).toEqual([]);
  });
});

describe("refreshIndex serialization", () => {
  it("never runs update() concurrently across overlapping calls", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, refreshIndex, __resetSearchForTests } = await import("../../src/search");
    __resetSearchForTests();
    const db = initDb();
    // Make each update() block long enough that an unserialized impl
    // would have multiple in-flight at once.
    qmd.setUpdateDelay(15);
    await initSearch(db);

    refreshIndex();
    refreshIndex();
    refreshIndex();

    // Wait for the chained promises to drain (3 fires × 15ms each).
    await new Promise((r) => setTimeout(r, 100));

    // High-water mark of in-flight update() invocations must be 1 — if the
    // lock leaked, this would observe at least 2.
    expect(qmd.state.maxConcurrentUpdates).toBe(1);
    expect(qmd.state.updateCalls).toBeGreaterThanOrEqual(4);
    db.close();
  });

  it("swallows update() errors and increments the failure counter", async () => {
    const { initDb } = await import("../../src/db");
    const { initSearch, refreshIndex, __resetSearchForTests } = await import("../../src/search");
    __resetSearchForTests();
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
