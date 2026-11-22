use crate::fvm::runner::CancelRegistry;
use crate::proxy::{apply_active_proxy_to_curl, curl_binary, null_device};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use std::cmp::Ordering;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::{Arc, OnceLock};
use std::time::Duration;
use tauri::ipc::Channel;
use tauri::AppHandle;
use tauri_plugin_opener::OpenerExt;
use tokio::process::Command as AsyncCommand;

pub const GITHUB_OWNER: &str = "hanklee9820";
pub const GITHUB_REPO: &str = "fvm-orbit";
pub const REPO_URL: &str = "https://github.com/hanklee9820/fvm-orbit";
pub const RELEASES_PAGE_URL: &str = "https://github.com/hanklee9820/fvm-orbit/releases";
const RELEASES_LATEST_API_URL: &str =
    "https://api.github.com/repos/hanklee9820/fvm-orbit/releases/latest";
const RELEASES_LIST_API_URL: &str =
    "https://api.github.com/repos/hanklee9820/fvm-orbit/releases?per_page=10";
const RELEASES_LATEST_WEB_URL: &str = "https://github.com/hanklee9820/fvm-orbit/releases/latest";

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppVersionInfo {
    pub version: String,
    pub os: String,
    pub arch: String,
    pub repo_url: String,
    pub releases_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseAssetInfo {
    pub name: String,
    pub download_url: String,
    pub size_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCheckResult {
    pub current_version: String,
    pub latest_version: String,
    pub tag_name: String,
    pub has_update: bool,
    pub release_name: String,
    pub release_notes: Option<String>,
    pub published_at: Option<String>,
    pub release_url: String,
    pub prerelease: bool,
    pub recommended_asset: Option<ReleaseAssetInfo>,
    pub assets: Vec<ReleaseAssetInfo>,
    /// "github-api" | "github-redirect" | "no-release"
    pub checked_via: String,
    pub proxy_used: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDownloadEvent {
    pub request_id: String,
    /// "started" | "progress" | "finished" | "cancelled" | "error"
    pub kind: String,
    pub downloaded_bytes: u64,
    pub total_bytes: u64,
    pub percent: Option<u8>,
    pub saved_path: Option<String>,
    pub message: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubReleasePayload {
    tag_name: String,
    #[serde(default)]
    name: Option<String>,
    #[serde(default)]
    body: Option<String>,
    #[serde(default)]
    html_url: Option<String>,
    #[serde(default)]
    published_at: Option<String>,
    #[serde(default)]
    prerelease: bool,
    #[serde(default)]
    draft: bool,
    #[serde(default)]
    assets: Vec<GithubAssetPayload>,
}

#[derive(Debug, Deserialize)]
struct GithubAssetPayload {
    name: String,
    browser_download_url: String,
    #[serde(default)]
    size: u64,
}

static LAST_DOWNLOADED_INSTALLER: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

fn last_downloaded_store() -> &'static Mutex<Option<PathBuf>> {
    LAST_DOWNLOADED_INSTALLER.get_or_init(|| Mutex::new(None))
}

#[derive(Debug, Clone, PartialEq, Eq)]
enum PrereleaseId {
    Numeric(u64),
    Alpha(String),
}

impl Ord for PrereleaseId {
    fn cmp(&self, other: &Self) -> Ordering {
        match (self, other) {
            (Self::Numeric(a), Self::Numeric(b)) => a.cmp(b),
            (Self::Numeric(_), Self::Alpha(_)) => Ordering::Less,
            (Self::Alpha(_), Self::Numeric(_)) => Ordering::Greater,
            (Self::Alpha(a), Self::Alpha(b)) => a.cmp(b),
        }
    }
}

impl PartialOrd for PrereleaseId {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct SemVer {
    pub major: u64,
    pub minor: u64,
    pub patch: u64,
    prerelease: Vec<PrereleaseId>,
}

impl Ord for SemVer {
    fn cmp(&self, other: &Self) -> Ordering {
        self.major
            .cmp(&other.major)
            .then_with(|| self.minor.cmp(&other.minor))
            .then_with(|| self.patch.cmp(&other.patch))
            .then_with(|| match (self.prerelease.is_empty(), other.prerelease.is_empty()) {
                (true, true) => Ordering::Equal,
                (true, false) => Ordering::Greater,
                (false, true) => Ordering::Less,
                (false, false) => self.prerelease.cmp(&other.prerelease),
            })
    }
}

impl PartialOrd for SemVer {
    fn partial_cmp(&self, other: &Self) -> Option<Ordering> {
        Some(self.cmp(other))
    }
}

pub fn normalize_version_str(raw: &str) -> String {
    raw.trim()
        .trim_start_matches(['v', 'V'])
        .trim()
        .to_string()
}

pub fn parse_semver(raw: &str) -> Option<SemVer> {
    let cleaned = normalize_version_str(raw);
    if cleaned.is_empty() {
        return None;
    }
    let without_build = cleaned.split('+').next().unwrap_or("");
    let (core, pre_opt) = match without_build.split_once('-') {
        Some((c, p)) => (c, Some(p)),
        None => (without_build, None),
    };

    let parts: Vec<&str> = core.split('.').collect();
    if parts.is_empty() || parts.len() > 3 {
        return None;
    }
    let major = parts.first()?.parse::<u64>().ok()?;
    let minor = parts.get(1).copied().unwrap_or("0").parse::<u64>().ok()?;
    let patch = parts.get(2).copied().unwrap_or("0").parse::<u64>().ok()?;

    let prerelease = match pre_opt {
        Some(pre) if !pre.is_empty() => pre
            .split('.')
            .filter(|s| !s.is_empty())
            .map(|id| match id.parse::<u64>() {
                Ok(n) => PrereleaseId::Numeric(n),
                Err(_) => PrereleaseId::Alpha(id.to_ascii_lowercase()),
            })
            .collect(),
        _ => Vec::new(),
    };

    Some(SemVer {
        major,
        minor,
        patch,
        prerelease,
    })
}

pub fn is_newer_version(current: &str, candidate: &str) -> bool {
    match (parse_semver(current), parse_semver(candidate)) {
        (Some(cur), Some(cand)) => cand > cur,
        _ => {
            let cur_norm = normalize_version_str(current);
            let cand_norm = normalize_version_str(candidate);
            !cand_norm.is_empty() && cand_norm != cur_norm
        }
    }
}

pub fn get_app_version_info(app: &AppHandle) -> AppVersionInfo {
    AppVersionInfo {
        version: app.package_info().version.to_string(),
        os: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        repo_url: REPO_URL.to_string(),
        releases_url: RELEASES_PAGE_URL.to_string(),
    }
}

fn is_ignored_asset(name_lower: &str) -> bool {
    name_lower.ends_with(".sig")
        || name_lower.ends_with(".sha256")
        || name_lower.ends_with(".txt")
        || name_lower.ends_with(".json")
        || name_lower.ends_with(".blockmap")
        || name_lower.contains("checksum")
        || name_lower.contains("sha256sum")
}

fn score_asset_for_platform(os: &str, arch: &str, name: &str) -> Option<i32> {
    let lower = name.to_ascii_lowercase();
    if is_ignored_asset(&lower) {
        return None;
    }

    let is_arm = lower.contains("aarch64") || lower.contains("arm64");
    let is_x64 = lower.contains("x86_64")
        || lower.contains("x64")
        || lower.contains("amd64")
        || lower.contains("intel");
    let is_universal = lower.contains("universal");

    let arch_score = match arch {
        "aarch64" => {
            if is_arm {
                40
            } else if is_universal {
                20
            } else if is_x64 {
                return None;
            } else {
                0
            }
        }
        "x86_64" => {
            if is_x64 {
                40
            } else if is_universal {
                20
            } else if is_arm {
                return None;
            } else {
                0
            }
        }
        _ => 0,
    };

    let ext_score = match os {
        "macos" => {
            if lower.ends_with(".dmg") {
                100
            } else if lower.ends_with(".pkg") {
                80
            } else if lower.ends_with(".app.tar.gz") {
                50
            } else {
                return None;
            }
        }
        "windows" => {
            if lower.ends_with("-setup.exe") || lower.ends_with(".exe") {
                100
            } else if lower.ends_with(".msi") {
                80
            } else {
                return None;
            }
        }
        "linux" => {
            if lower.ends_with(".appimage") {
                100
            } else if lower.ends_with(".deb") {
                80
            } else if lower.ends_with(".rpm") {
                60
            } else {
                return None;
            }
        }
        _ => return None,
    };

    Some(ext_score + arch_score)
}

pub fn pick_recommended_asset(
    os: &str,
    arch: &str,
    assets: &[ReleaseAssetInfo],
) -> Option<ReleaseAssetInfo> {
    assets
        .iter()
        .filter_map(|asset| {
            score_asset_for_platform(os, arch, &asset.name).map(|score| (score, asset))
        })
        .max_by_key(|(score, _)| *score)
        .map(|(_, asset)| asset.clone())
}

fn build_result_from_payload(
    payload: GithubReleasePayload,
    current_version: &str,
    os: &str,
    arch: &str,
    proxy_used: Option<String>,
) -> UpdateCheckResult {
    let latest_version = normalize_version_str(&payload.tag_name);
    let has_update = is_newer_version(current_version, &latest_version);
    let assets: Vec<ReleaseAssetInfo> = payload
        .assets
        .into_iter()
        .filter(|a| !is_ignored_asset(&a.name.to_ascii_lowercase()))
        .map(|a| ReleaseAssetInfo {
            name: a.name,
            download_url: a.browser_download_url,
            size_bytes: a.size,
        })
        .collect();
    let recommended_asset = pick_recommended_asset(os, arch, &assets);
    let release_name = payload
        .name
        .filter(|n| !n.trim().is_empty())
        .unwrap_or_else(|| format!("FVM Orbit v{latest_version}"));
    let release_notes = payload.body.and_then(|b| {
        let trimmed = b.trim().to_string();
        if trimmed.is_empty() {
            None
        } else {
            Some(trimmed)
        }
    });
    let release_url = payload
        .html_url
        .filter(|u| !u.trim().is_empty())
        .unwrap_or_else(|| format!("{RELEASES_PAGE_URL}/tag/{}", payload.tag_name));

    UpdateCheckResult {
        current_version: current_version.to_string(),
        latest_version,
        tag_name: payload.tag_name,
        has_update,
        release_name,
        release_notes,
        published_at: payload.published_at,
        release_url,
        prerelease: payload.prerelease,
        recommended_asset,
        assets,
        checked_via: "github-api".to_string(),
        proxy_used,
    }
}

pub fn parse_github_release_json(
    raw: &str,
    current_version: &str,
    os: &str,
    arch: &str,
    proxy_used: Option<String>,
) -> Result<UpdateCheckResult, String> {
    let payload: GithubReleasePayload = serde_json::from_str(raw).map_err(|e| {
        format!(
            "{}: {e}",
            crate::i18n::pick("解析 GitHub Release 响应失败", "Failed to parse GitHub Release JSON")
        )
    })?;
    Ok(build_result_from_payload(
        payload,
        current_version,
        os,
        arch,
        proxy_used,
    ))
}

pub fn parse_tag_from_redirect_url(effective_url: &str) -> Option<String> {
    let trimmed = effective_url.trim().trim_end_matches('/');
    let marker = "/releases/tag/";
    let idx = trimmed.find(marker)?;
    let rest = &trimmed[idx + marker.len()..];
    let tag = rest.split(['?', '#', '/']).next()?.trim();
    if tag.is_empty() {
        None
    } else {
        Some(tag.to_string())
    }
}

async fn curl_get_json(url: &str, current_version: &str) -> Result<(u16, String, Option<String>), String> {
    let mut cmd = AsyncCommand::new(curl_binary());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    cmd.args([
        "-sS",
        "-L",
        "--connect-timeout",
        "8",
        "--max-time",
        "15",
        "-H",
        "Accept: application/vnd.github+json",
        "-H",
        "X-GitHub-Api-Version: 2022-11-28",
        "-H",
        &format!("User-Agent: FVM-Orbit/{current_version} ({GITHUB_OWNER}/{GITHUB_REPO})"),
        "-w",
        "\n%{http_code}",
    ]);

    let proxy_used = apply_active_proxy_to_curl(&mut cmd).await;
    cmd.arg(url);

    let output = cmd.output().await.map_err(|e| {
        format!(
            "{}: {e}",
            crate::i18n::pick("无法执行检查更新请求 (curl)", "Failed to invoke curl for update check")
        )
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();

    let (body, code_str) = match stdout.rsplit_once('\n') {
        Some((b, c)) => (b.to_string(), c.trim().to_string()),
        None => (String::new(), stdout.trim().to_string()),
    };
    let http_code = code_str.parse::<u16>().unwrap_or(0);

    if !output.status.success() && http_code == 0 {
        let detail = if !stderr.is_empty() {
            stderr.lines().last().unwrap_or(&stderr).to_string()
        } else {
            crate::i18n::pick("网络连接超时或无法访问 GitHub", "Network timeout or unable to reach GitHub")
                .to_string()
        };
        return Err(detail);
    }

    Ok((http_code, body, proxy_used))
}

async fn fetch_latest_via_web_redirect(
    current_version: &str,
    redirect_url: &str,
) -> Result<UpdateCheckResult, String> {
    let mut cmd = AsyncCommand::new(curl_binary());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    cmd.args([
        "-sS",
        "-L",
        "-I",
        "-o",
        null_device(),
        "--connect-timeout",
        "8",
        "--max-time",
        "15",
        "-H",
        &format!("User-Agent: FVM-Orbit/{current_version}"),
        "-w",
        "%{http_code}\n%{url_effective}",
    ]);
    let proxy_used = apply_active_proxy_to_curl(&mut cmd).await;
    cmd.arg(redirect_url);

    let output = cmd.output().await.map_err(|e| {
        format!(
            "{}: {e}",
            crate::i18n::pick("无法访问 GitHub Releases 页面", "Failed to reach GitHub Releases page")
        )
    })?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let mut lines = stdout.lines();
    let http_code = lines
        .next()
        .and_then(|l| l.trim().parse::<u16>().ok())
        .unwrap_or(0);
    let effective_url = lines.next().unwrap_or("").trim().to_string();

    if !output.status.success() || !(200..400).contains(&http_code) {
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let detail = if !stderr.is_empty() {
            stderr.lines().last().unwrap_or(&stderr).to_string()
        } else if http_code > 0 {
            format!("HTTP {http_code}")
        } else {
            crate::i18n::pick("连接 GitHub 失败", "Failed to connect to GitHub").to_string()
        };
        return Err(detail);
    }

    let Some(tag_name) = parse_tag_from_redirect_url(&effective_url) else {
        return Ok(UpdateCheckResult {
            current_version: current_version.to_string(),
            latest_version: current_version.to_string(),
            tag_name: format!("v{current_version}"),
            has_update: false,
            release_name: format!("FVM Orbit v{current_version}"),
            release_notes: None,
            published_at: None,
            release_url: RELEASES_PAGE_URL.to_string(),
            prerelease: false,
            recommended_asset: None,
            assets: Vec::new(),
            checked_via: "no-release".to_string(),
            proxy_used,
        });
    };

    let latest_version = normalize_version_str(&tag_name);
    let has_update = is_newer_version(current_version, &latest_version);

    Ok(UpdateCheckResult {
        current_version: current_version.to_string(),
        latest_version: latest_version.clone(),
        tag_name,
        has_update,
        release_name: format!("FVM Orbit v{latest_version}"),
        release_notes: None,
        published_at: None,
        release_url: effective_url,
        prerelease: latest_version.contains('-'),
        recommended_asset: None,
        assets: Vec::new(),
        checked_via: "github-redirect".to_string(),
        proxy_used,
    })
}

async fn check_for_updates_with_endpoints(
    current_version: &str,
    os: &str,
    arch: &str,
    latest_api_url: &str,
    list_api_url: &str,
    web_redirect_url: &str,
) -> Result<UpdateCheckResult, String> {
    let (status, body, proxy_used) = curl_get_json(latest_api_url, current_version).await?;

    if status == 200 {
        return parse_github_release_json(&body, current_version, os, arch, proxy_used);
    }

    // Handle GitHub API rate limiting gracefully via web redirect fallback
    if status == 403 || status == 429 {
        return fetch_latest_via_web_redirect(current_version, web_redirect_url).await;
    }

    // If /releases/latest returns 404 (e.g. only prereleases or no releases yet), inspect /releases list
    if status == 404 {
        let (list_status, list_body, list_proxy) =
            curl_get_json(list_api_url, current_version).await?;
        if list_status == 200 {
            let releases: Vec<GithubReleasePayload> =
                serde_json::from_str(&list_body).unwrap_or_default();
            if let Some(first) = releases.into_iter().find(|r| !r.draft) {
                return Ok(build_result_from_payload(
                    first,
                    current_version,
                    os,
                    arch,
                    list_proxy,
                ));
            }
            return Ok(UpdateCheckResult {
                current_version: current_version.to_string(),
                latest_version: current_version.to_string(),
                tag_name: format!("v{current_version}"),
                has_update: false,
                release_name: format!("FVM Orbit v{current_version}"),
                release_notes: None,
                published_at: None,
                release_url: RELEASES_PAGE_URL.to_string(),
                prerelease: false,
                recommended_asset: None,
                assets: Vec::new(),
                checked_via: "no-release".to_string(),
                proxy_used: list_proxy,
            });
        }
    }

    let is_zh = crate::i18n::current_locale().is_zh();
    Err(if is_zh {
        format!("GitHub Releases 返回 HTTP {status}")
    } else {
        format!("GitHub Releases returned HTTP {status}")
    })
}

pub async fn check_for_updates(app: &AppHandle) -> Result<UpdateCheckResult, String> {
    let current_version = app.package_info().version.to_string();
    let os = std::env::consts::OS;
    let arch = std::env::consts::ARCH;

    check_for_updates_with_endpoints(
        &current_version,
        os,
        arch,
        RELEASES_LATEST_API_URL,
        RELEASES_LIST_API_URL,
        RELEASES_LATEST_WEB_URL,
    )
    .await
}

pub fn validate_download_target(asset_name: &str, download_url: &str) -> Result<(), String> {
    let trimmed_name = asset_name.trim();
    if trimmed_name.is_empty()
        || trimmed_name.contains('/')
        || trimmed_name.contains('\\')
        || trimmed_name.contains("..")
        || trimmed_name.contains('\0')
    {
        return Err(crate::i18n::pick("非法的安装包文件名", "Invalid installer file name").to_string());
    }

    let lower_name = trimmed_name.to_ascii_lowercase();
    let allowed_ext = [
        ".dmg",
        ".pkg",
        ".app.tar.gz",
        ".exe",
        ".msi",
        ".appimage",
        ".deb",
        ".rpm",
        ".zip",
    ]
    .iter()
    .any(|ext| lower_name.ends_with(ext));
    if !allowed_ext {
        return Err(
            crate::i18n::pick("不支持的安装包文件格式", "Unsupported installer file extension")
                .to_string(),
        );
    }

    let trimmed_url = download_url.trim();
    let allowed_prefixes = [
        "https://github.com/hanklee9820/fvm-orbit/releases/download/",
        "https://objects.githubusercontent.com/",
        "https://release-assets.githubusercontent.com/",
    ];
    if !allowed_prefixes.iter().any(|p| trimmed_url.starts_with(p)) {
        return Err(crate::i18n::pick(
            "下载地址不在允许的 GitHub Release 域名范围内",
            "Download URL is outside allowed GitHub Release hosts",
        )
        .to_string());
    }

    Ok(())
}

pub async fn download_update_asset(
    app: &AppHandle,
    request_id: String,
    asset_name: String,
    download_url: String,
    total_bytes: u64,
    on_event: Channel<UpdateDownloadEvent>,
    cancel_registry: Arc<CancelRegistry>,
) -> Result<Option<String>, String> {
    validate_download_target(&asset_name, &download_url)?;

    let download_dir = dirs::download_dir().unwrap_or_else(std::env::temp_dir);
    tokio::fs::create_dir_all(&download_dir).await.map_err(|e| {
        format!(
            "{}: {e}",
            crate::i18n::pick("无法创建下载目录", "Failed to create download directory")
        )
    })?;

    let dest_path = download_dir.join(&asset_name);
    let part_path = download_dir.join(format!("{asset_name}.fvmorbit.part"));
    let _ = tokio::fs::remove_file(&part_path).await;

    let current_version = app.package_info().version.to_string();
    let mut cmd = AsyncCommand::new(curl_binary());
    #[cfg(windows)]
    cmd.creation_flags(0x0800_0000);
    cmd.args([
        "-sS",
        "-L",
        "--fail",
        "--connect-timeout",
        "10",
        "--max-time",
        "600",
        "-H",
        &format!("User-Agent: FVM-Orbit/{current_version}"),
        "-o",
    ]);
    cmd.arg(&part_path);
    apply_active_proxy_to_curl(&mut cmd).await;
    cmd.arg(&download_url);
    cmd.stdout(Stdio::null()).stderr(Stdio::piped());

    let cancel_token = cancel_registry.register(&request_id);

    let mut child = cmd.spawn().map_err(|e| {
        cancel_registry.remove(&request_id);
        format!(
            "{}: {e}",
            crate::i18n::pick("无法启动安装包下载进程 (curl)", "Failed to start curl download process")
        )
    })?;

    let _ = on_event.send(UpdateDownloadEvent {
        request_id: request_id.clone(),
        kind: "started".to_string(),
        downloaded_bytes: 0,
        total_bytes,
        percent: if total_bytes > 0 { Some(0) } else { None },
        saved_path: None,
        message: None,
    });

    let mut stderr_handle = child.stderr.take();
    let mut ticker = tokio::time::interval(Duration::from_millis(160));
    ticker.set_missed_tick_behavior(tokio::time::MissedTickBehavior::Skip);

    let exit_status = loop {
        tokio::select! {
            _ = cancel_token.cancelled() => {
                let _ = child.kill().await;
                let _ = child.wait().await;
                let _ = tokio::fs::remove_file(&part_path).await;
                cancel_registry.remove(&request_id);
                let _ = on_event.send(UpdateDownloadEvent {
                    request_id: request_id.clone(),
                    kind: "cancelled".to_string(),
                    downloaded_bytes: 0,
                    total_bytes,
                    percent: None,
                    saved_path: None,
                    message: None,
                });
                return Ok(None);
            }
            status_res = child.wait() => {
                break status_res.map_err(|e| {
                    cancel_registry.remove(&request_id);
                    format!(
                        "{}: {e}",
                        crate::i18n::pick("等待下载进程异常", "Error waiting for download process")
                    )
                })?;
            }
            _ = ticker.tick() => {
                let downloaded = tokio::fs::metadata(&part_path)
                    .await
                    .map(|m| m.len())
                    .unwrap_or(0);
                let pct = if total_bytes > 0 {
                    Some(((downloaded.saturating_mul(100)) / total_bytes).min(99) as u8)
                } else {
                    None
                };
                let _ = on_event.send(UpdateDownloadEvent {
                    request_id: request_id.clone(),
                    kind: "progress".to_string(),
                    downloaded_bytes: downloaded,
                    total_bytes,
                    percent: pct,
                    saved_path: None,
                    message: None,
                });
            }
        }
    };

    cancel_registry.remove(&request_id);

    if !exit_status.success() {
        let mut stderr_buf = Vec::new();
        if let Some(ref mut err_pipe) = stderr_handle {
            use tokio::io::AsyncReadExt;
            let _ = err_pipe.read_to_end(&mut stderr_buf).await;
        }
        let _ = tokio::fs::remove_file(&part_path).await;
        let stderr_text = String::from_utf8_lossy(&stderr_buf).trim().to_string();
        let detail = if !stderr_text.is_empty() {
            stderr_text
                .lines()
                .last()
                .unwrap_or(&stderr_text)
                .to_string()
        } else {
            crate::i18n::pick("安装包下载失败，请检查网络或代理设置", "Installer download failed; check your network or proxy settings")
                .to_string()
        };
        let _ = on_event.send(UpdateDownloadEvent {
            request_id: request_id.clone(),
            kind: "error".to_string(),
            downloaded_bytes: 0,
            total_bytes,
            percent: None,
            saved_path: None,
            message: Some(detail.clone()),
        });
        return Err(detail);
    }

    let final_size = tokio::fs::metadata(&part_path)
        .await
        .map(|m| m.len())
        .unwrap_or(0);
    if final_size == 0 {
        let _ = tokio::fs::remove_file(&part_path).await;
        let msg = crate::i18n::pick("下载的安装包为空文件", "Downloaded installer file is empty")
            .to_string();
        let _ = on_event.send(UpdateDownloadEvent {
            request_id,
            kind: "error".to_string(),
            downloaded_bytes: 0,
            total_bytes,
            percent: None,
            saved_path: None,
            message: Some(msg.clone()),
        });
        return Err(msg);
    }

    if dest_path.exists() {
        let _ = tokio::fs::remove_file(&dest_path).await;
    }
    tokio::fs::rename(&part_path, &dest_path).await.map_err(|e| {
        let _ = std::fs::remove_file(&part_path);
        format!(
            "{}: {e}",
            crate::i18n::pick("保存安装包文件失败", "Failed to save installer file")
        )
    })?;

    *last_downloaded_store().lock() = Some(dest_path.clone());
    let saved_str = dest_path.to_string_lossy().to_string();

    let _ = on_event.send(UpdateDownloadEvent {
        request_id,
        kind: "finished".to_string(),
        downloaded_bytes: final_size,
        total_bytes: total_bytes.max(final_size),
        percent: Some(100),
        saved_path: Some(saved_str.clone()),
        message: None,
    });

    Ok(Some(saved_str))
}

pub fn open_downloaded_update(app: &AppHandle, path: String) -> Result<(), String> {
    let requested = PathBuf::from(&path);
    let recorded = last_downloaded_store().lock().clone();
    let Some(expected) = recorded else {
        return Err(crate::i18n::pick(
            "未找到本次已下载的安装包，请先重新下载",
            "No downloaded installer found for this session; please download again",
        )
        .to_string());
    };
    if requested != expected || !Path::new(&expected).is_file() {
        return Err(crate::i18n::pick(
            "安装包路径无效或文件已被移动",
            "Installer path is invalid or the file was moved",
        )
        .to_string());
    }

    app.opener()
        .open_path(expected.to_string_lossy().to_string(), None::<&str>)
        .map_err(|e| {
            format!(
                "{}: {e}",
                crate::i18n::pick("无法打开安装包", "Failed to open installer")
            )
        })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn compares_semver_versions_accurately() {
        assert!(is_newer_version("0.1.1", "0.1.2"));
        assert!(is_newer_version("0.1.1", "v0.2.0"));
        assert!(is_newer_version("0.1.1", "1.0.0"));
        assert!(!is_newer_version("0.1.1", "0.1.1"));
        assert!(!is_newer_version("0.1.1", "v0.1.1"));
        assert!(!is_newer_version("0.1.1", "0.1.0"));

        // Prerelease ordering per SemVer 2.0
        assert!(is_newer_version("0.2.0-beta.1", "0.2.0"));
        assert!(is_newer_version("0.2.0-beta.2", "0.2.0-beta.10"));
        assert!(is_newer_version("0.2.0-alpha.1", "0.2.0-beta.1"));
        assert!(!is_newer_version("0.2.0", "0.2.0-rc.1"));
        assert!(!is_newer_version("0.1.1+build.1", "0.1.1+build.2"));
    }

    #[test]
    fn picks_best_installer_asset_per_os_and_arch() {
        let assets = vec![
            ReleaseAssetInfo {
                name: "SHA256SUMS.txt".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/SHA256SUMS.txt".to_string(),
                size_bytes: 660,
            },
            ReleaseAssetInfo {
                name: "FVM.Orbit_0.2.0_aarch64.dmg".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_aarch64.dmg".to_string(),
                size_bytes: 6_454_634,
            },
            ReleaseAssetInfo {
                name: "FVM.Orbit_aarch64.app.tar.gz".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_aarch64.app.tar.gz".to_string(),
                size_bytes: 5_046_467,
            },
            ReleaseAssetInfo {
                name: "FVM.Orbit_0.2.0_x64.dmg".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_x64.dmg".to_string(),
                size_bytes: 6_619_085,
            },
            ReleaseAssetInfo {
                name: "FVM.Orbit_0.2.0_x64-setup.exe".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_x64-setup.exe".to_string(),
                size_bytes: 3_034_340,
            },
            ReleaseAssetInfo {
                name: "FVM.Orbit_0.2.0_x64_en-US.msi".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_x64_en-US.msi".to_string(),
                size_bytes: 4_268_032,
            },
            ReleaseAssetInfo {
                name: "FVM.Orbit_0.2.0_arm64-setup.exe".to_string(),
                download_url: "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_arm64-setup.exe".to_string(),
                size_bytes: 2_733_772,
            },
        ];

        assert_eq!(
            pick_recommended_asset("macos", "aarch64", &assets).map(|a| a.name),
            Some("FVM.Orbit_0.2.0_aarch64.dmg".to_string())
        );
        assert_eq!(
            pick_recommended_asset("macos", "x86_64", &assets).map(|a| a.name),
            Some("FVM.Orbit_0.2.0_x64.dmg".to_string())
        );
        assert_eq!(
            pick_recommended_asset("windows", "x86_64", &assets).map(|a| a.name),
            Some("FVM.Orbit_0.2.0_x64-setup.exe".to_string())
        );
        assert_eq!(
            pick_recommended_asset("windows", "aarch64", &assets).map(|a| a.name),
            Some("FVM.Orbit_0.2.0_arm64-setup.exe".to_string())
        );
    }

    #[test]
    fn parses_github_release_json_and_detects_update() {
        let json = r###"{
            "tag_name": "v0.2.0",
            "name": "FVM Orbit v0.2.0",
            "body": "## Highlights\n- Added update checker",
            "html_url": "https://github.com/hanklee9820/fvm-orbit/releases/tag/v0.2.0",
            "published_at": "2026-11-22T08:00:00Z",
            "prerelease": false,
            "draft": false,
            "assets": [
                {
                    "name": "FVM.Orbit_0.2.0_aarch64.dmg",
                    "browser_download_url": "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_aarch64.dmg",
                    "size": 6400000
                },
                {
                    "name": "SHA256SUMS.txt",
                    "browser_download_url": "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/SHA256SUMS.txt",
                    "size": 500
                }
            ]
        }"###;

        let res = parse_github_release_json(json, "0.1.1", "macos", "aarch64", None).unwrap();
        assert!(res.has_update);
        assert_eq!(res.latest_version, "0.2.0");
        assert_eq!(res.tag_name, "v0.2.0");
        assert_eq!(res.assets.len(), 1);
        assert_eq!(
            res.recommended_asset.as_ref().map(|a| a.name.as_str()),
            Some("FVM.Orbit_0.2.0_aarch64.dmg")
        );

        let same = parse_github_release_json(json, "0.2.0", "macos", "aarch64", None).unwrap();
        assert!(!same.has_update);
    }

    #[test]
    fn extracts_tag_from_redirect_url() {
        assert_eq!(
            parse_tag_from_redirect_url(
                "https://github.com/hanklee9820/fvm-orbit/releases/tag/v0.2.1"
            ),
            Some("v0.2.1".to_string())
        );
        assert_eq!(
            parse_tag_from_redirect_url(
                "https://github.com/hanklee9820/fvm-orbit/releases/tag/v0.2.1?foo=bar"
            ),
            Some("v0.2.1".to_string())
        );
        assert_eq!(
            parse_tag_from_redirect_url("https://github.com/hanklee9820/fvm-orbit/releases"),
            None
        );
    }

    #[test]
    fn validates_download_targets_strictly() {
        assert!(validate_download_target(
            "FVM.Orbit_0.2.0_aarch64.dmg",
            "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_aarch64.dmg"
        )
        .is_ok());
        assert!(validate_download_target(
            "../evil.dmg",
            "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/evil.dmg"
        )
        .is_err());
        assert!(validate_download_target(
            "FVM.Orbit_0.2.0_aarch64.dmg",
            "https://evil.example.com/FVM.Orbit_0.2.0_aarch64.dmg"
        )
        .is_err());
        assert!(validate_download_target(
            "script.sh",
            "https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/script.sh"
        )
        .is_err());
    }

    fn spawn_mock_http_server(
        responses: Vec<String>,
    ) -> (u16, std::thread::JoinHandle<()>) {
        use std::io::{Read, Write};
        use std::net::TcpListener;

        let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
        let port = listener.local_addr().unwrap().port();
        let handle = std::thread::spawn(move || {
            for resp in responses {
                if let Ok((mut stream, _)) = listener.accept() {
                    let mut buf = [0u8; 2048];
                    let _ = stream.read(&mut buf);
                    let _ = stream.write_all(resp.as_bytes());
                    let _ = stream.flush();
                }
            }
        });
        (port, handle)
    }

    #[tokio::test]
    async fn e2e_curl_check_returns_update_and_matches_asset() {
        let body = r###"{"tag_name":"v0.2.0","name":"FVM Orbit v0.2.0","body":"## Notes\n- Faster updates","html_url":"https://github.com/hanklee9820/fvm-orbit/releases/tag/v0.2.0","published_at":"2026-11-22T08:00:00Z","prerelease":false,"draft":false,"assets":[{"name":"FVM.Orbit_0.2.0_aarch64.dmg","browser_download_url":"https://github.com/hanklee9820/fvm-orbit/releases/download/v0.2.0/FVM.Orbit_0.2.0_aarch64.dmg","size":6454634}]}"###;
        let resp = format!(
            "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\nConnection: close\r\n\r\n{}",
            body.len(),
            body
        );
        let (port, handle) = spawn_mock_http_server(vec![resp]);
        let base = format!("http://127.0.0.1:{port}");

        let res = check_for_updates_with_endpoints(
            "0.1.1",
            "macos",
            "aarch64",
            &format!("{base}/releases/latest"),
            &format!("{base}/releases"),
            &format!("{base}/web/latest"),
        )
        .await
        .expect("e2e 200 check should succeed");

        let _ = handle.join();
        assert!(res.has_update);
        assert_eq!(res.latest_version, "0.2.0");
        assert_eq!(res.checked_via, "github-api");
        assert_eq!(
            res.recommended_asset.as_ref().map(|a| a.name.as_str()),
            Some("FVM.Orbit_0.2.0_aarch64.dmg")
        );
    }

    #[tokio::test]
    async fn e2e_curl_rate_limit_falls_back_to_web_redirect() {
        let rate_limited = "HTTP/1.1 403 Forbidden\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}".to_string();
        let (port, handle) = {
            use std::io::{Read, Write};
            use std::net::TcpListener;
            let listener = TcpListener::bind("127.0.0.1:0").expect("bind mock server");
            let port = listener.local_addr().unwrap().port();
            let redirect_loc = format!("http://127.0.0.1:{port}/releases/tag/v0.3.0");
            let redirect_resp = format!(
                "HTTP/1.1 302 Found\r\nLocation: {redirect_loc}\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"
            );
            let final_ok = "HTTP/1.1 200 OK\r\nContent-Length: 0\r\nConnection: close\r\n\r\n".to_string();
            let responses = vec![rate_limited, redirect_resp, final_ok];
            let h = std::thread::spawn(move || {
                for resp in responses {
                    if let Ok((mut stream, _)) = listener.accept() {
                        let mut buf = [0u8; 2048];
                        let _ = stream.read(&mut buf);
                        let _ = stream.write_all(resp.as_bytes());
                        let _ = stream.flush();
                    }
                }
            });
            (port, h)
        };

        let base = format!("http://127.0.0.1:{port}");
        let res = check_for_updates_with_endpoints(
            "0.1.1",
            "macos",
            "aarch64",
            &format!("{base}/api/latest"),
            &format!("{base}/api/releases"),
            &format!("{base}/releases/latest"),
        )
        .await
        .expect("e2e 403 redirect fallback should succeed");

        let _ = handle.join();
        assert!(res.has_update);
        assert_eq!(res.latest_version, "0.3.0");
        assert_eq!(res.tag_name, "v0.3.0");
        assert_eq!(res.checked_via, "github-redirect");
    }

    #[tokio::test]
    async fn e2e_curl_404_falls_back_to_releases_list_no_release() {
        let not_found = "HTTP/1.1 404 Not Found\r\nContent-Length: 2\r\nConnection: close\r\n\r\n{}".to_string();
        let empty_list = "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: 2\r\nConnection: close\r\n\r\n[]".to_string();
        let (port, handle) = spawn_mock_http_server(vec![not_found, empty_list]);
        let base = format!("http://127.0.0.1:{port}");

        let res = check_for_updates_with_endpoints(
            "0.1.1",
            "macos",
            "aarch64",
            &format!("{base}/api/latest"),
            &format!("{base}/api/releases"),
            &format!("{base}/releases/latest"),
        )
        .await
        .expect("e2e 404 empty list fallback should succeed");

        let _ = handle.join();
        assert!(!res.has_update);
        assert_eq!(res.checked_via, "no-release");
        assert_eq!(res.latest_version, "0.1.1");
    }
}
