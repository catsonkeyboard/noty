use std::fs;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use tauri::Manager;

/// App configuration persisted at ~/.noty/config.json.
/// All fields are optional so hand-edited / older files stay loadable.
#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppConfig {
    pub vault_path: Option<String>,
    pub theme: Option<String>,
    pub editor_width: Option<String>,
    pub llm: LlmConfig,
    pub webdav: WebdavConfig,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct LlmConfig {
    pub base_url: Option<String>,
    pub model: Option<String>,
}

#[derive(Debug, Default, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WebdavConfig {
    pub url: Option<String>,
    pub username: Option<String>,
    pub remote_dir: Option<String>,
    pub sync_on_start: Option<bool>,
    pub auto_sync_interval_mins: Option<u32>,
}

fn config_file(home: &Path) -> PathBuf {
    home.join(".noty").join("config.json")
}

fn load_from(path: &Path) -> AppConfig {
    let Ok(content) = fs::read_to_string(path) else {
        return AppConfig::default();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn save_to(path: &Path, config: &AppConfig) -> Result<(), String> {
    if let Some(dir) = path.parent() {
        fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    let json = serde_json::to_string_pretty(config).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| e.to_string())?;
    fs::rename(&tmp, path).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn load_config(app: tauri::AppHandle) -> Result<AppConfig, String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    Ok(load_from(&config_file(&home)))
}

#[tauri::command]
pub fn save_config(app: tauri::AppHandle, config: AppConfig) -> Result<(), String> {
    let home = app.path().home_dir().map_err(|e| e.to_string())?;
    save_to(&config_file(&home), &config)
}

#[cfg(test)]
mod tests {
    use super::*;

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

    #[test]
    fn missing_or_invalid_file_yields_defaults() {
        let dir = tempfile::tempdir().unwrap();
        let path = config_file(dir.path());
        assert_eq!(load_from(&path), AppConfig::default());
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, "not json").unwrap();
        assert_eq!(load_from(&path), AppConfig::default());
    }

    #[test]
    fn partial_file_keeps_defaults_for_missing_keys() {
        let dir = tempfile::tempdir().unwrap();
        let path = config_file(dir.path());
        fs::create_dir_all(path.parent().unwrap()).unwrap();
        fs::write(&path, r#"{"theme":"light"}"#).unwrap();
        let cfg = load_from(&path);
        assert_eq!(cfg.theme.as_deref(), Some("light"));
        assert!(cfg.vault_path.is_none());
        assert!(cfg.llm.base_url.is_none());
    }
}
