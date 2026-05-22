use crate::ipc_client::{AgentStatus, ScanState};

pub fn format_status_line(s: &AgentStatus) -> String {
    let state = match s.state {
        ScanState::Idle => "Idle",
        ScanState::Scanning => "Scanning",
        ScanState::Error => "Error",
        ScanState::Unknown => "Unknown",
    };

    let scan_time = s
        .last_scan_at
        .as_deref()
        .map(|t| format!(" — last scan {}", friendly_time(t)))
        .unwrap_or_default();

    format!(
        "{state}{scan_time} ({} indexed, {} skipped)",
        s.last_indexed, s.last_skipped
    )
}

pub fn friendly_time(iso: &str) -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);

    let then = parse_iso_secs(iso).unwrap_or(now);
    let secs = now.saturating_sub(then);

    if secs < 60 {
        "just now".into()
    } else if secs < 3600 {
        format!("{}m ago", secs / 60)
    } else if secs < 86400 {
        format!("{}h ago", secs / 3600)
    } else {
        format!("{}d ago", secs / 86400)
    }
}

/// Parses an ISO 8601 UTC timestamp into seconds since Unix epoch.
/// Reads exactly bytes 0–18 (`YYYY-MM-DDTHH:MM:SS`); everything from byte 19
/// onward (fractional seconds, timezone offsets) is silently ignored, so
/// `+05:00` offsets are dropped rather than rejected or adjusted.
pub fn parse_iso_secs(s: &str) -> Option<u64> {
    let b = s.as_bytes();
    if b.len() < 20 {
        return None;
    }
    let year: u64 = std::str::from_utf8(&b[0..4]).ok()?.parse().ok()?;
    let mon: u64 = std::str::from_utf8(&b[5..7]).ok()?.parse().ok()?;
    let day: u64 = std::str::from_utf8(&b[8..10]).ok()?.parse().ok()?;
    let hour: u64 = std::str::from_utf8(&b[11..13]).ok()?.parse().ok()?;
    let min: u64 = std::str::from_utf8(&b[14..16]).ok()?.parse().ok()?;
    let sec: u64 = std::str::from_utf8(&b[17..19]).ok()?.parse().ok()?;

    let y = if mon <= 2 { year - 1 } else { year };
    let era = y / 400;
    let yoe = y - era * 400;
    let doy = (153 * (if mon > 2 { mon - 3 } else { mon + 9 }) + 2) / 5 + day - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    let days = era * 146097 + doe - 719468;

    Some(days * 86400 + hour * 3600 + min * 60 + sec)
}

#[cfg(test)]
mod tests {
    use super::parse_iso_secs;

    #[test]
    fn known_timestamp() {
        assert_eq!(parse_iso_secs("2024-01-15T11:50:00Z"), Some(1705319400));
    }

    #[test]
    fn epoch() {
        assert_eq!(parse_iso_secs("1970-01-01T00:00:00Z"), Some(0));
    }

    #[test]
    fn year_boundary() {
        assert_eq!(parse_iso_secs("2023-12-31T23:59:59Z"), Some(1704067199));
    }

    #[test]
    fn leap_year_feb29() {
        assert_eq!(parse_iso_secs("2024-02-29T00:00:00Z"), Some(1709164800));
    }

    #[test]
    fn too_short_returns_none() {
        assert_eq!(parse_iso_secs("2024-01"), None);
        assert_eq!(parse_iso_secs(""), None);
    }

    #[test]
    fn non_numeric_field_returns_none() {
        assert_eq!(parse_iso_secs("20XX-01-01T00:00:00Z"), None);
        assert_eq!(parse_iso_secs("2024-MM-01T00:00:00Z"), None);
    }

    #[test]
    fn timezone_offset_silently_dropped() {
        assert_eq!(
            parse_iso_secs("2024-01-15T11:50:00+05:00"),
            parse_iso_secs("2024-01-15T11:50:00Z"),
        );
    }
}
