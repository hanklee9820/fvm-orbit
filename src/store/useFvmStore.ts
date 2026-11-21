import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  applyNativeAppIcon,
  applyZshrcPathFix,
  cancelFvmRequest,
  executeSpawnMatrix,
  fetchDoctorReport,
  fetchReleases,
  fetchWorkspaceSnapshot,
  isTauriRuntime,
  pickDirectoryDialog,
  streamFvmCommand,
} from "../services/fvmBridge";
import type {
  AppIconStyle,
  CliLogEntry,
  DoctorOutput,
  ReleasesResponse,
  SpawnTaskRequest,
  SpawnTaskResult,
  TabId,
  ThemeMode,
  ToastItem,
  WorkspaceSnapshot,
} from "../types/fvm";

const EXTRA_PROJECTS_KEY = "fvm_orbit_extra_projects";
const THEME_KEY = "fvm_orbit_theme";
const APP_ICON_STYLE_KEY = "fvm_orbit_app_icon_style";

function loadExtraProjects(): string[] {
  try {
    const raw = localStorage.getItem(EXTRA_PROJECTS_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveExtraProjects(list: string[]) {
  try {
    localStorage.setItem(EXTRA_PROJECTS_KEY, JSON.stringify(list));
  } catch {
    // ignore storage quota errors
  }
}

function loadTheme(): ThemeMode {
  try {
    const t = localStorage.getItem(THEME_KEY);
    if (t === "system" || t === "light" || t === "dark") return t;
  } catch {
    // ignore
  }
  return "system";
}

function loadAppIconStyle(): AppIconStyle {
  try {
    const s = localStorage.getItem(APP_ICON_STYLE_KEY);
    if (s === "dark" || s === "light" || s === "auto") return s;
  } catch {
    // ignore
  }
  return "dark";
}

export function resolveEffectiveTheme(mode: ThemeMode): "dark" | "light" {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }
  return mode;
}

export function resolveEffectiveAppIcon(
  iconStyle: AppIconStyle,
  theme: ThemeMode
): "dark" | "light" {
  if (iconStyle === "auto") {
    return resolveEffectiveTheme(theme);
  }
  return iconStyle;
}

export function syncNativeAppIcon(iconStyle: AppIconStyle, theme: ThemeMode) {
  const effective = resolveEffectiveAppIcon(iconStyle, theme);
  void applyNativeAppIcon(effective).catch(() => {});
}

export function applyThemeToDomAndWindow(mode: ThemeMode) {
  const effective = resolveEffectiveTheme(mode);
  document.documentElement.setAttribute("data-theme", effective);
  if (isTauriRuntime()) {
    void getCurrentWindow()
      .setTheme(mode === "system" ? null : mode)
      .catch(() => {});
  }
}

function nowTime(): string {
  return new Date().toTimeString().slice(0, 8);
}

function genId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i++;
  }
  return `${value.toFixed(i >= 2 ? 2 : 0)} ${units[i]}`;
}

interface FvmStoreState {
  activeTab: TabId;
  theme: ThemeMode;
  appIconStyle: AppIconStyle;
  loading: boolean;
  loadingReleases: boolean;
  loadingDoctor: boolean;
  error: string | null;

  snapshot: WorkspaceSnapshot | null;
  releases: ReleasesResponse | null;
  doctorReport: DoctorOutput | null;
  doctorUpdatedAt: string | null;
  doctorRunSeq: number;
  extraProjects: string[];

  selectedProjectId: string | null;
  selectedFlavor: string;
  pendingSdk: string | null;
  useFlags: {
    pin: boolean;
    skipPubGet: boolean;
    skipSetup: boolean;
    force: boolean;
  };

  consoleOpen: boolean;
  logs: CliLogEntry[];
  activeRequestIds: string[];

  spawnMode: "spawn" | "flavor" | "exec";
  spawnCommand: string;
  spawnTargets: string[];
  spawnProjectId: string | null;
  spawnRunning: boolean;
  spawnRequestId: string | null;
  spawnResults: SpawnTaskResult[];

