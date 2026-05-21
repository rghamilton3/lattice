use crate::status::SharedStatus;
use std::fs;
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixListener;
use tracing::{debug, warn};

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

pub async fn serve(status: SharedStatus) {
    let path = socket_path();
    // Remove stale socket from a previous run.
    let _ = fs::remove_file(&path);

    let listener = match UnixListener::bind(&path) {
        Ok(l) => l,
        Err(e) => {
            warn!(error = %e, path = %path.display(), "IPC socket bind failed");
            return;
        }
    };

    debug!(path = %path.display(), "IPC socket listening");

    loop {
        match listener.accept().await {
            Ok((stream, _)) => {
                let status = status.clone();
                tokio::spawn(async move { handle(stream, status).await });
            }
            Err(e) => warn!(error = %e, "IPC accept error"),
        }
    }
}

async fn handle(stream: tokio::net::UnixStream, status: SharedStatus) {
    let (reader, mut writer) = stream.into_split();
    let mut reader = BufReader::new(reader);
    let mut line = String::new();

    if reader.read_line(&mut line).await.unwrap_or(0) == 0 {
        return;
    }

    if line.trim() == "status" {
        let json = {
            let s = status.read().unwrap();
            serde_json::to_string(&*s).unwrap_or_default()
        };
        let _ = writer.write_all(json.as_bytes()).await;
        let _ = writer.write_all(b"\n").await;
        debug!("IPC: served status");
    }
}
