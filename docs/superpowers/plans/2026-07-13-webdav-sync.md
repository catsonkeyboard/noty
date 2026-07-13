# WebDAV 同步功能实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为 noty 实现 vault 与 WebDAV 服务器(重点坚果云)的双向同步,含冲突双副本保留、手动/启动/定时三种触发方式。

**Architecture:** Rust 端基于 reqwest 手写极简 WebDAV 客户端(PROPFIND/GET/PUT/MKCOL/DELETE),用三方对比(本地 × 远端 × 上次同步快照)生成同步计划并串行执行,每完成一个文件立即持久化快照。前端 zustand SyncStore 驱动状态栏指示器、设置页和自动同步定时器。

**Tech Stack:** Rust (reqwest / quick-xml / percent-encoding / keyring / walkdir / tokio), React 19 + zustand, Tauri 2 事件(`sync://progress` 等)。

**Spec:** `docs/superpowers/specs/2026-07-13-webdav-sync-design.md`

**约定:**

- 所有同步内部路径均为 **vault 根的相对路径**,`/` 分隔(如 `sub/note.md`)。
- 快照存于 `~/.noty/sync/<vault路径fnv1a哈希>.json`。
- Rust 测试在 `src-tauri/` 下运行 `cargo test`;前端测试运行 `pnpm test`。

---

### Task 1: Rust 依赖 + WebdavConfig 配置结构

**Files:**
- Modify: `src-tauri/Cargo.toml`
- Modify: `src-tauri/src/config.rs`

- [ ] **Step 1: 添加依赖**

在 `src-tauri/Cargo.toml` 的 `[dependencies]` 段末尾追加:

```toml
quick-xml = "0.38"
percent-encoding = "2"
```

- [ ] **Step 2: 写失败的测试**

修改 `src-tauri/src/config.rs` 中现有 `roundtrip` 测试,让 `AppConfig` 字面量包含 webdav 字段(此时编译失败,即"失败的测试"):

```rust
    #[test]
    fn roundtrip() {
        let dir = tempfile::tempdir().unwrap();
        let path = config_file(dir.path());
        let config = AppConfig {
            vault_path: Some("/tmp/vault".into()),
            theme: Some("dark".into()),
            editor_width: Some("wide".into()),
            llm: LlmConfig {
                base_url: Some("http://localhost:11434/v1".into()),
                model: Some("llama3".into()),
            },
            webdav: WebdavConfig {
                url: Some("https://dav.jianguoyun.com/dav/".into()),
                username: Some("me@example.com".into()),
                remote_dir: Some("noty".into()),
                sync_on_start: Some(true),
                auto_sync_interval_mins: Some(10),
            },
        };
        save_to(&path, &config).unwrap();
        assert_eq!(load_from(&path), config);
        // written as camelCase JSON for hand-editing
        let raw = fs::read_to_string(&path).unwrap();
        assert!(raw.contains("\"vaultPath\""));
        assert!(raw.contains("\"baseUrl\""));
        assert!(raw.contains("\"remoteDir\""));
        assert!(raw.contains("\"autoSyncIntervalMins\""));
    }
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd src-tauri && cargo test config`
Expected: 编译错误 `cannot find struct WebdavConfig` / `struct AppConfig has no field webdav`

- [ ] **Step 4: 实现 WebdavConfig**

在 `config.rs` 中,`AppConfig` 增加字段,并在 `LlmConfig` 之后新增结构体:

```rust
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub theme: Option<String>,
    pub editor_width: Option<String>,
    pub llm: LlmConfig,
    pub webdav: WebdavConfig,
}
```

```rust
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WebdavConfig {
    pub url: Option<String>,
    pub username: Option<String>,
    pub remote_dir: Option<String>,
    pub sync_on_start: Option<bool>,
    pub auto_sync_interval_mins: Option<u32>,
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd src-tauri && cargo test config`
Expected: `test config::tests::roundtrip ... ok`(共 3 个 config 测试全过;`partial_file_keeps_defaults_for_missing_keys` 验证了旧配置文件缺 webdav 字段时正常加载)

- [ ] **Step 6: Commit**

```bash
git add src-tauri/Cargo.toml src-tauri/Cargo.lock src-tauri/src/config.rs
git commit -m "feat(sync): add webdav section to app config"
```

---

### Task 2: secrets.rs 通用化 + WebDAV 密码命令

WebDAV 密码存系统钥匙串,keyring 条目 `("noty", "webdav-password")`。keyring 依赖系统钥匙串,不写单测(与现有 secrets 代码一致),以 `cargo check` 验证。

**Files:**
- Modify: `src-tauri/src/secrets.rs`(整文件替换)
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 重写 secrets.rs**

用以下内容替换 `src-tauri/src/secrets.rs` 全文(把原来写死的 `USER` 改成参数,行为不变,再加 webdav 密码命令):

```rust
const SERVICE: &str = "noty";
const LLM_KEY: &str = "llm-api-key";
const WEBDAV_KEY: &str = "webdav-password";

fn entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, user).map_err(|e| e.to_string())
}

fn set(user: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        return delete(user);
    }
    entry(user)?.set_password(value).map_err(|e| e.to_string())
}

fn get(user: &str) -> Result<Option<String>, String> {
    match entry(user)?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

fn delete(user: &str) -> Result<(), String> {
    match entry(user)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    set(LLM_KEY, &key)
}

#[tauri::command]
pub fn get_api_key() -> Result<Option<String>, String> {
    get(LLM_KEY)
}

#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    Ok(get(LLM_KEY)?.is_some())
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    delete(LLM_KEY)
}

#[tauri::command]
pub fn set_webdav_password(key: String) -> Result<(), String> {
    set(WEBDAV_KEY, &key)
}

#[tauri::command]
pub fn has_webdav_password() -> Result<bool, String> {
    Ok(get(WEBDAV_KEY)?.is_some())
}

#[tauri::command]
pub fn delete_webdav_password() -> Result<(), String> {
    delete(WEBDAV_KEY)
}

/// Internal helper for the sync engine (not exposed as a command).
pub fn get_webdav_password() -> Result<Option<String>, String> {
    get(WEBDAV_KEY)
}
```

- [ ] **Step 2: 注册命令**

`src-tauri/src/lib.rs` 的 `generate_handler![...]` 中,在 `secrets::delete_api_key,` 之后追加:

```rust
            secrets::set_webdav_password,
            secrets::has_webdav_password,
            secrets::delete_webdav_password,
```

- [ ] **Step 3: 验证编译与既有测试**

