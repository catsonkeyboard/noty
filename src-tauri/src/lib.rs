mod config;
mod llm;
mod secrets;
mod vault;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(llm::LlmState::default())
        .invoke_handler(tauri::generate_handler![
            config::load_config,
            config::save_config,
            vault::fs_ops::ensure_default_vault,
            vault::fs_ops::list_vault,
            vault::fs_ops::read_note,
            vault::fs_ops::write_note,
            vault::fs_ops::create_note,
            vault::fs_ops::create_folder,
            vault::fs_ops::rename_entry,
            vault::fs_ops::delete_entry,
            vault::fs_ops::move_entry,
            vault::search::search_vault,
            llm::llm_stream,
            llm::llm_cancel,
            llm::list_models,
            secrets::set_api_key,
            secrets::get_api_key,
            secrets::has_api_key,
            secrets::delete_api_key,
            secrets::set_webdav_password,
            secrets::has_webdav_password,
            secrets::delete_webdav_password,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
