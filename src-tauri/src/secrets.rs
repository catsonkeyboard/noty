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
