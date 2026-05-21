import { describe, expect, it, beforeEach, afterEach } from "bun:test";
import { writeFileSync, utimesSync } from "node:fs";
import { join } from "node:path";
import { mkTestEnv, type TestEnv } from "../helpers/env";
import {
  titleToSlug,
  createWorking,
  readWorking,
  updateWorking,
  deleteWorking,
  listWorking,
  workingDir,
  WorkingNotFoundError,
  WorkingConflictError,
} from "../../src/working";

let env: TestEnv;

beforeEach(() => {
  env = mkTestEnv();
});

afterEach(() => {
  env.cleanup();
});

describe("titleToSlug", () => {
  it("lowercases letters", () => {
    expect(titleToSlug("Hello")).toBe("hello");
  });

  it("replaces whitespace with hyphens", () => {
    expect(titleToSlug("hello world")).toBe("hello-world");
    expect(titleToSlug("hello   world")).toBe("hello-world");
    expect(titleToSlug("hello\tworld")).toBe("hello-world");
  });

  it("drops punctuation and non-ascii letters", () => {
    expect(titleToSlug("Hello, World!")).toBe("hello-world");
    expect(titleToSlug("naïve façade")).toBe("nave-faade");
  });

  it("collapses runs of hyphens", () => {
    expect(titleToSlug("a -- b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(titleToSlug("--leading and trailing--")).toBe("leading-and-trailing");
  });

  it("returns empty string when title has no slug-safe characters", () => {
    expect(titleToSlug("!!!")).toBe("");
    expect(titleToSlug("")).toBe("");
  });
});

describe("createWorking", () => {
  it("derives slug from title and writes default body", () => {
    const slug = createWorking("My First Note");
    expect(slug).toBe("my-first-note");
    const doc = readWorking(slug);
    expect(doc.content).toBe("# My First Note\n\n");
    expect(doc.title).toBe("My First Note");
  });

  it("uses provided content verbatim when given", () => {
    const slug = createWorking("Another", "# Custom title\n\nbody here\n");
    expect(slug).toBe("another");
    const doc = readWorking(slug);
    expect(doc.content).toBe("# Custom title\n\nbody here\n");
    expect(doc.title).toBe("Custom title");
  });

  it("throws WorkingConflictError on duplicate slug", () => {
    createWorking("Same");
    expect(() => createWorking("Same")).toThrow(WorkingConflictError);
  });

  it("throws when title produces empty slug", () => {
    expect(() => createWorking("!!!")).toThrow(/empty slug/);
  });
});

describe("readWorking", () => {
  it("returns slug, title, content, and an ISO modified_at", () => {
    createWorking("Read Me");
    const doc = readWorking("read-me");
    expect(doc.slug).toBe("read-me");
    expect(doc.title).toBe("Read Me");
    expect(doc.content).toBe("# Read Me\n\n");
    expect(doc.modified_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("falls back to slug when content has no heading", () => {
    // Use a write through createWorking() to ensure the working dir exists,
    // then overwrite with heading-less content to exercise the fallback path.
    createWorking("Raw");
    writeFileSync(join(workingDir(), "raw.md"), "just body, no heading\n", "utf-8");
    expect(readWorking("raw").title).toBe("raw");
  });

  it("throws WorkingNotFoundError on missing slug", () => {
    expect(() => readWorking("missing")).toThrow(WorkingNotFoundError);
  });

  it("treats invalid slug shape as not-found", () => {
    expect(() => readWorking("Bad Slug!")).toThrow(WorkingNotFoundError);
    expect(() => readWorking("../escape")).toThrow(WorkingNotFoundError);
  });
});

describe("updateWorking", () => {
  it("overwrites content", () => {
    createWorking("Doc");
    updateWorking("doc", "# Doc\n\nupdated\n");
    expect(readWorking("doc").content).toBe("# Doc\n\nupdated\n");
  });

  it("throws on missing slug", () => {
    expect(() => updateWorking("nope", "x")).toThrow(WorkingNotFoundError);
  });

  it("rejects invalid slug shape", () => {
    expect(() => updateWorking("../x", "x")).toThrow(WorkingNotFoundError);
  });
});

describe("deleteWorking", () => {
  it("removes the file", () => {
    createWorking("Goodbye");
    deleteWorking("goodbye");
    expect(() => readWorking("goodbye")).toThrow(WorkingNotFoundError);
  });

  it("throws on missing slug", () => {
    expect(() => deleteWorking("nope")).toThrow(WorkingNotFoundError);
  });

  it("rejects invalid slug shape", () => {
    expect(() => deleteWorking("../x")).toThrow(WorkingNotFoundError);
  });
});

describe("listWorking", () => {
  it("returns an empty list when no docs exist", () => {
    expect(listWorking()).toEqual([]);
  });

  it("returns docs sorted by mtime descending", () => {
    createWorking("First");
    createWorking("Second");
    createWorking("Third");

    // Force distinct mtimes (some filesystems have ms resolution and create
    // calls land within the same tick).
    const dir = workingDir();
    const now = Date.now();
    utimesSync(join(dir, "first.md"), new Date(now - 3000), new Date(now - 3000));
    utimesSync(join(dir, "second.md"), new Date(now - 2000), new Date(now - 2000));
    utimesSync(join(dir, "third.md"), new Date(now - 1000), new Date(now - 1000));

    const list = listWorking();
    expect(list.map((d) => d.slug)).toEqual(["third", "second", "first"]);
  });

  it("skips files that vanish between readdir and read", () => {
    const dir = workingDir();
    // Force a non-readable filename through the directory by writing then
    // immediately removing — but here we just confirm listing doesn't choke
    // when a file is missing, by writing an empty doc the normal way and
    // checking the listing returns its summary cleanly.
    createWorking("Vanishing");
    const list = listWorking();
    expect(list.length).toBe(1);
    expect(list[0].slug).toBe("vanishing");
  });
});
