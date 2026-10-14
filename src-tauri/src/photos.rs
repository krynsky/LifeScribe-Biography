use std::path::{Path, PathBuf};
use std::fs;
use anyhow::Result;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};
use walkdir::WalkDir;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "heic", "heif",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct ScannedPhoto {
    pub path: String,
    pub filename: String,
    pub size_bytes: u64,
    pub modified_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ExifData {
    pub path: String,
    pub taken_at: Option<String>,
    pub latitude: Option<f64>,
    pub longitude: Option<f64>,
    pub camera_make: Option<String>,
    pub camera_model: Option<String>,
    pub width: Option<u32>,
    pub height: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ThumbnailResult {
    pub source_path: String,
    pub thumb_path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProgress {
    pub total: usize,
    pub processed: usize,
    pub failed: usize,
    pub results: Vec<BatchPhotoResult>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchPhotoResult {
    pub path: String,
    pub exif: Option<ExifData>,
    pub thumb_path: Option<String>,
    pub error: Option<String>,
}

fn is_image(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| SUPPORTED_EXTENSIONS.contains(&e.to_lowercase().as_str()))
        .unwrap_or(false)
}

fn thumb_path_for(app: &AppHandle, source: &Path) -> Result<PathBuf> {
    use sha2::{Digest, Sha256};

    let mut hasher = Sha256::new();
    hasher.update(source.to_string_lossy().as_bytes());
    let hash = hex::encode(hasher.finalize());

    let thumbs_dir = crate::data::files_root(app).join("thumbs");

    Ok(thumbs_dir.join(format!("{}.jpg", &hash[..16])))
}

#[tauri::command]
pub async fn scan_folder(folder_path: String) -> Result<Vec<ScannedPhoto>, String> {
    let mut photos = Vec::new();

    for entry in WalkDir::new(&folder_path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let path = entry.path();
        if !path.is_file() || !is_image(path) {
            continue;
        }

        let meta = fs::metadata(path).ok();
        let size_bytes = meta.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified_at = meta
            .and_then(|m| m.modified().ok())
            .and_then(|t| {
                use std::time::UNIX_EPOCH;
                t.duration_since(UNIX_EPOCH).ok()
            })
            .map(|d| {
                let secs = d.as_secs();
                chrono::DateTime::from_timestamp(secs as i64, 0)
                    .map(|dt| dt.format("%Y-%m-%dT%H:%M:%SZ").to_string())
            })
            .flatten();

        photos.push(ScannedPhoto {
            path: path.to_string_lossy().to_string(),
            filename: path
                .file_name()
                .map(|n| n.to_string_lossy().to_string())
                .unwrap_or_default(),
            size_bytes,
            modified_at,
        });
    }

    Ok(photos)
}

#[tauri::command]
pub async fn extract_exif(photo_path: String) -> Result<ExifData, String> {
    let path = PathBuf::from(&photo_path);

    let mut result = ExifData {
        path: photo_path.clone(),
        taken_at: None,
        latitude: None,
        longitude: None,
        camera_make: None,
        camera_model: None,
        width: None,
        height: None,
    };

    // Read image dimensions
    if let Ok(img) = image::open(&path) {
        result.width = Some(img.width());
        result.height = Some(img.height());
    }

    // Read EXIF data
    let file = fs::File::open(&path).map_err(|e| e.to_string())?;
    let mut buf_reader = std::io::BufReader::new(file);

    if let Ok(exif_reader) = exif::Reader::new().read_from_container(&mut buf_reader) {
        use exif::{In, Tag};

        if let Some(field) = exif_reader.get_field(Tag::DateTimeOriginal, In::PRIMARY) {
            result.taken_at = Some(field.display_value().with_unit(field).to_string());
        }

        if let Some(field) = exif_reader.get_field(Tag::Make, In::PRIMARY) {
            result.camera_make = Some(field.display_value().with_unit(field).to_string().trim_matches('"').to_string());
        }

        if let Some(field) = exif_reader.get_field(Tag::Model, In::PRIMARY) {
            result.camera_model = Some(field.display_value().with_unit(field).to_string().trim_matches('"').to_string());
        }

        // GPS extraction
        let lat: Option<&exif::Field> = exif_reader.get_field(Tag::GPSLatitude, In::PRIMARY);
        let lat_ref: Option<&exif::Field> = exif_reader.get_field(Tag::GPSLatitudeRef, In::PRIMARY);
        let lon: Option<&exif::Field> = exif_reader.get_field(Tag::GPSLongitude, In::PRIMARY);
        let lon_ref: Option<&exif::Field> = exif_reader.get_field(Tag::GPSLongitudeRef, In::PRIMARY);

        if let (Some(lat), Some(lat_ref), Some(lon), Some(lon_ref)) = (lat, lat_ref, lon, lon_ref) {
            let lat_str = lat.display_value().with_unit(lat).to_string();
            let lon_str = lon.display_value().with_unit(lon).to_string();
            let lat_ref_str = lat_ref.display_value().with_unit(lat_ref).to_string();
            let lon_ref_str = lon_ref.display_value().with_unit(lon_ref).to_string();

            if let (Some(lat_f), Some(lon_f)) = (
                parse_gps_coord(&lat_str),
                parse_gps_coord(&lon_str),
            ) {
                let lat_signed = if lat_ref_str.contains('S') { -lat_f } else { lat_f };
                let lon_signed = if lon_ref_str.contains('W') { -lon_f } else { lon_f };
                result.latitude = Some(lat_signed);
                result.longitude = Some(lon_signed);
            }
        }
    }

    Ok(result)
}

fn parse_gps_coord(s: &str) -> Option<f64> {
    // Format: "deg min sec" or "deg min.frac"
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.is_empty() {
        return None;
    }

    let parse_rational = |s: &str| -> Option<f64> {
        if let Some((num, den)) = s.split_once('/') {
            let n: f64 = num.parse().ok()?;
            let d: f64 = den.parse().ok()?;
            if d == 0.0 { None } else { Some(n / d) }
        } else {
            s.parse().ok()
        }
    };

    match parts.len() {
        1 => parse_rational(parts[0]),
        2 => {
            let deg = parse_rational(parts[0])?;
            let min = parse_rational(parts[1])?;
            Some(deg + min / 60.0)
        }
        3 => {
            let deg = parse_rational(parts[0])?;
            let min = parse_rational(parts[1])?;
            let sec = parse_rational(parts[2])?;
            Some(deg + min / 60.0 + sec / 3600.0)
        }
        _ => None,
    }
}

#[tauri::command]
pub async fn generate_thumbnail(
    app: AppHandle,
    source_path: String,
    max_size: u32,
) -> Result<ThumbnailResult, String> {
    let path = PathBuf::from(&source_path);
    let thumb_path = thumb_path_for(&app, &path).map_err(|e| e.to_string())?;

    if thumb_path.exists() {
        let img = image::open(&thumb_path).map_err(|e| e.to_string())?;
        return Ok(ThumbnailResult {
            source_path,
            thumb_path: thumb_path.to_string_lossy().to_string(),
            width: img.width(),
            height: img.height(),
        });
    }

    let img = image::open(&path).map_err(|e| e.to_string())?;
    let thumb = img.thumbnail(max_size, max_size);

    let w = thumb.width();
    let h = thumb.height();

    thumb
        .save_with_format(&thumb_path, image::ImageFormat::Jpeg)
        .map_err(|e| e.to_string())?;

    Ok(ThumbnailResult {
        source_path,
        thumb_path: thumb_path.to_string_lossy().to_string(),
        width: w,
        height: h,
    })
}

#[tauri::command]
pub async fn batch_process_photos(
    app: AppHandle,
    paths: Vec<String>,
    thumb_size: u32,
    window: tauri::Window,
) -> Result<BatchProgress, String> {
    let total = paths.len();
    let mut processed = 0;
    let mut failed = 0;
    let mut results = Vec::with_capacity(total);

    for path_str in &paths {
        let path = PathBuf::from(path_str);

        let exif = extract_exif(path_str.clone()).await.ok();

        let thumb_path = match generate_thumbnail(app.clone(), path_str.clone(), thumb_size).await {
            Ok(t) => Some(t.thumb_path),
            Err(_) => None,
        };

        let had_error = exif.is_none() && thumb_path.is_none();
        if had_error {
            failed += 1;
        } else {
            processed += 1;
        }

        results.push(BatchPhotoResult {
            path: path_str.clone(),
            exif,
            thumb_path,
            error: if had_error {
                Some("Failed to process photo".to_string())
            } else {
                None
            },
        });

        // Emit progress event every 10 photos
        if results.len() % 10 == 0 {
            let _ = window.emit(
                "photo-batch-progress",
                serde_json::json!({
                    "total": total,
                    "processed": processed,
                    "failed": failed,
                }),
            );
        }
    }

    Ok(BatchProgress {
        total,
        processed,
        failed,
        results,
    })
}
