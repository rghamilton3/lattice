mod cache;
mod config;
mod extract;
mod ipc;
mod scan;
mod status;
mod time;

use anyhow::Result;
use ipc::AgentCommand;
use std::time::Duration;
use tokio::sync::mpsc;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lattice_agent=info".parse().unwrap()),
        )
        .init();

    let force = std::env::args().any(|a| a == "--force");

    let cfg = config::load()?;
    info!(
        machine_id = %cfg.machine_id,
        spine_url  = %cfg.spine_url,
        interval_m = cfg.poll_interval_minutes,
        force,
        "lattice-agent starting"
    );

    let cache = cache::open()?;
    if force {
        cache.clear_known_paths();
        info!("--force: cleared known-path records, all watch paths will be fully re-indexed");
    }

    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    let status = status::new_shared();

    let (cmd_tx, mut cmd_rx) = mpsc::channel::<AgentCommand>(8);
    let ipc_status = status.clone();
    tokio::spawn(async move { ipc::serve(ipc_status, cmd_tx).await });

    loop {
        scan::run_pass(&cfg, &cache, &client, &status).await;

        // Wait for either the poll interval to elapse or a reindex command to arrive.
        // Multiple ForceReindex commands coalesce: we drain the channel before acting.
        let force_reindex = tokio::select! {
            _ = tokio::time::sleep(Duration::from_secs(cfg.poll_interval_minutes * 60)) => false,
            cmd = cmd_rx.recv() => {
                while cmd_rx.try_recv().is_ok() {}
                matches!(cmd, Some(AgentCommand::ForceReindex))
            }
        };

        if force_reindex {
            cache.clear_known_paths();
            info!(
                "reindex command: cleared known-path records, all watch paths will be fully re-indexed"
            );
        }
    }
}
