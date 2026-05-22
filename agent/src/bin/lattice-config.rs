//! Configuration editor for the Lattice agent.
//!
//! Reads the platform config file, presents an egui form, and writes
//! changes back using toml_edit (preserves comments and formatting).
//! Launched as a subprocess by lattice-tray.

use eframe::egui;
use lattice_agent::config::config_path;
use lattice_agent::config_edit::{self, ConfigForm, WatchRow};
use lattice_agent::ipc_client;
use std::path::PathBuf;
use std::sync::mpsc;
use std::time::Duration;
use toml_edit::DocumentMut;

const APP_ID: &str = "com.rghsoftware.lattice.config";

// ── Modal state ───────────────────────────────────────────────────────────────

#[derive(Default)]
enum ModalState {
    #[default]
    None,
    AskRestart,
    ReindexPending,
    Error(String),
    Info {
        title: String,
        body: String,
    },
}

// ── App state ─────────────────────────────────────────────────────────────────

enum AppState {
    Loaded { doc: DocumentMut, form: ConfigForm },
    LoadError(String),
}

// ── ConfigApp ─────────────────────────────────────────────────────────────────

struct ConfigApp {
    state: AppState,
    config_path: PathBuf,
    show_token: bool,
    modal: ModalState,
    reindex_rx: Option<mpsc::Receiver<Result<(), String>>>,
}

impl ConfigApp {
    fn new() -> Self {
        let config_path = config_path();
        let state = match config_edit::load(&config_path) {
            Ok((doc, form)) => AppState::Loaded { doc, form },
            Err(msg) => AppState::LoadError(msg),
        };
        Self {
            state,
            config_path,
            show_token: false,
            modal: ModalState::None,
            reindex_rx: None,
        }
    }

    fn poll_reindex_channel(&mut self) {
        let done = match &self.reindex_rx {
            None => return,
            Some(rx) => {
                match rx.try_recv() {
                    Ok(Ok(())) => {
                        self.modal = ModalState::Info {
                        title: "Re-index started".into(),
                        body: "The agent will re-upload all files.\nWatch the tray icon for progress.".into(),
                    };
                        true
                    }
                    Ok(Err(e)) => {
                        self.modal = ModalState::Error(e);
                        true
                    }
                    Err(mpsc::TryRecvError::Disconnected) => {
                        self.modal = ModalState::Error("Reindex thread panicked".into());
                        true
                    }
                    Err(mpsc::TryRecvError::Empty) => false,
                }
            }
        };
        if done {
            self.reindex_rx = None;
        }
    }
}

