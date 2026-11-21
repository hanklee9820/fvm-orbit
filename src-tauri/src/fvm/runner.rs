use crate::fvm::env::{check_path_priority, resolve_fvm_binary, resolved_path_env};
use crate::fvm::models::{
    CachedSdkInfo, ChannelHead, CleanupAction, CleanupReport, CliStreamEvent, DoctorOutput,
    ForkEntry, FvmContextInfo, PatchUpgradeItem, ProjectInfo, ReleaseItem, ReleasesResponse,
    SpawnStreamEvent, SpawnTaskRequest, WorkspaceSnapshot,
};
use parking_lot::Mutex;
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use std::process::Stdio;
use std::sync::Arc;
use std::time::Instant;
use tauri::ipc::Channel;
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::Command;
use tokio_util::sync::CancellationToken;
use walkdir::WalkDir;

#[derive(Default)]
pub struct CancelRegistry {
    tokens: Mutex<HashMap<String, CancellationToken>>,
}

impl CancelRegistry {
    pub fn register(&self, request_id: &str) -> CancellationToken {
        let token = CancellationToken::new();
        self.tokens.lock().insert(request_id.to_string(), token.clone());
        token
    }

    pub fn cancel(&self, request_id: &str) -> bool {
        if let Some(token) = self.tokens.lock().remove(request_id) {
            token.cancel();
            true
        } else {
            false
        }
    }

    pub fn remove(&self, request_id: &str) {
        self.tokens.lock().remove(request_id);
    }
}

fn build_fvm_cmd(args: &[String], cwd: Option<&str>) -> Command {
    let mut cmd = Command::new(resolve_fvm_binary());
    cmd.args(args)
        .env("PATH", resolved_path_env())
        .env("NO_COLOR", "1")
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    if let Some(dir) = cwd {
        if !dir.trim().is_empty() && Path::new(dir).is_dir() {
            cmd.current_dir(dir);
        }
    }
    cmd
}

fn consume_st_or_bel(chars: &mut std::iter::Peekable<std::str::Chars<'_>>, allow_bel: bool) {
    while let Some(c) = chars.next() {
        if allow_bel && c == '\x07' {
            break;
        }
        if c == '\u{009c}' {
            break;
        }
        if c == '\x1b' && chars.peek() == Some(&'\\') {
            chars.next();
            break;
        }
    }
}

/// Strips ANSI/VT escape sequences (CSI, OSC, DCS/SOS/PM/APC, charset, 2-byte ESC),
/// normalizes CRLF, resolves standalone CR spinner overwrites, and removes stray control characters
/// while preserving Unicode text (including box-drawing characters, CJK, and emoji).
pub fn strip_ansi_codes(input: &str) -> String {
    let mut out = String::with_capacity(input.len());
    let mut chars = input.chars().peekable();

    while let Some(ch) = chars.next() {
        match ch {
            '\x1b' => match chars.peek().copied() {
                // CSI: ESC [ <params 0x30..=0x3F>* <intermediates 0x20..=0x2F>* <final 0x40..=0x7E>
                Some('[') => {
                    chars.next();
                    while let Some(&c) = chars.peek() {
                        if c == '\n' || c == '\x1b' {
                            break;
                        }
                        chars.next();
                        if ('@'..='~').contains(&c) {
                            break;
                        }
                    }
                }
                // OSC: ESC ] ... (BEL | ST)
                Some(']') => {
                    chars.next();
                    consume_st_or_bel(&mut chars, true);
                }
                // DCS / SOS / PM / APC: ESC (P | X | ^ | _) ... ST
                Some('P' | 'X' | '^' | '_') => {
                    chars.next();
                    consume_st_or_bel(&mut chars, false);
                }
                // nF sequence: ESC <intermediate 0x20..=0x2F>+ <final 0x30..=0x7E>
                Some(c) if (' '..='/').contains(&c) => {
                    chars.next();
                    while let Some(&next_c) = chars.peek() {
                        if next_c == '\n' || next_c == '\x1b' {
                            break;
                        }
                        chars.next();
                        if ('0'..='~').contains(&next_c) {
                            break;
                        }
                    }
                }
                // 2-byte ESC sequence: ESC <0x30..=0x7E>
                Some(c) if ('0'..='~').contains(&c) => {
                    chars.next();
                }
                // Lone or trailing ESC
                _ => {}
            },
            // 8-bit CSI (U+009B)
            '\u{009b}' => {
                while let Some(&c) = chars.peek() {
                    if c == '\n' || c == '\x1b' {
                        break;
                    }
                    chars.next();
                    if ('@'..='~').contains(&c) {
                        break;
                    }
                }
            }
            // 8-bit OSC (U+009D)
            '\u{009d}' => {
                consume_st_or_bel(&mut chars, true);
            }
            // 8-bit DCS / SOS / PM / APC
            '\u{0090}' | '\u{0098}' | '\u{009e}' | '\u{009f}' => {
                consume_st_or_bel(&mut chars, false);
            }
            // Normalize CRLF; keep standalone CR for line-overwrite resolution below
            '\r' => {
                if chars.peek() == Some(&'\n') {
                    chars.next();
                    out.push('\n');
                } else {
                    out.push('\r');
                }
            }
            '\n' | '\t' => out.push(ch),
            c if c.is_control() => {}
            other => out.push(other),
        }
    }

    if out.contains('\r') {
        let mut cleaned = String::with_capacity(out.len());
        for (idx, line) in out.split('\n').enumerate() {
            if idx > 0 {
                cleaned.push('\n');
            }
            if line.contains('\r') {
                let effective = line
                    .split('\r')
                    .rev()
                    .find(|seg| !seg.is_empty())
                    .unwrap_or("");
                cleaned.push_str(effective);
            } else {
                cleaned.push_str(line);
            }
        }
        return cleaned;
    }

    out
}

