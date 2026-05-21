use crate::cache::Cache;
use crate::config::{Config, WatchEntry};
use crate::extract;
use crate::status::{ScanState, SharedStatus};
use anyhow::Result;
use mime_guess::MimeGuess;
use serde::Serialize;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::{debug, error, info, warn};
use walkdir::WalkDir;

#[derive(Serialize)]
struct IndexPayload<'a> {
    machine_id: &'a str,
    path: &'a str,
    hash: &'a str,
    mime_type: &'a str,
    text: &'a str,
    modified_at: &'a str,
    size_bytes: u64,
}

enum ProcessResult {
    Indexed,
    Skipped,
    SpineFail(String),
}

pub async fn run_pass(cfg: &Config, cache: &Cache, client: &reqwest::Client, status: &SharedStatus) {
    {
        let mut s = status.write().unwrap();
        s.state = ScanState::Scanning;
    }

    info!("starting scan pass");
    let mut indexed = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;
    let mut spine_errors = 0u32;
    let mut last_err: Option<String> = None;

    for entry in &cfg.watch {
        let (i, sk, e, se, le) = scan_watch(cfg, cache, client, entry).await;
        indexed += i;
        skipped += sk;
        errors += e;
        spine_errors += se;
        if le.is_some() {
            last_err = le;
        }
    }

    info!(indexed, skipped, errors, "scan pass complete");

    let mut s = status.write().unwrap();
    s.state = if errors > 0 || spine_errors > 0 {
        ScanState::Error
    } else {
        ScanState::Idle
    };
    s.last_scan_at = Some(now_iso());
    s.last_indexed = indexed;
    s.last_skipped = skipped;
    s.last_errors = errors + spine_errors;
    // Only update spine_ok when we actually tried to contact the spine.
    if indexed > 0 || spine_errors > 0 {
        s.spine_ok = spine_errors == 0;
    }
    s.last_error_msg = last_err;
}

async fn scan_watch(
    cfg: &Config,
    cache: &Cache,
    client: &reqwest::Client,
    entry: &WatchEntry,
) -> (u32, u32, u32, u32, Option<String>) {
    let root = Path::new(&entry.path);
    if !root.exists() {
        warn!(path = %entry.path, "watch path does not exist, skipping");
        return (0, 0, 0, 0, None);
    }

    let patterns: Vec<glob::Pattern> = entry
        .patterns
        .iter()
        .filter_map(|p| {
            glob::Pattern::new(p)
                .map_err(|e| warn!(pattern = %p, error = %e, "invalid glob pattern"))
                .ok()
        })
        .collect();

    let mut indexed = 0u32;
    let mut skipped = 0u32;
    let mut errors = 0u32;
    let mut spine_errors = 0u32;
    let mut last_err: Option<String> = None;

    for dir_entry in WalkDir::new(root)
        .follow_links(false)
        .into_iter()
        .filter_entry(|e| e.depth() == 0 || !is_hidden(e))
    {
        let dir_entry = match dir_entry {
            Ok(e) => e,
            Err(err) => {
                warn!(error = %err, "walkdir error");
                errors += 1;
                last_err = Some(err.to_string());
                continue;
            }
        };

        if !dir_entry.file_type().is_file() {
            continue;
        }

        let file_path = dir_entry.path();
        let rel = file_path
            .strip_prefix(root)
            .unwrap_or(file_path)
            .to_string_lossy();

        if !patterns.iter().any(|p| p.matches(&rel)) {
            continue;
        }

        match process_file(cfg, cache, client, file_path).await {
            Ok(ProcessResult::Indexed) => indexed += 1,
            Ok(ProcessResult::Skipped) => skipped += 1,
            Ok(ProcessResult::SpineFail(msg)) => {
                spine_errors += 1;
                last_err = Some(msg);
            }
            Err(e) => {
                warn!(path = %file_path.display(), error = %e, "file processing failed");
                errors += 1;
                last_err = Some(e.to_string());
            }
        }
    }

    (indexed, skipped, errors, spine_errors, last_err)
}

