//! System tray icon for the Lattice agent.
//!
//! Controls the lattice-agent systemd user service and displays its status via
//! a StatusNotifierItem tray icon (compatible with waybar's tray module).

use ksni::blocking::TrayMethods;
use ksni::menu::*;
use serde::Deserialize;
use std::io::{self, BufRead, BufReader, Write};
use std::os::unix::net::UnixStream;
use std::path::PathBuf;
use std::time::Duration;

// ── Status types (mirrors agent/src/status.rs) ────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
enum ScanState {
    Idle,
    Scanning,
    Error,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Deserialize)]
struct AgentStatus {
    state: ScanState,
    last_scan_at: Option<String>,
    last_indexed: u32,
    last_skipped: u32,
    last_errors: u32,
    spine_ok: bool,
    last_error_msg: Option<String>,
}

// ── Icon colors (RGB) ─────────────────────────────────────────────────────────

// Gray  — agent stopped
const COLOR_STOPPED: [u8; 3] = [130, 130, 130];
// Green — idle, spine reachable
const COLOR_IDLE: [u8; 3] = [79, 174, 74];
// Orange — idle, spine unreachable
const COLOR_WARN: [u8; 3] = [255, 152, 0];
// Blue  — scan in progress
const COLOR_SCAN: [u8; 3] = [66, 133, 244];
// Red   — scan error
const COLOR_ERR: [u8; 3] = [219, 68, 55];
// Yellow — tray can't reach IPC socket (distinct from COLOR_WARN: spine unreachable)
const COLOR_IPC: [u8; 3] = [255, 200, 0];

/// Renders a 16×16 anti-aliased filled circle in ARGB32 network-byte-order.
fn circle_icon(rgb: [u8; 3]) -> Vec<ksni::Icon> {
    const SIZE: i32 = 16;
    let [r, g, b] = rgb;
    let mut data = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for y in 0..SIZE {
        for x in 0..SIZE {
            let dx = x as f32 + 0.5 - 8.0;
            let dy = y as f32 + 0.5 - 8.0;
            let dist = (dx * dx + dy * dy).sqrt();
            let alpha = ((7.0 - dist).clamp(0.0, 1.0) * 255.0) as u8;
            // ARGB32 network byte order: A, R, G, B
            data.extend_from_slice(&[alpha, r, g, b]);
        }
    }
    vec![ksni::Icon { width: SIZE, height: SIZE, data }]
}

// ── Fetch result ──────────────────────────────────────────────────────────────

enum FetchResult {
    Running(AgentStatus),
    Stopped,
    Error(String),
}

// ── Tray state ────────────────────────────────────────────────────────────────

#[derive(Debug)]
struct LatticeTray {
    running: bool,
    ipc_error: Option<String>,
    status_line: String,
    spine_line: String,
    error_line: Option<String>,
    icon_rgb: [u8; 3],
}

impl Default for LatticeTray {
    fn default() -> Self {
        Self {
            running: false,
            ipc_error: None,
            status_line: String::new(),
            spine_line: String::new(),
            error_line: None,
            icon_rgb: COLOR_STOPPED,
        }
    }
}

impl ksni::Tray for LatticeTray {
    fn id(&self) -> String {
        "lattice-agent".into()
    }

    fn title(&self) -> String {
        "Lattice Agent".into()
    }

    fn icon_pixmap(&self) -> Vec<ksni::Icon> {
        circle_icon(self.icon_rgb)
    }

    fn tool_tip(&self) -> ksni::ToolTip {
        let description = if let Some(ref msg) = self.ipc_error {
            format!("Agent: IPC error — {msg}")
        } else if self.running {
            format!("{}\n{}", self.status_line, self.spine_line)
        } else {
            "Agent stopped".into()
        };
        ksni::ToolTip {
            title: "Lattice Agent".into(),
            description,
            ..Default::default()
        }
    }