/// Extracts the JSON object/array from stdout even if FVM prints an update banner or warning preamble.
fn extract_json_payload(raw: &str) -> Result<Value, String> {
    let trimmed = raw.trim();
    if let Ok(v) = serde_json::from_str::<Value>(trimmed) {
        return Ok(v);
    }
    if let Some(start) = trimmed.find('{') {
        if let Some(end) = trimmed.rfind('}') {
            if end >= start {
                if let Ok(v) = serde_json::from_str::<Value>(&trimmed[start..=end]) {
                    return Ok(v);
                }
            }
        }
    }
    Err(format!(
        "无法解析 FVM JSON 输出: {}",
        strip_ansi_codes(trimmed).chars().take(240).collect::<String>()
    ))
}

pub async fn run_fvm_json(args: &[&str], cwd: Option<&str>) -> Result<Value, String> {
    let arg_vec: Vec<String> = args.iter().map(|s| s.to_string()).collect();
    let output = build_fvm_cmd(&arg_vec, cwd)
        .output()
        .await
        .map_err(|e| format!("无法执行 fvm ({}) : {e}", resolve_fvm_binary()))?;

    let stdout = String::from_utf8_lossy(&output.stdout).to_string();
    let stderr = strip_ansi_codes(&String::from_utf8_lossy(&output.stderr));

    if !output.status.success() && stdout.trim().is_empty() {
        return Err(format!(
            "fvm {} 执行失败 (exit {:?}): {}",
            args.join(" "),
            output.status.code(),
            stderr.trim()
        ));
    }

    extract_json_payload(&stdout).map_err(|err| {
        if stderr.trim().is_empty() {
            err
        } else {
            format!("{err} | stderr: {}", stderr.trim())
        }
    })
}

fn dir_size_bytes(path: &Path) -> u64 {
    if !path.exists() {
        return 0;
    }
    WalkDir::new(path)
        .follow_links(false)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter_map(|e| e.metadata().ok())
        .filter(|m| m.is_file())
        .map(|m| m.len())
        .sum()
}

fn resolve_global_version(global_link: &str) -> Option<String> {
    let link_path = Path::new(global_link);
    let target = std::fs::read_link(link_path).ok()?;
    target
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .filter(|s| !s.is_empty())
}

fn parse_release_item(v: &Value) -> ReleaseItem {
    ReleaseItem {
        version: v.get("version").and_then(Value::as_str).unwrap_or_default().to_string(),
        channel: v
            .get("channel")
            .or_else(|| v.get("channelName"))
            .and_then(Value::as_str)
            .unwrap_or("stable")
            .to_string(),
        release_date: v
            .get("release_date")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        hash: v.get("hash").and_then(Value::as_str).unwrap_or_default().to_string(),
        dart_sdk_version: v
            .get("dart_sdk_version")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        dart_sdk_arch: v
            .get("dart_sdk_arch")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        active_channel: v.get("active_channel").and_then(Value::as_bool).unwrap_or(false),
        archive_url: v
            .get("archiveUrl")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        sha256: v.get("sha256").and_then(Value::as_str).unwrap_or_default().to_string(),
    }
}

