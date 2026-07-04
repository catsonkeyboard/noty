const SERVICE: &str = "noty";
const USER: &str = "llm-api-key";

fn entry() -> Result<keyring::Entry, String> {
    keyring::Entry::new(SERVICE, USER).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn set_api_key(key: String) -> Result<(), String> {
    if key.is_empty() {
        return delete_api_key();
    }
    entry()?.set_password(&key).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn get_api_key() -> Result<Option<String>, String> {
    match entry()?.get_password() {
        Ok(key) => Ok(Some(key)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
pub fn has_api_key() -> Result<bool, String> {
    Ok(get_api_key()?.is_some())
}

#[tauri::command]
pub fn delete_api_key() -> Result<(), String> {
    match entry()?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}
