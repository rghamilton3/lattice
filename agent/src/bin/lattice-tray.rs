//! System tray icon for the Lattice agent (Linux / D-Bus StatusNotifierItem).
//!
//! Controls the lattice-agent systemd user service and displays its status via
//! a StatusNotifierItem tray icon (compatible with waybar's tray module).
//! All ksni code is gated behind cfg(unix); a stub main is compiled on other platforms.

#[cfg(unix)]
use ksni::blocking::TrayMethods;
#[cfg(unix)]
use ksni::menu::*;
use lattice_agent::format::format_status_line;
use lattice_agent::icon::{color_for, lattice_icon_argb32};
use lattice_agent::ipc_client::{FetchResult, fetch_status};
use std::time::Duration;

// ── Tray state ────────────────────────────────────────────────────────────────

#[cfg(unix)]
#[derive(Debug)]
struct LatticeTray {
    running: bool,
    ipc_error: Option<String>,
    status_line: String,
    spine_line: String,
    error_line: Option<String>,
    icon_rgb: [u8; 3],
}

#[cfg(unix)]
impl Default for LatticeTray {
    fn default() -> Self {
        use lattice_agent::icon::COLOR_STOPPED;
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

#[cfg(unix)]
impl ksni::Tray for LatticeTray {
    fn id(&self) -> String {
        "lattice-agent".into()
    }

    fn title(&self) -> String {
        "Lattice Agent".into()
    }

    fn icon_pixmap(&self) -> Vec<ksni::Icon> {
        vec![ksni::Icon {
            width: 16,
            height: 16,
            data: lattice_icon_argb32(self.icon_rgb),
        }]
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

        if self.running {
            items.push(
                StandardItem {
                    label: "Stop Agent".into(),
                    activate: Box::new(|_| {
                        service_control("stop");
                    }),
                    ..Default::default()
                }
                .into(),
            );
            items.push(
                StandardItem {
                    label: "Restart Agent".into(),
                    activate: Box::new(|_| {
                        service_control("restart");
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
                        service_control("start");
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
                    spawn_sibling("lattice-capture", &["--prompt"], "Could not launch capture");
                }),
                ..Default::default()
            }
            .into(),
        );

        items.push(
            StandardItem {
                label: "Configure…".into(),
                activate: Box::new(|_| {
                    spawn_sibling("lattice-config", &[], "Could not open config editor");
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
                    service_control("stop");
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

fn spawn_sibling(name: &str, args: &[&str], failure_summary: &str) {
    let bin = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(name)))
        .unwrap_or_else(|| name.into());

    if let Err(e) = std::process::Command::new(&bin).args(args).spawn() {
        tracing::warn!(bin = %bin.display(), error = %e, "failed to launch {name}");
        lattice_agent::platform::notify(
            &format!("{failure_summary}: {e}"),
            lattice_agent::platform::Urgency::Normal,
        );
    }
}

fn service_control(op: &str) {
    let msg = match std::process::Command::new("systemctl")
        .args(["--user", op, "lattice-agent"])
        .status()
    {
        Err(e) => format!("systemctl failed to run: {e}"),
        Ok(s) if !s.success() => format!("systemctl {op} returned {:?}", s.code()),
        Ok(_) => return,
    };
    tracing::warn!(op, "{msg}");
    lattice_agent::platform::notify(&msg, lattice_agent::platform::Urgency::Critical);
}

// ── Entry points ──────────────────────────────────────────────────────────────

#[cfg(unix)]
fn main() {
    tracing_subscriber::fmt::init();
    let handle = LatticeTray::default()
        .spawn()
        .expect("failed to register tray icon");

    loop {
        let result = fetch_status(Duration::from_secs(3));

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

#[cfg(not(unix))]
fn main() {
    eprintln!("lattice-tray only runs on Linux (requires D-Bus / ksni).");
    std::process::exit(1);
}
