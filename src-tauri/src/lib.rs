//! Sanctum desktop shell with a local JSON data file. No account is required.

use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

fn sanctum_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    // Keep the file easy for the user to find and back up. If the operating
    // system cannot provide Documents, fall back to Sanctum's app-data folder.
    let base = app.path().document_dir()
        .or_else(|_| app.path().app_local_data_dir())
        .map_err(|error| format!("Could not determine a local data folder: {error}"))?;
    Ok(base.join("Sanctum"))
}

#[tauri::command]
fn load_local_state(app: AppHandle) -> Result<Option<String>, String> {
    let path = sanctum_data_dir(&app)?.join("sanctum-data.json");
    match fs::read_to_string(&path) {
        Ok(contents) => Ok(Some(contents)),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!("Could not read {}: {error}", path.display())),
    }
}

#[tauri::command]
fn save_local_state(app: AppHandle, contents: String) -> Result<String, String> {
    let folder = sanctum_data_dir(&app)?;
    fs::create_dir_all(&folder)
        .map_err(|error| format!("Could not create {}: {error}", folder.display()))?;
    let path = folder.join("sanctum-data.json");
    fs::write(&path, contents)
        .map_err(|error| format!("Could not save {}: {error}", path.display()))?;
    Ok(path.to_string_lossy().into_owned())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![load_local_state, save_local_state])
        .run(tauri::generate_context!())
        .expect("error while running Sanctum");
}
