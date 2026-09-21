mod commands;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            commands::save_scene_file,
            commands::read_scene_file,
            commands::read_asset_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running Lumatrix");
}
