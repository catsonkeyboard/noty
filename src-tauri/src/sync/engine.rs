use std::collections::{BTreeMap, BTreeSet};

use super::state::Snapshot;

/// A file on disk, as seen by the local scan.
#[derive(Debug, Clone, PartialEq)]
pub struct LocalFile {
    pub mtime: i64,
    pub size: u64,
}

/// A file on the server, as seen by PROPFIND.
#[derive(Debug, Clone, PartialEq)]
pub struct RemoteFile {
    pub etag: String,
    pub size: u64,
}

#[derive(Debug, Clone, PartialEq)]
pub enum Action {
    Upload(String),
    Download(String),
    /// Both sides changed: save remote as a conflict copy, then upload local.
    Conflict(String),
    DeleteRemote(String),
    DeleteLocal(String),
    /// Deleted on both sides: just drop the snapshot entry.
    Forget(String),
}

impl Action {
    pub fn path(&self) -> &str {
        match self {
            Action::Upload(p)
            | Action::Download(p)
            | Action::Conflict(p)
            | Action::DeleteRemote(p)
            | Action::DeleteLocal(p)
            | Action::Forget(p) => p,
        }
    }
}

/// Three-way diff: decide one action per path.
/// See the decision table in docs/superpowers/specs/2026-07-13-webdav-sync-design.md.
pub fn plan(
    local: &BTreeMap<String, LocalFile>,
    remote: &BTreeMap<String, RemoteFile>,
    snapshot: &Snapshot,
) -> Vec<Action> {
    let mut paths: BTreeSet<&String> = BTreeSet::new();
    paths.extend(local.keys());
    paths.extend(remote.keys());
    paths.extend(snapshot.keys());

    let mut actions = Vec::new();
    for path in paths {
        let l = local.get(path);
        let r = remote.get(path);
        let s = snapshot.get(path);

        let local_changed = match (l, s) {
            (Some(l), Some(s)) => l.mtime != s.local_mtime || l.size != s.size,
            (Some(_), None) => true,
            _ => false,
        };
        let remote_changed = match (r, s) {
            (Some(r), Some(s)) => r.etag != s.etag,
            (Some(_), None) => true,
            _ => false,
        };

        let action = match (l.is_some(), r.is_some(), s.is_some()) {
            (true, true, _) => match (local_changed, remote_changed) {
                (true, true) => Some(Action::Conflict(path.clone())),
                (true, false) => Some(Action::Upload(path.clone())),
                (false, true) => Some(Action::Download(path.clone())),
                (false, false) => None,
            },
            // remote side deleted the file
            (true, false, true) => {
                if local_changed {
                    Some(Action::Upload(path.clone())) // local edits win over deletion
                } else {
                    Some(Action::DeleteLocal(path.clone()))
                }
            }
            (true, false, false) => Some(Action::Upload(path.clone())),
            // local side deleted the file
            (false, true, true) => {
                if remote_changed {
                    Some(Action::Download(path.clone())) // remote edits win over deletion
                } else {
                    Some(Action::DeleteRemote(path.clone()))
                }
            }
            (false, true, false) => Some(Action::Download(path.clone())),
            (false, false, true) => Some(Action::Forget(path.clone())),
            (false, false, false) => None,
        };
        if let Some(a) = action {
            actions.push(a);
        }
    }
    actions
}

use std::path::Path;

fn mtime_secs(meta: &std::fs::Metadata) -> i64 {
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
        .map(|d| d.as_secs() as i64)
        .unwrap_or(0)
}

/// Walk the vault; skip hidden entries and leftover atomic-write .tmp files.
pub fn scan_local(root: &Path) -> Result<BTreeMap<String, LocalFile>, String> {
    let mut files = BTreeMap::new();
    let walker = walkdir::WalkDir::new(root).into_iter().filter_entry(|e| {
        e.depth() == 0 || !e.file_name().to_string_lossy().starts_with('.')
    });
    for entry in walker {
        let entry = entry.map_err(|e| e.to_string())?;
        if !entry.file_type().is_file() {
            continue;
        }
        if entry.file_name().to_string_lossy().ends_with(".tmp") {
            continue;
        }
        let meta = entry.metadata().map_err(|e| e.to_string())?;
        let rel = entry
            .path()
            .strip_prefix(root)
            .map_err(|e| e.to_string())?
            .to_string_lossy()
            .replace('\\', "/");
        files.insert(rel, LocalFile { mtime: mtime_secs(&meta), size: meta.len() });
    }
    Ok(files)
}

