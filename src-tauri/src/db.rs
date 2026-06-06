use std::fs;
use tauri::{AppHandle, Manager};
use anyhow::Result;

/// Creates the app data directory and subdirectories on startup.
pub fn setup_app_dir(app: &AppHandle) -> Result<()> {
    let app_data = app
        .path()
        .app_local_data_dir()
        .expect("could not resolve app local data dir");

    fs::create_dir_all(app_data.join("thumbs"))?;
    fs::create_dir_all(app_data.join("temp"))?;

    Ok(())
}
