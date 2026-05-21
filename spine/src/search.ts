import { createStore } from "@tobilu/qmd";
import type { QMDStore } from "@tobilu/qmd";
import type { Database } from "bun:sqlite";
import { join, dirname, basename, resolve } from "path";
import { mkdirSync, writeFileSync, existsSync, unlinkSync } from "fs";
import { workingDir } from "./working";

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

function dbDir(): string {
  return dirname(resolve(process.env.DATABASE_PATH ?? "./lattice.dev.db"));
}

export function capturesDir(): string {
  return join(dbDir(), "captures");
}

export function localFilesDir(): string {
  return join(dbDir(), "local-files");
}

function qmdDbPath(): string {
  return join(dbDir(), "lattice.qmd.db");
}

function sanitize(s: string): string {
  return s.replace(/[\r\n]/g, " ");
}

export function captureToMarkdown({ id, text, source, captured_at }: CaptureData): string {
  return `---\nid: ${id}\nsource: ${sanitize(source)}\ncaptured_at: ${sanitize(captured_at)}\n---\n\n${text}\n`;
}

export function localFileToMarkdown(machineId: string, path: string, text: string): string {
  return `---\nmachine_id: ${sanitize(machineId)}\npath: ${sanitize(path)}\n---\n\n${text}\n`;
}

let _store: QMDStore | null = null;
let _initFailed = false;
let _indexFailures = 0;
// Serial lock: ensures update() and embed() calls never overlap.
let _indexLock: Promise<void> = Promise.resolve();

/** @internal test-only — do not use from production code. */
export function __resetSearchForTests(): void {
  _store = null;
  _initFailed = false;
  _indexFailures = 0;
  _indexLock = Promise.resolve();
}

/** @internal test-only — do not use from production code. */
export function __getIndexFailuresForTests(): number {
  return _indexFailures;
}

export async function initSearch(db: Database): Promise<void> {
  const captures = capturesDir();
  const localFiles = localFilesDir();
  const working = workingDir();
  // QMD's glob over `working` runs at createStore time; without the dir
  // present it raises and trips _initFailed. Pre-refactor working.ts mkdir'd
  // at module load; now it only mkdirs lazily, so init must do it.
  mkdirSync(captures, { recursive: true });
  mkdirSync(localFiles, { recursive: true });
  mkdirSync(working, { recursive: true });

  const rows = db
    .query("SELECT id, text, source, captured_at FROM captures")
    .all() as CaptureData[];

  for (const row of rows) {
    const filePath = join(captures, `${row.id}.md`);
    if (!existsSync(filePath)) {
      writeFileSync(filePath, captureToMarkdown(row));
    }
  }

  try {
    _store = await createStore({
      dbPath: qmdDbPath(),
      config: {
        collections: {
          captures: { path: captures, pattern: "**/*.md" },
          working: { path: working, pattern: "**/*.md" },
          "local-files": { path: localFiles, pattern: "**/*.md" },
        },
      },
    });
  } catch (e) {
    _initFailed = true;
    console.error("[qmd] initSearch failed — search unavailable:", e);
    throw e;
  }

  refreshIndex();
}

export function writeCaptureFile(
  id: number,
  text: string,
  source: string,
  captured_at: string
): void {
  writeFileSync(
    join(capturesDir(), `${id}.md`),
    captureToMarkdown({ id, text, source, captured_at })
  );
}

export function writeLocalFile(machineId: string, path: string, hash: string, text: string, prevHash?: string): void {
  const machineDir = join(localFilesDir(), machineId);
  mkdirSync(machineDir, { recursive: true });
  if (prevHash && prevHash !== hash) {
    const oldFile = join(machineDir, `${prevHash}.md`);
    if (existsSync(oldFile)) unlinkSync(oldFile);
  }
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
    .catch((e) => {
      _indexFailures++;
      if (_indexFailures === 1 || _indexFailures % 10 === 0) {
        console.warn(`[qmd] index refresh failed (${_indexFailures}x):`, e);
      }
    });
}

export async function search(q: string): Promise<SearchResult[]> {
  if (!_store) {
    if (_initFailed) console.warn("[qmd] search called but initSearch failed — returning empty results");
    return [];
  }
  const captures = capturesDir();
  const working = workingDir();
  const localFiles = localFilesDir();
  const results = await _store.search({ query: q, limit: 20 });
  return results.flatMap((r): SearchResult[] => {
    if (r.file.startsWith(captures + "/")) {
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
    if (r.file.startsWith(working + "/")) {
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
    if (r.file.startsWith(localFiles + "/")) {
      // Path: localFiles/<machine_id>/<hash>.md
      const parts = r.file.slice(localFiles.length + 1).split("/");
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
