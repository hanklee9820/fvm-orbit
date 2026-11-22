use crate::i18n::{current_locale, AppLocale};
use tauri::menu::{Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ID_ABOUT: &str = "app_menu_about";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ID_SETTINGS: &str = "app_menu_settings";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ID_REFRESH: &str = "app_menu_refresh";
#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
pub const MENU_ID_CHECK_UPDATES: &str = "app_menu_check_updates";

#[cfg_attr(not(target_os = "macos"), allow(dead_code))]
struct MenuStrings {
    about: &'static str,
    check_updates: &'static str,
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
                check_updates: "Check for Updates…",
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
                check_updates: "检查更新…",
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

    let about = MenuItem::with_id(app, MENU_ID_ABOUT, s.about, true, None::<&str>)?;
    let check_updates = MenuItem::with_id(
        app,
        MENU_ID_CHECK_UPDATES,
        s.check_updates,
        true,
        None::<&str>,
    )?;
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
            &check_updates,
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
            if id == MENU_ID_ABOUT {
                focus_main_window(app);
                let _ = app.emit("fvm://open-about", ());
            } else if id == MENU_ID_SETTINGS {
                focus_main_window(app);
                let _ = app.emit("fvm://open-settings", ());
            } else if id == MENU_ID_CHECK_UPDATES {
                focus_main_window(app);
                let _ = app.emit("fvm://check-updates", ());
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
        assert_eq!(MenuStrings::for_locale(AppLocale::En).about, "About FVM Orbit");
        assert_eq!(MenuStrings::for_locale(AppLocale::Zh).about, "关于 FVM Orbit");
        assert_eq!(MenuStrings::for_locale(AppLocale::En).settings, "Settings…");
        assert_eq!(MenuStrings::for_locale(AppLocale::Zh).settings, "设置…");
        assert_eq!(
            MenuStrings::for_locale(AppLocale::En).check_updates,
            "Check for Updates…"
        );
        assert_eq!(
            MenuStrings::for_locale(AppLocale::Zh).check_updates,
            "检查更新…"
        );
    }
}
