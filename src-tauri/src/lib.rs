//! Sanctum desktop shell.
//!
//! The whole app is the web page in `dist/` — the same one the website serves.
//! Your study is saved to your account (Supabase) and on this computer by the
//! page itself, so this side only opens the window and lets links to other
//! sites (like "Open in YouTube") open in your normal browser.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Sanctum");
}