impl eframe::App for ConfigApp {
    fn update(&mut self, ctx: &egui::Context, _frame: &mut eframe::Frame) {
        self.poll_reindex_channel();

        // ── Load-error state ──────────────────────────────────────────────────
        if let AppState::LoadError(ref msg) = self.state {
            let msg = msg.clone();
            egui::CentralPanel::default().show(ctx, |ui| {
                ui.label(&msg);
                ui.add_space(8.0);
                if ui.button("Close").clicked() {
                    ctx.send_viewport_cmd(egui::ViewportCommand::Close);
                }
            });
            return;
        }

        // ── Modal overlays ────────────────────────────────────────────────────
        // Take ownership to avoid self-referential borrow inside closures.
        let mut close_app = false;
        let modal = std::mem::take(&mut self.modal);
        self.modal = match modal {
            ModalState::None => ModalState::None,

            ModalState::AskRestart => {
                let mut next: ModalState = ModalState::AskRestart;
                egui::Window::new("Configuration Saved")
                    .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                    .fixed_size([340.0, 130.0])
                    .collapsible(false)
                    .resizable(false)
                    .show(ctx, |ui| {
                        ui.label("Configuration saved.\nRestart the agent to apply changes?");
                        ui.add_space(8.0);
                        ui.horizontal(|ui| {
                            if ui.button("Not Now").clicked() {
                                next = ModalState::None;
                                close_app = true;
                            }
                            if ui.button("Restart Agent").clicked() {
                                match restart_service() {
                                    Ok(()) => {
                                        next = ModalState::None;
                                        close_app = true;
                                    }
                                    Err(e) => next = ModalState::Error(e),
                                }
                            }
                        });
                    });
                next
            }

            ModalState::ReindexPending => {
                ctx.request_repaint();
                egui::Window::new("Working…")
                    .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                    .fixed_size([200.0, 60.0])
                    .collapsible(false)
                    .resizable(false)
                    .show(ctx, |ui| {
                        ui.label("Requesting re-index…");
                    });
                ModalState::ReindexPending
            }

            ModalState::Error(msg) => {
                let mut done = false;
                egui::Window::new("Error")
                    .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                    .fixed_size([380.0, 110.0])
                    .collapsible(false)
                    .resizable(false)
                    .show(ctx, |ui| {
                        ui.label(&msg);
                        ui.add_space(8.0);
                        if ui.button("Close").clicked() {
                            done = true;
                        }
                    });
                if done {
                    ModalState::None
                } else {
                    ModalState::Error(msg)
                }
            }

            ModalState::Info { title, body } => {
                let mut done = false;
                egui::Window::new(title.as_str())
                    .anchor(egui::Align2::CENTER_CENTER, [0.0, 0.0])
                    .fixed_size([380.0, 110.0])
                    .collapsible(false)
                    .resizable(false)
                    .show(ctx, |ui| {
                        ui.label(&body);
                        ui.add_space(8.0);
                        if ui.button("Close").clicked() {
                            done = true;
                        }
                    });
                if done {
                    ModalState::None
                } else {
                    ModalState::Info { title, body }
                }
            }
        };

        if close_app {
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
            return;
        }

        // ── Main form ─────────────────────────────────────────────────────────
        // Split field borrows so closures can capture distinct fields simultaneously.
        let show_token = &mut self.show_token;
        let modal = &mut self.modal;
        let reindex_rx = &mut self.reindex_rx;
        let config_path = &self.config_path;
        let (doc, form) = match &mut self.state {
            AppState::Loaded { doc, form } => (doc, form),
            AppState::LoadError(_) => return,
        };

        let mut save_clicked = false;
        let mut cancel_clicked = false;

        // Button row must be reserved before CentralPanel so ScrollArea doesn't
        // consume all vertical space and push the buttons off screen.
        egui::TopBottomPanel::bottom("button_row").show(ctx, |ui| {
            ui.add_space(4.0);
            ui.horizontal(|ui| {
                ui.with_layout(egui::Layout::right_to_left(egui::Align::Center), |ui| {
                    if ui.button("Save").clicked() {
                        save_clicked = true;
                    }
                    if ui.button("Cancel").clicked() {
                        cancel_clicked = true;
                    }
                });
            });
            ui.add_space(4.0);
        });

        egui::CentralPanel::default().show(ctx, |ui| {
            egui::ScrollArea::vertical().show(ui, |ui| {
                // Spine
                egui::Frame::group(ui.style()).show(ui, |ui| {
                    ui.heading("Spine");
                    egui::Grid::new("spine")
                        .num_columns(2)
                        .spacing([8.0, 6.0])
                        .show(ui, |ui| {
                            ui.label("URL:");
                            ui.add(
                                egui::TextEdit::singleline(&mut form.spine_url)
                                    .desired_width(f32::INFINITY),
                            );
                            ui.end_row();
                            ui.label("Token:");
                            ui.horizontal(|ui| {
                                ui.add(
                                    egui::TextEdit::singleline(&mut form.spine_token)
                                        .password(!*show_token)
                                        .desired_width(f32::INFINITY),
                                );
                                let lbl = if *show_token { "Hide" } else { "Show" };
                                if ui.button(lbl).clicked() {
                                    *show_token = !*show_token;
                                }
                            });
                            ui.end_row();
                        });
                });
                ui.add_space(8.0);

                // Agent
                egui::Frame::group(ui.style()).show(ui, |ui| {
                    ui.heading("Agent");
                    egui::Grid::new("agent")
                        .num_columns(2)
                        .spacing([8.0, 6.0])
                        .show(ui, |ui| {
                            ui.label("Machine ID:");
                            ui.add(
                                egui::TextEdit::singleline(&mut form.machine_id)
                                    .hint_text("defaults to hostname")
                                    .desired_width(f32::INFINITY),
                            );
                            ui.end_row();
                            ui.label("Poll (min):");
                            ui.add(egui::DragValue::new(&mut form.poll_minutes).range(1..=1440));
                            ui.end_row();
                            ui.label("Max file (MB):");
                            ui.add(
                                egui::DragValue::new(&mut form.max_file_mb)
                                    .range(0.1..=2048.0)
                                    .speed(0.1),
                            );
                            ui.end_row();
                        });
                });
                ui.add_space(8.0);

                // Watch paths
                egui::Frame::group(ui.style()).show(ui, |ui| {
                    ui.heading("Watch Paths");
                    let mut to_remove: Option<usize> = None;
                    for (i, row) in form.watch_rows.iter_mut().enumerate() {
                        egui::Frame::group(ui.style()).show(ui, |ui| {
                            ui.horizontal(|ui| {
                                ui.label("Path:");
                                ui.add(
                                    egui::TextEdit::singleline(&mut row.path)
                                        .desired_width(f32::INFINITY),
                                );
                                if ui.button("Remove").clicked() {
                                    to_remove = Some(i);
                                }
                            });
                            ui.label("Patterns (one per line):");
                            ui.add(egui::TextEdit::multiline(&mut row.patterns).desired_rows(3));
                        });
                        ui.add_space(4.0);
                    }
                    if let Some(i) = to_remove {
                        form.watch_rows.remove(i);
                    }
                    if ui.button("+ Add Watch Path").clicked() {
                        form.watch_rows.push(WatchRow::default());
                    }
                });
                ui.add_space(8.0);

                // Actions
                egui::Frame::group(ui.style()).show(ui, |ui| {
                    ui.heading("Actions");
                    ui.horizontal(|ui| {
                        let busy = matches!(modal, ModalState::ReindexPending);
                        if ui
                            .add_enabled(!busy, egui::Button::new("Update Index"))
                            .clicked()
                        {
                            let (tx, rx) = mpsc::channel();
                            *reindex_rx = Some(rx);
                            *modal = ModalState::ReindexPending;
                            ctx.request_repaint();
                            std::thread::spawn(move || {
                                tx.send(send_reindex()).ok();
                            });
                        }
                        ui.label("Clear the file cache and re-upload all indexed files to Spine.");
                    });
                });
            });
        });

        if cancel_clicked {
            ctx.send_viewport_cmd(egui::ViewportCommand::Close);
        }
        if save_clicked {
            config_edit::apply(doc, form);
            match config_edit::save(doc, config_path) {
                Ok(()) => *modal = ModalState::AskRestart,
                Err(e) => *modal = ModalState::Error(e),
            }
        }
    }
}