fn inspect_project_fs(path_str: &str, raw_project: &Value) -> ProjectInfo {
    let dir = Path::new(path_str);
    let name = raw_project
        .get("name")
        .and_then(Value::as_str)
        .filter(|s| !s.is_empty())
        .map(String::from)
        .or_else(|| dir.file_name().map(|n| n.to_string_lossy().to_string()))
        .unwrap_or_else(|| path_str.to_string());

    // pinnedVersion can be null, a string, or an object { name: "..." }
    let pinned_version = raw_project.get("pinnedVersion").and_then(|pv| {
        if let Some(s) = pv.as_str() {
            Some(s.to_string())
        } else {
            pv.get("name").and_then(Value::as_str).map(String::from)
        }
    });

    let active_flavor = raw_project
        .get("activeFlavor")
        .and_then(Value::as_str)
        .map(String::from);

    let mut flavors = HashMap::new();
    if let Some(obj) = raw_project.get("flavors").and_then(Value::as_object) {
        for (k, v) in obj {
            if let Some(s) = v.as_str() {
                flavors.insert(k.clone(), s.to_string());
            } else if let Some(s) = v.get("name").and_then(Value::as_str) {
                flavors.insert(k.clone(), s.to_string());
            }
        }
    }

    let fvmrc_path = dir.join(".fvmrc");
    let fvmrc_raw = std::fs::read_to_string(&fvmrc_path).ok();
    let has_melos = dir.join("melos.yaml").is_file();

    let vscode_settings = std::fs::read_to_string(dir.join(".vscode/settings.json")).ok();
    let vscode_synced = vscode_settings
        .as_deref()
        .map(|s| s.contains(".fvm/flutter_sdk"))
        .unwrap_or(false);

    let idea_dir = dir.join(".idea");
    let has_idea_dir = idea_dir.is_dir();
    let idea_synced = if has_idea_dir {
        // Check workspace.xml or libraries/Dart_SDK.xml for .fvm/flutter_sdk
        let dart_lib = std::fs::read_to_string(idea_dir.join("libraries/Dart_SDK.xml")).ok();
        let local_props = std::fs::read_to_string(dir.join("android/local.properties")).ok();
        dart_lib
            .as_deref()
            .map(|s| s.contains(".fvm/flutter_sdk"))
            .unwrap_or(false)
            || local_props
                .as_deref()
                .map(|s| s.contains(".fvm/flutter_sdk"))
                .unwrap_or(false)
    } else {
        false
    };

    let symlink_exists = dir.join(".fvm/flutter_sdk").exists();

    ProjectInfo {
        id: path_str.to_string(),
        name,
        path: path_str.to_string(),
        pinned_version,
        active_flavor,
        flavors,
        is_flutter: raw_project
            .get("isFlutter")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        has_config: raw_project
            .get("hasConfig")
            .and_then(Value::as_bool)
            .unwrap_or(fvmrc_path.is_file()),
        has_melos,
        vscode_synced,
        idea_synced,
        has_idea_dir,
        symlink_exists,
        fvmrc_raw,
    }
}

