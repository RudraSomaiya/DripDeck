// No console window behind the app in release builds.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::{fs, io, path::PathBuf};
use tauri::http::Response;

// Everything lives in a `data` folder next to the exe, so the app and the wardrobe move together.
fn data_dir() -> PathBuf {
    std::env::current_exe().expect("exe path").with_file_name("data")
}

// The app names photos `<id>.webp`. Anything else, like `../wardrobe.json`, is refused.
fn photo_path(name: &str) -> Result<PathBuf, String> {
    let stem = name.strip_suffix(".webp").unwrap_or("");
    if stem.is_empty() || stem.len() > 64 || !stem.chars().all(|c| c.is_ascii_alphanumeric() || c == '-') {
        return Err(format!("Not a photo name: {name}"));
    }
    Ok(data_dir().join("photos").join(name))
}

fn text(e: io::Error) -> String {
    e.to_string()
}

#[tauri::command]
fn load_db() -> Result<String, String> {
    match fs::read_to_string(data_dir().join("wardrobe.json")) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(String::new()),
        r => r.map_err(text),
    }
}

// Writes a temp file and renames it over the old one, so a crash mid-save never leaves half a file.
#[tauri::command]
fn save_db(json: String) -> Result<(), String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(text)?;
    let tmp = dir.join("wardrobe.json.tmp");
    fs::write(&tmp, json).map_err(text)?;
    fs::rename(tmp, dir.join("wardrobe.json")).map_err(text)
}

// The photo arrives as raw bytes, its file name in a header.
#[tauri::command]
fn save_photo(request: tauri::ipc::Request) -> Result<(), String> {
    let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
        return Err("Expected photo bytes".into());
    };
    let name = request.headers().get("name").and_then(|v| v.to_str().ok()).unwrap_or("");
    let path = photo_path(name)?;
    fs::create_dir_all(path.parent().unwrap()).map_err(text)?;
    fs::write(path, bytes).map_err(text)
}

#[tauri::command]
fn delete_photo(name: String) -> Result<(), String> {
    match fs::remove_file(photo_path(&name)?) {
        Err(e) if e.kind() == io::ErrorKind::NotFound => Ok(()),
        r => r.map_err(text),
    }
}

#[tauri::command]
fn data_folder() -> String {
    data_dir().display().to_string()
}

#[tauri::command]
fn open_data_folder() -> Result<(), String> {
    let dir = data_dir();
    fs::create_dir_all(&dir).map_err(text)?;
    // ponytail: Windows Explorer only; swap in the opener plugin if the app ever ships for macOS or Linux.
    std::process::Command::new("explorer").arg(dir).spawn().map(|_| ()).map_err(text)
}

fn main() {
    tauri::Builder::default()
        // Serves saved photos to the page at photo://<name> (http://photo.localhost/<name> on Windows).
        .register_uri_scheme_protocol("photo", |_ctx, request| {
            let name = request.uri().path().trim_start_matches('/');
            match photo_path(name).and_then(|p| fs::read(p).map_err(text)) {
                Ok(bytes) => Response::builder().header("Content-Type", "image/webp").body(bytes),
                Err(_) => Response::builder().status(404).body(Vec::new()),
            }
            .unwrap()
        })
        .invoke_handler(tauri::generate_handler![load_db, save_db, save_photo, delete_photo, data_folder, open_data_folder])
        .run(tauri::generate_context!())
        .expect("error while running Dripdeck");
}

#[cfg(test)]
mod tests {
    use super::photo_path;

    #[test]
    fn photo_names_cannot_leave_the_photos_folder() {
        assert!(photo_path("3f2a91bc-1d2e-4f5a-9b8c-7d6e5f4a3b2c.webp").is_ok());
        for bad in ["../wardrobe.json", "..\\x.webp", "a/b.webp", "C:\\x.webp", ".webp", "x.png", ""] {
            assert!(photo_path(bad).is_err(), "{bad} should be refused");
        }
    }
}
