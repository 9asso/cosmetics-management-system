#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_opener::init())
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

