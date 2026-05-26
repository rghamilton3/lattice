use std::path::Path;
use toml_edit::{ArrayOfTables, DocumentMut, Item, Table, Value};

#[derive(Default, Clone)]
pub struct WatchRow {
    pub path: String,
    /// Glob patterns, one per line (blank lines ignored on save).
    pub patterns: String,
}

pub struct ConfigForm {
    pub spine_url: String,
    pub spine_token: String,
    pub machine_id: String,
    pub poll_minutes: i64,
    pub max_file_mb: f64,
    pub watch_rows: Vec<WatchRow>,
}

/// Reads the config file and returns the parsed document alongside a populated form.
pub fn load(path: &Path) -> Result<(DocumentMut, ConfigForm), String> {
    let content = match std::fs::read_to_string(path) {
        Ok(content) => content,
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => String::new(),
        Err(e) => return Err(format!("Cannot read config at {}:\n{e}", path.display())),
    };
    let doc: DocumentMut = content
        .parse()
        .map_err(|e| format!("Cannot parse config:\n{e}"))?;

    let spine = doc.get("spine").and_then(|i| i.as_table());
    let agent = doc.get("agent").and_then(|i| i.as_table());

    let spine_url = spine
        .and_then(|t| t.get("url"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let spine_token = spine
        .and_then(|t| t.get("agent_token"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let machine_id = agent
        .and_then(|t| t.get("machine_id"))
        .and_then(|v| v.as_str())
        .unwrap_or("")
        .to_owned();
    let poll_minutes = agent
        .and_then(|t| t.get("poll_interval_minutes"))
        .and_then(|v| v.as_integer())
        .unwrap_or(15);
    let max_file_mb = agent
        .and_then(|t| t.get("max_file_bytes"))
        .and_then(|v| v.as_integer())
        .unwrap_or(10 * 1024 * 1024) as f64
        / (1024.0 * 1024.0);

    let watch_rows = agent
        .and_then(|t| t.get("watch"))
        .and_then(|w| w.as_array_of_tables())
        .map(|aot| {
            aot.iter()
                .map(|tbl| {
                    let path = tbl
                        .get("path")
                        .and_then(|v| v.as_str())
                        .unwrap_or("")
                        .to_owned();
                    let patterns = tbl
                        .get("patterns")
                        .and_then(|v| v.as_array())
                        .into_iter()
                        .flat_map(|a| a.iter())
                        .filter_map(|v| v.as_str())
                        .collect::<Vec<_>>()
                        .join("\n");
                    WatchRow { path, patterns }
                })
                .collect()
        })
        .unwrap_or_default();

    let form = ConfigForm {
        spine_url,
        spine_token,
        machine_id,
        poll_minutes,
        max_file_mb,
        watch_rows,
    };

    Ok((doc, form))
}

pub fn validate(form: &ConfigForm) -> Result<(), String> {
    let mut errors = Vec::new();

    if form.spine_url.trim().is_empty() {
        errors.push("Spine URL is required.");
    } else if !(form.spine_url.starts_with("http://") || form.spine_url.starts_with("https://")) {
        errors.push("Spine URL must start with http:// or https://.");
    }

    if form.spine_token.trim().is_empty() {
        errors.push("Agent token is required.");
    }
    if form.poll_minutes < 1 {
        errors.push("Poll interval must be at least 1 minute.");
    }
    if form.max_file_mb <= 0.0 {
        errors.push("Max file size must be greater than 0 MB.");
    }

    if errors.is_empty() {
        Ok(())
    } else {
        Err(errors.join("\n"))
    }
}

/// Writes form values back into the document, preserving all existing comments and formatting.
pub fn apply(doc: &mut DocumentMut, form: &ConfigForm) {
    if !doc.contains_key("spine") {
        doc.insert("spine", Item::Table(Table::new()));
    }
    if !doc.contains_key("agent") {
        doc.insert("agent", Item::Table(Table::new()));
    }

    doc["spine"]["url"] = toml_edit::value(form.spine_url.clone());
    doc["spine"]["agent_token"] = toml_edit::value(form.spine_token.clone());

    if form.machine_id.is_empty() {
        if let Some(t) = doc["agent"].as_table_mut() {
            t.remove("machine_id");
        }
    } else {
        doc["agent"]["machine_id"] = toml_edit::value(form.machine_id.clone());
    }
    doc["agent"]["poll_interval_minutes"] = toml_edit::value(form.poll_minutes);
    doc["agent"]["max_file_bytes"] = toml_edit::value((form.max_file_mb * 1024.0 * 1024.0) as i64);

    if let Some(t) = doc["agent"].as_table_mut() {
        t.remove("watch");
    }

    let watches: Vec<(String, Vec<String>)> = form
        .watch_rows
        .iter()
        .map(|row| {
            let pats = row
                .patterns
                .lines()
                .map(str::trim)
                .filter(|s| !s.is_empty())
                .map(str::to_owned)
                .collect();
            (row.path.trim().to_owned(), pats)
        })
        .filter(|(path, _)| !path.is_empty())
        .collect();

    if !watches.is_empty() {
        let mut aot = ArrayOfTables::new();
        for (p, pats) in &watches {
            let mut tbl = Table::new();
            tbl.insert("path", toml_edit::value(p.clone()));
            let mut arr = toml_edit::Array::new();
            for pat in pats {
                arr.push(pat.as_str());
            }
            tbl.insert("patterns", Item::Value(Value::Array(arr)));
            aot.push(tbl);
        }
        doc["agent"]["watch"] = Item::ArrayOfTables(aot);
    }
}

/// Atomically writes the document to disk via a temp file + rename.
pub fn save(doc: &DocumentMut, path: &Path) -> Result<(), String> {
    let tmp = path.with_extension("toml.tmp");
    let output = doc.to_string();
    std::fs::write(&tmp, &output)
        .and_then(|_| std::fs::rename(&tmp, path))
        .map_err(|e| format!("Failed to save config:\n{e}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn round_trip(input: &str) -> String {
        let mut doc: DocumentMut = input.parse().unwrap();
        let form = ConfigForm {
            spine_url: "https://updated.example.com".into(),
            spine_token: "secret".into(),
            machine_id: String::new(),
            poll_minutes: 15,
            max_file_mb: (10 * 1024 * 1024) as f64 / (1024.0 * 1024.0),
            watch_rows: vec![WatchRow {
                path: "/home/user/notes".into(),
                patterns: "**/*.md".into(),
            }],
        };
        apply(&mut doc, &form);
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
        assert!(
            output.contains("# production server"),
            "spine comment preserved"
        );
        assert!(
            output.contains("# poll interval comment"),
            "agent comment preserved"
        );
        assert!(
            output.contains("https://updated.example.com"),
            "url updated"
        );
        assert!(
            output.contains("poll_interval_minutes = 15"),
            "poll updated"
        );
        assert!(
            !output.contains("/home/user/books"),
            "removed watch entry gone"
        );
        assert!(
            output.contains("/home/user/notes"),
            "kept watch entry present"
        );
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
        let mut doc: DocumentMut = input.parse().unwrap();
        if let Some(t) = doc["agent"].as_table_mut() {
            t.remove("watch");
        }
        let output = doc.to_string();
        assert!(!output.contains("[[agent.watch]]"), "watch section removed");
    }

    #[test]
    fn fresh_config_missing_sections_produce_table_headers() {
        let mut doc: DocumentMut = "".parse().unwrap();

        if !doc.contains_key("spine") {
            doc.insert("spine", Item::Table(Table::new()));
        }
        if !doc.contains_key("agent") {
            doc.insert("agent", Item::Table(Table::new()));
        }

        doc["spine"]["url"] = toml_edit::value("https://example.com");
        doc["spine"]["agent_token"] = toml_edit::value("tok");
        doc["agent"]["poll_interval_minutes"] = toml_edit::value(15i64);
        doc["agent"]["max_file_bytes"] = toml_edit::value(10485760i64);

        let output = doc.to_string();
        assert!(
            !output.contains("spine = {"),
            "spine must not be an inline table"
        );
        assert!(
            !output.contains("agent = {"),
            "agent must not be an inline table"
        );
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
        let mut doc: DocumentMut = input.parse().unwrap();
        if let Some(t) = doc["agent"].as_table_mut() {
            t.remove("machine_id");
        }
        let output = doc.to_string();
        assert!(
            !output.contains("machine_id"),
            "machine_id must be removed when cleared"
        );
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

    #[test]
    fn validation_reports_required_fields() {
        let form = ConfigForm {
            spine_url: "".into(),
            spine_token: "".into(),
            machine_id: String::new(),
            poll_minutes: 0,
            max_file_mb: 0.0,
            watch_rows: vec![],
        };

        let err = validate(&form).unwrap_err();
        assert!(err.contains("Spine URL is required"));
        assert!(err.contains("Agent token is required"));
        assert!(err.contains("Poll interval"));
        assert!(err.contains("Max file size"));
    }

    #[test]
    fn apply_skips_empty_watch_paths_and_blank_patterns() {
        let mut doc: DocumentMut = "".parse().unwrap();
        let form = ConfigForm {
            spine_url: "https://example.com".into(),
            spine_token: "tok".into(),
            machine_id: String::new(),
            poll_minutes: 15,
            max_file_mb: 10.0,
            watch_rows: vec![
                WatchRow {
                    path: "   ".into(),
                    patterns: "**/*.md".into(),
                },
                WatchRow {
                    path: r#"C:\Users\Riley\Notes"#.into(),
                    patterns: "**/*.md\n\n  \n**/*.txt".into(),
                },
            ],
        };

        apply(&mut doc, &form);
        let output = doc.to_string();
        assert!(!output.contains("path = \"   \""));
        assert!(output.contains("Riley"));
        assert!(output.contains("Notes"));
        assert!(output.contains("**/*.md"));
        assert!(output.contains("**/*.txt"));
    }
}
