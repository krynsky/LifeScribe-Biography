mod db;
mod photos;
mod archive;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_http::init())
        .setup(|app| {
            db::setup_app_dir(app.handle())?;
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            // Photo commands
            photos::scan_folder,
            photos::extract_exif,
            photos::generate_thumbnail,
            photos::batch_process_photos,
            // Archive commands
            archive::extract_archive,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