/// Returns the outcome of attempting to index one file.
async fn process_file(
    cfg: &Config,
    cache: &Cache,
    client: &reqwest::Client,
    path: &Path,
) -> Result<ProcessResult> {
    let meta = std::fs::metadata(path)?;
    let size_bytes = meta.len();

    if size_bytes > cfg.max_file_bytes {
        debug!(
            path = %path.display(),
            size = size_bytes,
            limit = cfg.max_file_bytes,
            "file exceeds size limit, skipping"
        );
        return Ok(ProcessResult::Skipped);
    }

    let mtime_secs = meta
        .modified()?
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);

    let path_str = path.to_string_lossy();

    // Fast path: if mtime and size match the cache, skip hashing entirely.
    if let Some(cached) = cache.get(&path_str)
        && cached.mtime_secs == mtime_secs
        && cached.size_bytes == size_bytes as i64
    {
        return Ok(ProcessResult::Skipped);
    }

    let content = std::fs::read(path)?;
    let hash = blake3::hash(&content).to_hex().to_string();

    // If the hash is unchanged (mtime drift, etc.), update cache metadata and skip.
    if let Some(cached) = cache.get(&path_str)
        && cached.hash == hash
    {
        cache.upsert(&path_str, mtime_secs, size_bytes as i64, &hash);
        return Ok(ProcessResult::Skipped);
    }

    let mime = MimeGuess::from_path(path)
        .first_or_octet_stream()
        .to_string();

    let text = match extract::extract_text(path, &mime)? {
        Some(t) => t,
        None => {
            debug!(path = %path.display(), mime = %mime, "unsupported mime type, skipping");
            return Ok(ProcessResult::Skipped);
        }
    };

    let modified_at = chrono_iso(mtime_secs);

    let payload = IndexPayload {
        machine_id: &cfg.machine_id,
        path: &path_str,
        hash: &hash,
        mime_type: &mime,
        text: &text,
        modified_at: &modified_at,
        size_bytes,
    };

    let url = format!("{}/api/agent/index", cfg.spine_url);
    let resp = client
        .post(&url)
        .bearer_auth(&cfg.agent_token)
        .json(&payload)
        .send()
        .await;

    match resp {
        Err(e) => {
            error!(path = %path.display(), error = %e, "POST to spine failed, will retry next poll");
            Ok(ProcessResult::SpineFail(e.to_string()))
        }
        Ok(r) if !r.status().is_success() => {
            let http_status = r.status();
            let body = r.text().await.unwrap_or_default();
            error!(
                path = %path.display(),
                status = %http_status,
                body = %body,
                "spine rejected index payload, will retry next poll"
            );
            Ok(ProcessResult::SpineFail(format!("spine {http_status}")))
        }
        Ok(_) => {
            cache.upsert(&path_str, mtime_secs, size_bytes as i64, &hash);
            debug!(path = %path.display(), "indexed");
            Ok(ProcessResult::Indexed)
        }
    }
}

fn is_hidden(entry: &walkdir::DirEntry) -> bool {
    entry
        .file_name()
        .to_str()
        .map(|s| s.starts_with('.'))
        .unwrap_or(false)
}

fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    chrono_iso(secs)
}

fn chrono_iso(unix_secs: i64) -> String {
    // Manual ISO 8601 UTC formatting without a date crate dependency.
    use std::time::Duration;
    let t = UNIX_EPOCH + Duration::from_secs(unix_secs.max(0) as u64);
    let secs_since_epoch = t.duration_since(UNIX_EPOCH).unwrap().as_secs();

    // Simple UTC conversion (no leap-second handling; fine for file mtimes).
    let s = secs_since_epoch;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days = s / 86400;

    // Days since 1970-01-01 → calendar date (Gregorian proleptic).
    let (year, month, day) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from https://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests {
    #[test]
    fn glob_matches_root_depth() {
        let pat = glob::Pattern::new("**/*.md").unwrap();
        assert!(pat.matches("file.md"), "**/*.md should match file.md at root depth");
        assert!(pat.matches("sub/file.md"), "**/*.md should match sub/file.md");
    }

    #[test]
    fn chrono_iso_epoch() {
        assert_eq!(super::chrono_iso(0), "1970-01-01T00:00:00Z");
    }

    #[test]
    fn chrono_iso_known() {
        // 2024-01-15 11:50:00 UTC = 1705319400
        assert_eq!(super::chrono_iso(1705319400), "2024-01-15T11:50:00Z");
    }
}
