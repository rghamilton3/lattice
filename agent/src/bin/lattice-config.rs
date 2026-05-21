//! Configuration editor for the Lattice agent.
//!
//! Reads ~/.config/lattice/config.toml, presents a GTK4 form, and writes
//! changes back using toml_edit (preserves comments and formatting).
//! Launched as a subprocess by lattice-tray.
//! May invoke `systemctl --user restart lattice-agent`.

use gtk4::{
    prelude::*, Adjustment, Application, ApplicationWindow, Box as GBox,
    Button, Entry, Frame, Grid, Label, Orientation, PolicyType, ScrolledWindow,
    SpinButton, TextView,
};
use lattice_agent::config::config_path;
use std::cell::{Cell, RefCell};
use std::rc::Rc;

const APP_ID: &str = "com.rghsoftware.lattice.config";

// ── Helpers ───────────────────────────────────────────────────────────────────

fn systemctl_restart(parent: &ApplicationWindow) -> bool {
    match std::process::Command::new("systemctl")
        .args(["--user", "restart", "lattice-agent"])
        .status()
    {
        Err(e) => {
            show_error(parent, &format!("systemctl failed to run:\n{e}"));
            false
        }
        Ok(s) if !s.success() => {
            show_error(parent, &format!("systemctl restart returned exit code {:?}", s.code()));
            false
        }
        Ok(_) => true,
    }
}

// ── Watch row ─────────────────────────────────────────────────────────────────

struct WatchRow {
    container: GBox,
    path_entry: Entry,
    patterns_buffer: gtk4::TextBuffer,
}

fn make_watch_row(entries_box: &GBox, path: &str, patterns: &[String]) -> WatchRow {
    let container = GBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(4)
        .build();

    let path_row = GBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(6)
        .build();
    let path_lbl = Label::builder()
        .label("Path:")
        .width_chars(9)
        .halign(gtk4::Align::Start)
        .build();
    let path_entry = Entry::builder().hexpand(true).text(path).build();
    let remove_btn = Button::builder().label("Remove").build();
    path_row.append(&path_lbl);
    path_row.append(&path_entry);
    path_row.append(&remove_btn);

    let pat_row = GBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(6)
        .build();
    let pat_lbl = Label::builder()
        .label("Patterns:")
        .width_chars(9)
        .halign(gtk4::Align::Start)
        .valign(gtk4::Align::Start)
        .build();
    let pat_view = TextView::builder()
        .hexpand(true)
        .wrap_mode(gtk4::WrapMode::Word)
        .build();
    let patterns_buffer = pat_view.buffer();
    patterns_buffer.set_text(&patterns.join("\n"));
    let pat_scroll = ScrolledWindow::new();
    pat_scroll.set_hexpand(true);
    pat_scroll.set_min_content_height(60);
    pat_scroll.set_max_content_height(120);
    pat_scroll.set_vscrollbar_policy(PolicyType::Automatic);
    pat_scroll.set_hscrollbar_policy(PolicyType::Never);
    pat_scroll.set_child(Some(&pat_view));
    pat_row.append(&pat_lbl);
    pat_row.append(&pat_scroll);

    container.append(&path_row);
    container.append(&pat_row);
    entries_box.append(&container);

    {
        let container_c = container.clone();
        let entries_box_c = entries_box.clone();
        remove_btn.connect_clicked(move |_| {
            entries_box_c.remove(&container_c);
        });
    }

    WatchRow { container, path_entry, patterns_buffer }
}

// ── Post-save dialog ──────────────────────────────────────────────────────────

