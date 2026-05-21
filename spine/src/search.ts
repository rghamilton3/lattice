import { createStore } from "@tobilu/qmd";
import type { QMDStore } from "@tobilu/qmd";
import type { Database } from "bun:sqlite";
import { join, dirname, basename, resolve } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";
import { WORKING_DIR } from "./working";

interface CaptureData {
  id: number;
  text: string;
  source: string;
  captured_at: string;
}

export interface SearchResult {
  id: number;
  score: number;
  snippet: string;
  body: string;
  path: string;
  kind: "capture" | "local-file" | "working";
  machine_id?: string;
  slug?: string;
}

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./lattice.dev.db");
const CAPTURES_DIR = join(dirname(DB_PATH), "captures");
export const LOCAL_FILES_DIR = join(dirname(DB_PATH), "local-files");
const QMD_DB_PATH = join(dirname(DB_PATH), "lattice.qmd.db");

function sanitize(s: string): string {
  return s.replace(/[\r\n]/g, " ");
}

function captureToMarkdown({ id, text, source, captured_at }: CaptureData): string {
  return `---\nid: ${id}\nsource: ${sanitize(source)}\ncaptured_at: ${sanitize(captured_at)}\n---\n\n${text}\n`;
}

function localFileToMarkdown(machineId: string, path: string, text: string): string {
  return `---\nmachine_id: ${sanitize(machineId)}\npath: ${sanitize(path)}\n---\n\n${text}\n`;
}

let _store: QMDStore | null = null;
// Serial lock: ensures update() and embed() calls never overlap.
let _indexLock: Promise<void> = Promise.resolve();

export async function initSearch(db: Database): Promise<void> {
  mkdirSync(CAPTURES_DIR, { recursive: true });
  mkdirSync(LOCAL_FILES_DIR, { recursive: true });

  const rows = db
    .query("SELECT id, text, source, captured_at FROM captures")
    .all() as CaptureData[];

  for (const row of rows) {
    const filePath = join(CAPTURES_DIR, `${row.id}.md`);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, captureToMarkdown(row));
    }
  }

  _store = await createStore({
    dbPath: QMD_DB_PATH,
    config: {
      collections: {
        captures: { path: CAPTURES_DIR, pattern: "**/*.md" },
        working: { path: WORKING_DIR, pattern: "**/*.md" },
        "local-files": { path: LOCAL_FILES_DIR, pattern: "**/*.md" },
      },
    },
  });

  refreshIndex();
}

export function writeCaptureFile(
  id: number,
  text: string,
  source: string,
  captured_at: string
): void {
  writeFileSync(
    join(CAPTURES_DIR, `${id}.md`),
    captureToMarkdown({ id, text, source, captured_at })
  );
}

export function writeLocalFile(machineId: string, path: string, hash: string, text: string): void {
  const machineDir = join(LOCAL_FILES_DIR, machineId);
  mkdirSync(machineDir, { recursive: true });
  writeFileSync(join(machineDir, `${hash}.md`), localFileToMarkdown(machineId, path, text));
}

export function refreshIndex(): void {
  if (!_store) return;
  const store = _store;
  _indexLock = _indexLock
    .then(async () => {
      const result = await store.update();
      if (result.needsEmbedding > 0) {
        await store.embed();
      }
    })
    .catch((e) => console.error("[qmd] index refresh failed:", e));
}

export async function search(q: string): Promise<SearchResult[]> {
  if (!_store) return [];
  const results = await _store.search({ query: q, limit: 20 });
  return results.flatMap((r) => {
    if (r.file.startsWith(CAPTURES_DIR + "/")) {
      const id = parseInt(basename(r.file, ".md"), 10);
      if (isNaN(id)) return [];
      return [
        {
          id,
          score: r.score,
          snippet: r.bestChunk,
          body: r.body,
          path: r.displayPath,
          kind: "capture" as const,
        },
      ];
    }
    if (r.file.startsWith(WORKING_DIR + "/")) {
      const slug = basename(r.file, ".md");
      return [
        {
          id: 0,
          score: r.score,
          snippet: r.bestChunk,
          body: r.body,
          path: r.displayPath,
          kind: "working" as const,
          slug,
        },
      ];
    }
    if (r.file.startsWith(LOCAL_FILES_DIR + "/")) {
      // Path: LOCAL_FILES_DIR/<machine_id>/<hash>.md
      const parts = r.file.slice(LOCAL_FILES_DIR.length + 1).split("/");
      const machine_id = parts[0];
      return [
        {
          id: 0,
          score: r.score,
          snippet: r.bestChunk,
          body: r.body,
          path: r.displayPath,
          kind: "local-file" as const,
          machine_id,
        },
      ];
    }
    return [];
  });
}
