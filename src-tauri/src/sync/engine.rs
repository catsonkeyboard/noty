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
}
