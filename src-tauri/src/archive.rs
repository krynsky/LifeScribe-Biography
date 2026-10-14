use std::fs;
use std::io;
use std::path::Path;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use zip::ZipArchive;

#[derive(Debug, Serialize, Deserialize)]
pub struct ExtractResult {
    pub extracted_path: String,
    pub file_count: usize,
}

#[tauri::command]
pub async fn extract_archive(
    app: AppHandle,
    archive_path: String,
    window: tauri::Window,
) -> Result<ExtractResult, String> {
    let archive_file = fs::File::open(&archive_path).map_err(|e| e.to_string())?;
    let mut archive = ZipArchive::new(archive_file).map_err(|e| e.to_string())?;

    let temp_dir = crate::data::files_root(&app).join("temp");

    // Create unique extraction directory from archive name
    let archive_name = Path::new(&archive_path)
        .file_stem()
        .map(|n: &std::ffi::OsStr| n.to_string_lossy().to_string())
        .unwrap_or_else(|| "archive".to_string());

    let extract_dir = temp_dir.join(format!("{}_{}", archive_name, chrono::Utc::now().timestamp()));
    fs::create_dir_all(&extract_dir).map_err(|e| e.to_string())?;

    let total = archive.len();
    let mut extracted = 0;

    for i in 0..total {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        let outpath = match file.enclosed_name() {
            Some(path) => extract_dir.join(path),
            None => continue,
        };

        if file.is_dir() {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(parent) = outpath.parent() {
                fs::create_dir_all(parent).map_err(|e| e.to_string())?;
            }
            let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
            io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }

        extracted += 1;

        if extracted % 50 == 0 {
            let _ = window.emit(
                "archive-extract-progress",
                serde_json::json!({
                    "total": total,
                    "extracted": extracted,
                }),
            );
        }
    }

    Ok(ExtractResult {
        extracted_path: extract_dir.to_string_lossy().to_string(),
        file_count: extracted,
    })
}