fn prompt_restart(parent: &ApplicationWindow) {
    let dialog = gtk4::Window::builder()
        .transient_for(parent)
        .modal(true)
        .title("Configuration Saved")
        .default_width(340)
        .resizable(false)
        .build();

    let vbox = GBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(16)
        .margin_top(20)
        .margin_bottom(16)
        .margin_start(20)
        .margin_end(20)
        .build();

    vbox.append(
        &Label::builder()
            .label("Configuration saved.\nRestart the agent to apply changes?")
            .justify(gtk4::Justification::Center)
            .build(),
    );

    let btn_row = GBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(8)
        .halign(gtk4::Align::Center)
        .build();
    let not_now = Button::builder().label("Not Now").build();
    let restart = Button::builder().label("Restart Agent").build();
    restart.add_css_class("suggested-action");

    {
        let d = dialog.downgrade();
        let p = parent.downgrade();
        not_now.connect_clicked(move |_| {
            d.upgrade().map(|w| w.close());
            p.upgrade().map(|w| w.close());
        });
    }
    {
        let d = dialog.downgrade();
        let p = parent.downgrade();
        restart.connect_clicked(move |_| {
            if let Some(win) = p.upgrade() {
                if systemctl_restart(&win) {
                    win.close();
                }
            }
            d.upgrade().map(|w| w.close());
        });
    }

    btn_row.append(&not_now);
    btn_row.append(&restart);
    vbox.append(&btn_row);
    dialog.set_child(Some(&vbox));
    dialog.present();
}

fn show_error(parent: &ApplicationWindow, msg: &str) {
    let dialog = gtk4::Window::builder()
        .transient_for(parent)
        .modal(true)
        .title("Error")
        .default_width(380)
        .resizable(false)
        .build();
    let vbox = GBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(12)
        .margin_top(16)
        .margin_bottom(16)
        .margin_start(16)
        .margin_end(16)
        .build();
    vbox.append(&Label::builder().label(msg).wrap(true).xalign(0.0).build());
    let btn = Button::builder().label("Close").halign(gtk4::Align::End).build();
    let d = dialog.downgrade();
    btn.connect_clicked(move |_| { d.upgrade().map(|w| w.close()); });
    vbox.append(&btn);
    dialog.set_child(Some(&vbox));
    dialog.present();
}

// ── UI builder ────────────────────────────────────────────────────────────────