Run: `cd src-tauri && cargo test`
Expected: 编译通过,所有既有测试 ok

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/secrets.rs src-tauri/src/lib.rs
git commit -m "feat(sync): store webdav password in system keychain"
```

---

### Task 3: sync/state.rs — 同步快照

**Files:**
- Create: `src-tauri/src/sync/mod.rs`
- Create: `src-tauri/src/sync/state.rs`
- Modify: `src-tauri/src/lib.rs`(声明模块)

- [ ] **Step 1: 建模块骨架 + 失败的测试**

创建 `src-tauri/src/sync/mod.rs`:

```rust
pub mod state;
```

在 `src-tauri/src/lib.rs` 顶部 `mod secrets;` 之后加一行:

```rust
mod sync;
```

创建 `src-tauri/src/sync/state.rs`,先只写测试(实现留空,让编译失败):

```rust
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test sync::state`
Expected: 编译错误 `cannot find type Snapshot` 等

- [ ] **Step 3: 实现**

在 `state.rs` 测试模块上方补齐实现(原子写模式与 config.rs 一致):

```rust
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd src-tauri && cargo test sync::state`
Expected: 3 个测试 ok

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/sync src-tauri/src/lib.rs
git commit -m "feat(sync): add per-vault sync snapshot storage"
```

---

### Task 4: sync/engine.rs — plan() 三方对比纯函数

spec 判定表的核心实现。先写覆盖全部 12 种组合的测试。

**Files:**
- Create: `src-tauri/src/sync/engine.rs`
- Modify: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: 声明模块**

`src-tauri/src/sync/mod.rs` 改为:

```rust
pub mod engine;
pub mod state;
```

- [ ] **Step 2: 写失败的测试**

创建 `src-tauri/src/sync/engine.rs`,先写类型占位不写逻辑会导致测试全红;直接先写测试模块(编译失败):

```rust
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
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd src-tauri && cargo test sync::engine`
Expected: 编译错误 `cannot find type LocalFile / Action / fn plan`

- [ ] **Step 4: 实现 plan()**

在 `engine.rs` 测试模块上方补齐:

```rust
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
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd src-tauri && cargo test sync::engine`
Expected: 13 个测试 ok

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/sync
git commit -m "feat(sync): three-way diff planner covering full decision table"
```

---

### Task 5: sync/webdav.rs — multistatus 解析

纯函数部分:PROPFIND 207 响应 XML → `Vec<RemoteEntry>`。用坚果云风格样本测试(命名空间前缀 `D:`、percent-encoded 中文 href、weak etag、完整 URL href)。

**Files:**
- Create: `src-tauri/src/sync/webdav.rs`
- Modify: `src-tauri/src/sync/mod.rs`

- [ ] **Step 1: 声明模块**

`src-tauri/src/sync/mod.rs` 改为:

```rust
pub mod engine;
pub mod state;
pub mod webdav;
```

- [ ] **Step 2: 写失败的测试**

创建 `src-tauri/src/sync/webdav.rs`,先写测试模块:

```rust
#[cfg(test)]
mod tests {
    use super::*;

    const JIANGUOYUN_SAMPLE: &str = r#"<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/noty/</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag></D:getetag>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/%E7%AC%94%E8%AE%B0.md</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"abc123"</D:getetag>
        <D:getcontentlength>42</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/sub/</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"d1"</D:getetag>
        <D:resourcetype><D:collection/></D:resourcetype>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/sub/a.md</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>W/"weak-9"</D:getetag>
        <D:getcontentlength>7</D:getcontentlength>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
  <D:response>
    <D:href>/dav/noty/.hidden.md</D:href>
    <D:propstat>
      <D:prop>
        <D:getetag>"h1"</D:getetag>
        <D:resourcetype/>
      </D:prop>
      <D:status>HTTP/1.1 200 OK</D:status>
    </D:propstat>
  </D:response>
</D:multistatus>"#;

    #[test]
    fn parses_files_dirs_and_skips_root_and_hidden() {
        let entries = parse_multistatus(JIANGUOYUN_SAMPLE, "/dav/noty/").unwrap();
        assert_eq!(
            entries,
            vec![
                RemoteEntry { rel_path: "笔记.md".into(), etag: "abc123".into(), size: 42, is_dir: false },
                RemoteEntry { rel_path: "sub".into(), etag: "d1".into(), size: 0, is_dir: true },
                RemoteEntry { rel_path: "sub/a.md".into(), etag: "weak-9".into(), size: 7, is_dir: false },
            ]
        );
    }

    #[test]
    fn handles_full_url_hrefs() {
        let xml = r#"<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>https://dav.example.com/dav/noty/a.md</D:href>
    <D:propstat><D:prop><D:getetag>"x"</D:getetag><D:resourcetype/></D:prop></D:propstat>
  </D:response>
</D:multistatus>"#;
        let entries = parse_multistatus(xml, "/dav/noty/").unwrap();
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].rel_path, "a.md");
    }

    #[test]
    fn ignores_entries_outside_root() {
        let xml = r#"<?xml version="1.0"?>
<D:multistatus xmlns:D="DAV:">
  <D:response>
    <D:href>/dav/other/a.md</D:href>
    <D:propstat><D:prop><D:getetag>"x"</D:getetag><D:resourcetype/></D:prop></D:propstat>
  </D:response>
</D:multistatus>"#;
        assert!(parse_multistatus(xml, "/dav/noty/").unwrap().is_empty());
    }

    #[test]
    fn normalize_etag_strips_quotes_and_weak_prefix() {
        assert_eq!(normalize_etag("\"abc\""), "abc");
        assert_eq!(normalize_etag("W/\"abc\""), "abc");
        assert_eq!(normalize_etag("  abc "), "abc");
    }

    #[test]
    fn rejects_malformed_xml() {
        assert!(parse_multistatus("<not-closed", "/dav/").is_err());
    }
}
```

- [ ] **Step 3: 运行测试确认失败**

Run: `cd src-tauri && cargo test sync::webdav`
Expected: 编译错误 `cannot find fn parse_multistatus`

- [ ] **Step 4: 实现解析**

在 `webdav.rs` 测试模块上方补齐:

```rust
use quick_xml::events::Event;
use quick_xml::Reader;

/// One entry from a PROPFIND multistatus response, path relative to the sync root.
#[derive(Debug, Clone, PartialEq)]
pub struct RemoteEntry {
    pub rel_path: String,
    pub etag: String,
    pub size: u64,
    pub is_dir: bool,
}

/// Strip surrounding quotes and the weak-validator prefix from an ETag value.
pub fn normalize_etag(raw: &str) -> String {
    raw.trim().trim_start_matches("W/").trim_matches('"').to_string()
}