/// All ancestor directories of a relative path, shallow → deep.
fn parent_dirs(rel: &str) -> Vec<String> {
    let segs: Vec<&str> = rel.split('/').collect();
    let mut dirs = Vec::new();
    let mut acc = String::new();
    for seg in &segs[..segs.len().saturating_sub(1)] {
        if !acc.is_empty() {
            acc.push('/');
        }
        acc.push_str(seg);
        dirs.push(acc.clone());
    }
    dirs
}

/// Save remote bytes as "name (conflict YYYY-MM-DD HHMM).ext" next to the
/// original; appends " 1", " 2", … when the name is taken. Returns the
/// vault-relative path of the copy.
fn write_conflict_copy(vault_root: &Path, rel: &str, bytes: &[u8]) -> Result<String, String> {
    let abs = vault_root.join(rel);
    let dir = abs.parent().unwrap_or(vault_root).to_path_buf();
    let stem = abs
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("note")
        .to_string();
    let ext = abs.extension().and_then(|s| s.to_str()).map(String::from);
    let stamp = chrono::Local::now().format("%Y-%m-%d %H%M");
    let base = format!("{stem} (conflict {stamp})");
    let make = |suffix: &str| match &ext {
        Some(e) => dir.join(format!("{base}{suffix}.{e}")),
        None => dir.join(format!("{base}{suffix}")),
    };
    let mut candidate = make("");
    let mut i = 1;
    while candidate.exists() {
        candidate = make(&format!(" {i}"));
        i += 1;
    }
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    std::fs::write(&candidate, bytes).map_err(|e| e.to_string())?;
    Ok(candidate
        .strip_prefix(vault_root)
        .map_err(|e| e.to_string())?
        .to_string_lossy()
        .replace('\\', "/"))
}

use serde::Serialize;
use tauri::Emitter;

use super::state::{self, FileState};
use super::webdav::WebdavClient;

#[derive(Debug, Default, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SyncSummary {
    pub uploaded: u32,
    /// Vault-relative paths written locally (downloads + conflict copies).
    pub downloaded: Vec<String>,
    /// Vault-relative paths of conflict copies created.
    pub conflicts: Vec<String>,
    pub deleted_local: Vec<String>,
    pub deleted_remote: u32,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
struct ProgressPayload {
    current: usize,
    total: usize,
    path: String,
}

pub async fn run_sync(
    app: &tauri::AppHandle,
    home: &Path,
    vault: &str,
    cfg: &crate::config::WebdavConfig,
    password: &str,
) -> Result<SyncSummary, String> {
    let url = cfg.url.clone().ok_or("WebDAV URL is not configured")?;
    let username = cfg.username.clone().unwrap_or_default();
    let remote_dir = cfg.remote_dir.clone().unwrap_or_else(|| "noty".to_string());
    let client = WebdavClient::new(&url, &remote_dir, &username, password)?;

    client.ensure_root().await?;
    let remote = client.list_all().await?;
    let vault_root = Path::new(vault)
        .canonicalize()
        .map_err(|e| format!("vault not accessible: {e}"))?;
    let local = scan_local(&vault_root)?;
    let snap_path = state::snapshot_path(home, vault);
    let mut snapshot = state::load(&snap_path);

    let actions = plan(&local, &remote, &snapshot);
    let total = actions.len();
    let mut summary = SyncSummary::default();
    let mut created_dirs: BTreeSet<String> = BTreeSet::new();

    for (i, action) in actions.iter().enumerate() {
        app.emit(
            "sync://progress",
            ProgressPayload { current: i + 1, total, path: action.path().to_string() },
        )
        .ok();
        execute_one(&client, &vault_root, action, &remote, &mut snapshot, &mut created_dirs, &mut summary)
            .await?;
        state::save(&snap_path, &snapshot)?;
    }
    Ok(summary)
}

