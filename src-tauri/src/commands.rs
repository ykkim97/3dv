use std::path::{Path, PathBuf};
use tauri::ipc::Response;

fn checked_path(path: String, extensions: &[&str]) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err("Only absolute file paths are accepted.".into());
    }

    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .map(str::to_ascii_lowercase)
        .ok_or_else(|| "The selected file has no extension.".to_string())?;

    if !extensions.contains(&extension.as_str()) {
        return Err(format!("Unsupported file extension: .{extension}"));
    }
    Ok(path)
}

fn io_error(action: &str, path: &Path, error: std::io::Error) -> String {
    format!("Failed to {action} '{}': {error}", path.display())
}

#[tauri::command]
pub fn save_scene_file(path: String, contents: String) -> Result<(), String> {
    let path = checked_path(path, &["json"])?;
    std::fs::write(&path, contents).map_err(|error| io_error("save scene", &path, error))
}

#[tauri::command]
pub fn read_scene_file(path: String) -> Result<String, String> {
    let path = checked_path(path, &["json"])?;
    std::fs::read_to_string(&path).map_err(|error| io_error("read scene", &path, error))
}

#[tauri::command]
pub fn read_asset_file(path: String) -> Result<Response, String> {
    let path = checked_path(path, &["glb", "gltf", "obj"])?;
    let bytes = std::fs::read(&path).map_err(|error| io_error("read model", &path, error))?;
    Ok(Response::new(bytes))
}