// ── Service restart ───────────────────────────────────────────────────────────

fn restart_service() -> Result<(), String> {
    #[cfg(unix)]
    {
        let status = std::process::Command::new("systemctl")
            .args(["--user", "restart", "lattice-agent"])
            .status()
            .map_err(|e| format!("systemctl failed to run: {e}"))?;
        if !status.success() {
            return Err(format!(
                "systemctl restart returned exit code {:?}",
                status.code()
            ));
        }
    }
    #[cfg(windows)]
    {
        let status = std::process::Command::new("schtasks")
            .args(["/Run", "/TN", "LatticeAgent"])
            .status()
            .map_err(|e| format!("schtasks failed to run: {e}"))?;
        if !status.success() {
            return Err(format!(
                "schtasks /Run returned exit code {:?}",
                status.code()
            ));
        }
    }
    Ok(())
}

fn send_reindex() -> Result<(), String> {
    let line = ipc_client::send_command("reindex", Duration::from_secs(3)).map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "The agent is not running. Start it first.".to_owned()
        } else {
            format!("Could not connect to agent: {e}")
        }
    })?;
    if line.contains("\"ok\"") {
        Ok(())
    } else {
        Err(format!("Agent returned an error: {}", line.trim()))
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

fn main() {
    let options = eframe::NativeOptions {
        viewport: egui::ViewportBuilder::default()
            .with_title("Lattice Config")
            .with_inner_size([520.0, 640.0])
            .with_app_id(APP_ID),
        ..Default::default()
    };
    eframe::run_native(
        "Lattice Config",
        options,
        Box::new(|_cc| Ok(Box::new(ConfigApp::new()))),
    )
    .expect("eframe failed to start");
}
