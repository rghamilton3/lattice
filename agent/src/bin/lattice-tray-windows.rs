//! System tray icon for the Lattice agent (Windows).
//!
//! Uses `tray-icon` + `muda` for the system tray and context menu.
//! The tray-icon crate owns a Windows message-only HWND internally, so no
//! additional event-loop framework is required — a simple polling loop suffices.

// The tray-icon crate is a Windows-only dependency; gate all impl behind cfg(windows).
// On other platforms this compiles to a stub that exits with an error message.

#[cfg(windows)]
use lattice_agent::format::format_status_line;
#[cfg(windows)]
use lattice_agent::icon::{COLOR_IPC, COLOR_STOPPED, color_for, lattice_icon_rgba};
#[cfg(windows)]
use lattice_agent::ipc_client::{FetchResult, fetch_status};
#[cfg(windows)]
use std::sync::mpsc;
#[cfg(windows)]
use std::time::Duration;
#[cfg(windows)]
use tray_icon::{
    TrayIcon, TrayIconBuilder,
    menu::{IsMenuItem, Menu, MenuEvent, MenuItem, PredefinedMenuItem},
};

// ── Render state sent from background → main thread ──────────────────────────

#[cfg(windows)]
struct RenderState {
    running: bool,
    ipc_error: Option<String>,
    status_text: String,
    spine_text: String,
    error_text: Option<String>,
    icon_rgb: [u8; 3],
}

#[cfg(windows)]
impl Default for RenderState {
    fn default() -> Self {
        Self {
            running: false,
            ipc_error: None,
            status_text: String::new(),
            spine_text: String::new(),
            error_text: None,
            icon_rgb: COLOR_STOPPED,
        }
    }
}

#[cfg(windows)]
fn render_state(result: &FetchResult) -> RenderState {
    match result {
        FetchResult::Running(s) => RenderState {
            running: true,
            ipc_error: None,
            status_text: format_status_line(s),
            spine_text: if s.spine_ok {
                "Spine: reachable".into()
            } else {
                "Spine: unreachable".into()
            },
            error_text: if s.last_errors > 0 {
                Some(format!(
                    "Last error: {}",
                    s.last_error_msg.as_deref().unwrap_or("unknown")
                ))
            } else {
                None
            },
            icon_rgb: color_for(result),
        },
        FetchResult::Stopped => RenderState {
            running: false,
            status_text: "Agent stopped".into(),
            icon_rgb: COLOR_STOPPED,
            ..Default::default()
        },
        FetchResult::Error(msg) => RenderState {
            running: false,
            ipc_error: Some(msg.clone()),
            status_text: format!("IPC error: {msg}"),
            icon_rgb: COLOR_IPC,
            ..Default::default()
        },
    }
}

// ── Menu items (stored to update text/enabled state in-place) ─────────────────

#[cfg(windows)]
struct TrayMenu {
    status_item: MenuItem,
    spine_item: MenuItem,
    start_item: MenuItem,
    stop_item: MenuItem,
    restart_item: MenuItem,
    capture_item: MenuItem,
    configure_item: MenuItem,
    exit_item: MenuItem,
}

#[cfg(windows)]
fn build_tray() -> (TrayIcon, TrayMenu) {
    let status_item = MenuItem::new("Agent stopped", false, None);
    let spine_item = MenuItem::new("", false, None);
    let start_item = MenuItem::new("Start Agent", true, None);
    let stop_item = MenuItem::new("Stop Agent", false, None);
    let restart_item = MenuItem::new("Restart Agent", false, None);
    let capture_item = MenuItem::new("Capture…", true, None);
    let configure_item = MenuItem::new("Configure…", true, None);
    let exit_item = MenuItem::new("Stop Agent & Exit", true, None);

    let menu = Menu::new();
    let _ = menu.append_items(&[
        &status_item as &dyn IsMenuItem,
        &spine_item,
        &PredefinedMenuItem::separator(),
        &start_item,
        &stop_item,
        &restart_item,
        &PredefinedMenuItem::separator(),
        &capture_item,
        &configure_item,
        &PredefinedMenuItem::separator(),
        &exit_item,
    ]);

    let icon_rgba = lattice_icon_rgba(COLOR_STOPPED);
    let icon = tray_icon::Icon::from_rgba(icon_rgba, 16, 16).expect("valid icon data");

    let tray = TrayIconBuilder::new()
        .with_menu(Box::new(menu))
        .with_tooltip("Lattice Agent")
        .with_icon(icon)
        .build()
        .expect("failed to create tray icon");

    let items = TrayMenu {
        status_item,
        spine_item,
        start_item,
        stop_item,
        restart_item,
        capture_item,
        configure_item,
        exit_item,
    };

    (tray, items)
}

