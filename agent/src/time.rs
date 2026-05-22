use std::time::{SystemTime, UNIX_EPOCH};

pub fn now_iso() -> String {
    let secs = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0);
    chrono_iso(secs)
}

pub fn chrono_iso(unix_secs: i64) -> String {
    // Manual ISO 8601 UTC formatting without a date crate dependency.
    use std::time::Duration;
    let t = UNIX_EPOCH + Duration::from_secs(unix_secs.max(0) as u64);
    let secs_since_epoch = t.duration_since(UNIX_EPOCH).unwrap().as_secs();

    // Simple UTC conversion (no leap-second handling; fine for file mtimes).
    let s = secs_since_epoch;
    let sec = s % 60;
    let min = (s / 60) % 60;
    let hour = (s / 3600) % 24;
    let days = s / 86400;

    let (year, month, day) = days_to_ymd(days);
    format!(
        "{:04}-{:02}-{:02}T{:02}:{:02}:{:02}Z",
        year, month, day, hour, min, sec
    )
}

fn days_to_ymd(days: u64) -> (u64, u64, u64) {
    // Algorithm from https://howardhinnant.github.io/date_algorithms.html
    let z = days + 719468;
    let era = z / 146097;
    let doe = z - era * 146097;
    let yoe = (doe - doe / 1460 + doe / 36524 - doe / 146096) / 365;
    let y = yoe + era * 400;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = if m <= 2 { y + 1 } else { y };
    (y, m, d)
}

#[cfg(test)]
mod tests {
    use super::chrono_iso;

    #[test]
    fn chrono_iso_epoch() {
        assert_eq!(chrono_iso(0), "1970-01-01T00:00:00Z");
    }

    #[test]
    fn chrono_iso_known() {
        // 2024-01-15 11:50:00 UTC = 1705319400
        assert_eq!(chrono_iso(1705319400), "2024-01-15T11:50:00Z");
    }
}