async fn execute_one(
    client: &WebdavClient,
    vault_root: &Path,
    action: &Action,
    remote: &BTreeMap<String, RemoteFile>,
    snapshot: &mut Snapshot,
    created_dirs: &mut BTreeSet<String>,
    summary: &mut SyncSummary,
) -> Result<(), String> {
    match action {
        Action::Upload(path) => {
            upload(client, vault_root, path, snapshot, created_dirs).await?;
            summary.uploaded += 1;
        }
        Action::Download(path) => {
            download(client, vault_root, path, remote, snapshot).await?;
            summary.downloaded.push(path.clone());
        }
        Action::Conflict(path) => {
            let bytes = client.get(path).await?;
            let copy = write_conflict_copy(vault_root, path, &bytes)?;
            upload(client, vault_root, path, snapshot, created_dirs).await?;
            summary.downloaded.push(copy.clone());
            summary.conflicts.push(copy);
            summary.uploaded += 1;
        }
        Action::DeleteRemote(path) => {
            client.delete(path).await?;
            snapshot.remove(path);
            summary.deleted_remote += 1;
        }
        Action::DeleteLocal(path) => {
            match std::fs::remove_file(vault_root.join(path)) {
                Ok(()) => {}
                Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
                Err(e) => return Err(e.to_string()),
            }
            snapshot.remove(path);
            summary.deleted_local.push(path.clone());
        }
        Action::Forget(path) => {
            snapshot.remove(path);
        }
    }
    Ok(())
}

async fn upload(
    client: &WebdavClient,
    vault_root: &Path,
    rel: &str,
    snapshot: &mut Snapshot,
    created_dirs: &mut BTreeSet<String>,
) -> Result<(), String> {
    for dir in parent_dirs(rel) {
        if created_dirs.insert(dir.clone()) {
            client.mkcol(&dir).await?;
        }
    }
    let abs = vault_root.join(rel);
    let bytes = std::fs::read(&abs).map_err(|e| e.to_string())?;
    let etag = match client.put(rel, bytes).await? {
        Some(etag) => etag,
        None => client.file_etag(rel).await?,
    };
    let meta = std::fs::metadata(&abs).map_err(|e| e.to_string())?;
    snapshot.insert(
        rel.to_string(),
        FileState { etag, local_mtime: mtime_secs(&meta), size: meta.len() },
    );
    Ok(())
}

