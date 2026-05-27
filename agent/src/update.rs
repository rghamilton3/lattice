use anyhow::{Context, Result, anyhow, bail};
use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::fs;
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::time::{SystemTime, UNIX_EPOCH};

use crate::{config, platform};

const REPO_RELEASES_API: &str = "https://api.github.com/repos/rghamilton3/lattice/releases/latest";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ProductKind {
    LocalBinary,
    DesktopCompanion,
    ServerComponent,
    WebSurface,
    Installer,
    ServiceUnit,
    Unknown,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Product {
    pub id: String,
    pub display_name: String,
    pub kind: ProductKind,
    pub install_path: Option<PathBuf>,
    pub version_source: String,
    pub installed_version: Version,
    pub automatic_update: bool,
    pub manual_guidance: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AvailableUpdate {
    pub product_id: String,
    pub release_tag: String,
    pub target_version: Version,
    pub channel: String,
    pub summary: Option<String>,
    pub artifacts: Vec<UpdateArtifact>,
    pub eligibility: String,
    pub published_at: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateArtifact {
    pub product_id: String,
    pub asset_name: String,
    pub download_url: String,
    pub expected_checksum: Option<String>,
    pub size_bytes: Option<u64>,
    pub staged_path: Option<PathBuf>,
    pub target_path: Option<PathBuf>,
    pub verified_at: Option<String>,
    pub verification_status: VerificationStatus,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationStatus {
    Pending,
    Verified,
    Failed,
    NotAvailable,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UserState {
    pub config_path: PathBuf,
    pub agent_cache_path: PathBuf,
    pub capture_queue_path: PathBuf,
    pub history_path: PathBuf,
    pub service_definitions: Vec<PathBuf>,
    pub customized_service_definitions: bool,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct UpdateAttempt {
    pub id: String,
    pub operation: String,
    pub products: Vec<String>,
    pub starting_versions: BTreeMap<String, String>,
    pub target_versions: BTreeMap<String, String>,
    pub outcome: AttemptOutcome,
    pub started_at: String,
    pub completed_at: String,
    pub message: String,
    pub error_detail: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AttemptOutcome {
    Success,
    AlreadyCurrent,
    Unsupported,
    Offline,
    FailedVerification,
    FailedInstallation,
    Interrupted,
    ManualActionRequired,
    DeclinedConfirmation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProductStatus {
    Current,
    UpdateAvailable,
    ManualUpdateRequired,
    Unsupported,
    Offline,
    Unknown,
    DevBuild,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum Version {
    Stable(Vec<u64>),
    Dev(String),
    Unknown,
    Malformed(String),
}

pub async fn run_cli(args: &[String]) -> Result<i32> {
    match args {
        [cmd] if cmd == "check" => check().await,
        [cmd] if cmd == "history" => print_history(),
        [cmd, rest @ ..] if cmd == "apply" => apply(rest).await,
        _ => {
            eprintln!("Usage: lattice-agent update check");
            eprintln!("       lattice-agent update apply lattice-agent");
            eprintln!("       lattice-agent update apply desktop-companions");
            eprintln!("       lattice-agent update apply --all-supported");
            eprintln!("       lattice-agent update history");
            Ok(4)
        }
    }
}

async fn check() -> Result<i32> {
    let started_at = now_string();
    let products = discover_products();
    let metadata = fetch_release_metadata().await;
    let mut attempts = base_attempt("check", &products, &started_at);

    println!("Product updates");
    match metadata {
        Ok(release) => {
            for product in &products {
                let update = release.update_for(product);
                let status = classify(product, update.as_ref(), false);
                println!("{}", status_line(product, update.as_ref(), status));
                if let Some(update) = update {
                    attempts
                        .target_versions
                        .insert(product.id.clone(), update.target_version.to_string());
                }
            }
            attempts.outcome = if products.iter().all(|p| !p.automatic_update) {
                AttemptOutcome::ManualActionRequired
            } else {
                AttemptOutcome::Success
            };
            attempts.message =
                "Update check completed. Review each product next action before applying updates."
                    .to_owned();
            record_attempt(&attempts)?;
            Ok(0)
        }
        Err(err) => {
            for product in &products {
                println!("{}", status_line(product, None, ProductStatus::Offline));
            }
            attempts.outcome = AttemptOutcome::Offline;
            attempts.message = "Release metadata was unavailable. Installed files were not changed; try again when the network is reachable.".to_owned();
            attempts.error_detail = Some(err.to_string());
            record_attempt(&attempts)?;
            Ok(2)
        }
    }
}

async fn apply(args: &[String]) -> Result<i32> {
    let started_at = now_string();
    let products = discover_products();
    let requested = select_products(args, &products)?;
    if requested.is_empty() {
        eprintln!("No installed supported products matched the update request.");
        return Ok(3);
    }

    let release = match fetch_release_metadata().await {
        Ok(release) => release,
        Err(err) => {
            let mut attempt = base_attempt("apply", &requested, &started_at);
            attempt.outcome = AttemptOutcome::Offline;
            attempt.message = "Release metadata was unavailable. No files were changed; try again when the network is reachable.".to_owned();
            attempt.error_detail = Some(err.to_string());
            record_attempt(&attempt)?;
            eprintln!("{}", attempt.message);
            return Ok(2);
        }
    };

    let mut plan = Vec::new();
    for product in requested {
        if !product.automatic_update {
            eprintln!(
                "{} cannot be updated automatically. {}",
                product.display_name,
                next_action(&product, None, ProductStatus::ManualUpdateRequired)
            );
            return Ok(3);
        }
        let Some(update) = release.update_for(&product) else {
            eprintln!(
                "{} has no matching artifact for this platform. No files were changed.",
                product.display_name
            );
            return Ok(3);
        };
        match classify(&product, Some(&update), false) {
            ProductStatus::Current => println!(
                "{} is already current at {}.",
                product.display_name, product.installed_version
            ),
            ProductStatus::DevBuild => println!(
                "{} is a development build and will not be downgraded automatically.",
                product.display_name
            ),
            ProductStatus::UpdateAvailable | ProductStatus::Unknown => plan.push((product, update)),
            _ => {}
        }
    }

    if plan.is_empty() {
        let mut attempt = base_attempt("apply", &products, &started_at);
        attempt.outcome = AttemptOutcome::AlreadyCurrent;
        attempt.message = "All requested supported products are already current or are development builds. No files were changed.".to_owned();
        record_attempt(&attempt)?;
        println!("{}", attempt.message);
        return Ok(0);
    }

    println!("The following products will be updated after confirmation:");
    for (product, update) in &plan {
        println!(
            "{}: {} -> {}. {}",
            product.display_name,
            product.installed_version,
            update.target_version,
            update
                .summary
                .as_deref()
                .unwrap_or("Release summary unavailable.")
        );
    }
    if !confirm()? {
        let mut attempt = base_attempt("apply", &products, &started_at);
        attempt.outcome = AttemptOutcome::DeclinedConfirmation;
        attempt.message =
            "Operator confirmation was declined or unavailable. No files were changed.".to_owned();
        record_attempt(&attempt)?;
        println!("{}", attempt.message);
        return Ok(4);
    }

    let state = user_state();
    preserve_state(&state)?;
    let mut attempt = base_attempt("apply", &products, &started_at);
    for (product, update) in &plan {
        attempt
            .target_versions
            .insert(product.id.clone(), update.target_version.to_string());
        if let Err(err) = stage_verify_replace(product, update).await {
            attempt.outcome = if err.to_string().contains("verification")
                || err.to_string().contains("checksum")
            {
                AttemptOutcome::FailedVerification
            } else {
                AttemptOutcome::FailedInstallation
            };
            attempt.message = format!(
                "{} update failed. Installed files were preserved when replacement had not started; rerun the update after fixing the reported issue.",
                product.display_name
            );
            attempt.error_detail = Some(err.to_string());
            record_attempt(&attempt)?;
            eprintln!("{}", attempt.message);
            return Ok(1);
        }
    }

    attempt.outcome = AttemptOutcome::Success;
    attempt.message = restart_message(&plan.iter().map(|(p, _)| p.id.as_str()).collect::<Vec<_>>());
    record_attempt(&attempt)?;
    println!("{}", attempt.message);
    Ok(0)
}

fn print_history() -> Result<i32> {
    let path = history_path();
    if !path.exists() {
        println!(
            "No update attempts recorded yet. Run `lattice-agent update check` to create the first history entry."
        );
        return Ok(0);
    }
    let mut attempts = Vec::new();
    for line in fs::read_to_string(&path)?.lines() {
        if line.trim().is_empty() {
            continue;
        }
        attempts.push(
            serde_json::from_str::<UpdateAttempt>(line)
                .with_context(|| format!("invalid history entry in {}", path.display()))?,
        );
    }
    for attempt in attempts.iter().rev().take(25) {
        let products = attempt.products.join(",");
        let target = attempt
            .target_versions
            .values()
            .next()
            .cloned()
            .unwrap_or_else(|| "unavailable".to_owned());
        let starting = attempt
            .starting_versions
            .values()
            .next()
            .cloned()
            .unwrap_or_else(|| "unknown".to_owned());
        println!(
            "{} {} {} {} -> {}: {}. {}",
            attempt.completed_at,
            attempt.operation,
            products,
            starting,
            target,
            outcome_text(attempt.outcome),
            attempt.message
        );
    }
    Ok(0)
}

fn select_products(args: &[String], products: &[Product]) -> Result<Vec<Product>> {
    match args {
        [target] if target == "lattice-agent" => Ok(products
            .iter()
            .filter(|p| p.id == "lattice-agent")
            .cloned()
            .collect()),
        [target] if target == "desktop-companions" => Ok(products
            .iter()
            .filter(|p| p.kind == ProductKind::DesktopCompanion && p.install_path.is_some())
            .cloned()
            .collect()),
        [target] if target == "--all-supported" => Ok(products
            .iter()
            .filter(|p| p.automatic_update && p.install_path.is_some())
            .cloned()
            .collect()),
        _ => bail!(
            "supported apply targets are lattice-agent, desktop-companions, or --all-supported"
        ),
    }
}

fn discover_products() -> Vec<Product> {
    let mut products = vec![
        binary_product(
            "lattice-agent",
            "lattice-agent",
            ProductKind::LocalBinary,
            true,
        ),
        binary_product(
            "lattice-capture",
            "lattice-capture",
            ProductKind::DesktopCompanion,
            true,
        ),
        binary_product(
            "lattice-tray",
            "lattice-tray",
            ProductKind::DesktopCompanion,
            true,
        ),
        binary_product(
            "lattice-config",
            "lattice-config",
            ProductKind::DesktopCompanion,
            true,
        ),
    ];
    products.push(manual_product("spine", "spine", ProductKind::ServerComponent, "Update the self-hosted spine deployment manually from the project release notes and your Docker deployment files."));
    products.push(manual_product(
        "surface",
        "surface",
        ProductKind::WebSurface,
        "Build and deploy the surface static assets with the self-hosted spine deployment.",
    ));
    products.push(manual_product("installer", "installer scripts and service units", ProductKind::Installer, "Review release notes and rerun the installer only when you are ready to preserve or reapply local customizations."));
    products
}

fn binary_product(id: &str, display: &str, kind: ProductKind, automatic_update: bool) -> Product {
    let path = platform::install_path(id);
    let installed_version = if path.exists() {
        current_version()
    } else {
        Version::Unknown
    };
    Product {
        id: id.to_owned(),
        display_name: display.to_owned(),
        kind,
        install_path: path.exists().then_some(path),
        version_source: if id == "lattice-agent" {
            "package version"
        } else {
            "companion install"
        }
        .to_owned(),
        installed_version,
        automatic_update,
        manual_guidance: None,
    }
}

fn manual_product(id: &str, display: &str, kind: ProductKind, guidance: &str) -> Product {
    Product {
        id: id.to_owned(),
        display_name: display.to_owned(),
        kind,
        install_path: None,
        version_source: "manual deployment".to_owned(),
        installed_version: Version::Unknown,
        automatic_update: false,
        manual_guidance: Some(guidance.to_owned()),
    }
}

fn current_version() -> Version {
    Version::parse(env!("CARGO_PKG_VERSION"))
}

fn classify(product: &Product, update: Option<&AvailableUpdate>, offline: bool) -> ProductStatus {
    if offline {
        return ProductStatus::Offline;
    }
    if !product.automatic_update {
        return ProductStatus::ManualUpdateRequired;
    }
    if matches!(product.installed_version, Version::Dev(_)) {
        return ProductStatus::DevBuild;
    }
    let Some(update) = update else {
        return ProductStatus::Unsupported;
    };
    match product
        .installed_version
        .compare_stable(&update.target_version)
    {
        Some(std::cmp::Ordering::Less) | None => ProductStatus::UpdateAvailable,
        Some(std::cmp::Ordering::Equal) | Some(std::cmp::Ordering::Greater) => {
            ProductStatus::Current
        }
    }
}

fn status_line(
    product: &Product,
    update: Option<&AvailableUpdate>,
    status: ProductStatus,
) -> String {
    let latest = update
        .map(|u| u.target_version.to_string())
        .unwrap_or_else(|| "unavailable".to_owned());
    format!(
        "{}: installed {}, latest {}, {}. {}",
        product.display_name,
        product.installed_version,
        latest,
        status_text(status),
        next_action(product, update, status)
    )
}

fn status_text(status: ProductStatus) -> &'static str {
    match status {
        ProductStatus::Current => "current",
        ProductStatus::UpdateAvailable => "update available",
        ProductStatus::ManualUpdateRequired => "manual update required",
        ProductStatus::Unsupported => "unsupported",
        ProductStatus::Offline => "offline",
        ProductStatus::Unknown => "unknown",
        ProductStatus::DevBuild => "development build",
    }
}

fn next_action(
    product: &Product,
    _update: Option<&AvailableUpdate>,
    status: ProductStatus,
) -> String {
    match status {
        ProductStatus::Current => "No action is required.".to_owned(),
        ProductStatus::UpdateAvailable if product.kind == ProductKind::DesktopCompanion => "Run `lattice-agent update apply desktop-companions` or `lattice-agent update apply --all-supported` to update installed desktop companions.".to_owned(),
        ProductStatus::UpdateAvailable => format!("Run `lattice-agent update apply {}` to update.", product.id),
        ProductStatus::ManualUpdateRequired | ProductStatus::Unsupported => product.manual_guidance.clone().unwrap_or_else(|| "Update this product manually from the release notes.".to_owned()),
        ProductStatus::Offline => "Try again when release metadata is reachable; no local files were changed.".to_owned(),
        ProductStatus::Unknown => "Review the installed product before applying an update.".to_owned(),
        ProductStatus::DevBuild => "Development builds are not downgraded automatically; install a stable release manually if desired.".to_owned(),
    }
}

async fn fetch_release_metadata() -> Result<ReleaseMetadata> {
    let client = reqwest::Client::builder()
        .user_agent("lattice-agent-updater")
        .build()?;
    let release: GithubRelease = client
        .get(REPO_RELEASES_API)
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;
    let checksum_url = release
        .assets
        .iter()
        .find(|asset| asset.name == "checksums.blake3" || asset.name == "checksums.txt")
        .map(|asset| asset.browser_download_url.clone());
    let checksum_raw = if let Some(url) = checksum_url {
        client
            .get(url)
            .send()
            .await?
            .error_for_status()?
            .text()
            .await?
    } else {
        release.body.clone().unwrap_or_default()
    };
    Ok(ReleaseMetadata::from_github(
        release,
        current_target(),
        &checksum_raw,
    ))
}

async fn stage_verify_replace(product: &Product, update: &AvailableUpdate) -> Result<()> {
    let target_path = product
        .install_path
        .as_ref()
        .ok_or_else(|| anyhow!("{} is not installed", product.display_name))?;
    let mut artifact = update
        .artifacts
        .first()
        .cloned()
        .ok_or_else(|| anyhow!("no matching artifact for {}", product.display_name))?;
    let checksum = artifact.expected_checksum.clone().ok_or_else(|| {
        anyhow!(
            "missing checksum for {}; automatic replacement refused",
            artifact.asset_name
        )
    })?;
    let stage_dir = staging_dir();
    fs::create_dir_all(&stage_dir)?;
    let staged_path = stage_dir.join(&artifact.asset_name);
    let bytes = reqwest::get(&artifact.download_url)
        .await?
        .error_for_status()?
        .bytes()
        .await?;
    fs::write(&staged_path, &bytes)?;
    verify_file(&staged_path, &checksum)
        .with_context(|| format!("verification failed for {}", artifact.asset_name))?;
    artifact.staged_path = Some(staged_path.clone());
    artifact.target_path = Some(target_path.clone());
    artifact.verified_at = Some(now_string());
    artifact.verification_status = VerificationStatus::Verified;
    replace_file(&staged_path, target_path)?;
    Ok(())
}

fn verify_file(path: &Path, expected: &str) -> Result<()> {
    let actual = blake3::hash(&fs::read(path)?).to_hex().to_string();
    if actual.eq_ignore_ascii_case(expected.trim()) {
        Ok(())
    } else {
        bail!("checksum mismatch: expected {expected}, got {actual}")
    }
}

fn replace_file(staged: &Path, target: &Path) -> Result<()> {
    let parent = target
        .parent()
        .ok_or_else(|| anyhow!("target has no parent: {}", target.display()))?;
    fs::create_dir_all(parent)?;
    let replacement = target.with_extension("update-new");
    fs::copy(staged, &replacement)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(&replacement, fs::Permissions::from_mode(0o755))?;
    }
    fs::rename(&replacement, target)?;
    Ok(())
}

fn preserve_state(state: &UserState) -> Result<()> {
    for path in [
        &state.config_path,
        &state.agent_cache_path,
        &state.capture_queue_path,
        &state.history_path,
    ] {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)?;
        }
    }
    Ok(())
}

fn confirm() -> Result<bool> {
    print!("Type yes to replace the listed installed files: ");
    io::stdout().flush()?;
    let mut input = String::new();
    if io::stdin().read_line(&mut input)? == 0 {
        return Ok(false);
    }
    Ok(input.trim().eq_ignore_ascii_case("yes"))
}

fn restart_message(products: &[&str]) -> String {
    if products.contains(&"lattice-agent") {
        #[cfg(unix)]
        return "Update applied. Restart the agent with `systemctl --user restart lattice-agent`; restart lattice-tray too if desktop companions were updated.".to_owned();
        #[cfg(windows)]
        return "Update applied. Restart the agent with `schtasks /End /TN LatticeAgent` and `schtasks /Run /TN LatticeAgent`; restart LatticeTray if desktop companions were updated.".to_owned();
    }
    "Update applied. Restart any running desktop companion processes so they use the new binaries."
        .to_owned()
}

fn user_state() -> UserState {
    UserState {
        config_path: config::config_path(),
        agent_cache_path: platform::data_dir().join("agent.db"),
        capture_queue_path: platform::data_dir().join("queue.db"),
        history_path: history_path(),
        service_definitions: service_definitions(),
        customized_service_definitions: false,
    }
}

fn service_definitions() -> Vec<PathBuf> {
    #[cfg(unix)]
    return vec![
        platform::config_dir()
            .join("systemd")
            .join("user")
            .join("lattice-agent.service"),
        platform::config_dir()
            .join("systemd")
            .join("user")
            .join("lattice-tray.service"),
    ];
    #[cfg(windows)]
    return Vec::new();
    #[cfg(not(any(unix, windows)))]
    Vec::new()
}

fn base_attempt(operation: &str, products: &[Product], started_at: &str) -> UpdateAttempt {
    UpdateAttempt {
        id: format!("{}-{}", started_at, operation),
        operation: operation.to_owned(),
        products: products.iter().map(|p| p.id.clone()).collect(),
        starting_versions: products
            .iter()
            .map(|p| (p.id.clone(), p.installed_version.to_string()))
            .collect(),
        target_versions: BTreeMap::new(),
        outcome: AttemptOutcome::Success,
        started_at: started_at.to_owned(),
        completed_at: now_string(),
        message: String::new(),
        error_detail: None,
    }
}

fn record_attempt(attempt: &UpdateAttempt) -> Result<()> {
    let path = history_path();
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }
    let mut line = serde_json::to_string(attempt)?;
    line.push('\n');
    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(path)?;
    file.write_all(line.as_bytes())?;
    Ok(())
}

pub fn staging_dir() -> PathBuf {
    platform::data_dir().join("updates").join("staging")
}

pub fn history_path() -> PathBuf {
    platform::data_dir().join("updates").join("history.jsonl")
}

fn now_string() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{secs}")
}

fn current_target() -> String {
    #[cfg(all(target_os = "linux", target_arch = "x86_64"))]
    return "x86_64-unknown-linux-musl".to_owned();
    #[cfg(all(target_os = "linux", target_arch = "aarch64"))]
    return "aarch64-unknown-linux-musl".to_owned();
    #[cfg(all(target_os = "windows", target_arch = "x86_64"))]
    return "x86_64-pc-windows-msvc".to_owned();
    #[cfg(not(any(
        all(target_os = "linux", target_arch = "x86_64"),
        all(target_os = "linux", target_arch = "aarch64"),
        all(target_os = "windows", target_arch = "x86_64")
    )))]
    "unsupported".to_owned()
}

