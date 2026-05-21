use anyhow::{Result, bail};
use std::path::Path;
use std::process::Command;

/// Extract text from a file. Returns `None` if the type is unsupported.
/// Returns `Err` only on I/O or extraction failure for supported types.
pub fn extract_text(path: &Path, mime: &str) -> Result<Option<String>> {
    match mime {
        m if m.starts_with("text/") => {
            let text = std::fs::read_to_string(path)?;
            Ok(Some(text))
        }
        "application/pdf" => {
            let text = extract_pdf(path)?;
            Ok(Some(text))
        }
        _ => Ok(None),
    }
}

fn extract_pdf(path: &Path) -> Result<String> {
    let out = Command::new("pdftotext")
        .arg(path)
        .arg("-") // write to stdout
        .output();

    match out {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            bail!("pdftotext not found — install poppler-utils");
        }
        Err(e) => bail!("pdftotext failed: {e}"),
        Ok(output) if !output.status.success() => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            bail!("pdftotext exited non-zero: {stderr}");
        }
        Ok(output) => Ok(String::from_utf8_lossy(&output.stdout).into_owned()),
    }
}
