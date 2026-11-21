use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Manager};

const LANGUAGE_PREF_FILENAME: &str = "language.txt";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum LanguagePreference {
    System,
    Zh,
    En,
}

impl LanguagePreference {
    pub fn parse(raw: &str) -> Self {
        match raw.trim().to_ascii_lowercase().as_str() {
            "zh" | "zh-cn" | "zh-hans" | "zh-tw" | "zh-hant" => Self::Zh,
            "en" | "en-us" | "en-gb" => Self::En,
            _ => Self::System,
        }
    }

    pub fn as_str(self) -> &'static str {
        match self {
            Self::System => "system",
            Self::Zh => "zh",
            Self::En => "en",
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AppLocale {
    Zh,
    En,
}

impl AppLocale {
    pub fn is_zh(self) -> bool {
        matches!(self, Self::Zh)
    }
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct LanguageState {
    pub preference: LanguagePreference,
    pub resolved: AppLocale,
}

static ACTIVE_LANGUAGE_PREF: OnceLock<RwLock<LanguagePreference>> = OnceLock::new();

fn pref_store() -> &'static RwLock<LanguagePreference> {
    ACTIVE_LANGUAGE_PREF.get_or_init(|| RwLock::new(LanguagePreference::System))
}

fn pref_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(LANGUAGE_PREF_FILENAME))
}

/// Maps a BCP-47 / POSIX language tag (e.g. "en-CN", "zh-Hans-CN", "zh_TW.UTF-8") to Zh or En.
pub fn resolve_locale_from_tag(tag: &str) -> AppLocale {
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

    let primary = cleaned
        .split('-')
        .find(|s| !s.is_empty())
        .unwrap_or("");

    match primary {
        "zh" => AppLocale::Zh,
        _ => AppLocale::En,
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

pub fn detect_system_locale() -> AppLocale {
    if let Some(tag) = detect_system_preferred_language() {
        if !tag.trim().is_empty() {
            return resolve_locale_from_tag(&tag);
        }
    }

    for var in ["LC_ALL", "LC_MESSAGES", "LANG"] {
        if let Ok(val) = std::env::var(var) {
            let trimmed = val.trim();
            if !trimmed.is_empty() && !trimmed.eq_ignore_ascii_case("c") && trimmed != "POSIX" {
                return resolve_locale_from_tag(trimmed);
            }
        }
    }

    AppLocale::En
}

pub fn resolve_locale(pref: LanguagePreference) -> AppLocale {
    match pref {
        LanguagePreference::System => detect_system_locale(),
        LanguagePreference::Zh => AppLocale::Zh,
        LanguagePreference::En => AppLocale::En,
    }
}

pub fn init_language(app: &AppHandle) {
    let loaded = pref_file_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .map(|raw| LanguagePreference::parse(&raw))
        .unwrap_or(LanguagePreference::System);

    *pref_store().write() = loaded;
}

pub fn current_language_preference() -> LanguagePreference {
    *pref_store().read()
}

pub fn current_locale() -> AppLocale {
    resolve_locale(current_language_preference())
}

pub fn current_language_state() -> LanguageState {
    let preference = current_language_preference();
    LanguageState {
        preference,
        resolved: resolve_locale(preference),
    }
}

pub fn set_language_preference(app: &AppHandle, raw: &str) -> Result<LanguageState, String> {
    let pref = LanguagePreference::parse(raw);
    if let Some(path) = pref_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        fs::write(&path, pref.as_str()).map_err(|e| {
            if resolve_locale(pref).is_zh() {
                format!("保存语言配置失败: {e}")
            } else {
                format!("Failed to save language preference: {e}")
            }
        })?;
    }
    *pref_store().write() = pref;
    Ok(LanguageState {
        preference: pref,
        resolved: resolve_locale(pref),
    })
}

/// Convenience helper for picking a static Chinese or English string based on current locale.
pub fn pick(zh: &'static str, en: &'static str) -> &'static str {
    if current_locale().is_zh() {
        zh
    } else {
        en
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_bcp47_and_posix_tags_to_zh_or_en() {
        assert_eq!(resolve_locale_from_tag("en-CN"), AppLocale::En);
        assert_eq!(resolve_locale_from_tag("en-US"), AppLocale::En);
        assert_eq!(resolve_locale_from_tag("en_GB.UTF-8"), AppLocale::En);
        assert_eq!(resolve_locale_from_tag("ja-JP"), AppLocale::En);

        assert_eq!(resolve_locale_from_tag("zh-Hans-CN"), AppLocale::Zh);
        assert_eq!(resolve_locale_from_tag("zh_CN.UTF-8"), AppLocale::Zh);
        assert_eq!(resolve_locale_from_tag("zh-Hant-TW"), AppLocale::Zh);
        assert_eq!(resolve_locale_from_tag("zh-HK"), AppLocale::Zh);
    }

    #[test]
    fn parses_language_preferences() {
        assert_eq!(LanguagePreference::parse("zh"), LanguagePreference::Zh);
        assert_eq!(LanguagePreference::parse("zh-CN"), LanguagePreference::Zh);
        assert_eq!(LanguagePreference::parse("en"), LanguagePreference::En);
        assert_eq!(LanguagePreference::parse("en-US"), LanguagePreference::En);
        assert_eq!(LanguagePreference::parse("system"), LanguagePreference::System);
        assert_eq!(LanguagePreference::parse("unknown"), LanguagePreference::System);
    }
}
