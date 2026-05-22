use serde::Deserialize;
use std::io::{self, BufRead, BufReader, Write};
use std::path::PathBuf;
use std::time::Duration;

// These mirror agent/src/status.rs but are Deserialize-only — the IPC client
// only reads JSON from the agent; it never produces AgentStatus itself.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanState {
    Idle,
    Scanning,
    Error,
    #[serde(other)]
    Unknown,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgentStatus {
    pub state: ScanState,
    pub last_scan_at: Option<String>,
    pub last_indexed: u32,
    pub last_skipped: u32,
    pub last_errors: u32,
    pub spine_ok: bool,
    pub last_error_msg: Option<String>,
}

pub enum FetchResult {
    Running(AgentStatus),
    Stopped,
    Error(String),
}

#[cfg(unix)]
pub fn ipc_path() -> PathBuf {
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

#[cfg(windows)]
pub fn ipc_path() -> PathBuf {
    PathBuf::from(r"\\.\pipe\lattice-agent")
}

pub fn fetch_status(timeout: Duration) -> FetchResult {
    match send_command("status", timeout) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => FetchResult::Stopped,
        Err(e) => FetchResult::Error(e.to_string()),
        Ok(line) => match serde_json::from_str(line.trim()) {
            Ok(s) => FetchResult::Running(s),
            Err(e) => FetchResult::Error(e.to_string()),
        },
    }
}

/// Sends a single-line command to the agent and returns the response line.
/// Returns `Err` with `NotFound` kind when the agent is not running (socket/pipe absent).
pub fn send_command(cmd: &str, timeout: Duration) -> io::Result<String> {
    #[cfg(unix)]
    return unix_send(cmd, timeout);
    #[cfg(windows)]
    return win_send(cmd, timeout);
    #[cfg(not(any(unix, windows)))]
    Err(io::Error::new(
        io::ErrorKind::Unsupported,
        "IPC not supported on this platform",
    ))
}

#[cfg(unix)]
fn unix_send(cmd: &str, timeout: Duration) -> io::Result<String> {
    use std::os::unix::net::UnixStream;
    let mut stream = UnixStream::connect(ipc_path())?;
    stream.set_write_timeout(Some(timeout))?;
    stream.set_read_timeout(Some(timeout))?;
    stream.write_all(format!("{cmd}\n").as_bytes())?;
    let mut reader = BufReader::new(&stream);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    Ok(line)
}

#[cfg(windows)]
fn win_send(cmd: &str, _timeout: Duration) -> io::Result<String> {
    // Named-pipe client: open as a synchronous file. Windows has no client-side
    // per-call timeout equivalent to Unix set_read_timeout / set_write_timeout.
    // In practice the server always closes its end of the pipe after sending the
    // response, so read_line returns promptly on EOF. A server stall would block
    // this call indefinitely; this is acceptable for local IPC to a trusted process.
    use std::fs::OpenOptions;
    let mut file = OpenOptions::new().read(true).write(true).open(ipc_path())?;
    file.write_all(format!("{cmd}\n").as_bytes())?;
    let mut reader = BufReader::new(&file);
    let mut line = String::new();
    reader.read_line(&mut line)?;
    Ok(line)
}
