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
// Orange — idle with spine unreachable, or state unknown
const COLOR_WARN: [u8; 3] = [255, 152, 0];
// Blue  — scan in progress
const COLOR_SCAN: [u8; 3] = [66, 133, 244];
// Red   — scan error
const COLOR_ERR: [u8; 3] = [219, 68, 55];
// Yellow — IPC error (socket unreachable, timeout, write failure, or bad response)
const COLOR_IPC: [u8; 3] = [255, 200, 0];

/// Signed distance from point (px, py) to line segment (ax,ay)-(bx,by).
fn dist_to_segment(px: f32, py: f32, ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    let dx = bx - ax;
    let dy = by - ay;
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    let qx = ax + t.clamp(0.0, 1.0) * dx;
    let qy = ay + t.clamp(0.0, 1.0) * dy;
    ((px - qx).powi(2) + (py - qy).powi(2)).sqrt()
}

/// Renders a 16×16 anti-aliased lattice grid icon (3×3 nodes) in ARGB32 network-byte-order.
fn lattice_icon(rgb: [u8; 3]) -> Vec<ksni::Icon> {
    const SIZE: i32 = 16;
    // SVG grid coords 4/16/28 in 32×32 map to 2/8/14 in 16×16.
    const NODES: [(f32, f32); 9] = [
        (2.0, 2.0),
        (8.0, 2.0),
        (14.0, 2.0),
        (2.0, 8.0),
        (8.0, 8.0),
        (14.0, 8.0),
        (2.0, 14.0),
        (8.0, 14.0),
        (14.0, 14.0),
    ];
    // Three horizontal rows then three vertical columns.
    const LINES: [(usize, usize); 6] = [(0, 2), (3, 5), (6, 8), (0, 6), (1, 7), (2, 8)];
    const DOT_R: f32 = 1.5;
    const LINE_HW: f32 = 0.5;

    let [r, g, b] = rgb;
    let mut data = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for py in 0..SIZE {
        for px in 0..SIZE {
            let cx = px as f32 + 0.5;
            let cy = py as f32 + 0.5;
            let mut coverage: f32 = 0.0;
            for &(nx, ny) in &NODES {
                let d = ((cx - nx).powi(2) + (cy - ny).powi(2)).sqrt();
                coverage = coverage.max((DOT_R + 0.5 - d).clamp(0.0, 1.0));
            }
            for &(i, j) in &LINES {
                let (ax, ay) = NODES[i];
                let (bx, by) = NODES[j];
                let d = dist_to_segment(cx, cy, ax, ay, bx, by);
                coverage = coverage.max((LINE_HW + 0.5 - d).clamp(0.0, 1.0));
            }
            data.extend_from_slice(&[(coverage * 255.0) as u8, r, g, b]);
        }
    }
    vec![ksni::Icon {
        width: SIZE,
        height: SIZE,
        data,
    }]
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
        lattice_icon(self.icon_rgb)
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
                label: "Capture…".into(),
                activate: Box::new(|_| {
                    spawn_capture_ui();
                }),
                ..Default::default()
            }
            .into(),
        );

        items.push(
            StandardItem {
                label: "Configure…".into(),
                activate: Box::new(|_| {
                    spawn_config_ui();
                }),
                ..Default::default()
            }
            .into(),
        );

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

/// Parses an ISO 8601 UTC timestamp into seconds since Unix epoch.
/// Reads exactly bytes 0–18 (`YYYY-MM-DDTHH:MM:SS`); everything from byte 19
/// onward (fractional seconds, timezone offsets) is silently ignored, so
/// `+05:00` offsets are dropped rather than rejected or adjusted.
fn parse_iso_secs(s: &str) -> Option<u64> {
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

fn spawn_config_ui() {
    spawn_sibling("lattice-config", &[], "Could not open config editor");
}

fn spawn_capture_ui() {
    spawn_sibling("lattice-capture", &["--prompt"], "Could not launch capture");
}

/// Spawns a sibling binary (resolved relative to the running tray executable,
/// falling back to $PATH) and notifies the user if the spawn itself fails.
fn spawn_sibling(name: &str, args: &[&str], failure_summary: &str) {
    let bin = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(name)))
        .unwrap_or_else(|| name.into());

    if let Err(e) = std::process::Command::new(&bin).args(args).spawn() {
        tracing::warn!(bin = %bin.display(), error = %e, "failed to launch {name}");
        let _ = std::process::Command::new("notify-send")
            .args(["Lattice", &format!("{failure_summary}: {e}")])
            .spawn();
    }
}

fn systemctl(op: &str) {
    let msg = match std::process::Command::new("systemctl")
        .args(["--user", op, "lattice-agent"])
        .status()
    {
        Err(e) => format!("systemctl failed to run: {e}"),
        Ok(s) if !s.success() => format!("systemctl {op} returned {:?}", s.code()),
        Ok(_) => return,
    };
    tracing::warn!(op, "{msg}");
    let _ = std::process::Command::new("notify-send")
        .args(["Lattice", &msg, "--urgency", "critical"])
        .spawn();
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

#[cfg(test)]
mod tests {
    use super::parse_iso_secs;

    #[test]
    fn known_timestamp() {
        // 2024-01-15T11:50:00Z = 1705319400 (cross-checked with date -d)
        assert_eq!(parse_iso_secs("2024-01-15T11:50:00Z"), Some(1705319400));
    }

    #[test]
    fn epoch() {
        assert_eq!(parse_iso_secs("1970-01-01T00:00:00Z"), Some(0));
    }

    #[test]
    fn year_boundary() {
        // 2023-12-31T23:59:59Z = 1704067199
        assert_eq!(parse_iso_secs("2023-12-31T23:59:59Z"), Some(1704067199));
    }

    #[test]
    fn leap_year_feb29() {
        // 2024-02-29T00:00:00Z = 1709164800
        assert_eq!(parse_iso_secs("2024-02-29T00:00:00Z"), Some(1709164800));
    }

    #[test]
    fn too_short_returns_none() {
        assert_eq!(parse_iso_secs("2024-01"), None);
        assert_eq!(parse_iso_secs(""), None);
    }

    #[test]
    fn non_numeric_field_returns_none() {
        assert_eq!(parse_iso_secs("20XX-01-01T00:00:00Z"), None);
        assert_eq!(parse_iso_secs("2024-MM-01T00:00:00Z"), None);
    }

    #[test]
    fn timezone_offset_silently_dropped() {
        // Bytes past index 19 are ignored; result equals the bare UTC time.
        assert_eq!(
            parse_iso_secs("2024-01-15T11:50:00+05:00"),
            parse_iso_secs("2024-01-15T11:50:00Z"),
        );
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    tracing_subscriber::fmt::init();
    let handle = LatticeTray::default()
        .spawn()
        .expect("failed to register tray icon");

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