  cmdkOpen: boolean;
  menubarOpen: boolean;
  toasts: ToastItem[];

  setActiveTab: (tab: TabId) => void;
  setTheme: (theme: ThemeMode) => void;
  setAppIconStyle: (style: AppIconStyle) => Promise<void>;
  setCmdkOpen: (open: boolean) => void;
  setMenubarOpen: (open: boolean) => void;
  setConsoleOpen: (open: boolean) => void;
  clearLogs: () => void;

  selectProject: (projectId: string, flavor?: string) => void;
  setPendingSdk: (sdk: string | null) => void;
  toggleUseFlag: (flag: keyof FvmStoreState["useFlags"]) => void;

  setSpawnMode: (mode: "spawn" | "flavor" | "exec") => void;
  setSpawnCommand: (cmd: string) => void;
  toggleSpawnTarget: (target: string) => void;
  setSpawnProjectId: (pid: string | null) => void;

  pushToast: (message: string, tone?: ToastItem["tone"]) => void;
  dismissToast: (id: string) => void;

  bootstrap: () => Promise<void>;
  refreshAll: (silent?: boolean) => Promise<void>;
  refreshReleases: (channel?: string) => Promise<void>;
  refreshDoctor: (cwd?: string, manual?: boolean) => Promise<void>;

  runFvmArgs: (args: string[], cwd?: string, successToast?: string) => Promise<number>;
  cancelRequest: (requestId: string) => Promise<void>;

  bindProjectDialog: () => Promise<void>;
  removeExtraProject: (path: string) => Promise<void>;
  applyProjectBinding: (overrideFlavor?: string, overrideSdk?: string) => Promise<void>;
  installSdk: (version: string, options?: { noSetup?: boolean; setGlobal?: boolean }) => Promise<void>;
  removeSdk: (version: string) => Promise<void>;
  setGlobalSdk: (version: string) => Promise<void>;
  unlinkGlobalSdk: () => Promise<void>;
  runPatchUpgrade: (
    actions: { arguments: string[]; workingDirectory: string | null }[],
    label: string
  ) => Promise<void>;
  runCleanupRemovable: () => Promise<void>;
  runDestroyCache: () => Promise<void>;
  runSpawnMatrix: () => Promise<void>;
  cancelSpawnMatrix: () => Promise<void>;
  addFork: (alias: string, url: string) => Promise<void>;
  removeFork: (alias: string) => Promise<void>;
  saveGlobalConfig: (cfg: {
    cachePath: string;
    gitCachePath: string;
    flutterUrl: string;
    useGitCache: boolean;
    updateCheck: boolean;
  }) => Promise<void>;
  fixPathInZshrc: () => Promise<void>;
}

