import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from "fs";
import { basename, join, resolve } from "path";
import { dirname } from "node:path";

const DB_PATH = resolve(process.env.DATABASE_PATH ?? "./lattice.dev.db");
export const WORKING_DIR = join(dirname(DB_PATH), "working");

mkdirSync(WORKING_DIR, { recursive: true });

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

export interface WorkingDoc {
  slug: string;
  title: string;
  modified_at: string;
}

export interface WorkingDocFull extends WorkingDoc {
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

export function listWorking(): WorkingDoc[] {
  const files = readdirSync(WORKING_DIR).filter((f) => f.endsWith(".md"));
  return files
    .map((f) => {
      const slug = basename(f, ".md");
      const filePath = join(WORKING_DIR, f);
      const content = readFileSync(filePath, "utf-8");
      const stat = statSync(filePath);
      return {
        slug,
        title: extractTitle(content, slug),
        modified_at: stat.mtime.toISOString(),
      };
    })
    .sort((a, b) => b.modified_at.localeCompare(a.modified_at));
}

export function readWorking(slug: string): WorkingDocFull {
  const filePath = join(WORKING_DIR, `${slug}.md`);
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
  const filePath = join(WORKING_DIR, `${slug}.md`);
  if (existsSync(filePath)) throw new WorkingConflictError(slug);
  const body = content ?? `# ${title}\n\n`;
  writeFileSync(filePath, body, "utf-8");
  return slug;
}

export function updateWorking(slug: string, content: string): void {
  const filePath = join(WORKING_DIR, `${slug}.md`);
  if (!existsSync(filePath)) throw new WorkingNotFoundError(slug);
  writeFileSync(filePath, content, "utf-8");
}

export function deleteWorking(slug: string): void {
  const filePath = join(WORKING_DIR, `${slug}.md`);
  if (!existsSync(filePath)) throw new WorkingNotFoundError(slug);
  unlinkSync(filePath);
}