fn asset_name(product_id: &str, target: &str) -> String {
    let suffix = if target.contains("windows") {
        ".exe"
    } else {
        ""
    };
    if product_id == "lattice-config" && target == "x86_64-unknown-linux-musl" {
        "lattice-config-x86_64-unknown-linux-gnu".to_owned()
    } else {
        format!("{product_id}-{target}{suffix}")
    }
}

#[derive(Debug, Clone)]
struct ReleaseMetadata {
    tag: String,
    version: Version,
    summary: Option<String>,
    assets: HashMap<String, GithubAsset>,
    checksums: HashMap<String, String>,
    target: String,
    published_at: Option<String>,
}

impl ReleaseMetadata {
    fn from_github(release: GithubRelease, target: String, checksum_raw: &str) -> Self {
        let mut assets = HashMap::new();
        let checksums = parse_checksums(checksum_raw);
        for asset in release.assets {
            assets.insert(asset.name.clone(), asset);
        }
        Self {
            tag: release.tag_name.clone(),
            version: tag_version(&release.tag_name),
            summary: release.body,
            assets,
            checksums,
            target,
            published_at: release.published_at,
        }
    }

    fn update_for(&self, product: &Product) -> Option<AvailableUpdate> {
        let name = asset_name(&product.id, &self.target);
        let asset = self.assets.get(&name)?;
        let checksum = self.checksums.get(&name).cloned();
        Some(AvailableUpdate {
            product_id: product.id.clone(),
            release_tag: self.tag.clone(),
            target_version: self.version.clone(),
            channel: "stable".to_owned(),
            summary: self.summary.clone(),
            artifacts: vec![UpdateArtifact {
                product_id: product.id.clone(),
                asset_name: name,
                download_url: asset.browser_download_url.clone(),
                expected_checksum: checksum,
                size_bytes: asset.size,
                staged_path: None,
                target_path: product.install_path.clone(),
                verified_at: None,
                verification_status: VerificationStatus::Pending,
            }],
            eligibility: self.target.clone(),
            published_at: self.published_at.clone(),
        })
    }
}

