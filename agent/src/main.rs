mod cache;
mod config;
mod extract;
mod ipc;
mod scan;
mod status;
mod time;

use anyhow::Result;
use ipc::AgentCommand;
use std::sync::Arc;
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

    let args: Vec<String> = std::env::args().skip(1).collect();
    if args.first().is_some_and(|arg| arg == "update") {
        std::process::exit(lattice_agent::update::run_cli(&args[1..]).await?);
    }

    let force = args.iter().any(|a| a == "--force");

    let cfg = Arc::new(config::load()?);
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

    // Heartbeat: push status every 2 minutes so the surface shows the agent as
    // active even between 15-minute scan cycles.
    let hb_cfg = Arc::clone(&cfg);
    let hb_client = client.clone();
    let hb_status = status.clone();
    tokio::spawn(async move {
        loop {
            tokio::time::sleep(Duration::from_secs(120)).await;
            scan::push_status(&hb_cfg, &hb_client, &hb_status).await;
        }
    });

    loop {
        scan::run_pass(&cfg, &cache, &client, &status).await;
        scan::push_status(&cfg, &client, &status).await;

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
