pub mod frontmatter;
pub mod fs_ops;
pub mod search;

use std::path::{Path, PathBuf};

/// Resolve `path` and ensure it stays inside the vault root.
/// The path itself may not exist yet (e.g. a note about to be created),
/// so the check canonicalizes the closest existing ancestor.
pub fn resolve_in_vault(vault: &str, path: &str) -> Result<PathBuf, String> {
    let vault_root = Path::new(vault)
        .canonicalize()
        .map_err(|e| format!("vault not accessible: {e}"))?;

    let candidate = Path::new(path);
    let absolute = if candidate.is_absolute() {
        candidate.to_path_buf()
    } else {
        vault_root.join(candidate)
    };

    // Canonicalize the deepest existing ancestor, then re-append the rest.
    let mut existing = absolute.clone();
    let mut tail: Vec<std::ffi::OsString> = Vec::new();
    while !existing.exists() {
        match existing.file_name() {
            Some(name) => {
                tail.push(name.to_os_string());
                existing = existing
                    .parent()
                    .ok_or_else(|| "invalid path".to_string())?
                    .to_path_buf();
            }
            None => return Err("invalid path".to_string()),
        }
    }
    let mut resolved = existing
        .canonicalize()
        .map_err(|e| format!("cannot resolve path: {e}"))?;
    for part in tail.iter().rev() {
        if part == ".." || part == "." {
            return Err("path traversal is not allowed".to_string());
        }
        resolved.push(part);
    }

    if !resolved.starts_with(&vault_root) {
        return Err("path escapes the vault".to_string());
    }
    Ok(resolved)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn rejects_path_traversal() {
        let dir = tempfile::tempdir().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let vault_str = vault.to_str().unwrap();

        assert!(resolve_in_vault(vault_str, "../outside.md").is_err());
        assert!(resolve_in_vault(vault_str, "sub/../../outside.md").is_err());
        assert!(resolve_in_vault(vault_str, "/etc/passwd").is_err());
    }

    #[test]
    fn accepts_paths_inside_vault() {
        let dir = tempfile::tempdir().unwrap();
        let vault = dir.path().join("vault");
        fs::create_dir(&vault).unwrap();
        let vault_str = vault.to_str().unwrap();

        // existing file
        fs::write(vault.join("a.md"), "hi").unwrap();
        assert!(resolve_in_vault(vault_str, "a.md").is_ok());
        // not-yet-existing file in a not-yet-existing subfolder
        assert!(resolve_in_vault(vault_str, "sub/new.md").is_ok());
        // absolute path inside the vault
        let abs = vault.join("a.md");
        assert!(resolve_in_vault(vault_str, abs.to_str().unwrap()).is_ok());
    }
}
