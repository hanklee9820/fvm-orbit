use std::fs;
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

const ICON_DARK_PNG: &[u8] = include_bytes!("../icons/icon.png");
const ICON_LIGHT_PNG: &[u8] = include_bytes!("../icons/icon-light.png");
const PREF_FILENAME: &str = "dock_icon_style.txt";

fn pref_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(PREF_FILENAME))
}

pub fn load_saved_icon_style(app: &AppHandle) -> String {
    let Some(path) = pref_file_path(app) else {
        return "dark".to_string();
    };
    match fs::read_to_string(path) {
        Ok(raw) => match raw.trim() {
            "light" => "light".to_string(),
            _ => "dark".to_string(),
        },
        Err(_) => "dark".to_string(),
    }
}

fn save_icon_style(app: &AppHandle, style: &str) {
    if let Some(path) = pref_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let _ = fs::write(path, style);
    }
}

#[cfg(target_os = "macos")]
fn set_ns_app_icon_on_main_thread(
    mtm: objc2::MainThreadMarker,
    bytes: &[u8],
) -> Result<(), String> {
    use objc2::AnyThread;
    use objc2_app_kit::{NSApplication, NSImage};
    use objc2_foundation::NSData;

    let data = NSData::with_bytes(bytes);
    let image = NSImage::initWithData(NSImage::alloc(), &data)
        .ok_or_else(|| "无法解析应用图标 PNG 数据".to_string())?;
    let ns_app = NSApplication::sharedApplication(mtm);
    unsafe {
        ns_app.setApplicationIconImage(Some(&image));
    }
    Ok(())
}

pub fn apply_dock_icon(app: &AppHandle, style: &str) -> Result<String, String> {
    let normalized = match style.trim().to_ascii_lowercase().as_str() {
        "light" | "white" => "light",
        _ => "dark",
    };
    save_icon_style(app, normalized);

    let bytes: &'static [u8] = if normalized == "light" {
        ICON_LIGHT_PNG
    } else {
        ICON_DARK_PNG
    };

    #[cfg(target_os = "macos")]
    {
        if let Some(mtm) = objc2::MainThreadMarker::new() {
            set_ns_app_icon_on_main_thread(mtm, bytes)?;
        } else {
            let (tx, rx) = std::sync::mpsc::channel();
            app.run_on_main_thread(move || {
                let res = match objc2::MainThreadMarker::new() {
                    Some(mtm) => set_ns_app_icon_on_main_thread(mtm, bytes),
                    None => Err("未能在 macOS 主线程设置应用图标".to_string()),
                };
                let _ = tx.send(res);
            })
            .map_err(|e| format!("调度主线程更新图标失败: {e}"))?;

            rx.recv()
                .map_err(|e| format!("等待主线程图标更新结果失败: {e}"))??;
        }
    }

    #[cfg(not(target_os = "macos"))]
    {
        if let Some(win) = app.get_webview_window("main") {
            let img = tauri::image::Image::from_bytes(bytes)
                .map_err(|e| format!("解析窗口图标失败: {e}"))?;
            win.set_icon(img)
                .map_err(|e| format!("更新窗口图标失败: {e}"))?;
        }
    }

    Ok(normalized.to_string())
}

pub fn init_app_icon(app: &AppHandle) {
    let saved = load_saved_icon_style(app);
    if saved == "light" {
        if let Err(err) = apply_dock_icon(app, "light") {
            eprintln!("Warning: failed to restore saved app icon: {err}");
        }
    }
}
