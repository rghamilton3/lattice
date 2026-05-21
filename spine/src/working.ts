import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, dirname, join, resolve } from "path";

export function workingDir(): string {
  const dbPath = resolve(process.env.DATABASE_PATH ?? "./lattice.dev.db");
  return join(dirname(dbPath), "working");
}

function ensureWorkingDir(): string {
  const dir = workingDir();
  mkdirSync(dir, { recursive: true });
  return dir;
}

export class WorkingNotFoundError extends Error {
  constructor(slug: string) {
    super(`Working doc not found: ${slug}`);
  }
}

export class WorkingConflictError extends Error {
  constructor(slug: string) {
    super(`Working doc already exists: ${slug}`);
  }
}

const VALID_SLUG = /^[a-z0-9-]+$/;

function assertValidSlug(slug: string): void {
  if (!VALID_SLUG.test(slug)) throw new WorkingNotFoundError(slug);
}

export interface WorkingDocSummary {
  slug: string;
  title: string;
  modified_at: string;
}

export interface WorkingDocFull extends WorkingDocSummary {
  content: string;
}

export function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function extractTitle(content: string, slug: string): string {
  const match = content.match(/^#\s+(.+)/m);
  return match ? match[1].trim() : slug;
}

export function listWorking(): WorkingDocSummary[] {
  const dir = ensureWorkingDir();
  const files = readdirSync(dir).filter((f) => f.endsWith(".md"));
  return files
    .flatMap((f) => {
      const slug = basename(f, ".md");
      const filePath = join(dir, f);
      try {
        const content = readFileSync(filePath, "utf-8");
        const stat = statSync(filePath);
        return [{ slug, title: extractTitle(content, slug), modified_at: stat.mtime.toISOString() }];
      } catch (e: any) {
        if (e.code === "ENOENT") return [];
        console.error(`[working] listWorking read failed for ${filePath}:`, e);
        throw e;
      }
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}

export function readWorking(slug: string): WorkingDocFull {
  assertValidSlug(slug);
  const filePath = join(ensureWorkingDir(), `${slug}.md`);
  if (!existsSync(filePath)) throw new WorkingNotFoundError(slug);
  const content = readFileSync(filePath, "utf-8");
  const stat = statSync(filePath);
  return {
    slug,
    title: extractTitle(content, slug),
    modified_at: stat.mtime.toISOString(),
    content,
  };
}

export function createWorking(title: string, content?: string): string {
  const slug = titleToSlug(title);
  if (!slug) throw new Error(`Title produces empty slug: "${title}"`);
  const filePath = join(ensureWorkingDir(), `${slug}.md`);
  if (existsSync(filePath)) throw new WorkingConflictError(slug);
  const body = content ?? `# ${title}\n\n`;
  writeFileSync(filePath, body, "utf-8");
  return slug;
}

export function updateWorking(slug: string, content: string): void {
  assertValidSlug(slug);
  const filePath = join(ensureWorkingDir(), `${slug}.md`);
  if (!existsSync(filePath)) throw new WorkingNotFoundError(slug);
  writeFileSync(filePath, content, "utf-8");
}

export function deleteWorking(slug: string): void {
  assertValidSlug(slug);
  const filePath = join(ensureWorkingDir(), `${slug}.md`);
  if (!existsSync(filePath)) throw new WorkingNotFoundError(slug);
  unlinkSync(filePath);
}
