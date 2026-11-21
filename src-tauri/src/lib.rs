mod app_icon;
mod commands;
mod fvm;
mod tray;

use commands::AppState;
use fvm::runner::CancelRegistry;
use fvm::watcher::spawn_fvm_watcher;
use std::sync::Arc;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app_state = AppState {
        cancel_registry: Arc::new(CancelRegistry::default()),
    };

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(win) = app.get_webview_window("main") {
                let _ = win.unminimize();
                let _ = win.show();
                let _ = win.set_focus();
            }
        }))
        .manage(app_state)
        .setup(|app| {
            let handle = app.handle().clone();
            app_icon::init_app_icon(&handle);
            if let Err(err) = tray::init_tray(&handle) {
                eprintln!("Warning: failed to initialize macOS tray icon: {err}");
            }
            spawn_fvm_watcher(handle);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_workspace_snapshot,
            commands::get_releases,
            commands::run_fvm_stream,
            commands::cancel_fvm_request,
            commands::execute_spawn_matrix,
            commands::get_doctor_report,
            commands::fix_zshrc_path,
            commands::set_app_icon,
        ])
        .run(tauri::generate_context!())
        .expect("error while running FVM Orbit");
}