// ── Update tray from render state ─────────────────────────────────────────────

#[cfg(windows)]
fn apply_state(tray: &TrayIcon, menu: &TrayMenu, state: &RenderState) {
    let icon_rgba = lattice_icon_rgba(state.icon_rgb);
    if let Ok(icon) = tray_icon::Icon::from_rgba(icon_rgba, 16, 16) {
        let _ = tray.set_icon(Some(icon));
    }

    let tooltip = if let Some(ref err) = state.ipc_error {
        format!("Lattice Agent — IPC error: {err}")
    } else if state.running {
        format!("Lattice Agent — {}", state.status_text)
    } else {
        "Lattice Agent — stopped".into()
    };
    let _ = tray.set_tooltip(Some(&tooltip));

    menu.status_item.set_text(&state.status_text);

    if state.running && state.ipc_error.is_none() {
        let spine = match &state.error_text {
            Some(err) => format!("{} | {err}", state.spine_text),
            None => state.spine_text.clone(),
        };
        menu.spine_item.set_text(&spine);
    } else {
        menu.spine_item.set_text("");
    }

    menu.start_item.set_enabled(!state.running);
    menu.stop_item.set_enabled(state.running);
    menu.restart_item.set_enabled(state.running);
}

// ── Service control via Task Scheduler ───────────────────────────────────────

#[cfg(windows)]
fn schtasks(op: &str) {
    let (arg, tn) = match op {
        "start" | "restart" => ("/Run", "LatticeAgent"),
        "stop" => ("/End", "LatticeAgent"),
        _ => return,
    };
    match std::process::Command::new("schtasks")
        .args([arg, "/TN", tn])
        .status()
    {
        Err(e) => tracing::warn!(op, "schtasks failed to run: {e}"),
        Ok(s) if !s.success() => tracing::warn!(op, "schtasks {arg} returned {:?}", s.code()),
        Ok(_) => {}
    }
}

// ── Sibling binary launcher ───────────────────────────────────────────────────

#[cfg(windows)]
fn spawn_sibling(name: &str) {
    let bin = std::env::current_exe()
        .ok()
        .and_then(|p| p.parent().map(|d| d.join(name)))
        .unwrap_or_else(|| name.into());

    if let Err(e) = std::process::Command::new(&bin).spawn() {
        tracing::warn!(bin = %bin.display(), error = %e, "failed to launch {name}");
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

#[cfg(windows)]
fn main() {
    tracing_subscriber::fmt::init();

    let (tray, menu) = build_tray();
    let (state_tx, state_rx) = mpsc::channel::<RenderState>();

    // Background thread: poll IPC every 30 s.
    std::thread::spawn(move || {
        loop {
            let result = fetch_status(Duration::from_secs(3));
            state_tx.send(render_state(&result)).ok();
            std::thread::sleep(Duration::from_secs(30));
        }
    });

    let start_id = menu.start_item.id().clone();
    let stop_id = menu.stop_item.id().clone();
    let restart_id = menu.restart_item.id().clone();
    let capture_id = menu.capture_item.id().clone();
    let configure_id = menu.configure_item.id().clone();
    let exit_id = menu.exit_item.id().clone();

    loop {
        while let Ok(state) = state_rx.try_recv() {
            apply_state(&tray, &menu, &state);
        }

        while let Ok(ev) = MenuEvent::receiver().try_recv() {
            let id = &ev.id;
            if id == &start_id {
                schtasks("start");
            } else if id == &stop_id {
                schtasks("stop");
            } else if id == &restart_id {
                schtasks("restart");
            } else if id == &capture_id {
                spawn_sibling("lattice-capture");
            } else if id == &configure_id {
                spawn_sibling("lattice-config");
            } else if id == &exit_id {
                schtasks("stop");
                std::process::exit(0);
            }
        }

        std::thread::sleep(Duration::from_millis(100));
    }
}

#[cfg(not(windows))]
fn main() {
    eprintln!("lattice-tray-windows only runs on Windows.");
    std::process::exit(1);
}