/// Parse a 207 multistatus body. `root_path` is the percent-decoded server
/// path of the sync root, always with a trailing slash (e.g. "/dav/noty/").
/// Entries outside the root, the root itself and hidden files are skipped.
pub fn parse_multistatus(xml: &str, root_path: &str) -> Result<Vec<RemoteEntry>, String> {
    #[derive(PartialEq)]
    enum Field {
        None,
        Href,
        Etag,
        Length,
    }

    let mut reader = Reader::from_str(xml);
    let mut entries = Vec::new();
    let mut field = Field::None;
    let mut href = String::new();
    let mut etag = String::new();
    let mut size: u64 = 0;
    let mut is_dir = false;

    loop {
        match reader.read_event() {
            Ok(Event::Start(e)) => match e.local_name().as_ref() {
                b"response" => {
                    href.clear();
                    etag.clear();
                    size = 0;
                    is_dir = false;
                }
                b"href" => field = Field::Href,
                b"getetag" => field = Field::Etag,
                b"getcontentlength" => field = Field::Length,
                b"collection" => is_dir = true,
                _ => {}
            },
            Ok(Event::Empty(e)) if e.local_name().as_ref() == b"collection" => is_dir = true,
            Ok(Event::Text(t)) => {
                let text = t.unescape().map_err(|e| e.to_string())?.trim().to_string();
                match field {
                    Field::Href => href = text,
                    Field::Etag => etag = text,
                    Field::Length => size = text.parse().unwrap_or(0),
                    Field::None => {}
                }
            }
            Ok(Event::End(e)) => match e.local_name().as_ref() {
                b"href" | b"getetag" | b"getcontentlength" => field = Field::None,
                b"response" => {
                    let decoded = percent_encoding::percent_decode_str(&href)
                        .decode_utf8_lossy()
                        .into_owned();
                    // href may be an absolute path or a full URL — reduce to a path
                    let path = match decoded.split_once("://") {
                        Some((_, rest)) => match rest.split_once('/') {
                            Some((_, p)) => format!("/{p}"),
                            None => "/".to_string(),
                        },
                        None => decoded,
                    };
                    if let Some(rel) = path.strip_prefix(root_path) {
                        let rel = rel.trim_end_matches('/').to_string();
                        let hidden = rel.split('/').any(|s| s.starts_with('.'));
                        if !rel.is_empty() && !hidden {
                            entries.push(RemoteEntry {
                                rel_path: rel,
                                etag: normalize_etag(&etag),
                                size,
                                is_dir,
                            });
                        }
                    }
                }
                _ => {}
            },
            Ok(Event::Eof) => break,
            Err(e) => return Err(format!("bad multistatus XML: {e}")),
            _ => {}
        }
    }
    Ok(entries)
}
```

- [ ] **Step 5: 运行测试确认通过**

Run: `cd src-tauri && cargo test sync::webdav`
Expected: 5 个测试 ok

- [ ] **Step 6: Commit**

```bash
git add src-tauri/src/sync
git commit -m "feat(sync): parse webdav propfind multistatus responses"
```

---

### Task 6: sync/webdav.rs — HTTP 客户端

网络方法(无单测,靠 Task 13 手动验证;本任务以 `cargo check` + clippy 保证质量)。核心点:自定义 HTTP 动词、Basic 认证、429/5xx 指数退避重试、`Depth: infinity` 失败自动降级逐目录遍历、坚果云串行请求。

**Files:**
- Modify: `src-tauri/src/sync/webdav.rs`(在 Task 5 实现之后追加)

- [ ] **Step 1: 追加客户端实现**

在 `parse_multistatus` 之后、`#[cfg(test)]` 之前追加:

```rust
use std::collections::BTreeMap;

use percent_encoding::{utf8_percent_encode, AsciiSet, CONTROLS};

use super::engine::RemoteFile;

/// Characters to escape inside one path segment of a URL.
const SEGMENT: &AsciiSet = &CONTROLS
    .add(b' ')
    .add(b'"')
    .add(b'#')
    .add(b'%')
    .add(b'<')
    .add(b'>')
    .add(b'?')
    .add(b'`')
    .add(b'{')
    .add(b'}');

const PROPFIND_BODY: &str = r#"<?xml version="1.0" encoding="utf-8"?><D:propfind xmlns:D="DAV:"><D:prop><D:getetag/><D:getcontentlength/><D:resourcetype/></D:prop></D:propfind>"#;

fn method(name: &str) -> reqwest::Method {
    reqwest::Method::from_bytes(name.as_bytes()).expect("valid method name")
}

pub enum Propfind {
    Entries(Vec<RemoteEntry>),
    /// The server rejected this Depth (jianguoyun disallows "infinity").
    Unsupported,
}

pub struct WebdavClient {
    http: reqwest::Client,
    /// Server base URL without trailing slash, e.g. "https://dav.jianguoyun.com/dav"
    base: String,
    /// Path segments of the remote sync dir, e.g. ["noty"]
    root_segments: Vec<String>,
    username: String,
    password: String,
}