export const useFvmStore = create<FvmStoreState>((set, get) => ({
  activeTab: "topology",
  theme: loadTheme(),
  appIconStyle: loadAppIconStyle(),
  loading: false,
  loadingReleases: false,
  loadingDoctor: false,
  error: null,

  snapshot: null,
  releases: null,
  doctorReport: null,
  doctorUpdatedAt: null,
  doctorRunSeq: 0,
  extraProjects: loadExtraProjects(),

  selectedProjectId: null,
  selectedFlavor: "__default__",
  pendingSdk: null,
  useFlags: {
    pin: false,
    skipPubGet: false,
    skipSetup: false,
    force: false,
  },

  consoleOpen: true,
  logs: [],
  activeRequestIds: [],

  spawnMode: "spawn",
  spawnCommand: "test",
  spawnTargets: [],
  spawnProjectId: null,
  spawnRunning: false,
  spawnRequestId: null,
  spawnResults: [],

  cmdkOpen: false,
  menubarOpen: false,
  toasts: [],

  setActiveTab: (tab) => set({ activeTab: tab }),

  setTheme: (theme) => {
    applyThemeToDomAndWindow(theme);
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      // ignore
    }
    set({ theme });
    if (get().appIconStyle === "auto") {
      syncNativeAppIcon("auto", theme);
    }
  },

  setAppIconStyle: async (style) => {
    try {
      localStorage.setItem(APP_ICON_STYLE_KEY, style);
    } catch {
      // ignore
    }
    set({ appIconStyle: style });
    const effective = resolveEffectiveAppIcon(style, get().theme);
    try {
      await applyNativeAppIcon(effective);
      const label =
        style === "light"
          ? "已切换为白底瓷光 App Logo"
          : style === "dark"
            ? "已切换为黑底曜石 App Logo"
            : `App Logo 已设为跟随外观（当前：${effective === "light" ? "白底" : "黑底"}）`;
      get().pushToast(label, "success");
    } catch (err) {
      get().pushToast(`切换应用图标失败: ${String(err)}`, "error");
    }
  },

  setCmdkOpen: (open) => set({ cmdkOpen: open }),
  setMenubarOpen: (open) => set({ menubarOpen: open }),
  setConsoleOpen: (open) => set({ consoleOpen: open }),
  clearLogs: () => set({ logs: [] }),

  selectProject: (projectId, flavor = "__default__") =>
    set({ selectedProjectId: projectId, selectedFlavor: flavor, pendingSdk: null }),

  setPendingSdk: (sdk) => set({ pendingSdk: sdk }),

  toggleUseFlag: (flag) =>
    set((s) => ({ useFlags: { ...s.useFlags, [flag]: !s.useFlags[flag] } })),

  setSpawnMode: (mode) => {
    const snap = get().snapshot;
    let defaults: string[] = [];
    if (mode === "flavor" && snap?.projects[0]) {
      defaults = Object.keys(snap.projects[0].flavors);
    } else if (snap) {
      defaults = snap.versions.slice(0, 3).map((v) => v.name);
    }
    set({ spawnMode: mode, spawnTargets: defaults, spawnResults: [] });
  },

  setSpawnCommand: (cmd) => set({ spawnCommand: cmd }),

  toggleSpawnTarget: (target) =>
    set((s) => ({
      spawnTargets: s.spawnTargets.includes(target)
        ? s.spawnTargets.filter((t) => t !== target)
        : [...s.spawnTargets, target],
    })),

  setSpawnProjectId: (pid) => set({ spawnProjectId: pid }),

  pushToast: (message, tone = "info") => {
    const id = genId("toast");
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, message, tone }] }));
    setTimeout(() => {
      get().dismissToast(id);
    }, 3200);
  },

  dismissToast: (id) =>
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  bootstrap: async () => {
    applyThemeToDomAndWindow(get().theme);
    syncNativeAppIcon(get().appIconStyle, get().theme);
    if (!isTauriRuntime()) {
      set({ error: "请通过 FVM Orbit 桌面应用或 pnpm tauri:dev 启动，以连接本机 fvm CLI。" });
      return;
    }
    await Promise.all([get().refreshAll(), get().refreshReleases()]);
  },

  refreshAll: async (silent = false) => {
    if (!isTauriRuntime()) return;
    const { extraProjects } = get();
    if (!silent) set({ loading: true, error: null });

    try {
      const snap = await fetchWorkspaceSnapshot(extraProjects);
      set((s) => {
        const stillHasProj = snap.projects.some((p) => p.id === s.selectedProjectId);
        const firstProj = snap.projects[0]?.id ?? null;
        const nextTargets = s.spawnTargets.filter((t) =>
          snap.versions.some((v) => v.name === t)
        );
        return {
          snapshot: snap,
          loading: false,
          error: null,
          selectedProjectId: stillHasProj ? s.selectedProjectId : firstProj,
          spawnProjectId:
            s.spawnProjectId && snap.projects.some((p) => p.id === s.spawnProjectId)
              ? s.spawnProjectId
              : firstProj,
          spawnTargets: nextTargets.length
            ? nextTargets
            : snap.versions.slice(0, 3).map((v) => v.name),
        };
      });
      if (!silent) {
        set((s) => ({
          logs: [
            {
              id: genId("log"),
              time: nowTime(),
              cmd: "fvm api context & list & cleanup",
              status: "OK" as const,
              lines: [
                `FVM ${snap.context.fvmVersion} · ${snap.versions.length} 个缓存 SDK (${snap.totalCacheSizeLabel}) · ${snap.projects.length} 个项目`,
              ],
            },
            ...s.logs,
          ].slice(0, 60),
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      get().pushToast(`读取本机 FVM 失败: ${msg}`, "error");
    }
  },

  refreshReleases: async (channel) => {
    if (!isTauriRuntime()) return;
    set({ loadingReleases: true });
    try {
      const rel = await fetchReleases(60, channel);
      set({ releases: rel, loadingReleases: false });
    } catch (err) {
      set({ loadingReleases: false });
      get().pushToast(`拉取官方发布列表失败: ${String(err)}`, "warning");
    }
  },

  refreshDoctor: async (cwd, manual = false) => {
    if (!isTauriRuntime() || get().loadingDoctor) return;
    set({ loadingDoctor: true });
    const minDelay = manual
      ? new Promise<void>((resolve) => setTimeout(resolve, 350))
      : Promise.resolve();
    try {
      const [res] = await Promise.all([fetchDoctorReport(cwd), minDelay]);
      set((s) => ({
        doctorReport: res,
        loadingDoctor: false,
        doctorUpdatedAt: nowTime(),
        doctorRunSeq: s.doctorRunSeq + 1,
      }));
      if (manual) {
        get().pushToast("fvm doctor 诊断已刷新", "success");
      }
    } catch (err) {
      await minDelay;
      set({ loadingDoctor: false });
      get().pushToast(`fvm doctor 执行失败: ${String(err)}`, "error");
    }
  },

  runFvmArgs: async (args, cwd, successToast) => {
    if (!isTauriRuntime()) return -1;
    const requestId = genId("req");
    const cmdStr = `fvm ${args.join(" ")}`;

    const entry: CliLogEntry = {
      id: requestId,
      time: nowTime(),
      cmd: cmdStr,
      cwd,
      status: "RUNNING",
      lines: [],
    };

    set((s) => ({
      consoleOpen: true,
      logs: [entry, ...s.logs].slice(0, 60),
      activeRequestIds: [...s.activeRequestIds, requestId],
    }));

    try {
      const code = await streamFvmCommand(requestId, args, cwd, (evt) => {
        set((s) => ({
          logs: s.logs.map((l) => {
            if (l.id !== requestId) return l;
            if (evt.kind === "stdout" || evt.kind === "stderr") {
              const nextLines = evt.line !== null ? [...l.lines, evt.line].slice(-300) : l.lines;
              return { ...l, lines: nextLines };
            }
            if (evt.kind === "finished") {
              return {
                ...l,
                status: evt.exitCode === 0 ? "OK" : "ERR",
                exitCode: evt.exitCode,
                durationMs: evt.durationMs,
              };
            }
            if (evt.kind === "cancelled") {
              return {
                ...l,
                status: "CANCELLED",
                exitCode: evt.exitCode,
                durationMs: evt.durationMs,
                lines: [...l.lines, "[已由用户中止]"],
              };
            }
            if (evt.kind === "error") {
              return {
                ...l,
                status: "ERR",
                exitCode: -1,
                lines: evt.line ? [...l.lines, evt.line] : l.lines,
              };
            }
            return l;
          }),
        }));
      });

      set((s) => ({
        activeRequestIds: s.activeRequestIds.filter((id) => id !== requestId),
      }));

      if (code === 0) {
        if (successToast) get().pushToast(successToast, "success");
      } else if (code !== -2) {
        get().pushToast(`命令执行退出码 ${code}，请查看底部控制台日志`, "error");
      }
      await get().refreshAll(true);
      return code;
    } catch (err) {
      set((s) => ({
        activeRequestIds: s.activeRequestIds.filter((id) => id !== requestId),
        logs: s.logs.map((l) =>
          l.id === requestId
            ? { ...l, status: "ERR", lines: [...l.lines, String(err)] }
            : l
        ),
      }));
      get().pushToast(`执行异常: ${String(err)}`, "error");
      return -1;
    }
  },

  cancelRequest: async (requestId) => {
    await cancelFvmRequest(requestId);
    set((s) => ({
      activeRequestIds: s.activeRequestIds.filter((id) => id !== requestId),
    }));
    get().pushToast("已发送进程中止信号", "warning");
  },

  bindProjectDialog: async () => {
    const dir = await pickDirectoryDialog();
    if (!dir) return;
    const nextExtra = Array.from(new Set([...get().extraProjects, dir]));
    saveExtraProjects(nextExtra);
    set({ extraProjects: nextExtra, selectedProjectId: dir, selectedFlavor: "__default__" });
    await get().refreshAll();
    get().pushToast(`已加载项目目录: ${dir.split("/").pop()}`, "success");
  },

  removeExtraProject: async (path) => {
    const nextExtra = get().extraProjects.filter((p) => p !== path);
    saveExtraProjects(nextExtra);
    set({ extraProjects: nextExtra });
    await get().refreshAll();
  },

  applyProjectBinding: async (overrideFlavor, overrideSdk) => {
    const { snapshot, selectedProjectId, selectedFlavor, pendingSdk, useFlags } = get();
    const proj = snapshot?.projects.find((p) => p.id === selectedProjectId);
    if (!proj) return;

    const flavor = overrideFlavor ?? selectedFlavor;
    const targetVer =
      overrideSdk ??
      pendingSdk ??
      (flavor === "__default__" ? proj.pinnedVersion : proj.flavors[flavor]);
    if (!targetVer) {
      get().pushToast("请先在右侧选择一个目标 Flutter SDK 版本", "warning");
      return;
    }

    const args = ["use", targetVer];
    if (flavor !== "__default__") args.push("--flavor", flavor);
    if (useFlags.pin) args.push("--pin");
    if (useFlags.skipPubGet) args.push("--skip-pub-get");
    if (useFlags.skipSetup) args.push("--skip-setup");
    if (useFlags.force) args.push("--force");

    await get().runFvmArgs(
      args,
      proj.path,
      `${proj.name}${flavor !== "__default__" ? ` [${flavor}]` : ""} 已绑定至 ${targetVer}`
    );
    set({ pendingSdk: null });
  },

  installSdk: async (version, options) => {
    const clean = version.trim();
    if (!clean) return;
    const args = ["install", clean];
    if (options?.noSetup) args.push("--no-setup");

    const code = await get().runFvmArgs(args, undefined, `Flutter ${clean} 安装完成`);
    if (code === 0 && options?.setGlobal) {
      await get().setGlobalSdk(clean);
    }
  },

  removeSdk: async (version) => {
    await get().runFvmArgs(["remove", version], undefined, `已移除缓存版本 ${version}`);
  },

  setGlobalSdk: async (version) => {
    await get().runFvmArgs(["global", version], undefined, `全局默认 SDK 已设为 ${version}`);
  },

  unlinkGlobalSdk: async () => {
    await get().runFvmArgs(["global", "--unlink"], undefined, "已取消全局默认 SDK");
  },

  runPatchUpgrade: async (actions, label) => {
    for (const act of actions) {
      await get().runFvmArgs(act.arguments, act.workingDirectory ?? undefined);
    }
    get().pushToast(label, "success");
    await get().refreshAll(true);
  },

  runCleanupRemovable: async () => {
    await get().runFvmArgs(
      ["cleanup", "--remove-unused", "-y"],
      undefined,
      "未引用 SDK 清理完成"
    );
  },

  runDestroyCache: async () => {
    await get().runFvmArgs(["destroy", "--force"], undefined, "已清空 FVM 全部缓存");
  },

  runSpawnMatrix: async () => {
    const { spawnMode, spawnCommand, spawnTargets, spawnProjectId, snapshot } = get();
    const cmdTokens = spawnCommand.trim().split(/\s+/).filter(Boolean);
    if (!cmdTokens.length) {
      get().pushToast("请输入要执行的命令参数（如 test / analyze）", "warning");
      return;
    }

    const targets = spawnMode === "exec" ? ["exec"] : spawnTargets;
    if (!targets.length) {
      get().pushToast("请至少勾选一个执行目标", "warning");
      return;
    }

    const cwd = snapshot?.projects.find((p) => p.id === spawnProjectId)?.path;
    const requestId = genId("spawn");

    const tasks: SpawnTaskRequest[] = targets.map((t) => {
      const args =
        spawnMode === "spawn"
          ? ["spawn", t, ...cmdTokens]
          : spawnMode === "flavor"
            ? ["flavor", t, ...cmdTokens]
            : ["exec", ...cmdTokens];
      return { id: genId("task"), label: t, args };
    });

    const initialResults: SpawnTaskResult[] = tasks.map((tk) => ({
      taskId: tk.id,
      label: tk.label,
      cmd: `fvm ${tk.args.join(" ")}`,
      status: "RUNNING",
      lines: [],
      durationMs: null,
      exitCode: null,
    }));

    set({
      spawnRunning: true,
      spawnRequestId: requestId,
      spawnResults: initialResults,
    });

    try {
      await executeSpawnMatrix(requestId, cwd, tasks, (evt) => {
        set((s) => ({
          spawnResults: s.spawnResults.map((r) => {
            if (r.taskId !== evt.taskId) return r;
            if (evt.kind === "stdout" || evt.kind === "stderr") {
              return {
                ...r,
                lines: evt.line !== null ? [...r.lines, evt.line].slice(-200) : r.lines,
              };
            }
            if (evt.kind === "finished") {
              return {
                ...r,
                status: evt.exitCode === 0 ? "PASS" : "FAIL",
                exitCode: evt.exitCode,
                durationMs: evt.durationMs,
              };
            }
            if (evt.kind === "cancelled") {
              return {
                ...r,
                status: "CANCELLED",
                exitCode: evt.exitCode,
                durationMs: evt.durationMs,
              };
            }
            if (evt.kind === "error") {
              return {
                ...r,
                status: "FAIL",
                exitCode: -1,
                lines: evt.line ? [...r.lines, evt.line] : r.lines,
              };
            }
            return r;
          }),
        }));
      });
      set({ spawnRunning: false, spawnRequestId: null });
      get().pushToast(`并发矩阵执行完毕 (${tasks.length} 个轨道)`, "success");
    } catch (err) {
      set({ spawnRunning: false, spawnRequestId: null });
      get().pushToast(`并发执行异常: ${String(err)}`, "error");
    }
  },

  cancelSpawnMatrix: async () => {
    const reqId = get().spawnRequestId;
    if (!reqId) return;
    await cancelFvmRequest(reqId);
    set({ spawnRunning: false, spawnRequestId: null });
    get().pushToast("已中止并发矩阵", "warning");
  },

  addFork: async (alias, url) => {
    const a = alias.trim();
    const u = url.trim();
    if (!a || !u) {
      get().pushToast("请填写 Fork 别名和 Git URL", "warning");
      return;
    }
    await get().runFvmArgs(["fork", "add", a, u], undefined, `已注册 Fork 别名 ${a}`);
  },

  removeFork: async (alias) => {
    await get().runFvmArgs(["fork", "remove", alias], undefined, `已移除 Fork 别名 ${alias}`);
  },

  saveGlobalConfig: async (cfg) => {
    const args = [
      "config",
      "--cache-path",
      cfg.cachePath,
      "--git-cache-path",
      cfg.gitCachePath,
      "--flutter-url",
      cfg.flutterUrl,
      cfg.useGitCache ? "--use-git-cache" : "--no-use-git-cache",
      cfg.updateCheck ? "--update-check" : "--no-update-check",
    ];
    await get().runFvmArgs(args, undefined, "全局 FVM 配置已更新");
  },

  fixPathInZshrc: async () => {
    try {
      const msg = await applyZshrcPathFix();
      get().pushToast(msg, "success");
      await get().refreshAll(true);
    } catch (err) {
      get().pushToast(`写入 ~/.zshrc 失败: ${String(err)}`, "error");
    }
  },
}));