fn build_ui(app: &Application) {
    let path = config_path();

    let content = match std::fs::read_to_string(&path) {
        Ok(c) => c,
        Err(e) => {
            let win = ApplicationWindow::builder()
                .application(app)
                .title("Lattice Config")
                .default_width(420)
                .build();
            let vbox = GBox::builder()
                .orientation(Orientation::Vertical)
                .spacing(12)
                .margin_top(16)
                .margin_bottom(16)
                .margin_start(16)
                .margin_end(16)
                .build();
            vbox.append(
                &Label::builder()
                    .label(&format!("Cannot read config at {}:\n{e}", path.display()))
                    .wrap(true)
                    .xalign(0.0)
                    .build(),
            );
            let btn = Button::builder().label("Close").halign(gtk4::Align::End).build();
            let w = win.downgrade();
            btn.connect_clicked(move |_| { w.upgrade().map(|x| x.close()); });
            vbox.append(&btn);
            win.set_child(Some(&vbox));
            win.present();
            return;
        }
    };

    let doc: toml_edit::DocumentMut = match content.parse() {
        Ok(d) => d,
        Err(e) => {
            let win = ApplicationWindow::builder()
                .application(app)
                .title("Lattice Config")
                .default_width(420)
                .build();
            let vbox = GBox::builder()
                .orientation(Orientation::Vertical)
                .spacing(12)
                .margin_top(16)
                .margin_bottom(16)
                .margin_start(16)
                .margin_end(16)
                .build();
            vbox.append(
                &Label::builder()
                    .label(&format!("Cannot parse config:\n{e}"))
                    .wrap(true)
                    .xalign(0.0)
                    .build(),
            );
            let btn = Button::builder().label("Close").halign(gtk4::Align::End).build();
            let w = win.downgrade();
            btn.connect_clicked(move |_| { w.upgrade().map(|x| x.close()); });
            vbox.append(&btn);
            win.set_child(Some(&vbox));
            win.present();
            return;
        }
    };

    let doc = Rc::new(RefCell::new(doc));

    // ── Window ────────────────────────────────────────────────────────────────

    let window = ApplicationWindow::builder()
        .application(app)
        .title("Lattice Config")
        .default_width(520)
        .default_height(640)
        .build();

    let root = GBox::builder().orientation(Orientation::Vertical).build();

    let scroll = ScrolledWindow::new();
    scroll.set_hscrollbar_policy(PolicyType::Never);
    scroll.set_vscrollbar_policy(PolicyType::Automatic);
    scroll.set_vexpand(true);

    let form = GBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(12)
        .margin_top(12)
        .margin_bottom(12)
        .margin_start(16)
        .margin_end(16)
        .build();
    scroll.set_child(Some(&form));

    // ── Spine section ─────────────────────────────────────────────────────────

    let (spine_url_init, spine_tok_init) = {
        let d = doc.borrow();
        let spine = d.get("spine").and_then(|i| i.as_table());
        (
            spine.and_then(|t| t.get("url")).and_then(|v| v.as_str()).unwrap_or("").to_owned(),
            spine.and_then(|t| t.get("agent_token")).and_then(|v| v.as_str()).unwrap_or("").to_owned(),
        )
    };

    let spine_frame = Frame::builder().label("Spine").build();
    let spine_grid = Grid::builder()
        .row_spacing(6)
        .column_spacing(8)
        .margin_top(8)
        .margin_bottom(8)
        .margin_start(8)
        .margin_end(8)
        .build();

    let url_entry = Entry::builder().hexpand(true).text(spine_url_init.as_str()).build();

    let tok_entry = Entry::builder()
        .hexpand(true)
        .visibility(false)
        .input_purpose(gtk4::InputPurpose::Password)
        .text(spine_tok_init.as_str())
        .build();
    let tok_toggle = Button::builder().label("Show").build();
    let tok_visible = Rc::new(Cell::new(false));
    {
        let tok_entry_c = tok_entry.clone();
        let tok_visible_c = tok_visible.clone();
        tok_toggle.connect_clicked(move |btn| {
            let v = !tok_visible_c.get();
            tok_visible_c.set(v);
            tok_entry_c.set_visibility(v);
            btn.set_label(if v { "Hide" } else { "Show" });
        });
    }
    let tok_box = GBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(4)
        .hexpand(true)
        .build();
    tok_box.append(&tok_entry);
    tok_box.append(&tok_toggle);

    spine_grid.attach(
        &Label::builder().label("URL:").halign(gtk4::Align::Start).build(),
        0, 0, 1, 1,
    );
    spine_grid.attach(&url_entry, 1, 0, 1, 1);
    spine_grid.attach(
        &Label::builder().label("Token:").halign(gtk4::Align::Start).build(),
        0, 1, 1, 1,
    );
    spine_grid.attach(&tok_box, 1, 1, 1, 1);
    spine_frame.set_child(Some(&spine_grid));
    form.append(&spine_frame);

    // ── Agent section ─────────────────────────────────────────────────────────

    let (mid_init, poll_init, max_bytes_init) = {
        let d = doc.borrow();
        let agent = d.get("agent").and_then(|i| i.as_table());
        (
            agent.and_then(|t| t.get("machine_id")).and_then(|v| v.as_str()).unwrap_or("").to_owned(),
            agent.and_then(|t| t.get("poll_interval_minutes")).and_then(|v| v.as_integer()).unwrap_or(15) as f64,
            agent.and_then(|t| t.get("max_file_bytes")).and_then(|v| v.as_integer()).unwrap_or(10 * 1024 * 1024) as f64,
        )
    };

    let agent_frame = Frame::builder().label("Agent").build();
    let agent_grid = Grid::builder()
        .row_spacing(6)
        .column_spacing(8)
        .margin_top(8)
        .margin_bottom(8)
        .margin_start(8)
        .margin_end(8)
        .build();

    let mid_entry = Entry::builder()
        .hexpand(true)
        .text(mid_init.as_str())
        .placeholder_text("defaults to hostname")
        .build();
    let poll_spin = SpinButton::builder()
        .adjustment(&Adjustment::new(poll_init, 1.0, 1440.0, 1.0, 10.0, 0.0))
        .digits(0)
        .build();
    let max_spin = SpinButton::builder()
        .adjustment(&Adjustment::new(
            max_bytes_init / (1024.0 * 1024.0),
            0.1, 2048.0, 1.0, 10.0, 0.0,
        ))
        .digits(1)
        .build();

    agent_grid.attach(
        &Label::builder().label("Machine ID:").halign(gtk4::Align::Start).build(),
        0, 0, 1, 1,
    );
    agent_grid.attach(&mid_entry, 1, 0, 1, 1);
    agent_grid.attach(
        &Label::builder().label("Poll (min):").halign(gtk4::Align::Start).build(),
        0, 1, 1, 1,
    );
    agent_grid.attach(&poll_spin, 1, 1, 1, 1);
    agent_grid.attach(
        &Label::builder().label("Max file (MB):").halign(gtk4::Align::Start).build(),
        0, 2, 1, 1,
    );
    agent_grid.attach(&max_spin, 1, 2, 1, 1);
    agent_frame.set_child(Some(&agent_grid));
    form.append(&agent_frame);

    // ── Watch paths section ───────────────────────────────────────────────────

    let watch_frame = Frame::builder().label("Watch Paths").build();
    let watch_outer = GBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(8)
        .margin_top(8)
        .margin_bottom(8)
        .margin_start(8)
        .margin_end(8)
        .build();
    let entries_box = GBox::builder()
        .orientation(Orientation::Vertical)
        .spacing(8)
        .build();

    let watch_rows: Rc<RefCell<Vec<WatchRow>>> = Rc::new(RefCell::new(Vec::new()));

    {
        let d = doc.borrow();
        let watch_opt = d.get("agent")
            .and_then(|i| i.as_table())
            .and_then(|t| t.get("watch"))
            .and_then(|w| w.as_array_of_tables());
        if let Some(aot) = watch_opt {
            for tbl in aot {
                let p = tbl.get("path").and_then(|v| v.as_str()).unwrap_or("");
                let pats: Vec<String> = tbl
                    .get("patterns")
                    .and_then(|v| v.as_array())
                    .into_iter()
                    .flat_map(|a| a.iter())
                    .filter_map(|v| v.as_str())
                    .map(str::to_owned)
                    .collect();
                let row = make_watch_row(&entries_box, p, &pats);
                watch_rows.borrow_mut().push(row);
            }
        }
    }

    let add_btn = Button::builder()
        .label("+ Add Watch Path")
        .halign(gtk4::Align::Start)
        .build();
    {
        let wr = watch_rows.clone();
        let eb = entries_box.clone();
        add_btn.connect_clicked(move |_| {
            let row = make_watch_row(&eb, "", &[]);
            wr.borrow_mut().push(row);
        });
    }
    watch_outer.append(&entries_box);
    watch_outer.append(&add_btn);
    watch_frame.set_child(Some(&watch_outer));
    form.append(&watch_frame);

    // ── Button row ────────────────────────────────────────────────────────────

    root.append(&scroll);
    root.append(&gtk4::Separator::builder().orientation(Orientation::Horizontal).build());

    let btn_row = GBox::builder()
        .orientation(Orientation::Horizontal)
        .spacing(8)
        .halign(gtk4::Align::End)
        .margin_top(8)
        .margin_bottom(8)
        .margin_end(12)
        .build();

    let cancel_btn = Button::builder().label("Cancel").build();
    {
        let w = window.downgrade();
        cancel_btn.connect_clicked(move |_| { w.upgrade().map(|x| x.close()); });
    }

    let save_btn = Button::builder().label("Save").build();
    save_btn.add_css_class("suggested-action");
    {
        let doc_c = doc.clone();
        let path_c = path.clone();
        let wr_c = watch_rows.clone();
        let win_c = window.clone();

        save_btn.connect_clicked(move |_| {
            let new_url = url_entry.text().to_string();
            let new_tok = tok_entry.text().to_string();
            let new_mid = mid_entry.text().to_string();
            let new_poll = poll_spin.value() as i64;
            let new_max = (max_spin.value() * 1024.0 * 1024.0) as i64;

            let new_watches: Vec<(String, Vec<String>)> = wr_c
                .borrow()
                .iter()
                .filter(|r| r.container.parent().is_some())
                .map(|r| {
                    let p = r.path_entry.text().trim().to_string();
                    let buf = &r.patterns_buffer;
                    let text = buf
                        .text(&buf.start_iter(), &buf.end_iter(), false)
                        .to_string();
                    let pats = text
                        .lines()
                        .map(str::trim)
                        .filter(|s| !s.is_empty())
                        .map(str::to_owned)
                        .collect();
                    (p, pats)
                })
                .collect();

            let mut d = doc_c.borrow_mut();

            if !d.contains_key("spine") {
                d.insert("spine", toml_edit::Item::Table(toml_edit::Table::new()));
            }
            if !d.contains_key("agent") {
                d.insert("agent", toml_edit::Item::Table(toml_edit::Table::new()));
            }

            d["spine"]["url"] = toml_edit::value(new_url);
            d["spine"]["agent_token"] = toml_edit::value(new_tok);

            if new_mid.is_empty() {
                if let Some(t) = d["agent"].as_table_mut() {
                    t.remove("machine_id");
                }
            } else {
                d["agent"]["machine_id"] = toml_edit::value(new_mid);
            }
            d["agent"]["poll_interval_minutes"] = toml_edit::value(new_poll);
            d["agent"]["max_file_bytes"] = toml_edit::value(new_max);

            // Replace [[agent.watch]] entries entirely.
            if let Some(t) = d["agent"].as_table_mut() {
                t.remove("watch");
            }
            if !new_watches.is_empty() {
                let mut aot = toml_edit::ArrayOfTables::new();
                for (p, pats) in &new_watches {
                    let mut tbl = toml_edit::Table::new();
                    tbl.insert("path", toml_edit::value(p.clone()));
                    let mut arr = toml_edit::Array::new();
                    for pat in pats {
                        arr.push(pat.as_str());
                    }
                    tbl.insert(
                        "patterns",
                        toml_edit::Item::Value(toml_edit::Value::Array(arr)),
                    );
                    aot.push(tbl);
                }
                d["agent"]["watch"] = toml_edit::Item::ArrayOfTables(aot);
            }

            let output = d.to_string();
            drop(d);

            let tmp = path_c.with_extension("toml.tmp");
            let write_result = std::fs::write(&tmp, &output)
                .and_then(|_| std::fs::rename(&tmp, &path_c));
            match write_result {
                Ok(_) => prompt_restart(&win_c),
                Err(e) => show_error(&win_c, &format!("Failed to save config:\n{e}")),
            }
        });
    }

    btn_row.append(&cancel_btn);
    btn_row.append(&save_btn);
    root.append(&btn_row);

    window.set_child(Some(&root));
    window.present();
}

