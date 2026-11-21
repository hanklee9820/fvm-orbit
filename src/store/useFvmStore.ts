import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { applyLocaleToDocument, resolveLocale, translate } from "../i18n";
import {
  applyNativeAppIcon,
  applyZshrcPathFix,
  cancelFvmRequest,
  detectSystemProxy,
  executeSpawnMatrix,
  fetchAppLanguage,
  fetchDoctorReport,
  fetchProxySettings,
  fetchReleases,
  fetchWorkspaceSnapshot,
  isTauriRuntime,
  pickDirectoryDialog,
  saveAppLanguage,
  saveProxySettings,
  streamFvmCommand,
} from "../services/fvmBridge";
import type {
  AppIconStyle,
  CliLogEntry,
  DoctorOutput,
  LanguagePreference,
  Locale,
  ProxySettings,
  ReleasesResponse,
  SettingsTabId,
  SpawnTaskRequest,
  SpawnTaskResult,
  SystemProxyInfo,
  TabId,
  ThemeMode,
  ToastItem,
  WorkspaceSnapshot,
} from "../types/fvm";

const EXTRA_PROJECTS_KEY = "fvm_orbit_extra_projects";
const THEME_KEY = "fvm_orbit_theme";
const APP_ICON_STYLE_KEY = "fvm_orbit_app_icon_style";
const PROXY_SETTINGS_KEY = "fvm_orbit_proxy_settings";
const LANGUAGE_KEY = "fvm_orbit_language";

function loadLanguagePreference(): LanguagePreference {
  try {
    const raw = localStorage.getItem(LANGUAGE_KEY);
    if (raw === "system" || raw === "zh" || raw === "en") return raw;
  } catch {
    // ignore
  }
  return "system";
}

function cacheLanguagePreference(pref: LanguagePreference) {
  try {
    localStorage.setItem(LANGUAGE_KEY, pref);
  } catch {
    // ignore
  }
}

export const DEFAULT_PROXY_SETTINGS: ProxySettings = {
  mode: "system",
  protocol: "http",
  host: "127.0.0.1",
  port: "7890",
  username: "",
  password: "",
  bypass: "localhost,127.0.0.1,::1,.local",
};

function loadProxySettings(): ProxySettings {
  try {
    const raw = localStorage.getItem(PROXY_SETTINGS_KEY);
    if (!raw) return DEFAULT_PROXY_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<ProxySettings>;
    const mode =
      parsed.mode === "direct" || parsed.mode === "system" || parsed.mode === "custom"
        ? parsed.mode
        : DEFAULT_PROXY_SETTINGS.mode;
    const protocol =
      parsed.protocol === "http" || parsed.protocol === "https" || parsed.protocol === "socks5"
        ? parsed.protocol
        : DEFAULT_PROXY_SETTINGS.protocol;
    return {
      mode,
      protocol,
      host: typeof parsed.host === "string" ? parsed.host : DEFAULT_PROXY_SETTINGS.host,
      port: typeof parsed.port === "string" ? parsed.port : DEFAULT_PROXY_SETTINGS.port,
      username: typeof parsed.username === "string" ? parsed.username : "",
      password: typeof parsed.password === "string" ? parsed.password : "",
      bypass:
        typeof parsed.bypass === "string" ? parsed.bypass : DEFAULT_PROXY_SETTINGS.bypass,
    };
  } catch {
    return DEFAULT_PROXY_SETTINGS;
  }
}

function cacheProxySettings(settings: ProxySettings) {
  try {
    localStorage.setItem(PROXY_SETTINGS_KEY, JSON.stringify(settings));
  } catch {
    // ignore storage errors
  }
}

export interface ProxyDisplaySummary {
  tone: "direct" | "active" | "warning";
  navBadge: string;
  statusLabel: string;
  titleLabel: string;
}