impl WebdavClient {
    pub fn new(
        base_url: &str,
        remote_dir: &str,
        username: &str,
        password: &str,
    ) -> Result<Self, String> {
        let base = base_url.trim().trim_end_matches('/').to_string();
        if base.is_empty() {
            return Err("WebDAV URL is not configured".to_string());
        }
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(60))
            .build()
            .map_err(|e| e.to_string())?;
        Ok(Self {
            http,
            base,
            root_segments: remote_dir
                .split('/')
                .filter(|s| !s.is_empty())
                .map(String::from)
                .collect(),
            username: username.to_string(),
            password: password.to_string(),
        })
    }

    /// URL for a root-relative path ("" = the sync root itself), no trailing slash.
    fn url_for(&self, rel: &str) -> String {
        let mut url = self.base.clone();
        let segments = self
            .root_segments
            .iter()
            .map(String::as_str)
            .chain(rel.split('/').filter(|s| !s.is_empty()));
        for seg in segments {
            url.push('/');
            url.push_str(&utf8_percent_encode(seg, SEGMENT).to_string());
        }
        url
    }

    /// Percent-decoded server path of the sync root with trailing slash,
    /// used to relativize PROPFIND hrefs (e.g. "/dav/noty/").
    fn root_path(&self) -> String {
        let after_scheme = self.base.split_once("://").map(|(_, r)| r).unwrap_or(&self.base);
        let mut p = match after_scheme.find('/') {
            Some(i) => after_scheme[i..].trim_end_matches('/').to_string(),
            None => String::new(),
        };
        for seg in &self.root_segments {
            p.push('/');
            p.push_str(seg);
        }
        p.push('/');
        p
    }

    fn auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        req.basic_auth(&self.username, Some(&self.password))
    }

    /// Send with up to 3 attempts; retries on 429 / 5xx / transport errors
    /// with exponential backoff (jianguoyun rate-limits free accounts).
    async fn send_retry(&self, req: reqwest::RequestBuilder) -> Result<reqwest::Response, String> {
        let mut delay = std::time::Duration::from_millis(500);
        for attempt in 1..=3u32 {
            let cloned = req
                .try_clone()
                .ok_or_else(|| "internal error: request is not cloneable".to_string())?;
            match cloned.send().await {
                Ok(resp) => {
                    let s = resp.status();
                    if attempt < 3 && (s.as_u16() == 429 || s.is_server_error()) {
                        // fall through to backoff
                    } else {
                        return Ok(resp);
                    }
                }
                Err(e) => {
                    if attempt == 3 {
                        return Err(format!("network error: {e}"));
                    }
                }
            }
            tokio::time::sleep(delay).await;
            delay *= 2;
        }
        unreachable!("loop always returns on attempt 3");
    }

    async fn propfind_dir(&self, rel: &str, depth: &str) -> Result<Propfind, String> {
        let url = format!("{}/", self.url_for(rel));
        let req = self
            .auth(self.http.request(method("PROPFIND"), &url))
            .header("Depth", depth)
            .header("Content-Type", "application/xml")
            .body(PROPFIND_BODY);
        let resp = self.send_retry(req).await?;
        match resp.status().as_u16() {
            207 => {
                let text = resp.text().await.map_err(|e| e.to_string())?;
                Ok(Propfind::Entries(parse_multistatus(&text, &self.root_path())?))
            }
            400 | 403 | 501 => Ok(Propfind::Unsupported),
            401 => Err("authentication failed — check username / app password".to_string()),
            404 => Ok(Propfind::Entries(Vec::new())),
            s => Err(format!("PROPFIND failed with status {s}")),
        }
    }

    /// List every file under the sync root. Tries a single Depth:infinity
    /// request first, falls back to a per-directory Depth:1 walk.
    pub async fn list_all(&self) -> Result<BTreeMap<String, RemoteFile>, String> {
        let mut files = BTreeMap::new();
        match self.propfind_dir("", "infinity").await? {
            Propfind::Entries(entries) => {
                for e in entries {
                    if !e.is_dir {
                        files.insert(e.rel_path, RemoteFile { etag: e.etag, size: e.size });
                    }
                }
            }
            Propfind::Unsupported => {
                let mut dirs = vec![String::new()];
                while let Some(dir) = dirs.pop() {
                    let entries = match self.propfind_dir(&dir, "1").await? {
                        Propfind::Entries(e) => e,
                        Propfind::Unsupported => {
                            return Err("server rejected PROPFIND Depth 1".to_string())
                        }
                    };
                    for e in entries {
                        if e.rel_path == dir {
                            continue; // the directory itself
                        }
                        if e.is_dir {
                            dirs.push(e.rel_path);
                        } else {
                            files.insert(e.rel_path, RemoteFile { etag: e.etag, size: e.size });
                        }
                    }
                }
            }
        }
        Ok(files)
    }

    pub async fn get(&self, rel: &str) -> Result<Vec<u8>, String> {
        let resp = self.send_retry(self.auth(self.http.get(self.url_for(rel)))).await?;
        if !resp.status().is_success() {
            return Err(format!("GET {rel} failed with status {}", resp.status()));
        }
        Ok(resp.bytes().await.map_err(|e| e.to_string())?.to_vec())
    }

    /// PUT the file; returns the new ETag when the server sends one back.
    pub async fn put(&self, rel: &str, body: Vec<u8>) -> Result<Option<String>, String> {
        let resp = self
            .send_retry(self.auth(self.http.put(self.url_for(rel))).body(body))
            .await?;
        if !resp.status().is_success() {
            return Err(format!("PUT {rel} failed with status {}", resp.status()));
        }
        Ok(resp
            .headers()
            .get("etag")
            .and_then(|v| v.to_str().ok())
            .map(normalize_etag))
    }

    /// Fetch the current ETag of a single file (fallback after a PUT
    /// whose response carried no ETag header).
    pub async fn file_etag(&self, rel: &str) -> Result<String, String> {
        let req = self
            .auth(self.http.request(method("PROPFIND"), self.url_for(rel)))
            .header("Depth", "0")
            .header("Content-Type", "application/xml")
            .body(PROPFIND_BODY);
        let resp = self.send_retry(req).await?;
        if resp.status().as_u16() != 207 {
            return Err(format!("PROPFIND {rel} failed with status {}", resp.status()));
        }
        let text = resp.text().await.map_err(|e| e.to_string())?;
        let entries = parse_multistatus(&text, &self.root_path())?;
        Ok(entries.into_iter().next().map(|e| e.etag).unwrap_or_default())
    }

    pub async fn delete(&self, rel: &str) -> Result<(), String> {
        let resp = self
            .send_retry(self.auth(self.http.delete(self.url_for(rel))))
            .await?;
        match resp.status().as_u16() {
            200..=299 | 404 => Ok(()),
            s => Err(format!("DELETE {rel} failed with status {s}")),
        }
    }

    /// Create one directory (root-relative). 405 means it already exists.
    pub async fn mkcol(&self, rel: &str) -> Result<(), String> {
        let url = format!("{}/", self.url_for(rel));
        let resp = self
            .send_retry(self.auth(self.http.request(method("MKCOL"), &url)))
            .await?;
        match resp.status().as_u16() {
            200..=299 | 405 => Ok(()),
            s => Err(format!("MKCOL {rel} failed with status {s}")),
        }
    }

    /// Create every level of the remote sync dir itself (e.g. "noty").
    pub async fn ensure_root(&self) -> Result<(), String> {
        for i in 1..=self.root_segments.len() {
            let mut url = self.base.clone();
            for seg in &self.root_segments[..i] {
                url.push('/');
                url.push_str(&utf8_percent_encode(seg, SEGMENT).to_string());
            }
            url.push('/');
            let resp = self
                .send_retry(self.auth(self.http.request(method("MKCOL"), &url)))
                .await?;
            match resp.status().as_u16() {
                200..=299 | 405 => {}
                401 => return Err("authentication failed — check username / app password".to_string()),
                s => return Err(format!("MKCOL failed with status {s}")),
            }
        }
        Ok(())
    }
}

/// Probe URL + credentials with a Depth:0 PROPFIND against the base URL.
pub async fn test_connection(url: &str, username: &str, password: &str) -> Result<(), String> {
    let client = WebdavClient::new(url, "", username, password)?;
    match client.propfind_dir("", "0").await? {
        Propfind::Entries(_) => Ok(()),
        Propfind::Unsupported => Err("server rejected PROPFIND".to_string()),
    }
}
```

- [ ] **Step 2: 加 url_for / root_path 的单元测试**

这两个函数是纯函数,可以测。在 `webdav.rs` 的 tests 模块内追加:

```rust
    #[test]
    fn url_for_encodes_segments() {
        let c = WebdavClient::new("https://dav.jianguoyun.com/dav/", "noty", "u", "p").unwrap();
        assert_eq!(c.url_for(""), "https://dav.jianguoyun.com/dav/noty");
        assert_eq!(
            c.url_for("sub dir/笔记#1.md"),
            "https://dav.jianguoyun.com/dav/noty/sub%20dir/笔记%231.md"
        );
    }

    #[test]
    fn root_path_is_decoded_server_path_with_trailing_slash() {
        let c = WebdavClient::new("https://dav.jianguoyun.com/dav/", "noty", "u", "p").unwrap();
        assert_eq!(c.root_path(), "/dav/noty/");
        let c2 = WebdavClient::new("https://dav.example.com", "", "u", "p").unwrap();
        assert_eq!(c2.root_path(), "/");
    }