fn main() {
    let app = Application::builder()
        .application_id(APP_ID)
        .build();
    app.connect_activate(build_ui);
    app.run();
}

#[cfg(test)]
mod tests {
    use toml_edit::{ArrayOfTables, Item, Table, Value};

    fn round_trip(input: &str) -> String {
        let mut doc: toml_edit::DocumentMut = input.parse().unwrap();

        doc["spine"]["url"] = toml_edit::value("https://updated.example.com");
        doc["agent"]["poll_interval_minutes"] = toml_edit::value(15i64);

        if let Some(t) = doc["agent"].as_table_mut() {
            t.remove("watch");
        }
        let mut aot = ArrayOfTables::new();
        let mut tbl = Table::new();
        tbl.insert("path", toml_edit::value("/home/user/notes"));
        let mut arr = toml_edit::Array::new();
        arr.push("**/*.md");
        tbl.insert("patterns", Item::Value(Value::Array(arr)));
        aot.push(tbl);
        doc["agent"]["watch"] = Item::ArrayOfTables(aot);

        doc.to_string()
    }

    #[test]
    fn config_round_trip_preserves_comments() {
        let input = r#"[spine]
# production server
url         = "https://lattice.rghsoftware.com"
agent_token = "secret"

[agent]
# poll interval comment
poll_interval_minutes = 30

[[agent.watch]]
path     = "/home/user/notes"
patterns = ["**/*.md"]

[[agent.watch]]
path     = "/home/user/books"
patterns = ["**/*.pdf"]
"#;

        let output = round_trip(input);
        assert!(output.contains("# production server"), "spine comment preserved");
        assert!(output.contains("# poll interval comment"), "agent comment preserved");
        assert!(output.contains("https://updated.example.com"), "url updated");
        assert!(output.contains("poll_interval_minutes = 15"), "poll updated");
        assert!(!output.contains("/home/user/books"), "removed watch entry gone");
        assert!(output.contains("/home/user/notes"), "kept watch entry present");
    }

