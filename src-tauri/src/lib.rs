mod data;
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
            data::setup(app.handle())?;
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
            // Data location
            data::get_data_location,
            data::set_data_location,
            data::dir_has_database,
            data::copy_data_folders,
            data::restart_app,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
