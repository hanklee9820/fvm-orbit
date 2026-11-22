import {
  Activity,
  ArrowUpCircle,
  Box,
  Check,
  ChevronRight,
  FlaskConical,
  GitFork,
  Network,
  Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import {
  FALLBACK_APP_VERSION,
  formatBytes,
  hasVisibleAppUpdate,
  useFvmStore,
} from "../store/useFvmStore";
import type { TabId } from "../types/fvm";

interface HoveredTip {
  label: string;
  sub: string;
  detail: string;
  top: number;
  left: number;
}

export function Sidebar() {
  const { t } = useI18n();
  const {
    activeTab,
    setActiveTab,
    snapshot,
    setGlobalSdk,
    unlinkGlobalSdk,
    pushToast,
    openSettings,
    appVersionInfo,
    updateResult,
    skippedUpdateVersion,
  } = useFvmStore();
  const [hoveredTip, setHoveredTip] = useState<HoveredTip | null>(null);
  const [globalPickerOpen, setGlobalPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!globalPickerOpen) return;
    const onDocClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setGlobalPickerOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGlobalPickerOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [globalPickerOpen]);

  const projectCount = snapshot?.projects.length ?? 0;
  const sdkCount = snapshot?.versions.length ?? 0;
  const cleanupCount =
    (snapshot?.cleanup.upgrades.length ?? 0) + (snapshot?.cleanup.removable.length ?? 0);
  const pathOk = snapshot?.context.pathPriorityOk ?? true;
  const forkCount = snapshot?.context.forks.length ?? 0;
  const totalBytes = snapshot?.totalCacheBytes ?? 0;
  const globalSdk = snapshot?.context.globalVersion;
  const gitCacheOn = snapshot?.context.gitCache ?? true;

  const navItems: {
    id: TabId;
    label: string;
    sub: string;
    detail: string;
    badge: string | null;
    badgeTone?: "warning" | "error" | "success" | "neutral";
    Icon: typeof Network;
  }[] = [
    {
      id: "topology",
      label: t("sidebar.nav.topologyLabel"),
      sub: t("sidebar.nav.topologySub"),
      detail: t("sidebar.nav.topologyDetail"),
      badge: projectCount ? String(projectCount) : null,
      Icon: Network,
    },
    {
      id: "releases",
      label: t("sidebar.nav.releasesLabel"),
      sub: t("sidebar.nav.releasesSub"),
      detail: t("sidebar.nav.releasesDetail"),
      badge: String(sdkCount),
      Icon: Box,
    },
    {
      id: "cleanup",
      label: t("sidebar.nav.cleanupLabel"),
      sub: t("sidebar.nav.cleanupSub"),
      detail: t("sidebar.nav.cleanupDetail"),
      badge: cleanupCount > 0 ? String(cleanupCount) : null,
      badgeTone: cleanupCount > 0 ? "warning" : "neutral",
      Icon: Sparkles,
    },
    {
      id: "spawn",
      label: t("sidebar.nav.spawnLabel"),
      sub: t("sidebar.nav.spawnSub"),
      detail: t("sidebar.nav.spawnDetail"),
      badge: null,
      Icon: FlaskConical,
    },
    {
      id: "doctor",
      label: t("sidebar.nav.doctorLabel"),
      sub: t("sidebar.nav.doctorSub"),
      detail: t("sidebar.nav.doctorDetail"),
      badge: pathOk ? "OK" : "1",
      badgeTone: pathOk ? "success" : "error",
      Icon: Activity,
    },
    {
      id: "config",
      label: t("sidebar.nav.configLabel"),
      sub: t("sidebar.nav.configSub"),
      detail: t("sidebar.nav.configDetail"),
      badge: forkCount ? String(forkCount) : null,
      Icon: GitFork,
    },
  ];

  const gbBarPct = Math.min(100, (totalBytes / (15 * 1024 * 1024 * 1024)) * 100);
  const hasUpdate = hasVisibleAppUpdate(updateResult, skippedUpdateVersion);
  const currentAppVersion =
    appVersionInfo?.version ?? updateResult?.currentVersion ?? FALLBACK_APP_VERSION;

  return (
    <aside className="w-56 shrink-0 bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col justify-between p-3 gap-4 select-none">
      <nav className="space-y-1">
        {navItems.map(({ id, label, sub, detail, badge, badgeTone, Icon }) => {
          const active = activeTab === id;
          const badgeClass = active
            ? badgeTone === "error"
              ? "bg-[var(--error)] text-white font-semibold"
              : badgeTone === "warning"
                ? "bg-[var(--warning)] text-white font-semibold"
                : badgeTone === "success"
                  ? "bg-[var(--success)] text-white font-semibold"
                  : "bg-white/20 text-[var(--primary-foreground)]"
            : badgeTone === "warning"
              ? "bg-[var(--warning)]/20 text-[var(--warning)]"
              : badgeTone === "error"
                ? "bg-[var(--error)]/20 text-[var(--error)]"
                : badgeTone === "success"
                  ? "bg-[var(--success)]/20 text-[var(--success)]"
                  : "bg-[var(--secondary)] text-[var(--secondary-foreground)]";

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              onMouseEnter={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTip({
                  label,
                  sub,
                  detail,
                  top: rect.top + rect.height / 2,
                  left: rect.right + 10,
                });
              }}
              onMouseLeave={() => setHoveredTip(null)}
              onFocus={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                setHoveredTip({
                  label,
                  sub,
                  detail,
                  top: rect.top + rect.height / 2,
                  left: rect.right + 10,
                });
              }}
              onBlur={() => setHoveredTip(null)}
              className={`w-full text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 transition cursor-pointer ${
                active
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "hover:bg-[var(--card)] text-[var(--foreground)]"
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Icon
                  className={`w-4 h-4 shrink-0 ${
                    active ? "text-[var(--primary-foreground)]" : "text-[var(--muted-foreground)]"
                  }`}
                />
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{label}</div>
                  <div
                    className={`text-xs truncate ${
                      active ? "opacity-85" : "text-[var(--muted-foreground)]"
                    }`}
                  >
                    {sub}
                  </div>
                </div>
              </div>
              {badge && (
                <span className={`px-1.5 py-0.5 rounded-md text-xs font-mono shrink-0 ${badgeClass}`}>
                  {badge}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Instant Floating Sidebar Tooltip (never clipped by overflow-hidden) */}
      {hoveredTip && (
        <div
          role="tooltip"
          style={{
            top: hoveredTip.top,
            left: hoveredTip.left,
            transform: "translateY(-50%)",
          }}
          className="fixed z-50 pointer-events-none w-64 px-3 py-2.5 rounded-xl bg-[var(--card)] border border-[var(--border)] glass-elevated space-y-1"
        >
          <div className="text-xs font-semibold text-[var(--foreground)]">
            {hoveredTip.label}
          </div>
          <div className="text-xs font-mono text-[var(--primary)]">
            {hoveredTip.sub}
          </div>
          <div className="text-xs text-[var(--muted-foreground)] leading-relaxed pt-0.5 border-t border-[var(--border)]">
            {hoveredTip.detail}
          </div>
        </div>
      )}

      {/* Bottom Cache & Global Status Card */}
      <div className="space-y-3 pt-3 border-t border-[var(--border)]">
        <div
          ref={pickerRef}
          className="relative p-3 rounded-xl bg-[var(--card)] border border-[var(--card-border)] space-y-2"
        >
          <div className="flex items-center justify-between text-xs gap-2">
            <span className="text-[var(--muted-foreground)] shrink-0">{t("sidebar.globalSdk")}</span>
            <button
              type="button"
              onClick={() => {
                const cached = snapshot?.versions ?? [];
                if (cached.length === 0) {
                  setActiveTab("releases");
                  pushToast(t("sidebar.globalEmptyToast"), "info");
                } else {
                  setGlobalPickerOpen((v) => !v);
                }
              }}
              title={
                globalSdk
                  ? t("sidebar.globalTitleCurrent", { sdk: globalSdk })
                  : (snapshot?.versions.length ?? 0) > 0
                    ? t("sidebar.globalTitlePick")
                    : t("sidebar.globalTitleInstall")
              }
              className="inline-flex items-center gap-0.5 font-mono font-semibold text-[var(--primary)] hover:underline truncate max-w-[112px] cursor-pointer"
            >
              <span className="truncate">{globalSdk ?? t("common.setUp")}</span>
              <ChevronRight className="w-3 h-3 shrink-0 opacity-80" />
            </button>
          </div>

          {/* Inline Global SDK Quick Picker Popover */}
          {globalPickerOpen && (
            <div className="absolute left-0 right-0 bottom-full mb-2 z-50 rounded-xl bg-[var(--card)] border border-[var(--border)] glass-elevated p-2 space-y-1">
              <div className="px-2 py-1 text-xs font-semibold text-[var(--muted-foreground)] flex items-center justify-between">
                <span>{t("sidebar.switchGlobalTitle")}</span>
                {globalSdk && (
                  <button
                    type="button"
                    onClick={() => {
                      setGlobalPickerOpen(false);
                      void unlinkGlobalSdk();
                    }}
                    className="text-[var(--error)] hover:underline font-normal cursor-pointer"
                  >
                    {t("sidebar.unlinkGlobal")}
                  </button>
                )}
              </div>
              <div className="max-h-44 overflow-y-auto scroll-thin space-y-0.5">
                {(snapshot?.versions ?? []).map((v) => (
                  <button
                    key={v.name}
                    type="button"
                    onClick={() => {
                      setGlobalPickerOpen(false);
                      if (!v.isGlobal) void setGlobalSdk(v.name);
                    }}
                    className={`w-full px-2 py-1.5 rounded-lg text-xs font-mono flex items-center justify-between gap-2 cursor-pointer transition ${
                      v.isGlobal
                        ? "bg-[var(--primary)]/15 text-[var(--primary)] font-semibold"
                        : "hover:bg-[var(--sidebar)] text-[var(--foreground)]"
                    }`}
                  >
                    <span className="truncate">{v.name}</span>
                    {v.isGlobal && <Check className="w-3.5 h-3.5 shrink-0" />}
                  </button>
                ))}
              </div>
              <div className="pt-1 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => {
                    setGlobalPickerOpen(false);
                    setActiveTab("releases");
                  }}
                  className="w-full px-2 py-1 rounded-lg text-xs text-[var(--primary)] hover:bg-[var(--sidebar)] text-left cursor-pointer"
                >
                  {t("sidebar.installMoreLink")}
                </button>
              </div>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">{t("sidebar.localCacheFootprint")}</span>
            <span className="font-mono tabular-nums font-medium">
              {totalBytes > 0 ? formatBytes(totalBytes) : snapshot?.totalCacheSizeLabel ?? "0 B"}
            </span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
            <div
              className="h-full rounded-full bg-[var(--primary)] transition-all duration-300"
              style={{ width: `${gbBarPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-xs text-[var(--muted-foreground)]">
            <span className="flex items-center gap-1.5">
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  gitCacheOn ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]"
                }`}
              />
              Git Cache
            </span>
            <span className="font-mono">{gitCacheOn ? "ON" : "OFF"}</span>
          </div>
        </div>

        <div className="px-1 text-xs text-[var(--muted-foreground)] flex items-center justify-between gap-2">
          <span className="truncate">{t("sidebar.poweredBy")}</span>
          <button
            type="button"
            onClick={() => openSettings("updates")}
            title={
              hasUpdate && updateResult
                ? t("sidebar.versionUpdateTooltip", {
                    current: currentAppVersion,
                    latest: updateResult.latestVersion,
                  })
                : t("sidebar.versionCheckTooltip", { version: currentAppVersion })
            }
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md font-mono transition cursor-pointer shrink-0 ${
              hasUpdate && updateResult
                ? "bg-[var(--primary)]/15 text-[var(--primary)] hover:bg-[var(--primary)]/25 font-semibold"
                : "text-[var(--code-foreground)] hover:bg-[var(--card)] hover:text-[var(--foreground)]"
            }`}
          >
            {hasUpdate && updateResult ? (
              <>
                <ArrowUpCircle className="w-3 h-3 shrink-0" />
                <span>v{updateResult.latestVersion}</span>
              </>
            ) : (
              <span>v{currentAppVersion}</span>
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}
