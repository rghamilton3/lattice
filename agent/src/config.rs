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
    // Optional so capture-only installs (no lattice-agent running, no watch dirs
    // configured) don't fail to parse a config that omits the [agent] section.
    #[serde(default)]
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

impl Default for AgentSection {
    // Used when the whole [agent] section is omitted (e.g. capture-only installs).
    // Keep numeric defaults consistent with the per-field serde defaults so the
    // agent still behaves sanely if it does start up against this config.
    fn default() -> Self {
        Self {
            machine_id: String::new(),
            poll_interval_minutes: default_poll_interval(),
            max_file_bytes: default_max_file_bytes(),
            watch: Vec::new(),
        }
    }
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

    let home = home_dir();
    let watch = root
        .agent
        .watch
        .into_iter()
        .map(|mut e| {
            if e.path.starts_with("~/") {
                e.path = format!("{}{}", home, &e.path[1..]);
            } else if e.path == "~" {
                e.path = home.clone();
            }
            e
        })
        .collect();

    Ok(Config {
        spine_url: root.spine.url.trim_end_matches('/').to_owned(),
        agent_token: root.spine.agent_token,
        machine_id,
        poll_interval_minutes: root.agent.poll_interval_minutes,
        max_file_bytes: root.agent.max_file_bytes,
        watch,
    })
}

pub fn config_path() -> PathBuf {
    #[cfg(unix)]
    return xdg_config_home().join("lattice").join("config.toml");
    #[cfg(windows)]
    return appdata_roaming().join("lattice").join("config.toml");
    #[cfg(not(any(unix, windows)))]
    PathBuf::from("config.toml")
}

#[cfg(unix)]
fn xdg_config_home() -> PathBuf {
    if let Ok(v) = std::env::var("XDG_CONFIG_HOME") {
        return PathBuf::from(v);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
    PathBuf::from(home).join(".config")
}

#[cfg(windows)]
fn appdata_roaming() -> PathBuf {
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from(r"C:\Users\Default\AppData\Roaming"))
}

fn home_dir() -> String {
    #[cfg(unix)]
    return std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
    #[cfg(windows)]
    return std::env::var("USERPROFILE").unwrap_or_else(|_| r"C:\Users\Default".to_owned());
    #[cfg(not(any(unix, windows)))]
    String::new()
}

fn hostname() -> String {
    #[cfg(unix)]
    return fs::read_to_string("/etc/hostname")
        .map(|s| s.trim().to_owned())
        .unwrap_or_else(|_| "unknown-host".to_owned());
    #[cfg(windows)]
    return std::env::var("COMPUTERNAME").unwrap_or_else(|_| "unknown-host".to_owned());
    #[cfg(not(any(unix, windows)))]
    "unknown-host".to_owned()
}
