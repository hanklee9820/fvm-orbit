import { Monitor, Moon, PanelTop, RefreshCw, Search, Settings, Sun } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { getProxyDisplaySummary, useFvmStore } from "../store/useFvmStore";
import { isTauriRuntime } from "../services/fvmBridge";
import type { ThemeMode } from "../types/fvm";

export function TitleBar() {
  const {
    snapshot,
    theme,
    loading,
    setTheme,
    setCmdkOpen,
    menubarOpen,
    setMenubarOpen,
    settingsOpen,
    openSettings,
    proxySettings,
    systemProxyInfo,
    refreshAll,
  } = useFvmStore();

  const fvmVer = snapshot?.context.fvmVersion ?? "4.3.2";
  const archLabel =
    snapshot?.context.archLabel === "aarch64"
      ? "macOS arm64"
      : `${snapshot?.context.osLabel ?? "macOS"} ${snapshot?.context.archLabel ?? ""}`.trim();
  const inTauri = isTauriRuntime();
  const proxySummary = getProxyDisplaySummary(proxySettings, systemProxyInfo);
  const proxyDotClass =
    proxySummary.tone === "active"
      ? "bg-[var(--success)]"
      : proxySummary.tone === "warning"
        ? "bg-[var(--warning)]"
        : "bg-[var(--muted-foreground)]";

  const themeOrder: ThemeMode[] = ["system", "light", "dark"];
  const themeMeta: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
    system: { label: "跟随系统", Icon: Monitor },
    light: { label: "浅色模式", Icon: Sun },
    dark: { label: "深色模式", Icon: Moon },
  };
  const nextTheme = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
  const CurrentThemeIcon = themeMeta[theme].Icon;

  return (
    <header
      data-tauri-drag-region
      className="h-13 shrink-0 px-4 flex items-center justify-between gap-3 bg-[var(--sidebar)] border-b border-[var(--border)] select-none"
    >
      {/* Left: leave breathing room for native macOS Overlay traffic lights */}
      <div
        data-tauri-drag-region
        className={`flex items-center gap-2 min-w-0 ${inTauri ? "pl-16" : ""}`}
      >
        <BrandLogo className="w-6 h-6 shrink-0" />

        <div data-tauri-drag-region className="flex items-center gap-2 min-w-0">
          <span className="font-semibold text-sm tracking-tight truncate">FVM Orbit</span>
          <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono">
            CLI {fvmVer}
          </span>
          <span className="hidden lg:inline-flex items-center text-xs px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] font-mono">
            {archLabel}
          </span>
        </div>
      </div>

      {/* Center: Command Palette Trigger */}
      <button
        type="button"
        onClick={() => setCmdkOpen(true)}
        className="hidden md:flex items-center justify-between gap-4 w-72 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition text-xs text-[var(--muted-foreground)] cursor-pointer"
      >
        <span className="flex items-center gap-2 truncate">
          <Search className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">搜索版本、项目或 FVM 指令…</span>
        </span>
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Right: Proxy Pill + Refresh + Theme + Settings + Quick Switch Popover */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => openSettings("proxy")}
          title={`当前下载网络：${proxySummary.statusLabel}（点击配置代理）`}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${proxyDotClass}`} />
          <span className="max-w-[132px] truncate">{proxySummary.titleLabel}</span>
        </button>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading}
          title="刷新本地 FVM 状态"
          className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>

        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          title={`主题：${themeMeta[theme].label}（点击切换为${themeMeta[nextTheme].label}）`}
          aria-label={`主题：${themeMeta[theme].label}`}
          className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
        >
          <CurrentThemeIcon className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => openSettings()}
          title="设置 (⌘,)"
          aria-label="打开设置"
          className={`p-1.5 rounded-lg border transition cursor-pointer ${
            settingsOpen
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
              : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          }`}
        >
          <Settings className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setMenubarOpen(!menubarOpen)}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition cursor-pointer ${
            menubarOpen
              ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
              : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)]"
          }`}
          title="打开快切舱浮窗（同时常驻 macOS 顶栏托盘）"
        >
          <PanelTop className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">快切舱</span>
        </button>
      </div>
    </header>
  );
}
