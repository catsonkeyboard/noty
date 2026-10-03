use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;

const SERVICE: &str = "noty";
const LLM_KEY: &str = "llm-api-key";
const WEBDAV_KEY: &str = "webdav-password";

fn entry(user: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, user).map_err(|e| e.to_string())
}

fn home_dir() -> Option<PathBuf> {
    std::env::var_os("HOME")
        .or_else(|| std::env::var_os("USERPROFILE"))
        .map(PathBuf::from)
}

fn fallback_dir() -> Option<PathBuf> {
    home_dir().map(|h| h.join(".noty"))
}

fn fallback_file() -> Option<PathBuf> {
    fallback_dir().map(|d| d.join(".secrets"))
}

fn read_fallback() -> HashMap<String, String> {
    let Some(path) = fallback_file() else {
        return HashMap::new();
    };
    let Ok(content) = fs::read_to_string(path) else {
        return HashMap::new();
    };
    serde_json::from_str(&content).unwrap_or_default()
}

fn write_fallback(map: &HashMap<String, String>) -> Result<(), String> {
    let Some(dir) = fallback_dir() else {
        return Err("cannot determine home directory".to_string());
    };
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;

    let Some(path) = fallback_file() else {
        return Err("cannot determine secrets file path".to_string());
    };

    let content = serde_json::to_string_pretty(map).map_err(|e| e.to_string())?;
    fs::write(&path, content).map_err(|e| e.to_string())?;

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = fs::set_permissions(&path, fs::Permissions::from_mode(0o600));
    }

    Ok(())
}

fn set_fallback(user: &str, value: &str) -> Result<(), String> {
    let mut map = read_fallback();
    map.insert(user.to_string(), value.to_string());
    write_fallback(&map)
}

fn get_fallback(user: &str) -> Option<String> {
    let map = read_fallback();
    map.get(user).cloned()
}

fn delete_fallback(user: &str) -> Result<(), String> {
    let mut map = read_fallback();
    map.remove(user);
    write_fallback(&map)
}

fn set(user: &str, value: &str) -> Result<(), String> {
    if value.is_empty() {
        return delete(user);
    }

    // Try system keyring first
    let keyring_result = entry(user).and_then(|e| e.set_password(value).map_err(|e| e.to_string()));
    match keyring_result {
        Ok(()) => {
            // Clean up fallback if system keyring succeeded
            let _ = delete_fallback(user);
            Ok(())
        }
        Err(err) => {
            eprintln!("keyring store failed ({err}), falling back to local protected file");
            set_fallback(user, value)
        }
    }
}

fn get(user: &str) -> Result<Option<String>, String> {
    // Try system keyring first
    if let Ok(e) = entry(user) {
        match e.get_password() {
            Ok(key) => return Ok(Some(key)),
            Err(keyring::Error::NoEntry) => {
                // Check if it was saved in fallback
                if let Some(val) = get_fallback(user) {
                    return Ok(Some(val));
                }
                return Ok(None);
            }
            Err(_) => {
                // Keyring platform error, check fallback
            }
        }
    }

    Ok(get_fallback(user))
}

fn delete(user: &str) -> Result<(), String> {
    let _ = delete_fallback(user);
    if let Ok(e) = entry(user) {
        match e.delete_credential() {
            Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
            Err(e) => {
                eprintln!("keyring delete warning: {e}");
                Ok(())
            }
        }
    } else {
        Ok(())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn secrets_crud_test() {
        let test_user = "test-user-crud";
        let res = set(test_user, "secret-123");
        assert!(res.is_ok(), "set should succeed with keyring or fallback");
        assert_eq!(get(test_user).unwrap(), Some("secret-123".to_string()));
        delete(test_user).unwrap();
        assert_eq!(get(test_user).unwrap(), None);
    }
}
