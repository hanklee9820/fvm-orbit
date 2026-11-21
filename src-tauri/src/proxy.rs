use parking_lot::RwLock;
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::process::Command as StdCommand;
use std::sync::OnceLock;
use std::time::Instant;
use tauri::{AppHandle, Manager};
use tokio::process::Command as AsyncCommand;

const PROXY_PREF_FILENAME: &str = "proxy_settings.json";
const DEFAULT_BYPASS: &str = "localhost,127.0.0.1,::1,.local";
const DEFAULT_TEST_URL: &str =
    "https://storage.googleapis.com/flutter_infra_release/releases/releases_macos.json";

const PROXY_ENV_KEYS: [&str; 10] = [
    "HTTP_PROXY",
    "HTTPS_PROXY",
    "ALL_PROXY",
    "FTP_PROXY",
    "NO_PROXY",
    "http_proxy",
    "https_proxy",
    "all_proxy",
    "ftp_proxy",
    "no_proxy",
];

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ProxySettings {
    /// "direct" | "system" | "custom"
    pub mode: String,
    /// "http" | "https" | "socks5"
    pub protocol: String,
    pub host: String,
    pub port: String,
    #[serde(default)]
    pub username: String,
    #[serde(default)]
    pub password: String,
    #[serde(default = "default_bypass")]
    pub bypass: String,
}

fn default_bypass() -> String {
    DEFAULT_BYPASS.to_string()
}

