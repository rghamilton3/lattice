use crate::status::SharedStatus;
use lattice_agent::ipc_client::ipc_path;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::sync::mpsc;
use tracing::{debug, error, warn};

pub enum AgentCommand {
    ForceReindex,
}

pub async fn serve(status: SharedStatus, cmd_tx: mpsc::Sender<AgentCommand>) {
    #[cfg(unix)]
    unix_serve(status, cmd_tx).await;
    #[cfg(windows)]
    win_serve(status, cmd_tx).await;
    #[cfg(not(any(unix, windows)))]
    error!("IPC not supported on this platform");
}

// ── Unix implementation ───────────────────────────────────────────────────────

#[cfg(unix)]
async fn unix_serve(status: SharedStatus, cmd_tx: mpsc::Sender<AgentCommand>) {
    use std::fs;
    use tokio::net::UnixListener;

    let path = ipc_path();
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
                tokio::spawn(async move { handle_unix(stream, status, tx).await });
            }
            Err(e) => warn!(error = %e, "IPC accept error"),
        }
    }
}

#[cfg(unix)]
async fn handle_unix(
    stream: tokio::net::UnixStream,
    status: SharedStatus,
    cmd_tx: mpsc::Sender<AgentCommand>,
) {
    let (reader, mut writer) = stream.into_split();
    handle_conn(BufReader::new(reader), &mut writer, status, cmd_tx).await;
}

// ── Windows implementation ────────────────────────────────────────────────────

#[cfg(windows)]
async fn win_serve(status: SharedStatus, cmd_tx: mpsc::Sender<AgentCommand>) {
    use tokio::net::windows::named_pipe::ServerOptions;

    let pipe_name = ipc_path();
    let pipe_str = pipe_name.to_str().unwrap_or(r"\\.\pipe\lattice-agent");

    let mut server = match ServerOptions::new()
        .first_pipe_instance(true)
        .create(pipe_str)
    {
        Ok(s) => s,
        Err(e) => {
            error!(error = %e, pipe = pipe_str, "Named pipe create failed — IPC is permanently disabled");
            return;
        }
    };

    debug!(pipe = pipe_str, "IPC named pipe listening");

    loop {
        if let Err(e) = server.connect().await {
            warn!(error = %e, "IPC accept error");
            continue;
        }

        let next = match ServerOptions::new().create(pipe_str) {
            Ok(s) => s,
            Err(e) => {
                error!(error = %e, "Failed to create next pipe instance — stopping IPC");
                break;
            }
        };

        let current = std::mem::replace(&mut server, next);
        let status = status.clone();
        let tx = cmd_tx.clone();
        tokio::spawn(async move { handle_win(current, status, tx).await });
    }
}

#[cfg(windows)]
async fn handle_win(
    stream: tokio::net::windows::named_pipe::NamedPipeServer,
    status: SharedStatus,
    cmd_tx: mpsc::Sender<AgentCommand>,
) {
    let (reader, mut writer) = tokio::io::split(stream);
    handle_conn(BufReader::new(reader), &mut writer, status, cmd_tx).await;
}

// ── Shared protocol handler ───────────────────────────────────────────────────

async fn handle_conn<R, W>(
    mut reader: BufReader<R>,
    writer: &mut W,
    status: SharedStatus,
    cmd_tx: mpsc::Sender<AgentCommand>,
) where
    R: tokio::io::AsyncRead + Unpin,
    W: tokio::io::AsyncWrite + Unpin,
{
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
            };
            let _ = writer.write_all(json.as_bytes()).await;
            let _ = writer.write_all(b"\n").await;
            debug!("IPC: served status");
        }
        "reindex" => {
            let response = match cmd_tx.try_send(AgentCommand::ForceReindex) {
                Ok(_) | Err(mpsc::error::TrySendError::Full(_)) => b"{\"ok\":true}\n" as &[u8],
                Err(mpsc::error::TrySendError::Closed(_)) => {
                    b"{\"error\":\"agent shutting down\"}\n"
                }
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
