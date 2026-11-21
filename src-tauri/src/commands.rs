use crate::app_icon::apply_dock_icon;
use crate::app_menu::refresh_app_menu;
use crate::fvm::env::append_fvm_path_to_zshrc;
use crate::fvm::models::{
    CliStreamEvent, DoctorOutput, ReleasesResponse, SpawnStreamEvent, SpawnTaskRequest,
    WorkspaceSnapshot,
};
use crate::fvm::runner::{
    fetch_releases, fetch_workspace_snapshot, run_doctor, run_spawn_matrix, stream_fvm_command,
    CancelRegistry,
};
use crate::i18n::{current_language_state, set_language_preference, LanguageState};
use crate::proxy::{
    detect_system_proxy as detect_sys_proxy, get_current_proxy_settings,
    test_proxy_connectivity as run_proxy_test, update_proxy_settings, ProxySettings,
    ProxyTestResult, SystemProxyInfo,
};
use crate::tray::{refresh_tray_language, update_tray_state};
use std::sync::Arc;
use tauri::ipc::Channel;
use tauri::{AppHandle, State};

pub struct AppState {
    pub cancel_registry: Arc<CancelRegistry>,
}

#[tauri::command]
pub async fn get_workspace_snapshot(
    app: AppHandle,
    extra_projects: Option<Vec<String>>,
) -> Result<WorkspaceSnapshot, String> {
    let snapshot = fetch_workspace_snapshot(extra_projects.unwrap_or_default()).await?;
    let names: Vec<String> = snapshot.versions.iter().map(|v| v.name.clone()).collect();
    update_tray_state(
        &app,
        snapshot.context.global_version.as_deref(),
        &names,
        &snapshot.total_cache_size_label,
    );
    Ok(snapshot)
}

#[tauri::command]
pub async fn get_releases(
    limit: Option<u32>,
    channel: Option<String>,
) -> Result<ReleasesResponse, String> {
    fetch_releases(limit, channel).await
}

#[tauri::command]
pub async fn run_fvm_stream(
    request_id: String,
    args: Vec<String>,
    cwd: Option<String>,
    on_event: Channel<CliStreamEvent>,
    state: State<'_, AppState>,
) -> Result<i32, String> {
    stream_fvm_command(
        request_id,
        args,
        cwd,
        on_event,
        state.cancel_registry.clone(),
    )
    .await
}

#[tauri::command]
pub fn cancel_fvm_request(request_id: String, state: State<'_, AppState>) -> bool {
    state.cancel_registry.cancel(&request_id)
}

#[tauri::command]
pub async fn execute_spawn_matrix(
    request_id: String,
    cwd: Option<String>,
    tasks: Vec<SpawnTaskRequest>,
    on_event: Channel<SpawnStreamEvent>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    run_spawn_matrix(
        request_id,
        cwd,
        tasks,
        on_event,
        state.cancel_registry.clone(),
    )
    .await
}

#[tauri::command]
pub async fn get_doctor_report(cwd: Option<String>) -> Result<DoctorOutput, String> {
    run_doctor(cwd).await
}

#[tauri::command]
pub fn fix_zshrc_path() -> Result<String, String> {
    append_fvm_path_to_zshrc()
}

#[tauri::command]
pub fn set_app_icon(app: AppHandle, style: String) -> Result<String, String> {
    apply_dock_icon(&app, &style)
}

#[tauri::command]
pub fn get_proxy_settings() -> ProxySettings {
    get_current_proxy_settings()
}

#[tauri::command]
pub fn set_proxy_settings(
    app: AppHandle,
    settings: ProxySettings,
) -> Result<ProxySettings, String> {
    update_proxy_settings(&app, settings)
}

#[tauri::command]
pub async fn detect_system_proxy() -> SystemProxyInfo {
    detect_sys_proxy().await
}

#[tauri::command]
pub async fn test_proxy_connectivity(
    settings: ProxySettings,
    target_url: Option<String>,
) -> Result<ProxyTestResult, String> {
    run_proxy_test(settings, target_url).await
}

#[tauri::command]
pub fn get_app_language() -> LanguageState {
    current_language_state()
}

#[tauri::command]
pub fn set_app_language(app: AppHandle, language: String) -> Result<LanguageState, String> {
    let state = set_language_preference(&app, &language)?;
    if let Err(err) = refresh_app_menu(&app) {
        eprintln!("Warning: failed to refresh macOS app menu after language change: {err}");
    }
    refresh_tray_language(&app);
    Ok(state)
}
