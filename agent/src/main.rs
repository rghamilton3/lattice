mod cache;
mod config;
mod extract;
mod ipc;
mod scan;
mod status;

use anyhow::Result;
use std::time::Duration;
use tracing::info;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "lattice_agent=info".parse().unwrap()),
        )
        .init();

    let cfg = config::load()?;
    info!(
        machine_id = %cfg.machine_id,
        spine_url  = %cfg.spine_url,
        interval_m = cfg.poll_interval_minutes,
        "lattice-agent starting"
    );

    let cache = cache::open()?;
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .build()?;

    let status = status::new_shared();

    // Serve status queries over the Unix socket in the background.
    let ipc_status = status.clone();
    tokio::spawn(async move { ipc::serve(ipc_status).await });

    loop {
        scan::run_pass(&cfg, &cache, &client, &status).await;
        tokio::time::sleep(Duration::from_secs(cfg.poll_interval_minutes * 60)).await;
    }
}