#[derive(Debug, Deserialize, Clone)]
struct GithubRelease {
    tag_name: String,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize, Clone)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
    size: Option<u64>,
    #[serde(default)]
    _unused: Option<String>,
}

fn parse_checksums(raw: &str) -> HashMap<String, String> {
    raw.lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let checksum = parts.next()?;
            let name = parts.next()?.trim_start_matches('*');
            Some((name.to_owned(), checksum.to_owned()))
        })
        .collect()
}

fn tag_version(tag: &str) -> Version {
    Version::parse(tag.trim_start_matches("agent-v").trim_start_matches('v'))
}

fn outcome_text(outcome: AttemptOutcome) -> &'static str {
    match outcome {
        AttemptOutcome::Success => "success",
        AttemptOutcome::AlreadyCurrent => "already-current",
        AttemptOutcome::Unsupported => "unsupported",
        AttemptOutcome::Offline => "offline",
        AttemptOutcome::FailedVerification => "failed-verification",
        AttemptOutcome::FailedInstallation => "failed-installation",
        AttemptOutcome::Interrupted => "interrupted",
        AttemptOutcome::ManualActionRequired => "manual-action-required",
        AttemptOutcome::DeclinedConfirmation => "declined-confirmation",
    }
}

impl Version {
    pub fn parse(raw: &str) -> Self {
        let raw = raw.trim();
        if raw.is_empty() || raw.eq_ignore_ascii_case("unknown") {
            return Self::Unknown;
        }
        if raw.contains("dev") || raw.contains("dirty") || raw.contains("+") {
            return Self::Dev(raw.to_owned());
        }
        let parts: Option<Vec<u64>> = raw.split('.').map(|p| p.parse().ok()).collect();
        match parts {
            Some(parts) if !parts.is_empty() => Self::Stable(parts),
            _ => Self::Malformed(raw.to_owned()),
        }
    }