```

注:`utf8_percent_encode` 不转义非 ASCII 字节,中文字符会原样保留在 String 里,reqwest 发送时会自动编码,断言按上面写即可(若实测 `url_for` 输出对中文做了编码,以实际输出修正断言,两者对服务器等价)。

- [ ] **Step 3: 运行测试与检查**

Run: `cd src-tauri && cargo test sync::webdav && cargo clippy -- -D warnings 2>/dev/null || cargo check`
Expected: 测试全过、编译无错误

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync/webdav.rs
git commit -m "feat(sync): minimal webdav client with retry and depth fallback"
```

---

### Task 7: sync/engine.rs — 本地扫描、冲突副本与执行器

**Files:**
- Modify: `src-tauri/src/sync/engine.rs`

- [ ] **Step 1: 写失败的测试(可测的纯/本地部分)**

在 `engine.rs` tests 模块内追加:

```rust
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
```

- [ ] **Step 2: 运行测试确认失败**

Run: `cd src-tauri && cargo test sync::engine`
Expected: 编译错误 `cannot find fn scan_local / parent_dirs / write_conflict_copy`

- [ ] **Step 3: 实现扫描与冲突副本**

在 `engine.rs` 的 `plan()` 之后追加:

```rust
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
```

- [ ] **Step 4: 运行测试确认通过**

Run: `cd src-tauri && cargo test sync::engine`
Expected: 全部通过(13 + 3 个)

- [ ] **Step 5: 实现执行器 run_sync**

继续在 `engine.rs` 追加(执行器走网络,不写单测,由 Task 13 手动验证):

```rust
use serde::Serialize;
use tauri::Emitter;

use super::state::{self, FileState};
use super::webdav::WebdavClient;
// 注:`Snapshot` 已在 Task 4 顶部通过 `use super::state::Snapshot;` 引入,勿重复导入。

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
```

注意:文件顶部的 `use std::collections::{BTreeMap, BTreeSet};` 已含 `BTreeSet`(Task 4 引入),如缺则补上。

- [ ] **Step 6: 编译 + 全量 Rust 测试**

Run: `cd src-tauri && cargo test`
Expected: 全部通过

- [ ] **Step 7: Commit**

```bash
git add src-tauri/src/sync/engine.rs
git commit -m "feat(sync): sync executor with conflict copies and resumable snapshot"
```

---

### Task 8: sync/mod.rs — Tauri 命令与注册

**Files:**
- Modify: `src-tauri/src/sync/mod.rs`
- Modify: `src-tauri/src/lib.rs`

- [ ] **Step 1: 实现命令**

`src-tauri/src/sync/mod.rs` 改为:

```rust
pub mod engine;
pub mod state;
pub mod webdav;

use tauri::{AppHandle, Emitter, Manager, State};

/// Prevents overlapping sync runs (manual + timer can race).
#[derive(Default)]
pub struct SyncGuard(pub tokio::sync::Mutex<()>);

#[tauri::command]
pub async fn sync_now(
    app: AppHandle,
    guard: State<'_, SyncGuard>,
    vault: String,
) -> Result<engine::SyncSummary, String> {
    let _lock = guard
        .0
        .try_lock()
        .map_err(|_| "sync already in progress".to_string())?;
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    let cfg = crate::config::load_config(app.clone())?.webdav;
    let password = crate::secrets::get_webdav_password()?
        .ok_or("WebDAV password is not set — open Settings → Sync")?;

    let result = engine::run_sync(&app, &home, &vault, &cfg, &password).await;
    match &result {
        Ok(summary) => app.emit("sync://done", summary).ok(),
        Err(e) => app.emit("sync://error", e.clone()).ok(),
    };
    result
}

/// Probe URL + credentials. `password: None` / empty falls back to the
/// password already stored in the keychain.
#[tauri::command]
pub async fn webdav_test_connection(
    url: String,
    username: String,
    password: Option<String>,
) -> Result<(), String> {
    let password = match password.filter(|p| !p.is_empty()) {
        Some(p) => p,
        None => crate::secrets::get_webdav_password()?
            .ok_or("no password entered and none stored yet")?,
    };
    webdav::test_connection(&url, &username, &password).await
}
```

- [ ] **Step 2: 注册**

`src-tauri/src/lib.rs`:`.manage(llm::LlmState::default())` 之后加:

```rust
        .manage(sync::SyncGuard::default())
```

`generate_handler![...]` 内(`secrets::delete_webdav_password,` 之后)加:

```rust
            sync::sync_now,
            sync::webdav_test_connection,
```

- [ ] **Step 3: 编译验证**

Run: `cd src-tauri && cargo test`
Expected: 编译通过,测试全过

- [ ] **Step 4: Commit**

```bash
git add src-tauri/src/sync/mod.rs src-tauri/src/lib.rs
git commit -m "feat(sync): expose sync_now and webdav_test_connection commands"
```

---

### Task 9: 前端 — tauri.ts API 与 SettingsStore 扩展

**Files:**
- Modify: `src/lib/tauri.ts`
- Modify: `src/store/SettingsStore.ts`

- [ ] **Step 1: tauri.ts 增加 sync API**

在 `src/lib/tauri.ts` 末尾追加:

```ts
export type SyncSummary = {
  uploaded: number;
  downloaded: string[];
  conflicts: string[];
  deletedLocal: string[];
  deletedRemote: number;
};

export const syncApi = {
  syncNow: (vault: string) => invoke<SyncSummary>("sync_now", { vault }),
  testConnection: (url: string, username: string, password: string | null) =>
    invoke<void>("webdav_test_connection", { url, username, password }),
  setWebdavPassword: (key: string) => invoke<void>("set_webdav_password", { key }),
  hasWebdavPassword: () => invoke<boolean>("has_webdav_password"),
  deleteWebdavPassword: () => invoke<void>("delete_webdav_password"),
};
```

- [ ] **Step 2: SettingsStore 扩展**

修改 `src/store/SettingsStore.ts`:

`AppConfig` 类型增加:

```ts
  webdav: {
    url: string | null;
    username: string | null;
    remoteDir: string | null;
    syncOnStart: boolean | null;
    autoSyncIntervalMins: number | null;
  };
```

