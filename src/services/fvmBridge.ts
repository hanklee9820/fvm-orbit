import { Channel, invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { revealItemInDir, openUrl } from "@tauri-apps/plugin-opener";
import type {
  CliStreamEvent,
  DoctorOutput,
  LanguagePreference,
  LanguageState,
  ProxySettings,
  ProxyTestResult,
  ReleasesResponse,
  SpawnStreamEvent,
  SpawnTaskRequest,
  SystemProxyInfo,
  WorkspaceSnapshot,
} from "../types/fvm";

export function isTauriRuntime(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export async function fetchWorkspaceSnapshot(
  extraProjects: string[] = []
): Promise<WorkspaceSnapshot> {
  return invoke<WorkspaceSnapshot>("get_workspace_snapshot", {
    extraProjects,
  });
}

export async function fetchReleases(
  limit?: number,
  channel?: string
): Promise<ReleasesResponse> {
  return invoke<ReleasesResponse>("get_releases", {
    limit: limit ?? 60,
    channel: channel && channel !== "all" ? channel : null,
  });
}

export async function streamFvmCommand(
  requestId: string,
  args: string[],
  cwd: string | undefined,
  onEvent: (evt: CliStreamEvent) => void
): Promise<number> {
  const channel = new Channel<CliStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<number>("run_fvm_stream", {
    requestId,
    args,
    cwd: cwd ?? null,
    onEvent: channel,
  });
}

export async function cancelFvmRequest(requestId: string): Promise<boolean> {
  return invoke<boolean>("cancel_fvm_request", { requestId });
}

export async function executeSpawnMatrix(
  requestId: string,
  cwd: string | undefined,
  tasks: SpawnTaskRequest[],
  onEvent: (evt: SpawnStreamEvent) => void
): Promise<void> {
  const channel = new Channel<SpawnStreamEvent>();
  channel.onmessage = onEvent;
  return invoke<void>("execute_spawn_matrix", {
    requestId,
    cwd: cwd ?? null,
    tasks,
    onEvent: channel,
  });
}

export async function fetchDoctorReport(cwd?: string): Promise<DoctorOutput> {
  return invoke<DoctorOutput>("get_doctor_report", { cwd: cwd ?? null });
}

export async function applyZshrcPathFix(): Promise<string> {
  return invoke<string>("fix_zshrc_path");
}

export async function applyNativeAppIcon(effectiveStyle: "dark" | "light"): Promise<void> {
  if (!isTauriRuntime()) return;
  await invoke<string>("set_app_icon", { style: effectiveStyle });
}

export async function fetchProxySettings(): Promise<ProxySettings> {
  return invoke<ProxySettings>("get_proxy_settings");
}

export async function saveProxySettings(settings: ProxySettings): Promise<ProxySettings> {
  return invoke<ProxySettings>("set_proxy_settings", { settings });
}

export async function detectSystemProxy(): Promise<SystemProxyInfo> {
  return invoke<SystemProxyInfo>("detect_system_proxy");
}

export async function testProxyConnectivity(
  settings: ProxySettings,
  targetUrl?: string
): Promise<ProxyTestResult> {
  return invoke<ProxyTestResult>("test_proxy_connectivity", {
    settings,
    targetUrl: targetUrl ?? null,
  });
}

export async function fetchAppLanguage(): Promise<LanguageState> {
  return invoke<LanguageState>("get_app_language");
}

export async function saveAppLanguage(language: LanguagePreference): Promise<LanguageState> {
  return invoke<LanguageState>("set_app_language", { language });
}

export async function pickDirectoryDialog(title: string): Promise<string | null> {
  if (!isTauriRuntime()) return null;
  const selected = await openDialog({
    directory: true,
    multiple: false,
    title,
  });
  if (typeof selected === "string") return selected;
  return null;
}

export async function revealPathInFinder(path: string): Promise<void> {
  if (!isTauriRuntime()) return;
  await revealItemInDir(path);
}

export async function openExternalUrl(url: string): Promise<void> {
  if (!isTauriRuntime()) {
    window.open(url, "_blank", "noopener,noreferrer");
    return;
  }
  await openUrl(url);
}

export async function subscribeNativeEvents(handlers: {
  onFsChanged: () => void;
  onNavigate: (tab: string) => void;
  onRefresh: () => void;
  onTraySetGlobal: (version: string) => void;
  onOpenSettings: () => void;
}): Promise<UnlistenFn[]> {
  if (!isTauriRuntime()) return [];
  return Promise.all([
    listen("fvm://fs-changed", () => handlers.onFsChanged()),
    listen<string>("fvm://navigate", (e) => handlers.onNavigate(e.payload)),
    listen("fvm://refresh", () => handlers.onRefresh()),
    listen<string>("fvm://tray-set-global", (e) => handlers.onTraySetGlobal(e.payload)),
    listen("fvm://open-settings", () => handlers.onOpenSettings()),
  ]);
}
