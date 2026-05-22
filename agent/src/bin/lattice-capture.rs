//! lattice-capture — POST quick text captures to the Lattice spine.
//!
//! Native replacement for the legacy `lattice-capture.sh`. Owns a local SQLite
//! queue at `~/.local/share/lattice/queue.db`; drains it at the start of each
//! successful run and falls back to it when the spine is unreachable.
//!
//! Text source resolution order:
//!   1. CLI args (joined with spaces)
//!   2. stdin if not a TTY
//!   3. interactive dmenu prompt (walker → wofi → rofi)

use anyhow::{Context, Result, bail};
use lattice_agent::config;
use rusqlite::{Connection, params};
use serde::{Deserialize, Serialize};
use std::io::{self, IsTerminal, Read};
use std::path::PathBuf;
use std::process::{Command, Stdio};
use std::time::Duration;

const CAPTURE_SOURCE: &str = "desktop-hotkey";
const POST_TIMEOUT: Duration = Duration::from_secs(5);

// dmenu-style prompts, tried in order. First one found on $PATH wins.
const DMENU_CANDIDATES: &[(&str, &[&str])] = &[
    ("walker", &["--dmenu"]),
    ("wofi", &["--dmenu"]),
    ("rofi", &["-dmenu"]),
];

#[derive(Serialize)]
struct Payload<'a> {
    text: &'a str,
    source: &'a str,
    captured_at: &'a str,
}

#[derive(Deserialize)]
struct CaptureResponse {
    id: i64,
}

#[tokio::main(flavor = "current_thread")]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lattice_capture=info".parse().unwrap()),
        )
        .init();

    if let Err(e) = run().await {
        eprintln!("lattice-capture: {e:#}");
        notify(&format!("{e}"), "critical");
        std::process::exit(1);
    }
}

async fn run() -> Result<()> {
    let cfg = config::load().context("loading config")?;
    if cfg.agent_token.is_empty() {
        bail!("spine.agent_token is empty in ~/.config/lattice/config.toml");
    }

    let text = match read_text()? {
        Some(t) if !t.trim().is_empty() => t,
        _ => return Ok(()),
    };

    let captured_at = now_iso();
    let queue = open_queue().context("opening offline queue")?;

    let client = reqwest::Client::builder()
        .timeout(POST_TIMEOUT)
        .build()
        .context("building HTTP client")?;

    drain_queue(&queue, &client, &cfg).await;

    match post(&client, &cfg, &text, CAPTURE_SOURCE, &captured_at).await {
        Ok(id) => notify(&format!("Captured #{id}"), "low"),
        Err(post_err) => match enqueue(&queue, &text, CAPTURE_SOURCE, &captured_at) {
            Ok(()) => {
                let reason = classify_post_error(&post_err);
                tracing::warn!(error = %post_err, reason = %reason, "spine post failed; capture queued");
                notify(&format!("Capture queued ({reason})"), "normal");
            }
            Err(queue_err) => {
                // Both spine AND the local queue failed — the capture is about
                // to be lost. Echo the text to stderr so the user can recover
                // it from journalctl / the invoking shell, and raise a loud
                // critical notification.
                let spine_reason = classify_post_error(&post_err);
                tracing::error!(
                    spine_error = %post_err,
                    queue_error = %queue_err,
                    "spine post AND queue write both failed; capture text follows"
                );
                eprintln!("--- LOST CAPTURE (copy from here) ---");
                eprintln!("{text}");
                eprintln!("--- END LOST CAPTURE ---");
                notify(
                    &format!("CAPTURE LOST — spine: {spine_reason}; queue: {queue_err}"),
                    "critical",
                );
                return Err(queue_err.context("enqueueing capture after spine failure"));
            }
        },
    }

    Ok(())
}

// ── Text input ────────────────────────────────────────────────────────────────

fn read_text() -> Result<Option<String>> {
    let args: Vec<String> = std::env::args().skip(1).collect();
    if !args.is_empty() {
        return Ok(Some(args.join(" ")));
    }
    let stdin = io::stdin();
    if !stdin.is_terminal() {
        let mut buf = String::new();
        stdin.lock().read_to_string(&mut buf)?;
        return Ok(Some(buf.trim_end_matches('\n').to_owned()));
    }
    prompt_dmenu()
}

fn prompt_dmenu() -> Result<Option<String>> {
    for (bin, args) in DMENU_CANDIDATES {
        if which(bin).is_none() {
            continue;
        }
        let child = Command::new(bin)
            .args(*args)
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::inherit())
            .spawn()
            .with_context(|| format!("spawning {bin}"))?;
        let out = child.wait_with_output()?;
        if !out.status.success() {
            // Non-zero typically means the user dismissed (Esc / closed window).
            return Ok(None);
        }
        let text = String::from_utf8_lossy(&out.stdout).trim().to_owned();
        return Ok(if text.is_empty() { None } else { Some(text) });
    }
    bail!("no dmenu prompt available (install walker, wofi, or rofi)");
}

fn which(bin: &str) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .map(|d| d.join(bin))
        .find(|p| p.is_file())
}

