use crate::ipc_client::{FetchResult, ScanState};

pub const COLOR_STOPPED: [u8; 3] = [130, 130, 130];
pub const COLOR_IDLE: [u8; 3] = [79, 174, 74];
pub const COLOR_WARN: [u8; 3] = [255, 152, 0];
pub const COLOR_SCAN: [u8; 3] = [66, 133, 244];
pub const COLOR_ERR: [u8; 3] = [219, 68, 55];
pub const COLOR_IPC: [u8; 3] = [255, 200, 0];

const SIZE: i32 = 16;
const NODES: [(f32, f32); 9] = [
    (2.0, 2.0),
    (8.0, 2.0),
    (14.0, 2.0),
    (2.0, 8.0),
    (8.0, 8.0),
    (14.0, 8.0),
    (2.0, 14.0),
    (8.0, 14.0),
    (14.0, 14.0),
];
const LINES: [(usize, usize); 6] = [(0, 2), (3, 5), (6, 8), (0, 6), (1, 7), (2, 8)];
const DOT_R: f32 = 1.5;
const LINE_HW: f32 = 0.5;

fn dist_to_segment(px: f32, py: f32, ax: f32, ay: f32, bx: f32, by: f32) -> f32 {
    let dx = bx - ax;
    let dy = by - ay;
    let t = ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy);
    let qx = ax + t.clamp(0.0, 1.0) * dx;
    let qy = ay + t.clamp(0.0, 1.0) * dy;
    ((px - qx).powi(2) + (py - qy).powi(2)).sqrt()
}

fn coverage_at(cx: f32, cy: f32) -> f32 {
    let mut coverage: f32 = 0.0;
    for &(nx, ny) in &NODES {
        let d = ((cx - nx).powi(2) + (cy - ny).powi(2)).sqrt();
        coverage = coverage.max((DOT_R + 0.5 - d).clamp(0.0, 1.0));
    }
    for &(i, j) in &LINES {
        let (ax, ay) = NODES[i];
        let (bx, by) = NODES[j];
        let d = dist_to_segment(cx, cy, ax, ay, bx, by);
        coverage = coverage.max((LINE_HW + 0.5 - d).clamp(0.0, 1.0));
    }
    coverage
}

/// 16×16 lattice grid icon in ARGB32 network-byte-order (for ksni).
pub fn lattice_icon_argb32(rgb: [u8; 3]) -> Vec<u8> {
    let [r, g, b] = rgb;
    let mut data = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for py in 0..SIZE {
        for px in 0..SIZE {
            let a = (coverage_at(px as f32 + 0.5, py as f32 + 0.5) * 255.0) as u8;
            data.extend_from_slice(&[a, r, g, b]);
        }
    }
    data
}

/// 16×16 lattice grid icon in RGBA byte order (for tray-icon on Windows).
pub fn lattice_icon_rgba(rgb: [u8; 3]) -> Vec<u8> {
    let [r, g, b] = rgb;
    let mut data = Vec::with_capacity((SIZE * SIZE * 4) as usize);
    for py in 0..SIZE {
        for px in 0..SIZE {
            let a = (coverage_at(px as f32 + 0.5, py as f32 + 0.5) * 255.0) as u8;
            data.extend_from_slice(&[r, g, b, a]);
        }
    }
    data
}

pub fn color_for(result: &FetchResult) -> [u8; 3] {
    match result {
        FetchResult::Stopped => COLOR_STOPPED,
        FetchResult::Error(_) => COLOR_IPC,
        FetchResult::Running(s) => match s.state {
            ScanState::Idle if s.spine_ok => COLOR_IDLE,
            ScanState::Idle => COLOR_WARN,
            ScanState::Scanning => COLOR_SCAN,
            ScanState::Error => COLOR_ERR,
            ScanState::Unknown => COLOR_WARN,
        },
    }
}
