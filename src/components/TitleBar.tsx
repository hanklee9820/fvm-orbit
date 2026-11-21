import { Monitor, Moon, PanelTop, RefreshCw, Search, Sun } from "lucide-react";
import { useFvmStore } from "../store/useFvmStore";
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
    refreshAll,
  } = useFvmStore();

  const fvmVer = snapshot?.context.fvmVersion ?? "4.3.2";
  const archLabel =
    snapshot?.context.archLabel === "aarch64"
      ? "macOS arm64"
      : `${snapshot?.context.osLabel ?? "macOS"} ${snapshot?.context.archLabel ?? ""}`.trim();
  const inTauri = isTauriRuntime();

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
        className={`flex items-center gap-2.5 min-w-0 ${inTauri ? "pl-16" : ""}`}
      >
        <div className="w-7 h-7 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] flex items-center justify-center shrink-0">
          <svg
            className="w-4 h-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="3" />
            <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-30 12 12)" />
            <ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(30 12 12)" />
          </svg>
        </div>

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

      {/* Right: Refresh + Theme + Quick Switch Popover */}
      <div className="flex items-center gap-2 shrink-0">
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
