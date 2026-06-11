use anyhow::{Result, bail};
use std::ffi::OsString;
use std::path::Path;
use std::process::Command;

/// Generation of the extraction capability set. Bump whenever the set of
/// extractable types changes so previously skipped files get retried.
pub const EXTRACTOR_GENERATION: i64 = 1;

/// Ceiling on extracted text, mirroring spine/src/extract.ts MAX_TEXT_CHARS.
const MAX_TEXT_CHARS: usize = 100_000;

/// Extract text from a file. Returns `None` if the type is unsupported.
/// Returns `Err` only on I/O or extraction failure for supported types.
pub fn extract_text(path: &Path, mime: &str) -> Result<Option<String>> {
    if mime.starts_with("text/") {
        let text = std::fs::read_to_string(path)?;
        return Ok(Some(truncate_text(text)));
    }
    match subprocess_spec(mime, path) {
        Some((cmd, args)) => Ok(Some(truncate_text(run_subprocess(cmd, args)?))),
        None => Ok(None),
    }
}

/// Truncate to MAX_TEXT_CHARS characters, cutting at the last space before
/// the limit (port of spine/src/extract.ts truncate()).
pub fn truncate_text(text: String) -> String {
    let limit_byte = match text.char_indices().nth(MAX_TEXT_CHARS) {
        Some((idx, _)) => idx,
        None => return text,
    };
    let cut = match text[..limit_byte].rfind(' ') {
        Some(i) if i > 0 => i,
        _ => limit_byte,
    };
    text[..cut].to_string()
}

/// Tool + args for MIME types extracted via subprocess. Mirrors
/// SUBPROCESS_TYPES in spine/src/extract.ts so agent and spine produce
/// equivalent text for the same file.
fn subprocess_spec(mime: &str, path: &Path) -> Option<(&'static str, Vec<OsString>)> {
    let p = path.as_os_str().to_os_string();
    match mime {
        "application/pdf" => Some(("pdftotext", vec![p, "-".into()])),
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" => {
            Some(("pandoc", vec!["--from=docx".into(), "--to=plain".into(), p]))
        }
        "application/vnd.openxmlformats-officedocument.presentationml.presentation" => {
            Some(("pandoc", vec!["--from=pptx".into(), "--to=plain".into(), p]))
        }
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" => {
            Some(("pandoc", vec!["--from=xlsx".into(), "--to=plain".into(), p]))
        }
        "application/msword" => Some(("pandoc", vec!["--from=doc".into(), "--to=plain".into(), p])),
        _ => None,
    }
}

fn install_hint(cmd: &str) -> &'static str {
    match cmd {
        "pdftotext" => "install poppler-utils",
        "pandoc" => "install pandoc",
        _ => "install it",
    }
}

fn run_subprocess(cmd: &'static str, args: Vec<OsString>) -> Result<String> {
    let out = Command::new(cmd).args(&args).output();

    match out {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            bail!("{cmd} not found — {}", install_hint(cmd));
        }
        Err(e) => bail!("{cmd} failed: {e}"),
        Ok(output) if !output.status.success() => {
            let stderr = String::from_utf8_lossy(&output.stderr);
            bail!("{cmd} exited non-zero: {stderr}");
        }
        Ok(output) => Ok(String::from_utf8_lossy(&output.stdout).into_owned()),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const DOCX: &str = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    const PPTX: &str = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
    const XLSX: &str = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

    fn spec_for(mime: &str) -> (&'static str, Vec<String>) {
        let (cmd, args) = subprocess_spec(mime, Path::new("/tmp/f")).expect("handler expected");
        (
            cmd,
            args.into_iter()
                .map(|a| a.to_string_lossy().into_owned())
                .collect(),
        )
    }

    #[test]
    fn pdf_dispatches_to_pdftotext_stdout() {
        let (cmd, args) = spec_for("application/pdf");
        assert_eq!(cmd, "pdftotext");
        assert_eq!(args, vec!["/tmp/f", "-"]);
    }

    #[test]
    fn office_types_dispatch_to_pandoc_with_matching_from() {
        for (mime, from) in [
            (DOCX, "--from=docx"),
            (PPTX, "--from=pptx"),
            (XLSX, "--from=xlsx"),
            ("application/msword", "--from=doc"),
        ] {
            let (cmd, args) = spec_for(mime);
            assert_eq!(cmd, "pandoc", "{mime}");
            assert_eq!(args, vec![from, "--to=plain", "/tmp/f"], "{mime}");
        }
    }

    #[test]
    fn unknown_mime_has_no_subprocess_handler() {
        for mime in [
            "application/vnd.lotus-organizer",
            "application/octet-stream",
            "application/zip",
        ] {
            assert!(
                subprocess_spec(mime, Path::new("/tmp/f")).is_none(),
                "{mime}"
            );
        }
    }

    #[test]
    fn extract_text_returns_none_for_unsupported_mime() {
        let result = extract_text(Path::new("/nonexistent"), "application/zip").unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn truncate_passes_through_under_limit() {
        let text = "short text".to_string();
        assert_eq!(truncate_text(text.clone()), text);
    }

    #[test]
    fn truncate_passes_through_at_exact_limit() {
        let text = "a".repeat(MAX_TEXT_CHARS);
        assert_eq!(truncate_text(text.clone()).len(), MAX_TEXT_CHARS);
    }

    #[test]
    fn truncate_cuts_at_last_space_before_limit() {
        let mut text = "word ".repeat(MAX_TEXT_CHARS / 5);
        text.push_str(&"x".repeat(10));
        let out = truncate_text(text);
        assert!(out.chars().count() <= MAX_TEXT_CHARS);
        assert!(!out.ends_with(' '));
        assert!(out.ends_with("word"));
    }

    #[test]
    fn truncate_hard_cuts_when_no_space_exists() {
        let text = "x".repeat(MAX_TEXT_CHARS + 50);
        let out = truncate_text(text);
        assert_eq!(out.chars().count(), MAX_TEXT_CHARS);
    }

    #[test]
    fn truncate_respects_char_boundaries() {
        let text = "é".repeat(MAX_TEXT_CHARS + 10);
        let out = truncate_text(text);
        assert_eq!(out.chars().count(), MAX_TEXT_CHARS);
    }
}
