use crate::i18n::{current_locale, AppLocale};
use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ID_SETTINGS: &str = "app_menu_settings";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ID_REFRESH: &str = "app_menu_refresh";

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
struct MenuStrings {
    about: &'static str,
    about_comments: &'static str,
    settings: &'static str,
    services: &'static str,
    hide: &'static str,
    hide_others: &'static str,
    show_all: &'static str,
    quit: &'static str,
    file: &'static str,
    close_window: &'static str,
    edit: &'static str,
    undo: &'static str,
    redo: &'static str,
    cut: &'static str,
    copy: &'static str,
    paste: &'static str,
    select_all: &'static str,
    view: &'static str,
    refresh: &'static str,
    fullscreen: &'static str,
    window: &'static str,
    minimize: &'static str,
    maximize: &'static str,
}

impl MenuStrings {
    fn for_locale(locale: AppLocale) -> Self {
        match locale {
            AppLocale::En => Self {
                about: "About FVM Orbit",
                about_comments: "Flutter SDK Spatial Cockpit & Menu Bar Switcher",
                settings: "Settings…",
                services: "Services",
                hide: "Hide FVM Orbit",
                hide_others: "Hide Others",
                show_all: "Show All",
                quit: "Quit FVM Orbit",
                file: "File",
                close_window: "Close Window",
                edit: "Edit",
                undo: "Undo",
                redo: "Redo",
                cut: "Cut",
                copy: "Copy",
                paste: "Paste",
                select_all: "Select All",
                view: "View",
                refresh: "Refresh FVM Status",
                fullscreen: "Toggle Full Screen",
                window: "Window",
                minimize: "Minimize",
                maximize: "Zoom",
            },
            AppLocale::Zh => Self {
                about: "关于 FVM Orbit",
                about_comments: "Flutter SDK 空间指挥台与状态栏快切工具",
                settings: "设置…",
                services: "服务",
                hide: "隐藏 FVM Orbit",
                hide_others: "隐藏其他",
                show_all: "全部显示",
                quit: "退出 FVM Orbit",
                file: "文件",
                close_window: "关闭窗口",
                edit: "编辑",
                undo: "撤销",
                redo: "重做",
                cut: "剪切",
                copy: "拷贝",
                paste: "粘贴",
                select_all: "全选",
                view: "显示",
                refresh: "刷新本地 FVM 状态",
                fullscreen: "切换全屏幕",
                window: "窗口",
                minimize: "最小化",
                maximize: "缩放",
            },
        }
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn focus_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let s = MenuStrings::for_locale(current_locale());

    let about_meta = AboutMetadata {
        name: Some("FVM Orbit".to_string()),
        version: Some(app.package_info().version.to_string()),
        comments: Some(s.about_comments.to_string()),
        ..Default::default()
    };

    let about = PredefinedMenuItem::about(app, Some(s.about), Some(about_meta))?;
    let sep_about = PredefinedMenuItem::separator(app)?;
    let settings = MenuItem::with_id(
        app,
        MENU_ID_SETTINGS,
        s.settings,
        true,
        Some("CmdOrCtrl+,"),
    )?;
    let sep_services = PredefinedMenuItem::separator(app)?;
    let services = PredefinedMenuItem::services(app, Some(s.services))?;
    let sep_hide = PredefinedMenuItem::separator(app)?;
    let hide = PredefinedMenuItem::hide(app, Some(s.hide))?;
    let hide_others = PredefinedMenuItem::hide_others(app, Some(s.hide_others))?;
    let show_all = PredefinedMenuItem::show_all(app, Some(s.show_all))?;
    let sep_quit = PredefinedMenuItem::separator(app)?;
    let quit = PredefinedMenuItem::quit(app, Some(s.quit))?;

    let app_submenu = Submenu::with_items(
        app,
        "FVM Orbit",
        true,
        &[
            &about,
            &sep_about,
            &settings,
            &sep_services,
            &services,
            &sep_hide,
            &hide,
            &hide_others,
            &show_all,
            &sep_quit,
            &quit,
        ],
    )?;

    let close_win = PredefinedMenuItem::close_window(app, Some(s.close_window))?;
    let file_submenu = Submenu::with_items(app, s.file, true, &[&close_win])?;

    let undo = PredefinedMenuItem::undo(app, Some(s.undo))?;
    let redo = PredefinedMenuItem::redo(app, Some(s.redo))?;
    let sep_edit = PredefinedMenuItem::separator(app)?;
    let cut = PredefinedMenuItem::cut(app, Some(s.cut))?;
    let copy = PredefinedMenuItem::copy(app, Some(s.copy))?;
    let paste = PredefinedMenuItem::paste(app, Some(s.paste))?;
    let select_all = PredefinedMenuItem::select_all(app, Some(s.select_all))?;
    let edit_submenu = Submenu::with_items(
        app,
        s.edit,
        true,
        &[&undo, &redo, &sep_edit, &cut, &copy, &paste, &select_all],
    )?;

    let refresh = MenuItem::with_id(
        app,
        MENU_ID_REFRESH,
        s.refresh,
        true,
        Some("CmdOrCtrl+R"),
    )?;
    let sep_view = PredefinedMenuItem::separator(app)?;
    let fullscreen = PredefinedMenuItem::fullscreen(app, Some(s.fullscreen))?;
    let view_submenu = Submenu::with_items(app, s.view, true, &[&refresh, &sep_view, &fullscreen])?;

    let minimize = PredefinedMenuItem::minimize(app, Some(s.minimize))?;
    let maximize = PredefinedMenuItem::maximize(app, Some(s.maximize))?;
    let sep_win = PredefinedMenuItem::separator(app)?;
    let close_win2 = PredefinedMenuItem::close_window(app, Some(s.close_window))?;
    let window_submenu = Submenu::with_items(
        app,
        s.window,
        true,
        &[&minimize, &maximize, &sep_win, &close_win2],
    )?;

    Menu::with_items(
        app,
        &[
            &app_submenu,
            &file_submenu,
            &edit_submenu,
            &view_submenu,
            &window_submenu,
        ],
    )
}

pub fn refresh_app_menu(app: &AppHandle) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        let menu = build_app_menu(app)?;
        app.set_menu(menu)?;
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }
    Ok(())
}

pub fn init_app_menu(app: &AppHandle) -> tauri::Result<()> {
    #[cfg(target_os = "macos")]
    {
        refresh_app_menu(app)?;
        app.on_menu_event(|app, event| {
            let id = event.id().as_ref();
            if id == MENU_ID_SETTINGS {
                focus_main_window(app);
                let _ = app.emit("fvm://open-settings", ());
            } else if id == MENU_ID_REFRESH {
                let _ = app.emit("fvm://refresh", ());
            }
        });
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn menu_strings_match_zh_and_en() {
        assert_eq!(MenuStrings::for_locale(AppLocale::En).settings, "Settings…");
        assert_eq!(MenuStrings::for_locale(AppLocale::Zh).settings, "设置…");
    }
}