    #[test]
    fn config_round_trip_empty_watch_removes_section() {
        let input = r#"[spine]
url         = "https://lattice.rghsoftware.com"
agent_token = "tok"

[agent]

[[agent.watch]]
path     = "/home/user/notes"
patterns = ["**/*.md"]
"#;
        let mut doc: toml_edit::DocumentMut = input.parse().unwrap();
        if let Some(t) = doc["agent"].as_table_mut() {
            t.remove("watch");
        }
        let output = doc.to_string();
        assert!(!output.contains("[[agent.watch]]"), "watch section removed");
    }

    #[test]
    fn fresh_config_missing_sections_produce_table_headers() {
        let mut doc: toml_edit::DocumentMut = "".parse().unwrap();

        if !doc.contains_key("spine") {
            doc.insert("spine", toml_edit::Item::Table(toml_edit::Table::new()));
        }
        if !doc.contains_key("agent") {
            doc.insert("agent", toml_edit::Item::Table(toml_edit::Table::new()));
        }

        doc["spine"]["url"] = toml_edit::value("https://example.com");
        doc["spine"]["agent_token"] = toml_edit::value("tok");
        doc["agent"]["poll_interval_minutes"] = toml_edit::value(15i64);
        doc["agent"]["max_file_bytes"] = toml_edit::value(10485760i64);

        let output = doc.to_string();
        assert!(!output.contains("spine = {"), "spine must not be an inline table");
        assert!(!output.contains("agent = {"), "agent must not be an inline table");
        assert!(output.contains("[spine]"), "spine must be a section header");
        assert!(output.contains("[agent]"), "agent must be a section header");
    }

    #[test]
    fn empty_machine_id_removes_key() {
        let input = r#"[spine]
url = "https://example.com"
agent_token = "tok"

[agent]
machine_id = "my-machine"
poll_interval_minutes = 15
max_file_bytes = 10485760
"#;
        let mut doc: toml_edit::DocumentMut = input.parse().unwrap();
        // Simulate save handler with empty machine_id field
        if let Some(t) = doc["agent"].as_table_mut() {
            t.remove("machine_id");
        }
        let output = doc.to_string();
        assert!(!output.contains("machine_id"), "machine_id must be removed when cleared");
    }

    #[test]
    fn watch_patterns_with_blank_lines_filtered() {
        let buf_text = "**/*.md\n\n  \n**/*.txt\n";
        let pats: Vec<String> = buf_text
            .lines()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .collect();
        assert_eq!(pats, ["**/*.md", "**/*.txt"]);
    }

    #[test]
    fn all_blank_watch_patterns_yield_empty_list() {
        let buf_text = "\n\n   \n";
        let pats: Vec<String> = buf_text
            .lines()
            .map(str::trim)
            .filter(|s| !s.is_empty())
            .map(str::to_owned)
            .collect();
        assert!(pats.is_empty());
    }
}