export function getProxyDisplaySummary(
  settings: ProxySettings,
  sysInfo: SystemProxyInfo | null,
  locale: Locale = "zh"
): ProxyDisplaySummary {
  if (settings.mode === "direct") {
    return {
      tone: "direct",
      navBadge: translate(locale, "proxySummary.directNavBadge"),
      statusLabel: translate(locale, "proxySummary.directStatus"),
      titleLabel: translate(locale, "proxySummary.directTitle"),
    };
  }

  if (settings.mode === "custom") {
    const host = settings.host.trim() || "127.0.0.1";
    const port = settings.port.trim() || "7890";
    return {
      tone: "active",
      navBadge: translate(locale, "proxySummary.customNavBadge"),
      statusLabel: translate(locale, "proxySummary.customStatus", { port }),
      titleLabel: translate(locale, "proxySummary.customTitle", { host, port }),
    };
  }

  // "system"
  const activePort = sysInfo?.httpsPort ?? sysInfo?.httpPort ?? sysInfo?.socksPort ?? null;
  if (sysInfo?.effectiveUrl) {
    const portSuffix = activePort ? ` · ${activePort}` : "";
    return {
      tone: "active",
      navBadge: translate(locale, "proxySummary.systemNavBadge"),
      statusLabel: translate(locale, "proxySummary.systemActiveStatus", { portSuffix }),
      titleLabel: translate(locale, "proxySummary.systemActiveTitle", { portSuffix }),
    };
  }

  return {
    tone: "warning",
    navBadge: translate(locale, "proxySummary.systemNavBadge"),
    statusLabel: translate(locale, "proxySummary.systemOffStatus"),
    titleLabel: translate(locale, "proxySummary.systemOffTitle"),
  };
}

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
  language: LanguagePreference;
  nativeSystemLocale: Locale | null;
  resolvedLocale: Locale;
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
  settingsOpen: boolean;
  settingsTab: SettingsTabId;
  proxySettings: ProxySettings;
  systemProxyInfo: SystemProxyInfo | null;
  detectingSystemProxy: boolean;
  toasts: ToastItem[];

  setActiveTab: (tab: TabId) => void;
  setTheme: (theme: ThemeMode) => void;
  setAppIconStyle: (style: AppIconStyle) => Promise<void>;
  setLanguage: (pref: LanguagePreference, silent?: boolean) => Promise<void>;
  setCmdkOpen: (open: boolean) => void;
  setMenubarOpen: (open: boolean) => void;
  openSettings: (tab?: SettingsTabId) => void;
  closeSettings: () => void;
  setSettingsTab: (tab: SettingsTabId) => void;
  updateProxySettings: (next: ProxySettings, silent?: boolean) => Promise<boolean>;
  refreshSystemProxy: () => Promise<SystemProxyInfo | null>;
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

const initialLanguagePref = loadLanguagePreference();
const initialResolvedLocale = resolveLocale(initialLanguagePref);
applyLocaleToDocument(initialResolvedLocale);

