//! Where the app keeps its data.
//!
//! By default the database lives in the app config folder and everything else (images, imported photos,
//! backups, thumbnails) in the app local data folder. The user can pick one folder to hold all of it; that
//! choice is remembered in a small pointer file in the app config folder, which never moves.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, Manager};
use tauri_plugin_fs::FsExt;
use walkdir::WalkDir;

const POINTER_FILE: &str = "data-location.json";
const DB_FILE: &str = "lifescribe.db";

#[derive(Serialize, Deserialize)]
struct Pointer {
    data_dir: String,
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DataLocation {
    /// True when the user picked a folder (false = the default layout).
    pub custom: bool,
    /// False when a chosen folder is missing (e.g. an unplugged drive).
    pub available: bool,
    /// Folder holding images/, media/, backups/, thumbs/ (and, when custom, the database).
    pub files_root: String,
    pub db_path: String,
    pub default_files_root: String,
    pub default_db_path: String,
    pub pointer_file: String,
}

fn config_dir(app: &AppHandle) -> PathBuf {
    app.path().app_config_dir().expect("could not resolve app config dir")
}

fn local_dir(app: &AppHandle) -> PathBuf {
    app.path().app_local_data_dir().expect("could not resolve app local data dir")
}

pub fn resolve(app: &AppHandle) -> DataLocation {
    let default_files_root = local_dir(app);
    let default_db_path = config_dir(app).join(DB_FILE);
    let pointer_file = config_dir(app).join(POINTER_FILE);

    let chosen = fs::read_to_string(&pointer_file)
        .ok()
        .and_then(|text| serde_json::from_str::<Pointer>(&text).ok())
        .map(|p| p.data_dir)
        .filter(|d| !d.trim().is_empty());

    let (custom, available, files_root, db_path) = match chosen {
        Some(dir) => {
            let root = PathBuf::from(&dir);
            let available = root.is_dir();
            let db = root.join(DB_FILE);
            (true, available, root, db)
        }
        None => (false, true, default_files_root.clone(), default_db_path.clone()),
    };

    DataLocation {
        custom,
        available,
        files_root: files_root.to_string_lossy().to_string(),
        db_path: db_path.to_string_lossy().to_string(),
        default_files_root: default_files_root.to_string_lossy().to_string(),
        default_db_path: default_db_path.to_string_lossy().to_string(),
        pointer_file: pointer_file.to_string_lossy().to_string(),
    }
}

/// Folder for thumbnails and scratch files. Falls back to the default if a chosen folder is missing.
pub fn files_root(app: &AppHandle) -> PathBuf {
    let loc = resolve(app);
    if loc.available {
        PathBuf::from(loc.files_root)
    } else {
        PathBuf::from(loc.default_files_root)
    }
}

/// Create the sub-folders on startup and let the webview read files from a chosen folder.
pub fn setup(app: &AppHandle) -> anyhow::Result<()> {
    let root = files_root(app);
    fs::create_dir_all(root.join("thumbs"))?;
    fs::create_dir_all(root.join("temp"))?;

    let loc = resolve(app);
    if loc.custom && loc.available {
        let dir = PathBuf::from(&loc.files_root);
        let _ = app.asset_protocol_scope().allow_directory(&dir, true);
        let _ = app.fs_scope().allow_directory(&dir, true);
    }
    Ok(())
}

#[tauri::command]
pub fn get_data_location(app: AppHandle) -> DataLocation {
    resolve(&app)
}

/// True when `path` is a folder that already holds a LifeScribe database.
#[tauri::command]
pub fn dir_has_database(path: String) -> bool {
    Path::new(&path).join(DB_FILE).is_file()
}

/// Remember the chosen folder. Takes effect the next time the app starts.
#[tauri::command]
pub fn set_data_location(app: AppHandle, path: String) -> Result<(), String> {
    if !Path::new(&path).is_dir() {
        return Err(format!("{path} is not a folder"));
    }
    let dir = config_dir(&app);
    fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    let text = serde_json::to_string_pretty(&Pointer { data_dir: path }).map_err(|e| e.to_string())?;
    fs::write(dir.join(POINTER_FILE), text).map_err(|e| e.to_string())
}

/// Copy the named sub-folders of `src_root` into `dst_root` (existing files of the same size are left alone).
/// Returns how many files were copied. Nothing in `src_root` is changed.
#[tauri::command]
pub async fn copy_data_folders(src_root: String, dst_root: String, folders: Vec<String>) -> Result<u64, String> {
    tokio::task::spawn_blocking(move || -> Result<u64, String> {
        let (src_root, dst_root) = (PathBuf::from(src_root), PathBuf::from(dst_root));
        let mut copied = 0u64;
        for folder in folders {
            let src = src_root.join(&folder);
            if !src.is_dir() {
                continue;
            }
            for entry in WalkDir::new(&src).into_iter().filter_map(|e| e.ok()) {
                let rel = entry.path().strip_prefix(&src_root).map_err(|e| e.to_string())?;
                let target = dst_root.join(rel);
                if entry.file_type().is_dir() {
                    fs::create_dir_all(&target).map_err(|e| e.to_string())?;
                } else if entry.file_type().is_file() {
                    if let Some(parent) = target.parent() {
                        fs::create_dir_all(parent).map_err(|e| e.to_string())?;
                    }
                    let same = fs::metadata(&target)
                        .map(|m| m.len() == entry.metadata().map(|s| s.len()).unwrap_or(u64::MAX))
                        .unwrap_or(false);
                    if !same {
                        fs::copy(entry.path(), &target).map_err(|e| format!("{}: {e}", entry.path().display()))?;
                        copied += 1;
                    }
                }
            }
        }
        Ok(copied)
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn restart_app(app: AppHandle) {
    app.restart()
}
