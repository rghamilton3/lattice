//! Cross-platform helpers shared between the agent binaries.
//!
//! Three concerns:
//! - `data_dir()`: where to keep SQLite files (queue, cache).
//! - `notify()`: surface a desktop notification.
//! - `prompt_text()`: ask the user for one line of text (used by lattice-capture).
//!
//! All three are implemented in a single module so the OS-specific differences
//! live in one place rather than scattered through every consumer.

use anyhow::Result;
use std::path::PathBuf;

// ── Data directory ───────────────────────────────────────────────────────────

/// Lattice's per-user data directory. Created on demand by callers when needed.
///
/// - Unix: `$XDG_DATA_HOME/lattice` or `$HOME/.local/share/lattice`.
/// - Windows: `%LOCALAPPDATA%\lattice` (matches `install.ps1`'s install layout).
pub fn data_dir() -> PathBuf {
    data_root().join("lattice")
}

/// Lattice's per-user config root.
pub fn config_dir() -> PathBuf {
    #[cfg(unix)]
    return std::env::var_os("XDG_CONFIG_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned()))
                .join(".config")
        });
    #[cfg(windows)]
    return std::env::var_os("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Users\Default\AppData\Roaming"));
    #[cfg(not(any(unix, windows)))]
    PathBuf::from(".")
}

/// Default install location for a Lattice binary managed by the local updater.
pub fn install_path(binary_name: &str) -> PathBuf {
    #[cfg(unix)]
    return PathBuf::from(std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned()))
        .join(".local")
        .join("bin")
        .join(binary_name);
    #[cfg(windows)]
    return data_dir().join(format!("{binary_name}.exe"));
    #[cfg(not(any(unix, windows)))]
    PathBuf::from(binary_name)
}

#[cfg(unix)]
fn data_root() -> PathBuf {
    if let Some(v) = std::env::var_os("XDG_DATA_HOME") {
        return PathBuf::from(v);
    }
    let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
    PathBuf::from(home).join(".local").join("share")
}

#[cfg(windows)]
fn data_root() -> PathBuf {
    std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|| PathBuf::from(r"C:\Users\Default\AppData\Local"))
}

#[cfg(not(any(unix, windows)))]
fn data_root() -> PathBuf {
    PathBuf::from(".")
}

// ── Notifications ────────────────────────────────────────────────────────────

/// Urgency hint for `notify`. Maps to libnotify levels on Linux and is mostly
/// advisory on Windows (the WinRT toast API doesn't expose the same enum).
#[derive(Clone, Copy)]
pub enum Urgency {
    Low,
    Normal,
    Critical,
}

/// Show a "Lattice" desktop notification. Blocks the caller until the
/// notification daemon has acked the message (typically a few ms), then
/// swallows any error - a missed notification should never abort a capture.
///
/// Runs on a fresh OS thread because `notify-rust` drives its dbus / WinRT I/O
/// via `block_on`, which panics inside an active tokio runtime.
pub fn notify(body: &str, urgency: Urgency) {
    let body = body.to_owned();
    let handle = std::thread::spawn(move || {
        let mut n = notify_rust::Notification::new();
        n.summary("Lattice").body(&body);

        #[cfg(all(unix, not(target_os = "macos")))]
        {
            n.urgency(match urgency {
                Urgency::Low => notify_rust::Urgency::Low,
                Urgency::Normal => notify_rust::Urgency::Normal,
                Urgency::Critical => notify_rust::Urgency::Critical,
            });
        }
        #[cfg(not(all(unix, not(target_os = "macos"))))]
        let _ = urgency;

        if let Err(e) = n.show() {
            tracing::warn!(error = %e, "desktop notification failed");
        }
    });
    let _ = handle.join();
}

// ── Text prompt ──────────────────────────────────────────────────────────────

/// Pop a single-line text input and return the entered string, or `None` if
/// the user cancelled. Used by `lattice-capture --prompt` and any other path
/// that needs to ask "what do you want to capture?".
///
/// Implemented with eframe on every platform so the UX is identical and there
/// are no shell-out dependencies to install (walker / wofi / rofi / PowerShell).
#[cfg(feature = "gui")]
pub fn prompt_text(title: &str) -> Result<Option<String>> {
    use eframe::egui;

    struct PromptApp {
        title: String,
        input: String,
        result: std::sync::Arc<std::sync::Mutex<Option<String>>>,
        focused: bool,
    }

    impl eframe::App for PromptApp {
        fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
            // Ctrl+Enter submits, Esc cancels. Plain Enter inserts a newline
            // (the multiline TextEdit's natural behavior). Captured at the
            // context level so the keys fire even while the editor has focus.
            let (submit, cancel) = ctx.input(|i| {
                let submit =
                    i.key_pressed(egui::Key::Enter) && (i.modifiers.ctrl || i.modifiers.command);
                let cancel = i.key_pressed(egui::Key::Escape);
                (submit, cancel)
            });

            egui::TopBottomPanel::bottom("prompt_hint")
                .show_separator_line(false)
                .show(ctx, |ui| {
                    ui.add_space(2.0);
                    ui.horizontal(|ui| {
                        ui.weak("Ctrl+Enter to capture, Esc to cancel");
                    });
                    ui.add_space(2.0);
                });

            egui::CentralPanel::default().show(ctx, |ui| {
                ui.add_space(8.0);
                ui.label(&self.title);
                ui.add_space(4.0);

                let edit = ui.add(
                    egui::TextEdit::multiline(&mut self.input)
                        .desired_width(f32::INFINITY)
                        .desired_rows(3)
                        .hint_text("Type your capture. Ctrl+Enter to send."),
                );
                if !self.focused {
                    edit.request_focus();
                    self.focused = true;
                }
            });

            if submit {
                let text = self.input.trim().to_owned();
                *self.result.lock().unwrap() = if text.is_empty() { None } else { Some(text) };
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            } else if cancel {
                *self.result.lock().unwrap() = None;
                ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            }
        }
    }

    let result = std::sync::Arc::new(std::sync::Mutex::new(None));
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_inner_size([520.0, 160.0])
            .with_resizable(false)
            .with_decorations(true)
            .with_always_on_top()
            .with_title("Lattice capture"),
        ..Default::default()
    };

    let title = title.to_owned();
    let result_clone = result.clone();
    eframe::run_native(
        "Lattice capture",
        options,
        Box::new(move |_cc| {
            Ok(Box::new(PromptApp {
                title,
                input: String::new(),
                result: result_clone,
                focused: false,
            }))
        }),
    )
    .map_err(|e| anyhow::anyhow!("opening capture prompt: {e}"))?;

    let out = result.lock().unwrap().take();
    Ok(out)
}

#[cfg(not(feature = "gui"))]
pub fn prompt_text(_title: &str) -> Result<Option<String>> {
    anyhow::bail!("prompt_text requires the `gui` feature");
}
