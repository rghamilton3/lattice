import { parse } from "smol-toml";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

interface LatticeConfig {
  spine?: {
    agent_token?: string;
    database_path?: string;
  };
}

function xdgConfigHome(): string {
  return process.env.XDG_CONFIG_HOME ?? join(process.env.HOME ?? "/root", ".config");
}

function readLatticeConfig(): LatticeConfig {
  const path = join(xdgConfigHome(), "lattice", "config.toml");
  if (!existsSync(path)) return {};
  try {
    return parse(readFileSync(path, "utf-8")) as LatticeConfig;
  } catch (e) {
    console.warn(`[config] failed to parse ${path}:`, e);
    return {};
  }
}

const _cfg = readLatticeConfig();

export function getAgentToken(): string | undefined {
  return process.env.LATTICE_AGENT_TOKEN ?? _cfg.spine?.agent_token;
}

export function getDatabasePath(): string {
  return process.env.DATABASE_PATH ?? _cfg.spine?.database_path ?? "./lattice.dev.db";
}