`SettingsState` 增加(放在 `llmModel: string;` 之后):

```ts
  webdavUrl: string;
  webdavUsername: string;
  webdavRemoteDir: string;
  webdavSyncOnStart: boolean;
  /** 0 = auto sync disabled */
  webdavAutoSyncIntervalMins: number;
  setWebdav: (patch: Partial<WebdavSettings>) => Promise<void>;
```

并在文件顶部(`SettingsState` 之前)加:

```ts
export type WebdavSettings = {
  webdavUrl: string;
  webdavUsername: string;
  webdavRemoteDir: string;
  webdavSyncOnStart: boolean;
  webdavAutoSyncIntervalMins: number;
};
```

`persist()` 的 `config` 对象增加:

```ts
      webdav: {
        url: s.webdavUrl || null,
        username: s.webdavUsername || null,
        remoteDir: s.webdavRemoteDir || null,
        syncOnStart: s.webdavSyncOnStart,
        autoSyncIntervalMins: s.webdavAutoSyncIntervalMins,
      },
```

初始值(`llmModel: "",` 之后):

```ts
    webdavUrl: "",
    webdavUsername: "",
    webdavRemoteDir: "noty",
    webdavSyncOnStart: true,
    webdavAutoSyncIntervalMins: 10,
```

`hydrate()` 的 `set({...})` 增加:

```ts
          webdavUrl: config.webdav?.url ?? "",
          webdavUsername: config.webdav?.username ?? "",
          webdavRemoteDir: config.webdav?.remoteDir ?? "noty",
          webdavSyncOnStart: config.webdav?.syncOnStart ?? true,
          webdavAutoSyncIntervalMins: config.webdav?.autoSyncIntervalMins ?? 10,
```

setter(`setLlmModel` 之后):

```ts
    setWebdav: async (patch) => {
      set(patch);
      await persist();
    },
```

- [ ] **Step 3: 类型检查 + 既有测试**

Run: `pnpm build && pnpm test`
Expected: tsc 无错误,vitest 既有测试全过

- [ ] **Step 4: Commit**

```bash
git add src/lib/tauri.ts src/store/SettingsStore.ts
git commit -m "feat(sync): frontend sync api and webdav settings state"
```

---

### Task 10: SyncStore + EditorStore.reloadActive(带测试)

**Files:**
- Create: `src/store/SyncStore.ts`
- Modify: `src/store/EditorStore.ts`
- Test: `src/store/__tests__/SyncStore.test.ts`

- [ ] **Step 1: EditorStore 增加 reloadActive**

`src/store/EditorStore.ts`:`EditorState` 类型中 `closeAll: () => void;` 之后加:

```ts
  /** Re-read the active note from disk (after sync downloaded a new version). No-op when dirty. */
  reloadActive: () => Promise<void>;
```

实现(`closeAll: ...,` 之后):

```ts
    reloadActive: async () => {
      const { activePath, dirty } = get();
      if (!activePath || dirty) return;
      await loadNote(activePath);
    },
```

- [ ] **Step 2: 写失败的 SyncStore 测试**

创建 `src/store/__tests__/SyncStore.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  listen: vi.fn(() => Promise.resolve(() => {})),
}));
vi.mock("@tauri-apps/plugin-dialog", () => ({ open: vi.fn() }));

import { invoke } from "@tauri-apps/api/core";
import { useSyncStore } from "@/store/SyncStore";
import { useSettingsStore } from "@/store/SettingsStore";

const summary = {
  uploaded: 1,
  downloaded: [],
  conflicts: [],
  deletedLocal: [],
  deletedRemote: 0,
};

describe("SyncStore", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
    useSettingsStore.setState({
      vaultPath: "/v",
      webdavUrl: "https://dav.example.com/dav/",
    });
    useSyncStore.setState({
      status: "idle",
      lastError: null,
      lastSyncAt: null,
      progress: null,
      lastConflicts: [],
    });
  });

  it("runs a sync and records success", async () => {
    vi.mocked(invoke).mockResolvedValue(summary);
    await useSyncStore.getState().syncNow();
    expect(invoke).toHaveBeenCalledWith("sync_now", { vault: "/v" });
    expect(useSyncStore.getState().status).toBe("success");
    expect(useSyncStore.getState().lastSyncAt).not.toBeNull();
  });

  it("records errors", async () => {
    vi.mocked(invoke).mockRejectedValue("boom");
    await useSyncStore.getState().syncNow();
    expect(useSyncStore.getState().status).toBe("error");
    expect(useSyncStore.getState().lastError).toContain("boom");
  });

  it("does nothing when webdav is not configured", async () => {
    useSettingsStore.setState({ webdavUrl: "" });
    await useSyncStore.getState().syncNow();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("refuses to start while already syncing", async () => {
    useSyncStore.setState({ status: "syncing" });
    await useSyncStore.getState().syncNow();
    expect(invoke).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: 运行测试确认失败**

Run: `pnpm test`
Expected: FAIL — `Cannot find module '@/store/SyncStore'`

- [ ] **Step 4: 实现 SyncStore**

创建 `src/store/SyncStore.ts`:

```ts
import { create } from "zustand";
import { listen } from "@tauri-apps/api/event";
import { syncApi } from "@/lib/tauri";
import { useSettingsStore } from "./SettingsStore";
import { useVaultStore } from "./VaultStore";
import { useEditorStore } from "./EditorStore";

export type SyncStatus = "idle" | "syncing" | "success" | "error";

type SyncState = {
  status: SyncStatus;
  progress: { current: number; total: number } | null;
  lastSyncAt: number | null;
  lastError: string | null;
  /** Conflict copies created by the last sync (vault-relative paths). */
  lastConflicts: string[];
  syncNow: () => Promise<void>;
};

export const useSyncStore = create<SyncState>()((set, get) => ({
  status: "idle",
  progress: null,
  lastSyncAt: null,
  lastError: null,
  lastConflicts: [],

  syncNow: async () => {
    const { vaultPath, webdavUrl } = useSettingsStore.getState();
    if (!vaultPath || !webdavUrl || get().status === "syncing") return;

    // persist any pending edits so the freshest content gets uploaded
    const { pendingFlush } = useEditorStore.getState();
    if (pendingFlush) await pendingFlush();

    set({ status: "syncing", lastError: null, progress: null });
    try {
      const summary = await syncApi.syncNow(vaultPath);
      set({
        status: "success",
        lastSyncAt: Date.now(),
        lastConflicts: summary.conflicts,
        progress: null,
      });

      const changedLocally =
        summary.downloaded.length > 0 || summary.deletedLocal.length > 0;
      if (changedLocally) {
        await useVaultStore.getState().loadTree();
        const editor = useEditorStore.getState();
        if (editor.activePath) {
          const rel = editor.activePath.startsWith(vaultPath + "/")
            ? editor.activePath.slice(vaultPath.length + 1)
            : editor.activePath;
          if (summary.deletedLocal.includes(rel)) {
            editor.handleDelete(editor.activePath);
          } else if (summary.downloaded.includes(rel)) {
            await editor.reloadActive();
          }
        }
      }
    } catch (e) {
      set({ status: "error", lastError: String(e), progress: null });
    }
  },
}));

