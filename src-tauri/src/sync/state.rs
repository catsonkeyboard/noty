use std::collections::BTreeMap;
use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

/// Per-file state recorded at the moment a file was last synced successfully.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
pub struct FileState {
    pub etag: String,
    pub local_mtime: i64,
    pub size: u64,
}

/// path (vault-relative, '/'-separated) → state at last successful sync
pub type Snapshot = BTreeMap<String, FileState>;

/// fnv1a-64 of the vault path, so each vault gets its own snapshot file.
fn vault_id(vault: &str) -> String {
    let mut h: u64 = 0xcbf29ce484222325;
    for b in vault.as_bytes() {
        h ^= u64::from(*b);
        h = h.wrapping_mul(0x100000001b3);
    }
    format!("{h:016x}")
}

pub fn snapshot_path(home: &Path, vault: &str) -> PathBuf {
    home.join(".noty")
        .join("sync")
        .join(format!("{}.json", vault_id(vault)))
}

pub fn load(path: &Path) -> Snapshot {
    let Ok(content) = fs::read_to_string(path) else {
        return Snapshot::new();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

pub fn save(path: &Path, snap: &Snapshot) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(snap).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snap.json");
        let mut snap = Snapshot::new();
        snap.insert(
            "sub/笔记.md".to_string(),
            FileState { etag: "abc123".into(), local_mtime: 1700000000, size: 42 },
        );
        save(&path, &snap).unwrap();
        assert_eq!(load(&path), snap);
    }

    #[test]
    fn missing_or_invalid_file_yields_empty() {
        let dir = tempfile::tempdir().unwrap();
        let path = dir.path().join("snap.json");
        assert!(load(&path).is_empty());
        std::fs::write(&path, "not json").unwrap();
        assert!(load(&path).is_empty());
    }

    #[test]
    fn snapshot_path_differs_per_vault() {
        let home = std::path::Path::new("/home/u");
        let a = snapshot_path(home, "/vault/a");
        let b = snapshot_path(home, "/vault/b");
        assert_ne!(a, b);
        assert!(a.starts_with("/home/u/.noty/sync"));
        assert!(a.extension().is_some_and(|e| e == "json"));
    }
}
