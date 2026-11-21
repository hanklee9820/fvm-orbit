use tauri::menu::{AboutMetadata, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tauri::{AppHandle, Emitter, Manager};

pub const MENU_ID_SETTINGS: &str = "app_menu_settings";
pub const MENU_ID_REFRESH: &str = "app_menu_refresh";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum MenuLocale {
    En,
    ZhHans,
    ZhHant,
    Ja,
    Ko,
}

struct MenuStrings {
    about: &'static str,
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
    fn for_locale(locale: MenuLocale) -> Self {
        match locale {
            MenuLocale::En => Self {
                about: "About FVM Orbit",
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
            MenuLocale::ZhHans => Self {
                about: "关于 FVM Orbit",
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
            MenuLocale::ZhHant => Self {
                about: "關於 FVM Orbit",
                settings: "設定…",
                services: "服務",
                hide: "隱藏 FVM Orbit",
                hide_others: "隱藏其他",
                show_all: "顯示全部",
                quit: "結束 FVM Orbit",
                file: "檔案",
                close_window: "關閉視窗",
                edit: "編輯",
                undo: "還原",
                redo: "重做",
                cut: "剪下",
                copy: "拷貝",
                paste: "貼上",
                select_all: "全選",
                view: "顯示方式",
                refresh: "重新整理 FVM 狀態",
                fullscreen: "切換全螢幕",
                window: "視窗",
                minimize: "縮到最小",
                maximize: "縮放",
            },
            MenuLocale::Ja => Self {
                about: "FVM Orbitについて",
                settings: "設定…",
                services: "サービス",
                hide: "FVM Orbitを非表示",
                hide_others: "ほかを非表示",
                show_all: "すべてを表示",
                quit: "FVM Orbitを終了",
                file: "ファイル",
                close_window: "ウインドウを閉じる",
                edit: "編集",
                undo: "取り消す",
                redo: "やり直す",
                cut: "カット",
                copy: "コピー",
                paste: "ペースト",
                select_all: "すべてを選択",
                view: "表示",
                refresh: "FVMの状態を更新",
                fullscreen: "フルスクリーンにする",
                window: "ウインドウ",
                minimize: "しまう",
                maximize: "拡大/縮小",
            },
            MenuLocale::Ko => Self {
                about: "FVM Orbit에 관하여",
                settings: "설정…",
                services: "서비스",
                hide: "FVM Orbit 가리기",
                hide_others: "기타 가리기",
                show_all: "모두 보기",
                quit: "FVM Orbit 종료",
                file: "파일",
                close_window: "윈도우 닫기",
                edit: "편집",
                undo: "실행 취소",
                redo: "실행 복귀",
                cut: "오려두기",
                copy: "복사하기",
                paste: "붙여넣기",
                select_all: "전체 선택",
                view: "보기",
                refresh: "FVM 상태 새로고침",
                fullscreen: "전체 화면 전환",
                window: "윈도우",
                minimize: "최소화",
                maximize: "확대/축소",
            },
        }
    }
}

/// Maps a BCP-47 / POSIX language tag (e.g. "en-CN", "zh-Hans-CN", "zh_TW.UTF-8") to a MenuLocale.
fn resolve_menu_locale_from_tag(tag: &str) -> MenuLocale {
    let cleaned = tag
        .trim()
        .split('.')
        .next()
        .unwrap_or("")
        .split('@')
        .next()
        .unwrap_or("")
        .to_ascii_lowercase()
        .replace('_', "-");

    let parts: Vec<&str> = cleaned.split('-').filter(|s| !s.is_empty()).collect();
    let Some(&lang) = parts.first() else {
        return MenuLocale::En;
    };

    match lang {
        "zh" => {
            if parts
                .iter()
                .skip(1)
                .any(|&p| matches!(p, "hant" | "tw" | "hk" | "mo"))
            {
                MenuLocale::ZhHant
            } else {
                MenuLocale::ZhHans
            }
        }
        "ja" => MenuLocale::Ja,
        "ko" => MenuLocale::Ko,
        _ => MenuLocale::En,
    }
}

#[cfg(target_os = "macos")]
fn detect_system_preferred_language() -> Option<String> {
    use objc2_foundation::NSLocale;

    let langs = NSLocale::preferredLanguages();
    langs.firstObject().map(|s| s.to_string())
}

#[cfg(not(target_os = "macos"))]
fn detect_system_preferred_language() -> Option<String> {
    None
}

fn detect_system_menu_locale() -> MenuLocale {
    if let Some(tag) = detect_system_preferred_language() {
        if !tag.trim().is_empty() {
            return resolve_menu_locale_from_tag(&tag);
        }
    }

    for var in ["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(val) = std::env::var(var) {
            let trimmed = val.trim();
            if !trimmed.is_empty() && !trimmed.eq_ignore_ascii_case("c") && trimmed != "POSIX" {
                return resolve_menu_locale_from_tag(trimmed);
            }
        }
    }

    MenuLocale::En
}

pub fn focus_main_window(app: &AppHandle) {
    if let Some(win) = app.get_webview_window("main") {
        let _ = win.unminimize();
        let _ = win.show();
        let _ = win.set_focus();
    }
}

pub fn build_app_menu(app: &AppHandle) -> tauri::Result<Menu<tauri::Wry>> {
    let s = MenuStrings::for_locale(detect_system_menu_locale());

    let about_meta = AboutMetadata {
        name: Some("FVM Orbit".to_string()),
        version: Some(app.package_info().version.to_string()),
        comments: Some("Flutter SDK Spatial Cockpit & Menu Bar Switcher".to_string()),
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

pub fn init_app_menu(app: &AppHandle) -> tauri::Result<()> {
    let menu = build_app_menu(app)?;
    app.set_menu(menu)?;
    app.on_menu_event(|app, event| {
        let id = event.id().as_ref();
        if id == MENU_ID_SETTINGS {
            focus_main_window(app);
            let _ = app.emit("fvm://open-settings", ());
        } else if id == MENU_ID_REFRESH {
            let _ = app.emit("fvm://refresh", ());
        }
    });
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_bcp47_and_posix_tags_correctly() {
        // English with China region (common macOS setup!) must stay English
        assert_eq!(resolve_menu_locale_from_tag("en-CN"), MenuLocale::En);
        assert_eq!(resolve_menu_locale_from_tag("en-US"), MenuLocale::En);
        assert_eq!(resolve_menu_locale_from_tag("en_GB.UTF-8"), MenuLocale::En);
        assert_eq!(MenuStrings::for_locale(MenuLocale::En).settings, "Settings…");

        assert_eq!(resolve_menu_locale_from_tag("zh-Hans-CN"), MenuLocale::ZhHans);
        assert_eq!(resolve_menu_locale_from_tag("zh_CN.UTF-8"), MenuLocale::ZhHans);
        assert_eq!(MenuStrings::for_locale(MenuLocale::ZhHans).settings, "设置…");

        assert_eq!(resolve_menu_locale_from_tag("zh-Hant-TW"), MenuLocale::ZhHant);
        assert_eq!(resolve_menu_locale_from_tag("zh-HK"), MenuLocale::ZhHant);
        assert_eq!(MenuStrings::for_locale(MenuLocale::ZhHant).settings, "設定…");

        assert_eq!(resolve_menu_locale_from_tag("ja-JP"), MenuLocale::Ja);
        assert_eq!(resolve_menu_locale_from_tag("ko-KR"), MenuLocale::Ko);
    }
}