    fn menu(&self) -> Vec<ksni::MenuItem<Self>> {
        let mut items: Vec<ksni::MenuItem<Self>> = Vec::new();

        // Status info (non-interactive)
        if let Some(ref msg) = self.ipc_error {
            items.push(
                StandardItem {
                    label: format!("IPC error: {msg}"),
                    enabled: false,
                    ..Default::default()
                }
                .into(),
            );
        } else if self.running {
            items.push(
                StandardItem {
                    label: self.status_line.clone(),
                    enabled: false,
                    ..Default::default()
                }
                .into(),
            );
            items.push(
                StandardItem {
                    label: self.spine_line.clone(),
                    enabled: false,
                    ..Default::default()
                }
                .into(),
            );
            if let Some(err) = &self.error_line {
                items.push(
                    StandardItem {
                        label: err.clone(),
                        enabled: false,
                        ..Default::default()
                    }
                    .into(),
                );
            }
        } else {
            items.push(
                StandardItem {
                    label: "Agent stopped".into(),
                    enabled: false,
                    ..Default::default()
                }
                .into(),
            );
        }

        items.push(MenuItem::Separator);

        // Control: Start/Stop (mutually exclusive based on state)
        if self.running {
            items.push(
                StandardItem {
                    label: "Stop Agent".into(),
                    activate: Box::new(|_| {
                        systemctl("stop");
                    }),
                    ..Default::default()
                }
                .into(),
            );
            items.push(
                StandardItem {
                    label: "Restart Agent".into(),
                    activate: Box::new(|_| {
                        systemctl("restart");
                    }),
                    ..Default::default()
                }
                .into(),
            );
        } else {
            items.push(
                StandardItem {
                    label: "Start Agent".into(),
                    activate: Box::new(|_| {
                        systemctl("start");
                    }),
                    ..Default::default()
                }
                .into(),
            );
        }

        items.push(MenuItem::Separator);

        items.push(
            StandardItem {
                label: "Stop Agent & Exit".into(),
                icon_name: "application-exit".into(),
                activate: Box::new(|_| {
                    systemctl("stop");
                    std::process::exit(0);
                }),
                ..Default::default()
            }
            .into(),
        );

        items
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn socket_path() -> PathBuf {
    if let Ok(dir) = std::env::var("XDG_RUNTIME_DIR") {
        return PathBuf::from(dir).join("lattice-agent.sock");
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
    PathBuf::from(home)
        .join(".local")
        .join("share")
        .join("lattice")
        .join("agent.sock")
}

fn fetch_status() -> FetchResult {
    let path = socket_path();
    let mut stream = match UnixStream::connect(&path) {
        Ok(s) => s,
        // NotFound = socket file absent = agent not running
        Err(e) if e.kind() == io::ErrorKind::NotFound => return FetchResult::Stopped,
        // Any other error = agent may be up but IPC is broken
        Err(e) => return FetchResult::Error(e.to_string()),
    };
    if let Err(e) = stream.set_write_timeout(Some(Duration::from_secs(3))) {
        return FetchResult::Error(e.to_string());
    }
    if let Err(e) = stream.set_read_timeout(Some(Duration::from_secs(3))) {
        return FetchResult::Error(e.to_string());
    }
    if let Err(e) = stream.write_all(b"status\n") {
        return FetchResult::Error(e.to_string());
    }
    let mut reader = BufReader::new(&stream);
    let mut line = String::new();
    if let Err(e) = reader.read_line(&mut line) {
        return FetchResult::Error(e.to_string());
    }
    match serde_json::from_str(line.trim()) {
        Ok(s) => FetchResult::Running(s),
        Err(e) => FetchResult::Error(e.to_string()),
    }
}

/// Builds the human-readable status line shown in the menu and tooltip.
fn format_status_line(s: &AgentStatus) -> String {
    let state = match s.state {
        ScanState::Idle => "Idle",
        ScanState::Scanning => "Scanning",
        ScanState::Error => "Error",
        ScanState::Unknown => "Unknown",
    };

    let scan_time = s
        .last_scan_at
        .as_deref()
        .map(|t| format!(" — last scan {}", friendly_time(t)))
        .unwrap_or_default();

    format!(
        "{state}{scan_time} ({} indexed, {} skipped)",
        s.last_indexed, s.last_skipped
    )
}

/// Converts an ISO 8601 UTC timestamp to a short relative string like "2m ago".
fn friendly_time(iso: &str) -> String {
    // Parse seconds-since-epoch from ISO 8601 without pulling in chrono.
    // Format: 2024-01-15T11:50:00Z
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let then = parse_iso_secs(iso).unwrap_or(now);
    let secs = now.saturating_sub(then);

    if secs < 60 {
        "just now".into()
    } else if secs < 3600 {
        format!("{}m ago", secs / 60)
    } else if secs < 86400 {
        format!("{}h ago", secs / 3600)
    } else {
        format!("{}d ago", secs / 86400)
    }
}

/// Parses "YYYY-MM-DDTHH:MM:SSZ" into seconds since Unix epoch.
fn parse_iso_secs(s: &str) -> Option<u64> {
    // Expect exactly "2006-01-02T15:04:05Z"
    let b = s.as_bytes();
    if b.len() < 20 {
        return None;
    }
    let year: u64 = std::str::from_utf8(&b[0..4]).ok()?.parse().ok()?;
    let mon: u64 = std::str::from_utf8(&b[5..7]).ok()?.parse().ok()?;
    let day: u64 = std::str::from_utf8(&b[8..10]).ok()?.parse().ok()?;
    let hour: u64 = std::str::from_utf8(&b[11..13]).ok()?.parse().ok()?;
    let min: u64 = std::str::from_utf8(&b[14..16]).ok()?.parse().ok()?;
    let sec: u64 = std::str::from_utf8(&b[17..19]).ok()?.parse().ok()?;

    // Days since epoch — simplified Gregorian (good enough for recent timestamps).
    let y = if mon <= 2 { year - 1 } else { year };
    let era = y / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if mon > 2 { mon - 3 } else { mon + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;

    Some(days * 86400 + hour * 3600 + min * 60 + sec)
}

fn systemctl(op: &str) {
    match std::process::Command::new("systemctl")
        .args(["--user", op, "lattice-agent"])
        .status()
    {
        Err(e) => tracing::warn!(op, error = %e, "systemctl failed to run"),
        Ok(s) if !s.success() => tracing::warn!(op, code = ?s.code(), "systemctl returned non-zero"),
        Ok(_) => {}
    }
}

/// Returns the RGB color for the tray icon based on fetch result.
fn color_for(result: &FetchResult) -> [u8; 3] {
    match result {
        FetchResult::Stopped => COLOR_STOPPED,
        FetchResult::Error(_) => COLOR_IPC,
        FetchResult::Running(s) => match s.state {
            ScanState::Idle if s.spine_ok => COLOR_IDLE,
            ScanState::Idle => COLOR_WARN,
            ScanState::Scanning => COLOR_SCAN,
            ScanState::Error => COLOR_ERR,
            ScanState::Unknown => COLOR_WARN,
        },
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    tracing_subscriber::fmt::init();
    let handle = LatticeTray::default().spawn().expect("failed to register tray icon");

    loop {
        let result = fetch_status();

        handle.update(|tray: &mut LatticeTray| {
            tray.icon_rgb = color_for(&result);

            match &result {
                FetchResult::Running(s) => {
                    tray.running = true;
                    tray.ipc_error = None;
                    tray.status_line = format_status_line(s);
                    tray.spine_line = if s.spine_ok {
                        "Spine: reachable".into()
                    } else {
                        "Spine: unreachable".into()
                    };
                    tray.error_line = if s.last_errors > 0 {
                        Some(format!(
                            "Last error: {}",
                            s.last_error_msg.as_deref().unwrap_or("unknown")
                        ))
                    } else {
                        None
                    };
                }
                FetchResult::Stopped => {
                    tray.running = false;
                    tray.ipc_error = None;
                    tray.status_line.clear();
                    tray.spine_line.clear();
                    tray.error_line = None;
                }
                FetchResult::Error(msg) => {
                    tray.running = false;
                    tray.ipc_error = Some(msg.clone());
                    tray.status_line.clear();
                    tray.spine_line.clear();
                    tray.error_line = None;
                }
            }
        });

        if handle.is_closed() {
            break;
        }

        std::thread::sleep(Duration::from_secs(30));
    }
}
