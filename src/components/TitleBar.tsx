import { Languages, Monitor, Moon, PanelTop, RefreshCw, Search, Settings, Sun } from "lucide-react";
import { BrandLogo } from "./BrandLogo";
import { useI18n } from "../i18n/useI18n";
import { getProxyDisplaySummary, useFvmStore } from "../store/useFvmStore";
import { isTauriRuntime } from "../services/fvmBridge";
import type { ThemeMode } from "../types/fvm";

export function TitleBar() {
  const { locale, setLanguage, t } = useI18n();
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
  const proxySummary = getProxyDisplaySummary(proxySettings, systemProxyInfo, locale);
  const proxyDotClass =
    proxySummary.tone === "active"
      ? "bg-[var(--success)]"
      : proxySummary.tone === "warning"
        ? "bg-[var(--warning)]"
        : "bg-[var(--muted-foreground)]";

  const themeOrder: ThemeMode[] = ["system", "light", "dark"];
  const themeMeta: Record<ThemeMode, { label: string; Icon: typeof Sun }> = {
    system: { label: t("titleBar.themeSystem"), Icon: Monitor },
    light: { label: t("titleBar.themeLight"), Icon: Sun },
    dark: { label: t("titleBar.themeDark"), Icon: Moon },
  };
  const nextTheme = themeOrder[(themeOrder.indexOf(theme) + 1) % themeOrder.length];
  const CurrentThemeIcon = themeMeta[theme].Icon;

  const nextLocale = locale === "zh" ? "en" : "zh";
  const currentLangLabel =
    locale === "zh" ? t("common.langNameZh") : t("common.langNameEn");
  const nextLangLabel =
    nextLocale === "zh" ? t("common.langNameZh") : t("common.langNameEn");

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
          <span className="truncate">{t("titleBar.searchPlaceholder")}</span>
        </span>
        <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs shrink-0">
          ⌘K
        </kbd>
      </button>

      {/* Right: Proxy Pill + Refresh + Language + Theme + Settings + Quick Switch Popover */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={() => openSettings("proxy")}
          title={t("titleBar.proxyTooltip", { status: proxySummary.statusLabel })}
          className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-xs font-medium text-[var(--foreground)] transition cursor-pointer"
        >
          <span className={`w-2 h-2 rounded-full shrink-0 ${proxyDotClass}`} />
          <span className="max-w-[132px] truncate">{proxySummary.titleLabel}</span>
        </button>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading}
          title={t("titleBar.refreshTooltip")}
          className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>

        <button
          type="button"
          onClick={() => void setLanguage(nextLocale)}
          title={t("titleBar.languageTooltip", {
            current: currentLangLabel,
            next: nextLangLabel,
          })}
          aria-label={t("titleBar.languageAria")}
          className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] text-xs font-mono transition cursor-pointer"
        >
          <Languages className="w-3.5 h-3.5 shrink-0" />
          <span>{locale === "zh" ? "中" : "EN"}</span>
        </button>

        <button
          type="button"
          onClick={() => setTheme(nextTheme)}
          title={t("titleBar.themeTooltip", {
            current: themeMeta[theme].label,
            next: themeMeta[nextTheme].label,
          })}
          aria-label={t("titleBar.themeAria", { current: themeMeta[theme].label })}
          className="p-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
        >
          <CurrentThemeIcon className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => openSettings()}
          title={t("titleBar.settingsTooltip")}
          aria-label={t("titleBar.settingsAria")}
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
          title={t("titleBar.quickSwitchTooltip")}
        >
          <PanelTop className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">{t("titleBar.quickSwitch")}</span>
        </button>
      </div>
    </header>
  );
}
