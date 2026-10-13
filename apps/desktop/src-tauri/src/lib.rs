use std::{fs, io::ErrorKind, path::PathBuf};
use tauri::{AppHandle, Manager};

const SESSION_FILENAME: &str = "session-token";

fn session_path(app: &AppHandle) -> Result<PathBuf, String> {
    app.path()
        .app_local_data_dir()
        .map(|directory| directory.join(SESSION_FILENAME))
        .map_err(|error| error.to_string())
}

#[tauri::command]
fn save_session_token(app: AppHandle, token: String) -> Result<(), String> {
    let path = session_path(&app)?;
    let directory = path
        .parent()
        .ok_or_else(|| "Invalid session directory".to_string())?;
    fs::create_dir_all(directory).map_err(|error| error.to_string())?;
    fs::write(path, token).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_session_token(app: AppHandle) -> Result<Option<String>, String> {
    match fs::read_to_string(session_path(&app)?) {
        Ok(token) if !token.trim().is_empty() => Ok(Some(token.trim().to_string())),
        Ok(_) => Ok(None),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.to_string()),
    }
}

#[tauri::command]
fn clear_session_token(app: AppHandle) -> Result<(), String> {
    match fs::remove_file(session_path(&app)?) {
        Ok(()) => Ok(()),
        Err(error) if error.kind() == ErrorKind::NotFound => Ok(()),
        Err(error) => Err(error.to_string()),
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            save_session_token,
            load_session_token,
            clear_session_token
        ])
        .setup(|app| {
            // Build the main window programmatically so we can apply
            // platform-specific options that are not available in tauri.conf.json.
            let builder = tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::App("/".into()),
            )
            .title("ONight — Gestion commerciale")
            .inner_size(1440.0, 900.0)
            .min_inner_size(1060.0, 700.0)
            .center();

            // On Windows, Tauri v2 serves the app from https://tauri.localhost
            // (WebView2 requires a secure origin). This causes the Chromium
            // engine to block fetch() calls to plain http:// endpoints as
            // "mixed content", showing "Le serveur inaccessible" even though
            // the server is healthy. Switching to http://tauri.localhost avoids
            // this restriction entirely — no HTTPS needed on the server.
            #[cfg(target_os = "windows")]
            let builder = builder.use_https_scheme(false);

            builder.build()?;
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running cosmetics desktop application");
}

