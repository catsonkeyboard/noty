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