listen<{ current: number; total: number; path: string }>(
  "sync://progress",
  (event) => {
    useSyncStore.setState({
      progress: { current: event.payload.current, total: event.payload.total },
    });
  }
);
```

- [ ] **Step 5: 运行测试确认通过**

Run: `pnpm test`
Expected: SyncStore 4 个测试 + 既有测试全过

- [ ] **Step 6: Commit**

```bash
git add src/store/SyncStore.ts src/store/EditorStore.ts src/store/__tests__/SyncStore.test.ts
git commit -m "feat(sync): sync store with post-sync tree refresh and note reload"
```

---

### Task 11: 设置对话框「Sync」页

**Files:**
- Modify: `src/components/Settings/SettingsDialog.tsx`

- [ ] **Step 1: 扩 Tab 类型与标签栏**

```ts
type Tab = "general" | "ai" | "sync";
```

标签栏数组改为:

```tsx
          {(["general", "ai", "sync"] as Tab[]).map((t) => (
```

标签文案改为:

```tsx
              {t === "general" ? "General" : t === "ai" ? "AI" : "Sync"}
```

- [ ] **Step 2: 增加状态与 handlers**

从 store 解构处追加 `webdavUrl, webdavUsername, webdavRemoteDir, webdavSyncOnStart, webdavAutoSyncIntervalMins, setWebdav`(都来自 `useSettingsStore()`)。

组件内新增本地 state(现有 useState 之后):

```tsx
  const [davKeySet, setDavKeySet] = useState(false);
  const [davKeyInput, setDavKeyInput] = useState("");
  const [testState, setTestState] = useState<
    { kind: "idle" } | { kind: "testing" } | { kind: "ok" } | { kind: "fail"; msg: string }
  >({ kind: "idle" });
```

打开对话框的 `useEffect` 中追加:

```tsx
      setDavKeyInput("");
      setTestState({ kind: "idle" });
      syncApi.hasWebdavPassword().then(setDavKeySet).catch(() => {});
```

(顶部 import 追加 `import { secretsApi, syncApi } from "@/lib/tauri";` — 替换原有 secretsApi 单独导入。)

handlers(`refreshModels` 之后):

```tsx
  const saveDavKey = async () => {
    const key = davKeyInput.trim();
    if (!key) return;
    await syncApi.setWebdavPassword(key);
    setDavKeyInput("");
    setDavKeySet(true);
  };

  const removeDavKey = async () => {
    await syncApi.deleteWebdavPassword();
    setDavKeySet(false);
  };

  const testConnection = async () => {
    setTestState({ kind: "testing" });
    try {
      await syncApi.testConnection(
        webdavUrl.trim(),
        webdavUsername.trim(),
        davKeyInput.trim() || null
      );
      setTestState({ kind: "ok" });
    } catch (e) {
      setTestState({ kind: "fail", msg: String(e) });
    }
  };
```

- [ ] **Step 3: Sync 页 JSX**

在 `{tab === "ai" && (...)}` 之后追加:

```tsx
          {tab === "sync" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Server URL</label>
                <input
                  className={inputCls}
                  value={webdavUrl}
                  onChange={(e) => setWebdav({ webdavUrl: e.target.value })}
                  placeholder="https://dav.jianguoyun.com/dav/"
                  spellCheck={false}
                />
              </div>
              <div className="flex gap-3">
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-sm font-medium">Username</label>
                  <input
                    className={inputCls}
                    value={webdavUsername}
                    onChange={(e) => setWebdav({ webdavUsername: e.target.value })}
                    placeholder="me@example.com"
                    spellCheck={false}
                  />
                </div>
                <div className="flex flex-1 flex-col gap-1.5">
                  <label className="text-sm font-medium">Remote folder</label>
                  <input
                    className={inputCls}
                    value={webdavRemoteDir}
                    onChange={(e) => setWebdav({ webdavRemoteDir: e.target.value })}
                    placeholder="noty"
                    spellCheck={false}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium">Password</label>
                {davKeySet ? (
                  <div className="flex items-center gap-2 text-sm">
                    <span className="flex items-center gap-1 text-green-600 dark:text-green-500">
                      <CheckIcon size={14} /> Password is set (stored in system keychain)
                    </span>
                    <Button variant="outline" size="sm" onClick={removeDavKey}>
                      Remove
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2">
                    <input
                      className={inputCls}
                      type="password"
                      value={davKeyInput}
                      onChange={(e) => setDavKeyInput(e.target.value)}
                      placeholder="App password"
                      onKeyDown={(e) => e.key === "Enter" && saveDavKey()}
                    />
                    <Button size="sm" onClick={saveDavKey} disabled={!davKeyInput.trim()}>
                      Save
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  For Jianguoyun (坚果云) use an app password from 账户信息 → 安全选项.
                </p>
              </div>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={webdavSyncOnStart}
                    onChange={(e) => setWebdav({ webdavSyncOnStart: e.target.checked })}
                  />
                  Sync on startup
                </label>
                <label className="flex items-center gap-2 text-sm">
                  Auto sync every
                  <input
                    className={cn(inputCls, "w-16 text-center")}
                    type="number"
                    min={0}
                    value={webdavAutoSyncIntervalMins}
                    onChange={(e) =>
                      setWebdav({
                        webdavAutoSyncIntervalMins: Math.max(0, Number(e.target.value) || 0),
                      })
                    }
                  />
                  min (0 = off)
                </label>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={testConnection}
                  disabled={testState.kind === "testing" || !webdavUrl.trim()}
                >
                  {testState.kind === "testing" ? "Testing…" : "Test connection"}
                </Button>
                {testState.kind === "ok" && (
                  <span className="flex items-center gap-1 text-sm text-green-600 dark:text-green-500">
                    <CheckIcon size={14} /> Connected
                  </span>
                )}
                {testState.kind === "fail" && (
                  <span className="text-sm text-red-500" title={testState.msg}>
                    {testState.msg}
                  </span>
                )}
              </div>
            </>
          )}
```

- [ ] **Step 4: 类型检查**

Run: `pnpm build`
Expected: tsc 无错误

- [ ] **Step 5: Commit**

```bash
git add src/components/Settings/SettingsDialog.tsx
git commit -m "feat(sync): webdav settings tab with connection test"
```

---

### Task 12: 状态栏同步指示器

**Files:**
- Modify: `src/components/StatusBar/index.tsx`

- [ ] **Step 1: 实现指示器**

`src/components/StatusBar/index.tsx` 顶部 import 追加:

```tsx
import { CloudIcon, CloudOffIcon, RefreshCwIcon } from "lucide-react";
import { useSyncStore } from "@/store/SyncStore";
```

(与现有 `FolderIcon` 合并成一个 lucide-react import。)

在 `StatusBar` 组件之前加子组件:

```tsx
const SyncIndicator = () => {
  const status = useSyncStore((s) => s.status);
  const progress = useSyncStore((s) => s.progress);
  const lastSyncAt = useSyncStore((s) => s.lastSyncAt);
  const lastError = useSyncStore((s) => s.lastError);
  const lastConflicts = useSyncStore((s) => s.lastConflicts);
  const syncNow = useSyncStore((s) => s.syncNow);
  const configured = useSettingsStore((s) => Boolean(s.webdavUrl));

  if (!configured) return null;

  const title =
    status === "error"
      ? `Sync failed: ${lastError}`
      : status === "syncing" && progress
        ? `Syncing ${progress.current}/${progress.total}`
        : lastConflicts.length > 0
          ? `Synced with ${lastConflicts.length} conflict cop${lastConflicts.length === 1 ? "y" : "ies"}:\n${lastConflicts.join("\n")}`
          : lastSyncAt
            ? `Last synced ${dayjs(lastSyncAt).format("HH:mm")}\nClick to sync`
            : "Click to sync";

  return (
    <button
      className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
      title={title}
      onClick={syncNow}
      disabled={status === "syncing"}
    >
      {status === "syncing" ? (
        <RefreshCwIcon size={12} className="animate-spin" />
      ) : status === "error" ? (
        <CloudOffIcon size={12} className="text-red-500" />
      ) : (
        <CloudIcon
          size={12}
          className={lastConflicts.length > 0 ? "text-amber-500" : ""}
        />
      )}
      {status === "syncing" && progress && (
        <span>
          {progress.current}/{progress.total}
        </span>
      )}
      {status === "error" && <span className="text-red-500">sync failed</span>}
    </button>
  );
};
```

`StatusBar` 的 JSX 中,vault 按钮之后包一个左侧组:

```tsx
      <div className="flex items-center gap-1">
        <button
          className="flex items-center gap-1.5 rounded px-1.5 py-0.5 hover:bg-accent hover:text-accent-foreground"
          title={`${vaultPath}\nClick to switch vault`}
          onClick={switchVault}
        >
          <FolderIcon size={12} />
          {vaultName}
        </button>
        <SyncIndicator />
      </div>
```

(即用一个 `div` 把原 vault 按钮和 `<SyncIndicator />` 包起来,footer 其余不变。)

- [ ] **Step 2: 类型检查**

Run: `pnpm build`
Expected: tsc 无错误

- [ ] **Step 3: Commit**

```bash
git add src/components/StatusBar/index.tsx
git commit -m "feat(sync): status bar sync indicator with progress and conflicts"
```

---

### Task 13: App.tsx 自动同步 + 全量验证

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: 启动同步与定时器**

`src/App.tsx`:把现有 `import { useEffect } from "react";` **替换**为下面第一行,并新增第二行:

```tsx
import { useEffect, useRef } from "react";
import { useSyncStore } from "@/store/SyncStore";
```

组件内(现有 `useEffect` 之后)追加:

```tsx
  const webdavUrl = useSettingsStore((s) => s.webdavUrl);
  const webdavSyncOnStart = useSettingsStore((s) => s.webdavSyncOnStart);
  const webdavAutoSyncIntervalMins = useSettingsStore((s) => s.webdavAutoSyncIntervalMins);
  const didStartSync = useRef(false);

  // sync once on startup
  useEffect(() => {
    if (!hydrated || !vaultPath || !webdavUrl || !webdavSyncOnStart) return;
    if (didStartSync.current) return;
    didStartSync.current = true;
    useSyncStore.getState().syncNow();
  }, [hydrated, vaultPath, webdavUrl, webdavSyncOnStart]);

  // periodic auto-sync; skipped while the editor has unsaved changes
  useEffect(() => {
    if (!hydrated || !vaultPath || !webdavUrl || !webdavAutoSyncIntervalMins) return;
    const id = window.setInterval(() => {
      if (!useEditorStore.getState().dirty) useSyncStore.getState().syncNow();
    }, webdavAutoSyncIntervalMins * 60_000);
    return () => window.clearInterval(id);
  }, [hydrated, vaultPath, webdavUrl, webdavAutoSyncIntervalMins]);
```

- [ ] **Step 2: 全量自动化验证**

Run: `pnpm build && pnpm test && cd src-tauri && cargo test`
Expected: 全部通过

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat(sync): auto sync on startup and on a configurable interval"
```

- [ ] **Step 4: 手动端到端验证(坚果云)**

启动 `pnpm tauri dev`,按以下清单逐项验证:

1. 设置 → Sync:填坚果云地址/账号/应用密码 → Test connection 显示 Connected;填错密码显示 authentication failed。
2. 点状态栏云图标手动同步:本地笔记全部出现在坚果云 `noty/` 目录(网页端确认,中文文件名正常)。
3. 坚果云网页端新建/修改一个 `.md` → 再同步 → 本地文件树出现/更新;当前打开的笔记被更新时编辑器内容刷新。
4. 本地删一个笔记 → 同步 → 远端消失;网页端删一个 → 同步 → 本地消失。
5. 冲突:同一笔记本地改一版、网页端改另一版 → 同步 → 本地出现 `xxx (conflict …).md` 且原文件保留本地版;再次同步后冲突副本也上传到远端。
6. 断网点同步 → 状态栏红色 sync failed,悬停可见错误;恢复网络再同步成功。
7. 重启应用:启动即自动同步一次(状态栏短暂转圈)。

全部通过后,该功能完成。

---

## 与 spec 的对应

| Spec 要求 | Task |
|---|---|
| WebdavConfig 配置 | 1 |
| 密码存钥匙串 | 2 |
| 快照(原子写、按 vault 隔离) | 3 |
| 三方对比判定表(12 组合) | 4 |
| multistatus 解析(坚果云样本) | 5 |
| WebDAV 动词 / 重试 / Depth 降级 | 6 |
| 执行器 / 冲突副本 / 断点续传 / 进度事件 | 7 |
| sync_now / 测试连接命令 / 并发互斥 | 8 |
| 前端 API 与设置持久化 | 9 |
| SyncStore / 文件树刷新 / 活动笔记重载 | 10 |
| 设置页 Sync tab | 11 |
| 状态栏指示器(冲突提示) | 12 |
| 启动 + 定时自动同步(未保存跳过) | 13 |
| 列目录失败不删除 | 7(list_all 失败即整体中止,不会走到删除) |