impl Default for ProxySettings {
    fn default() -> Self {
        Self {
            mode: "system".to_string(),
            protocol: "http".to_string(),
            host: "127.0.0.1".to_string(),
            port: "7890".to_string(),
            username: String::new(),
            password: String::new(),
            bypass: DEFAULT_BYPASS.to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SystemProxyInfo {
    pub http_enabled: bool,
    pub http_host: Option<String>,
    pub http_port: Option<u16>,
    pub https_enabled: bool,
    pub https_host: Option<String>,
    pub https_port: Option<u16>,
    pub socks_enabled: bool,
    pub socks_host: Option<String>,
    pub socks_port: Option<u16>,
    pub exceptions: Vec<String>,
    pub effective_url: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProxyTestResult {
    pub ok: bool,
    pub latency_ms: u64,
    pub target_url: String,
    pub proxy_used: Option<String>,
    pub http_status: Option<u16>,
    pub message: String,
}

static ACTIVE_PROXY_SETTINGS: OnceLock<RwLock<ProxySettings>> = OnceLock::new();

fn proxy_store() -> &'static RwLock<ProxySettings> {
    ACTIVE_PROXY_SETTINGS.get_or_init(|| RwLock::new(ProxySettings::default()))
}

fn pref_file_path(app: &AppHandle) -> Option<PathBuf> {
    app.path()
        .app_config_dir()
        .ok()
        .map(|dir| dir.join(PROXY_PREF_FILENAME))
}

pub fn normalize_settings(mut settings: ProxySettings) -> Result<ProxySettings, String> {
    settings.mode = match settings.mode.trim().to_ascii_lowercase().as_str() {
        "direct" => "direct".to_string(),
        "custom" => "custom".to_string(),
        _ => "system".to_string(),
    };
    settings.protocol = match settings.protocol.trim().to_ascii_lowercase().as_str() {
        "https" => "https".to_string(),
        "socks5" | "socks5h" => "socks5".to_string(),
        _ => "http".to_string(),
    };

    let mut host = settings.host.trim().to_string();
    for prefix in ["http://", "https://", "socks5h://", "socks5://"] {
        if let Some(stripped) = host.strip_prefix(prefix) {
            host = stripped.to_string();
            break;
        }
    }
    if let Some((h, _rest)) = host.split_once('/') {
        host = h.to_string();
    }
    settings.host = host.trim().to_string();
    settings.port = settings.port.trim().to_string();
    settings.username = settings.username.trim().to_string();
    settings.bypass = settings.bypass.trim().to_string();

    if settings.mode == "custom" {
        if settings.host.is_empty() {
            return Err("请输入自定义代理主机地址（如 127.0.0.1）".to_string());
        }
        let port_num: u16 = settings
            .port
            .parse()
            .map_err(|_| "请输入有效的代理端口号（1 - 65535）".to_string())?;
        if port_num == 0 {
            return Err("代理端口号不能为 0".to_string());
        }
        settings.port = port_num.to_string();
    }

    Ok(settings)
}

pub fn init_proxy_settings(app: &AppHandle) {
    let loaded = pref_file_path(app)
        .and_then(|p| fs::read_to_string(p).ok())
        .and_then(|raw| serde_json::from_str::<ProxySettings>(&raw).ok())
        .and_then(|s| normalize_settings(s).ok())
        .unwrap_or_default();

    *proxy_store().write() = loaded;
}

pub fn get_current_proxy_settings() -> ProxySettings {
    proxy_store().read().clone()
}

pub fn update_proxy_settings(
    app: &AppHandle,
    incoming: ProxySettings,
) -> Result<ProxySettings, String> {
    let normalized = normalize_settings(incoming)?;
    if let Some(path) = pref_file_path(app) {
        if let Some(parent) = path.parent() {
            let _ = fs::create_dir_all(parent);
        }
        let serialized = serde_json::to_string_pretty(&normalized)
            .map_err(|e| format!("序列化代理配置失败: {e}"))?;
        fs::write(&path, serialized).map_err(|e| format!("保存代理配置文件失败: {e}"))?;
    }
    *proxy_store().write() = normalized.clone();
    Ok(normalized)
}

fn percent_encode_userinfo(raw: &str) -> String {
    let mut out = String::with_capacity(raw.len());
    for b in raw.bytes() {
        let safe = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~');
        if safe {
            out.push(b as char);
        } else {
            out.push_str(&format!("%{:02X}", b));
        }
    }
    out
}

fn build_custom_proxy_url(settings: &ProxySettings, include_auth: bool) -> Option<String> {
    let host = settings.host.trim();
    let port = settings.port.trim();
    if host.is_empty() || port.is_empty() {
        return None;
    }
    let scheme = match settings.protocol.as_str() {
        "https" => "https",
        "socks5" => "socks5h",
        _ => "http",
    };
    let formatted_host = if host.contains(':') && !host.starts_with('[') {
        format!("[{host}]")
    } else {
        host.to_string()
    };

    if include_auth && !settings.username.is_empty() {
        let user = percent_encode_userinfo(&settings.username);
        if settings.password.is_empty() {
            Some(format!("{scheme}://{user}@{formatted_host}:{port}"))
        } else {
            let pass = percent_encode_userinfo(&settings.password);
            Some(format!("{scheme}://{user}:{pass}@{formatted_host}:{port}"))
        }
    } else {
        Some(format!("{scheme}://{formatted_host}:{port}"))
    }
}

pub fn parse_scutil_proxy_output(raw: &str) -> SystemProxyInfo {
    let mut info = SystemProxyInfo::default();
    let mut in_exceptions = false;

    for line in raw.lines() {
        let trimmed = line.trim();
        if in_exceptions {
            if trimmed == "}" {
                in_exceptions = false;
                continue;
            }
            if let Some((_, val)) = trimmed.split_once(':') {
                let item = val.trim();
                if !item.is_empty() {
                    info.exceptions.push(item.to_string());
                }
            }
            continue;
        }

        if trimmed.starts_with("ExceptionsList") && trimmed.contains("<array>") {
            in_exceptions = true;
            continue;
        }

        let Some((key, val)) = trimmed.split_once(':') else {
            continue;
        };
        let key = key.trim();
        let val = val.trim();

        match key {
            "HTTPEnable" => info.http_enabled = val == "1",
            "HTTPProxy" if !val.is_empty() => info.http_host = Some(val.to_string()),
            "HTTPPort" => info.http_port = val.parse::<u16>().ok(),
            "HTTPSEnable" => info.https_enabled = val == "1",
            "HTTPSProxy" if !val.is_empty() => info.https_host = Some(val.to_string()),
            "HTTPSPort" => info.https_port = val.parse::<u16>().ok(),
            "SOCKSEnable" => info.socks_enabled = val == "1",
            "SOCKSProxy" if !val.is_empty() => info.socks_host = Some(val.to_string()),
            "SOCKSPort" => info.socks_port = val.parse::<u16>().ok(),
            _ => {}
        }
    }

    if !info.http_enabled {
        info.http_host = None;
        info.http_port = None;
    }
    if !info.https_enabled {
        info.https_host = None;
        info.https_port = None;
    }
    if !info.socks_enabled {
        info.socks_host = None;
        info.socks_port = None;
    }

    info.effective_url = compute_effective_system_url(&info);
    info
}

fn compute_effective_system_url(info: &SystemProxyInfo) -> Option<String> {
    if let (true, Some(host), Some(port)) = (info.https_enabled, &info.https_host, info.https_port) {
        return Some(format!("http://{host}:{port}"));
    }
    if let (true, Some(host), Some(port)) = (info.http_enabled, &info.http_host, info.http_port) {
        return Some(format!("http://{host}:{port}"));
    }
    if let (true, Some(host), Some(port)) = (info.socks_enabled, &info.socks_host, info.socks_port) {
        return Some(format!("socks5h://{host}:{port}"));
    }
    None
}

pub fn detect_system_proxy_sync() -> SystemProxyInfo {
    #[cfg(target_os = "macos")]
    {
        if let Ok(output) = StdCommand::new("/usr/sbin/scutil").arg("--proxy").output() {
            if output.status.success() {
                let raw = String::from_utf8_lossy(&output.stdout);
                return parse_scutil_proxy_output(&raw);
            }
        }
    }

    // Fallback: inspect environment variables if scutil is unavailable
    let mut info = SystemProxyInfo::default();
    if let Ok(url) = std::env::var("HTTPS_PROXY").or_else(|_| std::env::var("https_proxy")) {
        if !url.trim().is_empty() {
            info.effective_url = Some(url.trim().to_string());
        }
    } else if let Ok(url) = std::env::var("HTTP_PROXY").or_else(|_| std::env::var("http_proxy")) {
        if !url.trim().is_empty() {
            info.effective_url = Some(url.trim().to_string());
        }
    }
    info
}

pub async fn detect_system_proxy() -> SystemProxyInfo {
    tokio::task::spawn_blocking(detect_system_proxy_sync)
        .await
        .unwrap_or_default()
}

fn clear_proxy_envs(cmd: &mut AsyncCommand) {
    for key in PROXY_ENV_KEYS {
        cmd.env_remove(key);
    }
}

fn set_git_proxy_override(cmd: &mut AsyncCommand, http_proxy: &str, https_proxy: &str) {
    cmd.env("GIT_CONFIG_COUNT", "2")
        .env("GIT_CONFIG_KEY_0", "http.proxy")
        .env("GIT_CONFIG_VALUE_0", http_proxy)
        .env("GIT_CONFIG_KEY_1", "https.proxy")
        .env("GIT_CONFIG_VALUE_1", https_proxy);
}

fn apply_settings_to_command(cmd: &mut AsyncCommand, settings: &ProxySettings) {
    clear_proxy_envs(cmd);

    match settings.mode.as_str() {
        "direct" => {
            cmd.env("NO_PROXY", "*").env("no_proxy", "*");
            set_git_proxy_override(cmd, "", "");
        }
        "custom" => {
            if let Some(url) = build_custom_proxy_url(settings, true) {
                cmd.env("HTTP_PROXY", &url)
                    .env("HTTPS_PROXY", &url)
                    .env("ALL_PROXY", &url)
                    .env("http_proxy", &url)
                    .env("https_proxy", &url)
                    .env("all_proxy", &url);
                set_git_proxy_override(cmd, &url, &url);
                if !settings.bypass.trim().is_empty() {
                    cmd.env("NO_PROXY", settings.bypass.trim())
                        .env("no_proxy", settings.bypass.trim());
                }
            }
        }
        _ => {
            // "system": query live macOS system proxy settings
            let sys = detect_system_proxy_sync();
            let http_url = match (sys.http_enabled, &sys.http_host, sys.http_port) {
                (true, Some(h), Some(p)) => Some(format!("http://{h}:{p}")),
                _ => None,
            };
            let https_url = match (sys.https_enabled, &sys.https_host, sys.https_port) {
                (true, Some(h), Some(p)) => Some(format!("http://{h}:{p}")),
                _ => None,
            };
            let socks_url = match (sys.socks_enabled, &sys.socks_host, sys.socks_port) {
                (true, Some(h), Some(p)) => Some(format!("socks5h://{h}:{p}")),
                _ => None,
            };

            let effective_http = http_url
                .clone()
                .or_else(|| https_url.clone())
                .or_else(|| socks_url.clone())
                .or_else(|| sys.effective_url.clone());
            let effective_https = https_url
                .clone()
                .or_else(|| http_url.clone())
                .or_else(|| socks_url.clone())
                .or_else(|| sys.effective_url.clone());

            if let Some(ref u) = effective_http {
                cmd.env("HTTP_PROXY", u).env("http_proxy", u);
            }
            if let Some(ref u) = effective_https {
                cmd.env("HTTPS_PROXY", u).env("https_proxy", u);
            }
            if let Some(ref u) = socks_url.or_else(|| effective_https.clone()) {
                cmd.env("ALL_PROXY", u).env("all_proxy", u);
            }

            if effective_http.is_some() || effective_https.is_some() {
                set_git_proxy_override(
                    cmd,
                    effective_http.as_deref().unwrap_or(""),
                    effective_https.as_deref().unwrap_or(""),
                );
                let mut bypass_parts: Vec<String> = sys
                    .exceptions
                    .into_iter()
                    .filter(|x| !x.is_empty() && x != "<local>")
                    .map(|x| x.strip_prefix('*').map(|s| s.to_string()).unwrap_or(x))
                    .collect();
                for required in ["localhost", "127.0.0.1"] {
                    if !bypass_parts.iter().any(|x| x == required) {
                        bypass_parts.push(required.to_string());
                    }
                }
                let joined = bypass_parts.join(",");
                cmd.env("NO_PROXY", &joined).env("no_proxy", &joined);
            }
        }
    }
}

/// Applies the active FVM Orbit proxy settings to any spawned `fvm` CLI command.
pub fn apply_proxy_to_command(cmd: &mut AsyncCommand) {
    let settings = get_current_proxy_settings();
    apply_settings_to_command(cmd, &settings);
}

fn resolve_test_target_url(raw: Option<String>) -> (String, bool) {
    let Some(candidate) = raw else {
        return (DEFAULT_TEST_URL.to_string(), true);
    };
    let trimmed = candidate.trim().trim_end_matches('/');
    if !(trimmed.starts_with("http://") || trimmed.starts_with("https://")) {
        return (DEFAULT_TEST_URL.to_string(), true);
    }
    if trimmed.ends_with(".git") {
        // Smart Git HTTP servers always support GET on info/refs (some reject HEAD)
        return (format!("{trimmed}/info/refs?service=git-upload-pack"), false);
    }
    (trimmed.to_string(), true)
}

pub async fn test_proxy_connectivity(
    raw_settings: ProxySettings,
    target_url: Option<String>,
) -> Result<ProxyTestResult, String> {
    let settings = normalize_settings(raw_settings)?;
    let (url, use_head) = resolve_test_target_url(target_url);

    let (proxy_arg, display_proxy) = match settings.mode.as_str() {
        "direct" => (None, None),
        "custom" => {
            let full = build_custom_proxy_url(&settings, true);
            let masked = build_custom_proxy_url(&settings, false);
            (full, masked)
        }
        _ => {
            let sys = detect_system_proxy().await;
            (sys.effective_url.clone(), sys.effective_url)
        }
    };

    let started = Instant::now();
    let mut cmd = AsyncCommand::new("/usr/bin/curl");
    if use_head {
        cmd.arg("-I");
    }
    cmd.args([
        "-sS",
        "-L",
        "-o",
        "/dev/null",
        "--connect-timeout",
        "6",
        "--max-time",
        "10",
        "-w",
        "%{http_code}",
    ]);

    clear_proxy_envs(&mut cmd);

    if settings.mode == "direct" || proxy_arg.is_none() {
        cmd.args(["--noproxy", "*"]);
    } else if let Some(ref p) = proxy_arg {
        cmd.args(["--proxy", p]);
        if settings.mode == "custom" && !settings.bypass.trim().is_empty() {
            cmd.args(["--noproxy", settings.bypass.trim()]);
        }
    }

    cmd.arg(&url);

    let output = cmd
        .output()
        .await
        .map_err(|e| format!("无法执行连通性检测 (curl): {e}"))?;
    let latency_ms = started.elapsed().as_millis() as u64;

    let code_str = String::from_utf8_lossy(&output.stdout).trim().to_string();
    let http_status = code_str.parse::<u16>().ok().filter(|&c| c > 0);
    let stderr_text = String::from_utf8_lossy(&output.stderr).trim().to_string();

    if output.status.success() && matches!(http_status, Some(200..=399)) {
        let mode_desc = match settings.mode.as_str() {
            "direct" => format!("直连可达 · {latency_ms} ms"),
            "system" if display_proxy.is_none() => {
                format!("系统未开代理，已直连 · {latency_ms} ms")
            }
            _ => format!("代理连通正常 · {latency_ms} ms"),
        };
        return Ok(ProxyTestResult {
            ok: true,
            latency_ms,
            target_url: url,
            proxy_used: display_proxy,
            http_status,
            message: mode_desc,
        });
    }

    let detail = if http_status == Some(407) {
        "代理需要身份认证 (HTTP 407)".to_string()
    } else if !stderr_text.is_empty() {
        stderr_text
            .lines()
            .last()
            .unwrap_or(&stderr_text)
            .to_string()
    } else if let Some(code) = http_status {
        format!("目标返回 HTTP {code}")
    } else {
        "连接超时或被拒绝".to_string()
    };

    Ok(ProxyTestResult {
        ok: false,
        latency_ms,
        target_url: url,
        proxy_used: display_proxy,
        http_status,
        message: format!("连通失败: {detail}"),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_macos_scutil_proxy_dictionary() {
        let sample = r#"
<dictionary> {
  ExceptionsList : <array> {
    0 : *.local
    1 : 169.254/16
    2 : 127.0.0.1
    3 : localhost
  }
  FTPPassive : 1
  HTTPEnable : 1
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 1
  HTTPSPort : 7890
  HTTPSProxy : 127.0.0.1
  SOCKSEnable : 1
  SOCKSPort : 7891
  SOCKSProxy : 127.0.0.1
}
"#;
        let parsed = parse_scutil_proxy_output(sample);
        assert!(parsed.http_enabled);
        assert_eq!(parsed.http_host.as_deref(), Some("127.0.0.1"));
        assert_eq!(parsed.http_port, Some(7890));
        assert!(parsed.https_enabled);
        assert_eq!(parsed.https_port, Some(7890));
        assert!(parsed.socks_enabled);
        assert_eq!(parsed.socks_port, Some(7891));
        assert_eq!(
            parsed.exceptions,
            vec!["*.local", "169.254/16", "127.0.0.1", "localhost"]
        );
        assert_eq!(parsed.effective_url.as_deref(), Some("http://127.0.0.1:7890"));
    }

    #[test]
    fn handles_disabled_scutil_proxy() {
        let sample = r#"
<dictionary> {
  HTTPEnable : 0
  HTTPPort : 7890
  HTTPProxy : 127.0.0.1
  HTTPSEnable : 0
  SOCKSEnable : 0
}
"#;
        let parsed = parse_scutil_proxy_output(sample);
        assert!(!parsed.http_enabled);
        assert_eq!(parsed.http_host, None);
        assert_eq!(parsed.effective_url, None);
    }

    #[test]
    fn builds_encoded_custom_proxy_url() {
        let cfg = ProxySettings {
            mode: "custom".to_string(),
            protocol: "socks5".to_string(),
            host: "127.0.0.1".to_string(),
            port: "10808".to_string(),
            username: "my user".to_string(),
            password: "p@ss:1/2".to_string(),
            bypass: "localhost".to_string(),
        };
        assert_eq!(
            build_custom_proxy_url(&cfg, true).as_deref(),
            Some("socks5h://my%20user:p%40ss%3A1%2F2@127.0.0.1:10808")
        );
        assert_eq!(
            build_custom_proxy_url(&cfg, false).as_deref(),
            Some("socks5h://127.0.0.1:10808")
        );
    }
}
