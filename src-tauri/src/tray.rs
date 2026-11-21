use tauri::image::Image;
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{AppHandle, Emitter, Manager};

pub const TRAY_ID: &str = "fvm-orbit-tray";

fn show_main_window(app: &AppHandle, target_tab: Option<&str>) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
    if let Some(tab) = target_tab {
        let _ = app.emit("fvm://navigate", tab);
    }
}

pub fn build_tray_menu(
    app: &AppHandle,
    global_sdk: Option<&str>,
    cached_versions: &[String],
    cache_size_label: &str,
) -> tauri::Result<Menu<tauri::Wry>> {
    let header_label = match global_sdk {
        Some(v) => format!("全局默认 SDK: {v}  ({cache_size_label})"),
        None => format!("全局默认 SDK: 未设置  ({cache_size_label})"),
    };
    let header_item = MenuItem::with_id(app, "tray_header", header_label, false, None::<&str>)?;
    let sep1 = PredefinedMenuItem::separator(app)?;

    let open_main = MenuItem::with_id(app, "tray_open", "打开 FVM Orbit 主控台", true, None::<&str>)?;
    let nav_topology = MenuItem::with_id(app, "nav_topology", "引力拓扑台（项目绑定）", true, None::<&str>)?;
    let nav_releases = MenuItem::with_id(app, "nav_releases", "版本宇宙（安装发布版）", true, None::<&str>)?;
    let nav_cleanup = MenuItem::with_id(app, "nav_cleanup", "瘦身雷达（清理缓存）", true, None::<&str>)?;
    let nav_doctor = MenuItem::with_id(app, "nav_doctor", "环境体检与 IDE / MCP", true, None::<&str>)?;

    let sep2 = PredefinedMenuItem::separator(app)?;

    // Dynamic submenu for 1-click Global SDK switching from the macOS Menu Bar
    let global_submenu = if cached_versions.is_empty() {
        let empty = MenuItem::with_id(app, "global_empty", "暂无已缓存 SDK", false, None::<&str>)?;
        Submenu::with_items(app, "快速切换全局 SDK", true, &[&empty])?
    } else {
        let mut items: Vec<MenuItem<tauri::Wry>> = Vec::with_capacity(cached_versions.len());
        for v in cached_versions {
            let prefix = if global_sdk == Some(v.as_str()) { "✓ " } else { "   " };
            items.push(MenuItem::with_id(
                app,
                format!("set_global::{v}"),
                format!("{prefix}{v}"),
                true,
                None::<&str>,
            )?);
        }
        let refs: Vec<&dyn tauri::menu::IsMenuItem<tauri::Wry>> =
            items.iter().map(|i| i as &dyn tauri::menu::IsMenuItem<tauri::Wry>).collect();
        Submenu::with_items(app, "快速切换全局 SDK", true, &refs)?
    };

    let refresh_item = MenuItem::with_id(app, "tray_refresh", "刷新本地 FVM 状态", true, None::<&str>)?;
    let sep3 = PredefinedMenuItem::separator(app)?;
    let quit_item = MenuItem::with_id(app, "tray_quit", "退出 FVM Orbit", true, None::<&str>)?;

    Menu::with_items(
        app,
        &[
            &header_item,
            &sep1,
            &open_main,
            &global_submenu,
            &sep2,
            &nav_topology,
            &nav_releases,
            &nav_cleanup,
            &nav_doctor,
            &refresh_item,
            &sep3,
            &quit_item,
        ],
    )
}

pub fn init_tray(app: &AppHandle) -> tauri::Result<()> {
    let icon = Image::from_bytes(include_bytes!("../icons/tray.png"))?;
    let menu = build_tray_menu(app, None, &[], "0 B")?;

    let _tray = TrayIconBuilder::with_id(TRAY_ID)
        .icon(icon)
        .icon_as_template(true)
        .tooltip("FVM Orbit — Flutter Version Management")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == "tray_open" {
                show_main_window(app, None);
            } else if id == "nav_topology" {
                show_main_window(app, Some("topology"));
            } else if id == "nav_releases" {
                show_main_window(app, Some("releases"));
            } else if id == "nav_cleanup" {
                show_main_window(app, Some("cleanup"));
            } else if id == "nav_doctor" {
                show_main_window(app, Some("doctor"));
            } else if id == "tray_refresh" {
                let _ = app.emit("fvm://refresh", ());
            } else if id == "tray_quit" {
                app.exit(0);
            } else if let Some(ver) = id.strip_prefix("set_global::") {
                let _ = app.emit("fvm://tray-set-global", ver.to_string());
            }
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            }
            | TrayIconEvent::Click {
                button: MouseButton::Right,
                button_state: MouseButtonState::Up,
                ..
            } = event
            {
                show_main_window(tray.app_handle(), None);
            }
        })
        .build(app)?;

    Ok(())
}

pub fn update_tray_state(
    app: &AppHandle,
    global_sdk: Option<&str>,
    cached_versions: &[String],
    cache_size_label: &str,
) {
    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        if let Ok(menu) = build_tray_menu(app, global_sdk, cached_versions, cache_size_label) {
            let _ = tray.set_menu(Some(menu));
        }
        let tip = match global_sdk {
            Some(v) => format!("FVM Orbit · Global: {v} ({cache_size_label})"),
            None => format!("FVM Orbit · 未设全局 ({cache_size_label})"),
        };
        let _ = tray.set_tooltip(Some(tip));
    }
}
