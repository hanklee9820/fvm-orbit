use serde::{Deserialize, Serialize};
use std::collections::HashMap;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ForkEntry {
    pub name: String,
    pub url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct FvmContextInfo {
    pub fvm_version: String,
    pub fvm_bin: String,
    pub fvm_dir: String,
    pub versions_cache_path: String,
    pub git_cache_path: String,
    pub global_cache_link: String,
    pub global_cache_bin_path: String,
    pub projects_registry_path: String,
    pub app_config_path: String,
    pub flutter_url: String,
    pub git_cache: bool,
    pub update_check_disabled: bool,
    pub run_pub_get_on_sdk_changes: bool,
    pub privileged_access: bool,
    pub global_version: Option<String>,
    pub forks: Vec<ForkEntry>,
    pub active_flutter_path: Option<String>,
    pub path_priority_ok: bool,
    pub os_label: String,
    pub arch_label: String,
    pub git_cache_bytes: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CachedSdkInfo {
    pub name: String,
    pub directory: String,
    pub release_from_channel: Option<String>,
    pub sdk_type: String,
    pub bin_path: String,
    pub flutter_sdk_version: Option<String>,
    pub dart_sdk_version: Option<String>,
    pub is_setup: bool,
    pub size_bytes: u64,
    pub is_global: bool,
    pub is_unreferenced: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectInfo {
    pub id: String,
    pub name: String,
    pub path: String,
    pub pinned_version: Option<String>,
    pub active_flavor: Option<String>,
    pub flavors: HashMap<String, String>,
    pub is_flutter: bool,
    pub has_config: bool,
    pub has_melos: bool,
    pub vscode_synced: bool,
    pub idea_synced: bool,
    pub has_idea_dir: bool,
    pub symlink_exists: bool,
    pub fvmrc_raw: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleaseItem {
    pub version: String,
    pub channel: String,
    pub release_date: String,
    pub hash: String,
    pub dart_sdk_version: String,
    pub dart_sdk_arch: String,
    pub active_channel: bool,
    pub archive_url: String,
    pub sha256: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChannelHead {
    pub stable: Option<ReleaseItem>,
    pub beta: Option<ReleaseItem>,
    pub dev: Option<ReleaseItem>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReleasesResponse {
    pub versions: Vec<ReleaseItem>,
    pub channels: ChannelHead,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupAction {
    pub arguments: Vec<String>,
    pub working_directory: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchUpgradeItem {
    pub from_version: String,
    pub to_version: String,
    pub reason: String,
    pub actions: Vec<CleanupAction>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CleanupReport {
    pub upgrades: Vec<PatchUpgradeItem>,
    pub unused: Vec<String>,
    pub removable: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceSnapshot {
    pub context: FvmContextInfo,
    pub total_cache_size_label: String,
    pub total_cache_bytes: u64,
    pub versions: Vec<CachedSdkInfo>,
    pub projects: Vec<ProjectInfo>,
    pub unreferenced_versions: Vec<String>,
    pub cleanup: CleanupReport,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CliStreamEvent {
    pub request_id: String,
    pub kind: String, // "started" | "stdout" | "stderr" | "finished" | "cancelled" | "error"
    pub line: Option<String>,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnTaskRequest {
    pub id: String,
    pub label: String,
    pub args: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SpawnStreamEvent {
    pub request_id: String,
    pub task_id: String,
    pub label: String,
    pub kind: String, // "started" | "stdout" | "stderr" | "finished" | "cancelled" | "error"
    pub line: Option<String>,
    pub exit_code: Option<i32>,
    pub duration_ms: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DoctorOutput {
    pub raw_output: String,
    pub exit_code: i32,
}