async fn download(
    client: &WebdavClient,
    vault_root: &Path,
    rel: &str,
    remote: &BTreeMap<String, RemoteFile>,
    snapshot: &mut Snapshot,
) -> Result<(), String> {
    let bytes = client.get(rel).await?;
    let abs = vault_root.join(rel);
    if let Some(parent) = abs.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let tmp = abs.with_extension("noty-sync.tmp");
    std::fs::write(&tmp, &bytes).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &abs).map_err(|e| e.to_string())?;
    let meta = std::fs::metadata(&abs).map_err(|e| e.to_string())?;
    let etag = remote.get(rel).map(|r| r.etag.clone()).unwrap_or_default();
    snapshot.insert(
        rel.to_string(),
        FileState { etag, local_mtime: mtime_secs(&meta), size: meta.len() },
    );
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::BTreeMap;

    fn lf(mtime: i64, size: u64) -> LocalFile {
        LocalFile { mtime, size }
    }
    fn rf(etag: &str) -> RemoteFile {
        RemoteFile { etag: etag.into(), size: 0 }
    }
    fn st(etag: &str, mtime: i64, size: u64) -> crate::sync::state::FileState {
        crate::sync::state::FileState { etag: etag.into(), local_mtime: mtime, size }
    }

    /// Build maps from a single optional entry each, keyed "a.md".
    fn run(
        l: Option<LocalFile>,
        r: Option<RemoteFile>,
        s: Option<crate::sync::state::FileState>,
    ) -> Vec<Action> {
        let key = "a.md".to_string();
        let local: BTreeMap<_, _> = l.map(|v| (key.clone(), v)).into_iter().collect();
        let remote: BTreeMap<_, _> = r.map(|v| (key.clone(), v)).into_iter().collect();
        let snap: crate::sync::state::Snapshot = s.map(|v| (key.clone(), v)).into_iter().collect();
        plan(&local, &remote, &snap)
    }

    #[test]
    fn local_new_uploads() {
        assert_eq!(run(Some(lf(10, 1)), None, None), vec![Action::Upload("a.md".into())]);
    }

    #[test]
    fn remote_new_downloads() {
        assert_eq!(run(None, Some(rf("e1")), None), vec![Action::Download("a.md".into())]);
    }

    #[test]
    fn both_new_conflicts() {
        assert_eq!(
            run(Some(lf(10, 1)), Some(rf("e1")), None),
            vec![Action::Conflict("a.md".into())]
        );
    }

    #[test]
    fn local_modified_uploads() {
        assert_eq!(
            run(Some(lf(20, 1)), Some(rf("e1")), Some(st("e1", 10, 1))),
            vec![Action::Upload("a.md".into())]
        );
    }

    #[test]
    fn remote_modified_downloads() {
        assert_eq!(
            run(Some(lf(10, 1)), Some(rf("e2")), Some(st("e1", 10, 1))),
            vec![Action::Download("a.md".into())]
        );
    }

    #[test]
    fn both_modified_conflicts() {
        assert_eq!(
            run(Some(lf(20, 2)), Some(rf("e2")), Some(st("e1", 10, 1))),
            vec![Action::Conflict("a.md".into())]
        );
    }

    #[test]
    fn local_deleted_remote_unchanged_deletes_remote() {
        assert_eq!(
            run(None, Some(rf("e1")), Some(st("e1", 10, 1))),
            vec![Action::DeleteRemote("a.md".into())]
        );
    }

    #[test]
    fn remote_deleted_local_unchanged_deletes_local() {
        assert_eq!(
            run(Some(lf(10, 1)), None, Some(st("e1", 10, 1))),
            vec![Action::DeleteLocal("a.md".into())]
        );
    }

    #[test]
    fn local_deleted_remote_modified_downloads() {
        assert_eq!(
            run(None, Some(rf("e2")), Some(st("e1", 10, 1))),
            vec![Action::Download("a.md".into())]
        );
    }

    #[test]
    fn local_modified_remote_deleted_uploads() {
        assert_eq!(
            run(Some(lf(20, 1)), None, Some(st("e1", 10, 1))),
            vec![Action::Upload("a.md".into())]
        );
    }

    #[test]
    fn both_deleted_forgets_snapshot_entry() {
        assert_eq!(run(None, None, Some(st("e1", 10, 1))), vec![Action::Forget("a.md".into())]);
    }

    #[test]
    fn unchanged_does_nothing() {
        assert_eq!(run(Some(lf(10, 1)), Some(rf("e1")), Some(st("e1", 10, 1))), vec![]);
    }

    #[test]
    fn size_change_counts_as_local_modification() {
        assert_eq!(
            run(Some(lf(10, 99)), Some(rf("e1")), Some(st("e1", 10, 1))),
            vec![Action::Upload("a.md".into())]
        );
    }

    #[test]
    fn scan_local_skips_hidden_and_tmp_files() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("sub")).unwrap();
        std::fs::create_dir_all(root.join(".git")).unwrap();
        std::fs::write(root.join("a.md"), "hello").unwrap();
        std::fs::write(root.join("sub/b.md"), "world!").unwrap();
        std::fs::write(root.join(".hidden.md"), "x").unwrap();
        std::fs::write(root.join(".git/config"), "x").unwrap();
        std::fs::write(root.join("a.md.tmp"), "x").unwrap();

        let files = scan_local(root).unwrap();
        let keys: Vec<&String> = files.keys().collect();
        assert_eq!(keys, vec!["a.md", "sub/b.md"]);
        assert_eq!(files["a.md"].size, 5);
        assert!(files["a.md"].mtime > 0);
    }

    #[test]
    fn parent_dirs_lists_every_ancestor() {
        assert_eq!(parent_dirs("a.md"), Vec::<String>::new());
        assert_eq!(parent_dirs("x/y/z.md"), vec!["x".to_string(), "x/y".to_string()]);
    }

    #[test]
    fn conflict_copy_gets_stamped_name_and_dedupes() {
        let dir = tempfile::tempdir().unwrap();
        let root = dir.path();
        std::fs::create_dir_all(root.join("sub")).unwrap();
        let first = write_conflict_copy(root, "sub/note.md", b"remote").unwrap();
        assert!(first.starts_with("sub/note (conflict "));
        assert!(first.ends_with(".md"));
        assert_eq!(std::fs::read(root.join(&first)).unwrap(), b"remote");
        // second copy in the same minute must not overwrite the first
        let second = write_conflict_copy(root, "sub/note.md", b"remote2").unwrap();
        assert_ne!(first, second);
    }
}
