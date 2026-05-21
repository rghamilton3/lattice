use anyhow::{Context, Result};
use serde::Deserialize;
use std::fs;
use std::path::PathBuf;

/// The public config type consumed by the rest of the agent.
#[derive(Debug)]
pub struct Config {
    pub spine_url: String,
    pub agent_token: String,
    pub machine_id: String,
    pub poll_interval_minutes: u64,
    pub max_file_bytes: u64,
    pub watch: Vec<WatchEntry>,
}

#[derive(Debug, Deserialize, Clone)]
pub struct WatchEntry {
    pub path: String,
    pub patterns: Vec<String>,
}

// ── Raw TOML shape ────────────────────────────────────────────────────────────

#[derive(Deserialize)]
struct RootConfig {
    spine: SpineSection,
    agent: AgentSection,
}

#[derive(Deserialize)]
struct SpineSection {
    url: String,
    agent_token: String,
}

#[derive(Deserialize)]
struct AgentSection {
    #[serde(default)]
    machine_id: String,
    #[serde(default = "default_poll_interval")]
    poll_interval_minutes: u64,
    #[serde(default = "default_max_file_bytes")]
    max_file_bytes: u64,
    #[serde(default)]
    watch: Vec<WatchEntry>,
}

fn default_poll_interval() -> u64 {
    15
}

fn default_max_file_bytes() -> u64 {
    10 * 1024 * 1024
}

// ── Public loader ─────────────────────────────────────────────────────────────

pub fn load() -> Result<Config> {
    let path = config_path();
    let raw = fs::read_to_string(&path)
        .with_context(|| format!("cannot read config at {}", path.display()))?;
    let root: RootConfig =
        toml::from_str(&raw).with_context(|| format!("invalid TOML in {}", path.display()))?;

    let machine_id = if root.agent.machine_id.is_empty() {
        hostname()
    } else {
        root.agent.machine_id
    };

    Ok(Config {
        spine_url: root.spine.url.trim_end_matches('/').to_owned(),
        agent_token: root.spine.agent_token,
        machine_id,
        poll_interval_minutes: root.agent.poll_interval_minutes,
        max_file_bytes: root.agent.max_file_bytes,
        watch: root.agent.watch,
    })
}

fn config_path() -> PathBuf {
    xdg_config_home().join("lattice").join("config.toml")
}

fn xdg_config_home() -> PathBuf {
    if let Ok(v) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(v);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
    PathBuf::from(home).join(".config")
}

fn hostname() -> String {
    fs::read_to_string("/etc/hostname")
        .map(|s| s.trim().to_owned())
        .unwrap_or_else(|_| "unknown-host".to_owned())
}