// ── Offline queue ─────────────────────────────────────────────────────────────

fn queue_path() -> PathBuf {
    let base = std::env::var_os("XDG_DATA_HOME")
        .map(PathBuf::from)
        .unwrap_or_else(|| {
            let home = std::env::var("HOME").unwrap_or_else(|_| "/root".to_owned());
            PathBuf::from(home).join(".local").join("share")
        });
    base.join("lattice").join("queue.db")
}

fn open_queue() -> Result<Connection> {
    let path = queue_path();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let conn = Connection::open(&path)?;
    // Schema is unchanged from the legacy lattice-capture.sh, so an existing
    // queue.db from the bash version carries over without migration.
    conn.execute(
        "CREATE TABLE IF NOT EXISTS queue (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            text        TEXT    NOT NULL,
            source      TEXT    NOT NULL,
            captured_at TEXT    NOT NULL,
            queued_at   TEXT    NOT NULL
         )",
        [],
    )?;
    Ok(conn)
}

fn enqueue(conn: &Connection, text: &str, source: &str, captured_at: &str) -> Result<()> {
    conn.execute(
        "INSERT INTO queue (text, source, captured_at, queued_at) VALUES (?1, ?2, ?3, ?4)",
        params![text, source, captured_at, now_iso()],
    )?;
    Ok(())
}

async fn drain_queue(conn: &Connection, client: &reqwest::Client, cfg: &config::Config) {
    let rows: Vec<(i64, String, String, String)> = match conn
        .prepare("SELECT id, text, source, captured_at FROM queue ORDER BY id")
        .and_then(|mut stmt| {
            stmt.query_map([], |row| {
                Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?))
            })
            .map(|iter| {
                iter.filter_map(|r| match r {
                    Ok(row) => Some(row),
                    Err(e) => {
                        tracing::warn!(error = %e, "skipping corrupt queue row");
                        None
                    }
                })
                .collect()
            })
        }) {
        Ok(rows) => rows,
        Err(e) => {
            tracing::warn!(error = %e, "queue read failed; skipping drain");
            return;
        }
    };

    let mut flushed = 0u32;
    for (id, text, source, captured_at) in rows {
        match post(client, cfg, &text, &source, &captured_at).await {
            Ok(_) => {
                if let Err(e) = conn.execute("DELETE FROM queue WHERE id = ?1", params![id]) {
                    tracing::warn!(error = %e, id, "failed to delete drained row");
                }
                flushed += 1;
            }
            Err(e) => {
                tracing::debug!(error = %e, "drain post failed; will retry next run");
                break;
            }
        }
    }
    if flushed > 0 {
        notify(&format!("Flushed {flushed} queued capture(s)"), "low");
    }
}

// ── Spine I/O ─────────────────────────────────────────────────────────────────

async fn post(
    client: &reqwest::Client,
    cfg: &config::Config,
    text: &str,
    source: &str,
    captured_at: &str,
) -> Result<i64> {
    let url = format!("{}/api/agent/capture", cfg.spine_url);
    let resp = client
        .post(&url)
        .bearer_auth(&cfg.agent_token)
        .json(&Payload { text, source, captured_at })
        .send()
        .await?
        .error_for_status()?
        .json::<CaptureResponse>()
        .await?;
    Ok(resp.id)
}

/// Translates a reqwest failure into a short, user-facing reason that's
/// accurate about what actually went wrong (vs. always blaming "spine
/// unreachable"). Falls back to the displayed error if we can't classify.
fn classify_post_error(err: &anyhow::Error) -> String {
    let Some(re) = err.downcast_ref::<reqwest::Error>() else {
        return err.to_string();
    };
    if re.is_timeout() {
        return "spine timeout".into();
    }
    if re.is_connect() {
        return "spine unreachable".into();
    }
    if let Some(status) = re.status() {
        return match status.as_u16() {
            401 | 403 => format!("spine rejected token ({status})"),
            300..=399 => format!("spine redirected to {status} (auth proxy intercepting /api/agent?)"),
            other => format!("spine HTTP {other}"),
        };
    }
    if re.is_decode() {
        // Hit when the body isn't valid JSON — typically because something
        // upstream (Authentik, Caddy error page) returned HTML instead of the
        // expected {id} payload. The bearer-auth route should not see this.
        return "spine response not JSON (auth proxy in front of /api/agent?)".into();
    }
    if re.is_redirect() {
        return "spine redirected (auth proxy in front of /api/agent?)".into();
    }
    re.to_string()
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

fn notify(body: &str, urgency: &str) {
    let _ = Command::new("notify-send")
        .args(["Lattice", body, "--urgency", urgency])
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
}

// Shell out to `date` — same pragmatic choice the bash script made. Avoids
// pulling in `chrono` or hand-rolling the civil-date conversion just for this.
fn now_iso() -> String {
    Command::new("date")
        .args(["-u", "+%Y-%m-%dT%H:%M:%SZ"])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_owned())
        .unwrap_or_else(|| "1970-01-01T00:00:00Z".to_owned())
}