pub async fn fetch_workspace_snapshot(extra_project_paths: Vec<String>) -> Result<WorkspaceSnapshot, String> {
    let (ctx_res, list_res, cleanup_res) = tokio::join!(
        run_fvm_json(&["api", "context", "--compress"], None),
        run_fvm_json(&["api", "list", "--compress"], None),
        run_fvm_json(&["api", "cleanup", "--compress"], None),
    );

    let ctx_val = ctx_res?;
    let list_val = list_res?;
    let cleanup_val = cleanup_res.unwrap_or_else(|_| serde_json::json!({}));

    let c = ctx_val.get("context").unwrap_or(&ctx_val);
    let global_cache_link = c
        .get("globalCacheLink")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let global_cache_bin_path = c
        .get("globalCacheBinPath")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();
    let git_cache_path = c
        .get("gitCachePath")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_string();

    let global_version = resolve_global_version(&global_cache_link);
    let (active_flutter_path, path_priority_ok) = check_path_priority(&global_cache_bin_path);

    let mut forks = Vec::new();
    if let Some(arr) = c
        .get("config")
        .and_then(|cfg| cfg.get("forks"))
        .and_then(Value::as_array)
    {
        for item in arr {
            if let (Some(name), Some(url)) = (
                item.get("name").and_then(Value::as_str),
                item.get("url").and_then(Value::as_str),
            ) {
                forks.push(ForkEntry {
                    name: name.to_string(),
                    url: url.to_string(),
                });
            }
        }
    }

    let unreferenced_versions: Vec<String> = list_val
        .get("unreferencedVersions")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();
    let unref_set: HashSet<String> = unreferenced_versions.iter().cloned().collect();

    // Parse versions and compute exact per-SDK disk sizes off the async worker pool
    let raw_versions = list_val
        .get("versions")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let sdk_dirs: Vec<String> = raw_versions
        .iter()
        .map(|v| {
            v.get("directory")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string()
        })
        .collect();
    let git_cache_clone = git_cache_path.clone();

    let (sdk_sizes, git_cache_bytes) = tokio::task::spawn_blocking(move || {
        let sizes: Vec<u64> = sdk_dirs
            .iter()
            .map(|d| dir_size_bytes(Path::new(d)))
            .collect();
        let gc = dir_size_bytes(Path::new(&git_cache_clone));
        (sizes, gc)
    })
    .await
    .unwrap_or_else(|_| (vec![0; raw_versions.len()], 0));

    let mut versions = Vec::with_capacity(raw_versions.len());
    let mut total_cache_bytes: u64 = 0;

    for (idx, v) in raw_versions.iter().enumerate() {
        let name = v
            .get("name")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string();
        let size_bytes = sdk_sizes.get(idx).copied().unwrap_or(0);
        total_cache_bytes += size_bytes;
        let is_global = global_version.as_deref() == Some(name.as_str());
        versions.push(CachedSdkInfo {
            is_unreferenced: unref_set.contains(&name),
            is_global,
            name,
            directory: v
                .get("directory")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            release_from_channel: v
                .get("releaseFromChannel")
                .and_then(Value::as_str)
                .map(String::from),
            sdk_type: v
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("release")
                .to_string(),
            bin_path: v
                .get("binPath")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .to_string(),
            flutter_sdk_version: v
                .get("flutterSdkVersion")
                .and_then(Value::as_str)
                .map(String::from),
            dart_sdk_version: v
                .get("dartSdkVersion")
                .and_then(Value::as_str)
                .map(String::from),
            is_setup: v.get("isSetup").and_then(Value::as_bool).unwrap_or(false),
            size_bytes,
        });
    }

    // Collect unique tracked projects (FVM projects registry + extra user-added paths)
    let mut project_paths: Vec<String> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();
    if let Some(arr) = list_val.get("projects").and_then(Value::as_array) {
        for p in arr.iter().filter_map(Value::as_str) {
            if Path::new(p).is_dir() && seen_paths.insert(p.to_string()) {
                project_paths.push(p.to_string());
            }
        }
    }
    for p in extra_project_paths {
        if Path::new(&p).is_dir() && seen_paths.insert(p.clone()) {
            project_paths.push(p);
        }
    }

    // Query `fvm api project --path <dir>` concurrently for all tracked projects
    let mut project_handles = Vec::new();
    for p in project_paths {
        project_handles.push(tokio::spawn(async move {
            let res = run_fvm_json(&["api", "project", "--compress", "--path", &p], None).await;
            let raw = res
                .ok()
                .and_then(|v| v.get("project").cloned())
                .unwrap_or_else(|| serde_json::json!({}));
            inspect_project_fs(&p, &raw)
        }));
    }

    let mut projects = Vec::new();
    for h in project_handles {
        if let Ok(info) = h.await {
            projects.push(info);
        }
    }

    // Parse cleanup report
    let upgrades: Vec<PatchUpgradeItem> = cleanup_val
        .get("upgrades")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .map(|u| PatchUpgradeItem {
                    from_version: u
                        .get("fromVersion")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    to_version: u
                        .get("toVersion")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    reason: u
                        .get("reason")
                        .and_then(Value::as_str)
                        .unwrap_or_default()
                        .to_string(),
                    actions: u
                        .get("actions")
                        .and_then(Value::as_array)
                        .map(|acts| {
                            acts.iter()
                                .map(|a| CleanupAction {
                                    arguments: a
                                        .get("arguments")
                                        .and_then(Value::as_array)
                                        .map(|items| {
                                            items
                                                .iter()
                                                .filter_map(Value::as_str)
                                                .map(String::from)
                                                .collect()
                                        })
                                        .unwrap_or_default(),
                                    working_directory: a
                                        .get("workingDirectory")
                                        .and_then(Value::as_str)
                                        .map(String::from),
                                })
                                .collect()
                        })
                        .unwrap_or_default(),
                })
                .collect()
        })
        .unwrap_or_default();

    let unused: Vec<String> = cleanup_val
        .get("unused")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_else(|| unreferenced_versions.clone());

    let removable: Vec<String> = cleanup_val
        .get("removable")
        .and_then(Value::as_array)
        .map(|arr| {
            arr.iter()
                .filter_map(Value::as_str)
                .map(String::from)
                .collect()
        })
        .unwrap_or_default();

    let context = FvmContextInfo {
        fvm_version: c
            .get("fvmVersion")
            .and_then(Value::as_str)
            .unwrap_or("unknown")
            .to_string(),
        fvm_bin: resolve_fvm_binary().to_string(),
        fvm_dir: c
            .get("fvmDir")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        versions_cache_path: c
            .get("versionsCachePath")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        git_cache_path,
        global_cache_link,
        global_cache_bin_path,
        projects_registry_path: c
            .get("projectsRegistryPath")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        app_config_path: c
            .get("appConfigPath")
            .and_then(Value::as_str)
            .unwrap_or_default()
            .to_string(),
        flutter_url: c
            .get("flutterUrl")
            .and_then(Value::as_str)
            .unwrap_or("https://github.com/flutter/flutter.git")
            .to_string(),
        git_cache: c.get("gitCache").and_then(Value::as_bool).unwrap_or(true),
        update_check_disabled: c
            .get("updateCheckDisabled")
            .and_then(Value::as_bool)
            .unwrap_or(false),
        run_pub_get_on_sdk_changes: c
            .get("runPubGetOnSdkChanges")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        privileged_access: c
            .get("privilegedAccess")
            .and_then(Value::as_bool)
            .unwrap_or(true),
        global_version,
        forks,
        active_flutter_path,
        path_priority_ok,
        os_label: std::env::consts::OS.to_string(),
        arch_label: std::env::consts::ARCH.to_string(),
        git_cache_bytes,
    };

    Ok(WorkspaceSnapshot {
        context,
        total_cache_size_label: list_val
            .get("size")
            .and_then(Value::as_str)
            .unwrap_or("0 B")
            .to_string(),
        total_cache_bytes,
        versions,
        projects,
        unreferenced_versions,
        cleanup: CleanupReport {
            upgrades,
            unused,
            removable,
        },
    })
}