export const useFvmStore = create<FvmStoreState>((set, get) => ({
  activeTab: "topology",
  theme: loadTheme(),
  appIconStyle: loadAppIconStyle(),
  language: initialLanguagePref,
  nativeSystemLocale: null,
  resolvedLocale: initialResolvedLocale,
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
  settingsOpen: false,
  settingsTab: "proxy",
  proxySettings: loadProxySettings(),
  systemProxyInfo: null,
  detectingSystemProxy: false,
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
    const locale = get().resolvedLocale;
    try {
      await applyNativeAppIcon(effective);
      const label =
        style === "light"
          ? translate(locale, "toast.iconSwitchedLight")
          : style === "dark"
            ? translate(locale, "toast.iconSwitchedDark")
            : translate(locale, "toast.iconSwitchedAuto", {
                current: translate(
                  locale,
                  effective === "light"
                    ? "settings.appearance.styleLightShort"
                    : "settings.appearance.styleDarkShort"
                ),
              });
      get().pushToast(label, "success");
    } catch (err) {
      get().pushToast(translate(locale, "toast.iconSwitchFailed", { err: String(err) }), "error");
    }
  },

  setLanguage: async (pref, silent = false) => {
    cacheLanguagePreference(pref);
    const optimisticResolved = resolveLocale(pref, get().nativeSystemLocale);
    applyLocaleToDocument(optimisticResolved);
    set({ language: pref, resolvedLocale: optimisticResolved });

    let finalResolved = optimisticResolved;
    if (isTauriRuntime()) {
      try {
        const saved = await saveAppLanguage(pref);
        finalResolved = saved.resolved;
        cacheLanguagePreference(saved.preference);
        applyLocaleToDocument(saved.resolved);
        set((s) => ({
          language: saved.preference,
          resolvedLocale: saved.resolved,
          nativeSystemLocale:
            saved.preference === "system" ? saved.resolved : s.nativeSystemLocale,
        }));
      } catch (err) {
        get().pushToast(
          translate(optimisticResolved, "toast.langSwitchFailed", { err: String(err) }),
          "error"
        );
        return;
      }
    }

    if (!silent) {
      const msg =
        pref === "zh"
          ? translate(finalResolved, "toast.langSwitchedZh")
          : pref === "en"
            ? translate(finalResolved, "toast.langSwitchedEn")
            : translate(finalResolved, "toast.langSwitchedSystem", {
                resolved:
                  finalResolved === "zh"
                    ? translate(finalResolved, "common.langNameZh")
                    : translate(finalResolved, "common.langNameEn"),
              });
      get().pushToast(msg, "success");
    }
  },

  setCmdkOpen: (open) => set({ cmdkOpen: open }),
  setMenubarOpen: (open) => set({ menubarOpen: open }),
  openSettings: (tab) => {
    set((s) => ({
      settingsOpen: true,
      settingsTab: tab ?? s.settingsTab,
      cmdkOpen: false,
      menubarOpen: false,
    }));
    void get().refreshSystemProxy();
  },
  closeSettings: () => set({ settingsOpen: false }),
  setSettingsTab: (tab) => set({ settingsTab: tab }),
  updateProxySettings: async (next, silent = false) => {
    if (!isTauriRuntime()) {
      cacheProxySettings(next);
      set({ proxySettings: next });
      return true;
    }
    try {
      const saved = await saveProxySettings(next);
      cacheProxySettings(saved);
      set({ proxySettings: saved });
      if (saved.mode === "system") {
        void get().refreshSystemProxy();
      }
      if (!silent) {
        const locale = get().resolvedLocale;
        const msg =
          saved.mode === "direct"
            ? translate(locale, "toast.proxyDirect")
            : saved.mode === "system"
              ? translate(locale, "toast.proxySystem")
              : translate(locale, "toast.proxyCustom", {
                  protocol: saved.protocol,
                  host: saved.host,
                  port: saved.port,
                });
        get().pushToast(msg, "success");
      }
      return true;
    } catch (err) {
      get().pushToast(String(err), "error");
      return false;
    }
  },
  refreshSystemProxy: async () => {
    if (!isTauriRuntime()) return null;
    set({ detectingSystemProxy: true });
    try {
      const info = await detectSystemProxy();
      set({ systemProxyInfo: info, detectingSystemProxy: false });
      return info;
    } catch {
      set({ detectingSystemProxy: false });
      return null;
    }
  },
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
    applyLocaleToDocument(get().resolvedLocale);
    syncNativeAppIcon(get().appIconStyle, get().theme);
    if (!isTauriRuntime()) {
      set({ error: translate(get().resolvedLocale, "app.notInTauriError") });
      return;
    }
    try {
      const [savedProxy, langState] = await Promise.all([
        fetchProxySettings(),
        fetchAppLanguage(),
        get().refreshSystemProxy(),
      ]);
      cacheProxySettings(savedProxy);
      cacheLanguagePreference(langState.preference);
      applyLocaleToDocument(langState.resolved);
      set((s) => ({
        proxySettings: savedProxy,
        language: langState.preference,
        resolvedLocale: langState.resolved,
        nativeSystemLocale:
          langState.preference === "system" ? langState.resolved : s.nativeSystemLocale,
      }));
    } catch {
      // keep fallback settings
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
        const locale = get().resolvedLocale;
        set((s) => ({
          logs: [
            {
              id: genId("log"),
              time: nowTime(),
              cmd: "fvm api context & list & cleanup",
              status: "OK" as const,
              lines: [
                translate(locale, "console.snapshotSummary", {
                  fvmVersion: snap.context.fvmVersion,
                  sdkCount: snap.versions.length,
                  cacheSize: snap.totalCacheSizeLabel,
                  projectCount: snap.projects.length,
                }),
              ],
            },
            ...s.logs,
          ].slice(0, 60),
        }));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ loading: false, error: msg });
      get().pushToast(
        translate(get().resolvedLocale, "toast.readFvmFailed", { err: msg }),
        "error"
      );
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
      get().pushToast(
        translate(get().resolvedLocale, "toast.fetchReleasesFailed", { err: String(err) }),
        "warning"
      );
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
        get().pushToast(translate(get().resolvedLocale, "toast.doctorRefreshed"), "success");
      }
    } catch (err) {
      await minDelay;
      set({ loadingDoctor: false });
      get().pushToast(
        translate(get().resolvedLocale, "toast.doctorFailed", { err: String(err) }),
        "error"
      );
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
                lines: [...l.lines, translate(get().resolvedLocale, "console.cancelledByUser")],
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
        get().pushToast(
          translate(get().resolvedLocale, "toast.cmdExitError", { code }),
          "error"
        );
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
      get().pushToast(
        translate(get().resolvedLocale, "toast.cmdExecError", { err: String(err) }),
        "error"
      );
      return -1;
    }
  },

  cancelRequest: async (requestId) => {
    await cancelFvmRequest(requestId);
    set((s) => ({
      activeRequestIds: s.activeRequestIds.filter((id) => id !== requestId),
    }));
    get().pushToast(translate(get().resolvedLocale, "toast.cancelSignalSent"), "warning");
  },

  bindProjectDialog: async () => {
    const dir = await pickDirectoryDialog(
      translate(get().resolvedLocale, "dialog.pickProjectTitle")
    );
    if (!dir) return;
    const nextExtra = Array.from(new Set([...get().extraProjects, dir]));
    saveExtraProjects(nextExtra);
    set({ extraProjects: nextExtra, selectedProjectId: dir, selectedFlavor: "__default__" });
    await get().refreshAll();
    get().pushToast(
      translate(get().resolvedLocale, "toast.projectLoaded", {
        name: dir.split("/").pop() ?? dir,
      }),
      "success"
    );
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
      get().pushToast(translate(get().resolvedLocale, "toast.selectSdkFirst"), "warning");
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
      translate(get().resolvedLocale, "toast.projectBound", {
        project: proj.name,
        flavorPart: flavor !== "__default__" ? ` [${flavor}]` : "",
        version: targetVer,
      })
    );
    set({ pendingSdk: null });
  },

  installSdk: async (version, options) => {
    const clean = version.trim();
    if (!clean) return;
    const args = ["install", clean];
    if (options?.noSetup) args.push("--no-setup");

    const code = await get().runFvmArgs(
      args,
      undefined,
      translate(get().resolvedLocale, "toast.sdkInstalled", { version: clean })
    );
    if (code === 0 && options?.setGlobal) {
      await get().setGlobalSdk(clean);
    }
  },

  removeSdk: async (version) => {
    await get().runFvmArgs(
      ["remove", version],
      undefined,
      translate(get().resolvedLocale, "toast.sdkRemoved", { version })
    );
  },

  setGlobalSdk: async (version) => {
    await get().runFvmArgs(
      ["global", version],
      undefined,
      translate(get().resolvedLocale, "toast.globalSet", { version })
    );
  },

  unlinkGlobalSdk: async () => {
    await get().runFvmArgs(
      ["global", "--unlink"],
      undefined,
      translate(get().resolvedLocale, "toast.globalUnlinked")
    );
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
      translate(get().resolvedLocale, "toast.cleanupDone")
    );
  },

  runDestroyCache: async () => {
    await get().runFvmArgs(
      ["destroy", "--force"],
      undefined,
      translate(get().resolvedLocale, "toast.destroyDone")
    );
  },

  runSpawnMatrix: async () => {
    const { spawnMode, spawnCommand, spawnTargets, spawnProjectId, snapshot } = get();
    const cmdTokens = spawnCommand.trim().split(/\s+/).filter(Boolean);
    if (!cmdTokens.length) {
      get().pushToast(translate(get().resolvedLocale, "toast.spawnNeedArgs"), "warning");
      return;
    }

    const targets = spawnMode === "exec" ? ["exec"] : spawnTargets;
    if (!targets.length) {
      get().pushToast(translate(get().resolvedLocale, "toast.spawnNeedTargets"), "warning");
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
      get().pushToast(
        translate(get().resolvedLocale, "toast.spawnFinished", { count: tasks.length }),
        "success"
      );
    } catch (err) {
      set({ spawnRunning: false, spawnRequestId: null });
      get().pushToast(
        translate(get().resolvedLocale, "toast.spawnError", { err: String(err) }),
        "error"
      );
    }
  },

  cancelSpawnMatrix: async () => {
    const reqId = get().spawnRequestId;
    if (!reqId) return;
    await cancelFvmRequest(reqId);
    set({ spawnRunning: false, spawnRequestId: null });
    get().pushToast(translate(get().resolvedLocale, "toast.spawnCancelled"), "warning");
  },

  addFork: async (alias, url) => {
    const a = alias.trim();
    const u = url.trim();
    if (!a || !u) {
      get().pushToast(translate(get().resolvedLocale, "toast.forkNeedFields"), "warning");
      return;
    }
    await get().runFvmArgs(
      ["fork", "add", a, u],
      undefined,
      translate(get().resolvedLocale, "toast.forkAdded", { alias: a })
    );
  },

  removeFork: async (alias) => {
    await get().runFvmArgs(
      ["fork", "remove", alias],
      undefined,
      translate(get().resolvedLocale, "toast.forkRemoved", { alias })
    );
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
    await get().runFvmArgs(
      args,
      undefined,
      translate(get().resolvedLocale, "toast.globalConfigUpdated")
    );
  },

  fixPathInZshrc: async () => {
    try {
      const msg = await applyZshrcPathFix();
      get().pushToast(msg, "success");
      await get().refreshAll(true);
    } catch (err) {
      get().pushToast(
        translate(get().resolvedLocale, "toast.zshrcFailed", { err: String(err) }),
        "error"
      );
    }
  },
}));