    fn compare_stable(&self, other: &Self) -> Option<std::cmp::Ordering> {
        let (Self::Stable(left), Self::Stable(right)) = (self, other) else {
            return None;
        };
        let max_len = left.len().max(right.len());
        for idx in 0..max_len {
            let ord = left
                .get(idx)
                .unwrap_or(&0)
                .cmp(right.get(idx).unwrap_or(&0));
            if ord != std::cmp::Ordering::Equal {
                return Some(ord);
            }
        }
        Some(std::cmp::Ordering::Equal)
    }
}

impl std::fmt::Display for Version {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Version::Stable(parts) => write!(
                f,
                "{}",
                parts
                    .iter()
                    .map(u64::to_string)
                    .collect::<Vec<_>>()
                    .join(".")
            ),
            Version::Dev(raw) | Version::Malformed(raw) => write!(f, "{raw}"),
            Version::Unknown => write!(f, "unknown"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_stable_unknown_malformed_and_dev_versions() {
        assert_eq!(Version::parse("0.10.1"), Version::Stable(vec![0, 10, 1]));
        assert_eq!(Version::parse("unknown"), Version::Unknown);
        assert_eq!(
            Version::parse("0.11.0-dev"),
            Version::Dev("0.11.0-dev".to_owned())
        );
        assert_eq!(
            Version::parse("not-a-version"),
            Version::Malformed("not-a-version".to_owned())
        );
    }

    #[test]
    fn compares_stable_versions_with_missing_patch_as_zero() {
        assert_eq!(
            Version::parse("0.10").compare_stable(&Version::parse("0.10.0")),
            Some(std::cmp::Ordering::Equal)
        );
        assert_eq!(
            Version::parse("0.10.0").compare_stable(&Version::parse("0.11.0")),
            Some(std::cmp::Ordering::Less)
        );
    }

    #[test]
    fn classifies_update_statuses() {
        let mut product = binary_product(
            "lattice-agent",
            "lattice-agent",
            ProductKind::LocalBinary,
            true,
        );
        product.install_path = Some(PathBuf::from("/tmp/lattice-agent"));
        product.installed_version = Version::parse("0.10.0");
        let update = AvailableUpdate {
            product_id: product.id.clone(),
            release_tag: "agent-v0.11.0".to_owned(),
            target_version: Version::parse("0.11.0"),
            channel: "stable".to_owned(),
            summary: None,
            artifacts: vec![],
            eligibility: "test".to_owned(),
            published_at: None,
        };
        assert_eq!(
            classify(&product, Some(&update), false),
            ProductStatus::UpdateAvailable
        );
        assert_eq!(classify(&product, None, true), ProductStatus::Offline);
        product.installed_version = Version::parse("0.12.0-dev");
        assert_eq!(
            classify(&product, Some(&update), false),
            ProductStatus::DevBuild
        );
    }

    #[test]
    fn staging_and_history_paths_stay_under_data_dir() {
        assert!(staging_dir().starts_with(platform::data_dir()));
        assert!(history_path().starts_with(platform::data_dir()));
    }

    #[test]
    fn parses_checksum_manifest_lines() {
        let checksums = parse_checksums(
            "abc lattice-agent-x86_64-unknown-linux-musl\ndef *lattice-tray-x86_64-unknown-linux-musl\n",
        );
        assert_eq!(
            checksums.get("lattice-agent-x86_64-unknown-linux-musl"),
            Some(&"abc".to_owned())
        );
        assert_eq!(
            checksums.get("lattice-tray-x86_64-unknown-linux-musl"),
            Some(&"def".to_owned())
        );
    }

    #[test]
    fn matches_release_artifact_for_platform_fixture_shape() {
        let release: GithubRelease = serde_json::from_str(
            r#"{
                "tag_name":"agent-v0.11.0",
                "body":"release notes",
                "published_at":"2026-05-27T00:00:00Z",
                "assets":[{"name":"lattice-agent-x86_64-unknown-linux-musl","browser_download_url":"https://example.test/agent","size":12}]
            }"#,
        )
        .unwrap();
        let metadata = ReleaseMetadata::from_github(
            release,
            "x86_64-unknown-linux-musl".to_owned(),
            "abc lattice-agent-x86_64-unknown-linux-musl",
        );
        let mut product = binary_product(
            "lattice-agent",
            "lattice-agent",
            ProductKind::LocalBinary,
            true,
        );
        product.install_path = Some(PathBuf::from("/tmp/lattice-agent"));
        let update = metadata.update_for(&product).unwrap();
        assert_eq!(update.target_version, Version::parse("0.11.0"));
        assert_eq!(
            update.artifacts[0].expected_checksum,
            Some("abc".to_owned())
        );
    }