pub async fn fetch_releases(limit: Option<u32>, channel: Option<String>) -> Result<ReleasesResponse, String> {
    let mut args: Vec<String> = vec![
        "api".into(),
        "releases".into(),
        "--compress".into(),
    ];
    if let Some(lim) = limit {
        args.push(format!("--limit={lim}"));
    }
    if let Some(ch) = channel {
        if matches!(ch.as_str(), "stable" | "beta" | "dev") {
            args.push("--filter-channel".into());
            args.push(ch);
        }
    }
    let arg_refs: Vec<&str> = args.iter().map(String::as_str).collect();
    let val = run_fvm_json(&arg_refs, None).await?;

    let versions: Vec<ReleaseItem> = val
        .get("versions")
        .and_then(Value::as_array)
        .map(|arr| arr.iter().map(parse_release_item).collect())
        .unwrap_or_default();

    let ch_obj = val.get("channels");
    let channels = ChannelHead {
        stable: ch_obj.and_then(|c| c.get("stable")).map(parse_release_item),
        beta: ch_obj.and_then(|c| c.get("beta")).map(parse_release_item),
        dev: ch_obj.and_then(|c| c.get("dev")).map(parse_release_item),
    };

    Ok(ReleasesResponse { versions, channels })
}

pub async fn run_doctor(cwd: Option<String>) -> Result<DoctorOutput, String> {
    let args = vec!["doctor".to_string()];
    let output = build_fvm_cmd(&args, cwd.as_deref())
        .output()
        .await
        .map_err(|e| format!("无法执行 fvm doctor: {e}"))?;
    let stdout = strip_ansi_codes(&String::from_utf8_lossy(&output.stdout));
    let stderr = strip_ansi_codes(&String::from_utf8_lossy(&output.stderr));
    let combined = if stderr.trim().is_empty() {
        stdout
    } else if stdout.trim().is_empty() {
        stderr
    } else {
        format!("{stdout}\n{stderr}")
    };
    Ok(DoctorOutput {
        raw_output: combined,
        exit_code: output.status.code().unwrap_or(-1),
    })
}

