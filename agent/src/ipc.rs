use crate::status::SharedStatus;
use std::fs;
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;
use tokio::sync::mpsc;
use tracing::{debug, error, warn};

pub enum AgentCommand {
    ForceReindex,
}

pub fn socket_path() -> PathBuf {
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

pub async fn serve(status: SharedStatus, cmd_tx: mpsc::Sender<AgentCommand>) {
    let path = socket_path();
    // Remove stale socket from a previous run.
    let _ = fs::remove_file(&path);

    let listener = match UnixListener::bind(&path) {
        Ok(l) => l,
        Err(e) => {
            error!(error = %e, path = %path.display(), "IPC socket bind failed — IPC is permanently disabled");
            return;
        }
    };

    debug!(path = %path.display(), "IPC socket listening");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let status = status.clone();
                let tx = cmd_tx.clone();
                tokio::spawn(async move { handle(stream, status, tx).await });
            }
            Err(e) => warn!(error = %e, "IPC accept error"),
        }
    }
}

async fn handle(
    stream: tokio::net::UnixStream,
    status: SharedStatus,
    cmd_tx: mpsc::Sender<AgentCommand>,
) {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();

    if reader.read_line(&mut line).await.unwrap_or(0) == 0 {
        return;
    }

    match line.trim() {
        "status" => {
            let json = {
                let s = match status.read() {
                    Ok(g) => g,
                    Err(e) => {
                        error!(error = %e, "IPC: status lock poisoned — closing connection");
                        return;
                    }
                };
                match serde_json::to_string(&*s) {
                    Ok(j) => j,
                    Err(e) => {
                        error!(error = %e, "IPC: failed to serialize status");
                        return;
                    }
                }
                // s (RwLockReadGuard) drops here, before the .await below
            };
            let _ = writer.write_all(json.as_bytes()).await;
            let _ = writer.write_all(b"\n").await;
            debug!("IPC: served status");
        }
        "reindex" => {
            // A full channel means a reindex is already queued - treat as success.
            let response = match cmd_tx.try_send(AgentCommand::ForceReindex) {
                Ok(_) | Err(mpsc::error::TrySendError::Full(_)) => b"{\"ok\":true}\n" as &[u8],
                Err(mpsc::error::TrySendError::Closed(_)) => b"{\"error\":\"agent shutting down\"}\n",
            };
            let _ = writer.write_all(response).await;
            debug!("IPC: queued reindex");
        }
        cmd => {
            debug!(command = cmd, "IPC: unknown command");
            let _ = writer.write_all(b"{\"error\":\"unknown command\"}\n").await;
        }
    }
}
