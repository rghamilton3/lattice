import { createStore } from "@tobilu/qmd";
import type { QMDStore } from "@tobilu/qmd";
import type { Database } from "bun:sqlite";
import { join, dirname, basename, resolve } from "path";
import { mkdirSync, writeFileSync, existsSync } from "fs";

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
}

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./lattice.dev.db");
const CAPTURES_DIR = join(dirname(DB_PATH), "captures");
const QMD_DB_PATH = join(dirname(DB_PATH), "lattice.qmd.db");

function sanitize(s: string): string {
  return s.replace(/[\r\n]/g, " ");
}

function captureToMarkdown({ id, text, source, captured_at }: CaptureData): string {
  return `---\nid: ${id}\nsource: ${sanitize(source)}\ncaptured_at: ${sanitize(captured_at)}\n---\n\n${text}\n`;
}

let _store: QMDStore | null = null;
// Serial lock: ensures update() and embed() calls never overlap.
let _indexLock: Promise<void> = Promise.resolve();

export async function initSearch(db: Database): Promise<void> {
  mkdirSync(CAPTURES_DIR, { recursive: true });

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
    const id = parseInt(basename(r.file, ".md"), 10);
    if (isNaN(id)) return [];
    return [{ id, score: r.score, snippet: r.bestChunk, body: r.body, path: r.displayPath }];
  });
}