/// Streams a real `fvm ...` subprocess line-by-line to the frontend via Tauri v2 `Channel<CliStreamEvent>`.
pub async fn stream_fvm_command(
    request_id: String,
    args: Vec<String>,
    cwd: Option<String>,
    on_event: Channel<CliStreamEvent>,
    cancel_registry: Arc<CancelRegistry>,
) -> Result<i32, String> {
    let started = Instant::now();
    let token = cancel_registry.register(&request_id);

    let _ = on_event.send(CliStreamEvent {
        request_id: request_id.clone(),
        kind: "started".into(),
        line: Some(format!("fvm {}", args.join(" "))),
        exit_code: None,
        duration_ms: None,
    });

    let mut child = match build_fvm_cmd(&args, cwd.as_deref()).spawn() {
        Ok(c) => c,
        Err(e) => {
            cancel_registry.remove(&request_id);
            let msg = format!("启动进程失败: {e}");
            let _ = on_event.send(CliStreamEvent {
                request_id: request_id.clone(),
                kind: "error".into(),
                line: Some(msg.clone()),
                exit_code: Some(-1),
                duration_ms: Some(started.elapsed().as_millis() as u64),
            });
            return Err(msg);
        }
    };

    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    let req_out = request_id.clone();
    let ch_out = on_event.clone();
    let out_task = tokio::spawn(async move {
        if let Some(s) = stdout {
            let mut reader = BufReader::new(s).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = ch_out.send(CliStreamEvent {
                    request_id: req_out.clone(),
                    kind: "stdout".into(),
                    line: Some(strip_ansi_codes(&line)),
                    exit_code: None,
                    duration_ms: None,
                });
            }
        }
    });

    let req_err = request_id.clone();
    let ch_err = on_event.clone();
    let err_task = tokio::spawn(async move {
        if let Some(s) = stderr {
            let mut reader = BufReader::new(s).lines();
            while let Ok(Some(line)) = reader.next_line().await {
                let _ = ch_err.send(CliStreamEvent {
                    request_id: req_err.clone(),
                    kind: "stderr".into(),
                    line: Some(strip_ansi_codes(&line)),
                    exit_code: None,
                    duration_ms: None,
                });
            }
        }
    });

    let exit_code: i32;
    let cancelled: bool;

    tokio::select! {
        _ = token.cancelled() => {
            let _ = child.kill().await;
            cancelled = true;
            exit_code = -2;
        }
        status = child.wait() => {
            cancelled = false;
            exit_code = status.ok().and_then(|s| s.code()).unwrap_or(-1);
        }
    }

    let _ = out_task.await;
    let _ = err_task.await;
    cancel_registry.remove(&request_id);

    let duration_ms = started.elapsed().as_millis() as u64;
    let _ = on_event.send(CliStreamEvent {
        request_id,
        kind: if cancelled { "cancelled" } else { "finished" }.into(),
        line: None,
        exit_code: Some(exit_code),
        duration_ms: Some(duration_ms),
    });

    Ok(exit_code)
}