    #[test]
    fn selects_agent_companions_and_all_supported() {
        let mut products = discover_products();
        for product in &mut products {
            if product.automatic_update {
                product.install_path = Some(PathBuf::from(format!("/tmp/{}", product.id)));
            }
        }
        let agent = select_products(&["lattice-agent".to_owned()], &products).unwrap();
        assert_eq!(agent.len(), 1);
        assert_eq!(agent[0].id, "lattice-agent");

        let companions = select_products(&["desktop-companions".to_owned()], &products).unwrap();
        assert!(
            companions
                .iter()
                .all(|p| p.kind == ProductKind::DesktopCompanion)
        );
        assert_eq!(companions.len(), 3);

        let all = select_products(&["--all-supported".to_owned()], &products).unwrap();
        assert_eq!(all.len(), 4);
    }

    #[test]
    fn history_attempt_serializes_product_outcome_and_next_action() {
        let product = manual_product(
            "spine",
            "spine",
            ProductKind::ServerComponent,
            "Update spine manually.",
        );
        let mut attempt = base_attempt("check", &[product], "1");
        attempt.outcome = AttemptOutcome::ManualActionRequired;
        attempt.message = "spine requires manual action. Update spine manually.".to_owned();
        let json = serde_json::to_string(&attempt).unwrap();
        assert!(json.contains("spine"));
        assert!(json.contains("ManualActionRequired"));
        assert!(json.contains("Update spine manually."));
    }

    #[test]
    fn refuses_bad_checksums_before_replacement() {
        let dir = std::env::temp_dir().join(format!("lattice-update-test-{}", std::process::id()));
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("artifact");
        fs::write(&file, "good").unwrap();
        assert!(verify_file(&file, "bad").is_err());
        let expected = blake3::hash(b"good").to_hex().to_string();
        assert!(verify_file(&file, &expected).is_ok());
        let _ = fs::remove_dir_all(dir);
    }

    #[test]
    fn renders_manual_guidance_text() {
        let product = manual_product(
            "spine",
            "spine",
            ProductKind::ServerComponent,
            "Update spine manually.",
        );
        let line = status_line(&product, None, ProductStatus::ManualUpdateRequired);
        assert!(line.contains("spine"));
        assert!(line.contains("manual update required"));
        assert!(line.contains("Update spine manually."));
    }
}
