use serde::{Deserialize, Serialize};
use std::sync::{Arc, RwLock};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ScanState {
    Idle,
    Scanning,
    Error,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentStatus {
    pub state: ScanState,
    /// ISO 8601 UTC timestamp of the last completed scan pass.
    pub last_scan_at: Option<String>,
    pub last_indexed: u32,
    pub last_skipped: u32,
    pub last_errors: u32,
    /// False when the last spine POST attempt failed.
    pub spine_ok: bool,
    pub last_error_msg: Option<String>,
}

impl Default for AgentStatus {
    fn default() -> Self {
        Self {
            state: ScanState::Idle,
            last_scan_at: None,
            last_indexed: 0,
            last_skipped: 0,
            last_errors: 0,
            spine_ok: true,
            last_error_msg: None,
        }
    }
}

pub type SharedStatus = Arc<RwLock<AgentStatus>>;

pub fn new_shared() -> SharedStatus {
    Arc::new(RwLock::new(AgentStatus::default()))
}