/// Runs multiple `fvm spawn / flavor / exec` tasks concurrently and streams per-task output.
pub async fn run_spawn_matrix(
    request_id: String,
    cwd: Option<String>,
    tasks: Vec<SpawnTaskRequest>,
    on_event: Channel<SpawnStreamEvent>,
    cancel_registry: Arc<CancelRegistry>,
) -> Result<(), String> {
    let parent_token = cancel_registry.register(&request_id);
    let mut handles = Vec::with_capacity(tasks.len());

    for task in tasks {
        let req_id = request_id.clone();
        let work_dir = cwd.clone();
        let ch = on_event.clone();
        let token = parent_token.child_token();

        handles.push(tokio::spawn(async move {
            let started = Instant::now();
            let _ = ch.send(SpawnStreamEvent {
                request_id: req_id.clone(),
                task_id: task.id.clone(),
                label: task.label.clone(),
                kind: "started".into(),
                line: Some(format!("fvm {}", task.args.join(" "))),
                exit_code: None,
                duration_ms: None,
            });

            let mut child = match build_fvm_cmd(&task.args, work_dir.as_deref()).spawn() {
                Ok(c) => c,
                Err(e) => {
                    let _ = ch.send(SpawnStreamEvent {
                        request_id: req_id,
                        task_id: task.id,
                        label: task.label,
                        kind: "error".into(),
                        line: Some(format!("启动失败: {e}")),
                        exit_code: Some(-1),
                        duration_ms: Some(started.elapsed().as_millis() as u64),
                    });
                    return;
                }
            };

            let stdout = child.stdout.take();
            let stderr = child.stderr.take();

            let (r1, t1, l1, c1) = (req_id.clone(), task.id.clone(), task.label.clone(), ch.clone());
            let out_h = tokio::spawn(async move {
                if let Some(s) = stdout {
                    let mut lines = BufReader::new(s).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = c1.send(SpawnStreamEvent {
                            request_id: r1.clone(),
                            task_id: t1.clone(),
                            label: l1.clone(),
                            kind: "stdout".into(),
                            line: Some(strip_ansi_codes(&line)),
                            exit_code: None,
                            duration_ms: None,
                        });
                    }
                }
            });

            let (r2, t2, l2, c2) = (req_id.clone(), task.id.clone(), task.label.clone(), ch.clone());
            let err_h = tokio::spawn(async move {
                if let Some(s) = stderr {
                    let mut lines = BufReader::new(s).lines();
                    while let Ok(Some(line)) = lines.next_line().await {
                        let _ = c2.send(SpawnStreamEvent {
                            request_id: r2.clone(),
                            task_id: t2.clone(),
                            label: l2.clone(),
                            kind: "stderr".into(),
                            line: Some(strip_ansi_codes(&line)),
                            exit_code: None,
                            duration_ms: None,
                        });
                    }
                }
            });

            let (cancelled, exit_code) = tokio::select! {
                _ = token.cancelled() => {
                    let _ = child.kill().await;
                    (true, -2)
                }
                st = child.wait() => {
                    (false, st.ok().and_then(|s| s.code()).unwrap_or(-1))
                }
            };

            let _ = out_h.await;
            let _ = err_h.await;

            let _ = ch.send(SpawnStreamEvent {
                request_id: req_id,
                task_id: task.id,
                label: task.label,
                kind: if cancelled { "cancelled" } else { "finished" }.into(),
                line: None,
                exit_code: Some(exit_code),
                duration_ms: Some(started.elapsed().as_millis() as u64),
            });
        }));
    }

    for h in handles {
        let _ = h.await;
    }
    cancel_registry.remove(&request_id);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::strip_ansi_codes;

    #[test]
    fn strips_fvm_doctor_cli_table_ansi_sequences() {
        let raw = "\x1b[37m┌─────────┬───────────┐\x1b[m\n\
                   \x1b[37m│ \x1b[m\x1b[1mProject\x1b[m\x1b[37m │ \x1b[m\x1b[1msrc-tauri\x1b[m\x1b[37m │\x1b[m\n\
                   \x1b[37m└─────────┴───────────┘\x1b[m";
        let expected = "┌─────────┬───────────┐\n\
                        │ Project │ src-tauri │\n\
                        └─────────┴───────────┘";
        let cleaned = strip_ansi_codes(raw);
        assert_eq!(cleaned, expected);
        assert!(!cleaned.contains('\x1b'));
    }

    #[test]
    fn strips_csi_osc_and_spinner_carriage_returns() {
        let raw = "\x1b[?25l\x1b[38;2;59;130;246mChecking...\x1b[0m\r\x1b[2K\x1b]8;;https://fvm.app\x07✓ 就绪\x1b]8;;\x1b\\\x1b[?25h\r\n第二行\tOK";
        assert_eq!(strip_ansi_codes(raw), "✓ 就绪\n第二行\tOK");
    }
}
