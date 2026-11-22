import {
  ArrowUpCircle,
  ArrowUpRight,
  Check,
  CheckCircle2,
  Copy,
  Cpu,
  Globe,
  HardDrive,
  Layers,
  Loader2,
  MessageSquare,
  RefreshCw,
  Tag,
  Terminal,
  X,
} from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import { openExternalUrl } from "../services/fvmBridge";
import {
  FALLBACK_APP_VERSION,
  formatBytes,
  hasVisibleAppUpdate,
  resolveEffectiveAppIcon,
  resolveEffectiveTheme,
  useFvmStore,
} from "../store/useFvmStore";

const WEBSITE_URL = "https://hanklee9820.github.io/fvm-orbit/";
const DEFAULT_REPO_URL = "https://github.com/hanklee9820/fvm-orbit";
const DEFAULT_RELEASES_URL = "https://github.com/hanklee9820/fvm-orbit/releases";
const ISSUES_URL = "https://github.com/hanklee9820/fvm-orbit/issues";
const FVM_REPO_URL = "https://github.com/btwld/fvm";
const FVM_DOCS_URL = "https://fvm.app/documentation/getting-started/overview";
const TAURI_URL = "https://v2.tauri.app/";
const AUTHOR_URL = "https://github.com/hanklee9820";

function GitHubIcon({ className = "w-3.5 h-3.5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.02 10.02 0 0 0 22 12.017C22 6.484 17.522 2 12 2Z" />
    </svg>
  );
}

export function AboutModal() {
  const { t } = useI18n();
  const {
    aboutOpen,
    closeAbout,
    theme,
    appIconStyle,
    snapshot,
    appVersionInfo,
    checkingUpdates,
    updateResult,
    skippedUpdateVersion,
    checkForUpdates,
    openSettings,
    pushToast,
  } = useFvmStore();

  const [effectiveTheme, setEffectiveTheme] = useState<"dark" | "light">(() =>
    resolveEffectiveTheme(theme)
  );
  const [copiedVersion, setCopiedVersion] = useState(false);
  const [copiedInfo, setCopiedInfo] = useState(false);
  const versionTimerRef = useRef<number | null>(null);
  const infoTimerRef = useRef<number | null>(null);
  const rawUid = useId().replace(/:/g, "");

  useEffect(() => {
    setEffectiveTheme(resolveEffectiveTheme(theme));
    if (theme !== "system" || typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setEffectiveTheme(mq.matches ? "dark" : "light");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  useEffect(() => {
    return () => {
      if (versionTimerRef.current) window.clearTimeout(versionTimerRef.current);
      if (infoTimerRef.current) window.clearTimeout(infoTimerRef.current);
    };
  }, []);

  useEffect(() => {
    if (!aboutOpen) {
      setCopiedVersion(false);
      setCopiedInfo(false);
    }
  }, [aboutOpen]);

  if (!aboutOpen) return null;

  const effectiveIcon =
    appIconStyle === "auto"
      ? effectiveTheme
      : resolveEffectiveAppIcon(appIconStyle, theme);
  const currentVersion =
    appVersionInfo?.version ?? updateResult?.currentVersion ?? FALLBACK_APP_VERSION;

  const osRaw = (appVersionInfo?.os ?? snapshot?.context.osLabel ?? "").toLowerCase();
  const osDisplay =
    osRaw === "windows" ? "Windows" : osRaw === "linux" ? "Linux" : "macOS";
  const archRaw = appVersionInfo?.arch ?? snapshot?.context.archLabel ?? "";
  const archDisplay = archRaw === "aarch64" ? "arm64" : archRaw;
  const platformLabel = `${osDisplay} ${archDisplay}`.trim();

  const repoUrl = appVersionInfo?.repoUrl ?? DEFAULT_REPO_URL;
  const releasesUrl = appVersionInfo?.releasesUrl ?? DEFAULT_RELEASES_URL;
  const hasUpdate = hasVisibleAppUpdate(updateResult, skippedUpdateVersion);

  const fvmVersion = snapshot?.context.fvmVersion ?? null;
  const globalSdk = snapshot?.context.globalVersion ?? null;
  const sdkCount = snapshot?.versions.length ?? 0;
  const projectCount = snapshot?.projects.length ?? 0;
  const cacheSizeLabel = snapshot
    ? snapshot.totalCacheBytes > 0
      ? formatBytes(snapshot.totalCacheBytes)
      : snapshot.totalCacheSizeLabel
    : null;

  const uid = `${rawUid}-${effectiveTheme}`;
  const orbitRingId = `about-orbit-ring-${uid}`;
  const orbitLeadId = `about-orbit-lead-${uid}`;
  const orbitGlowId = `about-orbit-glow-${uid}`;

  const handleCopyVersion = () => {
    const text = `FVM Orbit v${currentVersion}`;
    void navigator.clipboard?.writeText(text);
    setCopiedVersion(true);
    pushToast(t("common.copied", { text }), "info");
    if (versionTimerRef.current) window.clearTimeout(versionTimerRef.current);
    versionTimerRef.current = window.setTimeout(() => setCopiedVersion(false), 1600);
  };

  const handleCopyDiagnostics = () => {
    const lines = [
      `FVM Orbit: v${currentVersion} (${platformLabel})`,
      `FVM CLI: ${fvmVersion ? `v${fvmVersion}` : "N/A"}`,
      `Global SDK: ${globalSdk ?? "Not set"}`,
      snapshot
        ? `Workspace: ${sdkCount} SDKs (${cacheSizeLabel ?? "0 B"}) · ${projectCount} projects`
        : "Workspace: Unavailable",
      `Core Stack: Tauri v2 · Rust · React 19`,
    ];
    void navigator.clipboard?.writeText(lines.join("\n"));
    setCopiedInfo(true);
    pushToast(t("toast.diagnosticsCopied"), "success");
    if (infoTimerRef.current) window.clearTimeout(infoTimerRef.current);
    infoTimerRef.current = window.setTimeout(() => setCopiedInfo(false), 1800);
  };

  const handleUpdateAction = () => {
    closeAbout();
    if (hasUpdate) {
      openSettings("updates");
    } else {
      void checkForUpdates({ manual: true, openModal: true });
    }
  };

  const quickLinks = [
    {
      id: "website",
      label: t("about.linkWebsite"),
      url: WEBSITE_URL,
      icon: <Globe className="w-3.5 h-3.5 text-[var(--accent)] shrink-0" />,
    },
    {
      id: "github",
      label: t("about.linkGithub"),
      url: repoUrl,
      icon: <GitHubIcon className="w-3.5 h-3.5 text-[var(--foreground)] shrink-0" />,
    },
    {
      id: "releases",
      label: t("about.linkReleases"),
      url: releasesUrl,
      icon: <Tag className="w-3.5 h-3.5 text-[var(--primary)] shrink-0" />,
    },
    {
      id: "issues",
      label: t("about.linkIssues"),
      url: ISSUES_URL,
      icon: <MessageSquare className="w-3.5 h-3.5 text-[var(--chart-4)] shrink-0" />,
    },
  ];

  const currentYear = Math.max(2026, new Date().getFullYear());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs animate-about-backdrop"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeAbout();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("about.dialogAria")}
        className="w-full max-w-[456px] rounded-2xl bg-[var(--card)] border border-[var(--border)] glass-elevated overflow-hidden flex flex-col max-h-[90vh] animate-about-card"
      >
        {/* Atmospheric Orbital Hero Header */}
        <div
          className="relative overflow-hidden px-6 pt-6 pb-5 text-center border-b border-[var(--border)] shrink-0"
          style={{ background: "var(--about-hero-bg)" }}
        >
          {/* Parametric Orbital Geometry Backdrop */}
          <svg
            className="pointer-events-none absolute inset-0 w-full h-full select-none"
            viewBox="0 0 456 220"
            preserveAspectRatio="xMidYMid slice"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id={orbitRingId} x1="12%" y1="90%" x2="88%" y2="10%">
                <stop
                  offset="0%"
                  style={{ stopColor: "var(--logo-orbit-start)", stopOpacity: 0.28 }}
                />
                <stop
                  offset="50%"
                  style={{ stopColor: "var(--logo-orbit-start)", stopOpacity: 0.1 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: "var(--logo-orbit-end)", stopOpacity: 0.48 }}
                />
              </linearGradient>
              <linearGradient
                id={orbitLeadId}
                x1="104.2"
                y1="55.9"
                x2="366.9"
                y2="64.3"
                gradientUnits="userSpaceOnUse"
              >
                <stop
                  offset="0%"
                  style={{ stopColor: "var(--logo-orbit-start)", stopOpacity: 0 }}
                />
                <stop
                  offset="48%"
                  style={{ stopColor: "var(--logo-orbit-start)", stopOpacity: 0.44 }}
                />
                <stop
                  offset="100%"
                  style={{ stopColor: "var(--logo-orbit-end)", stopOpacity: 0.96 }}
                />
              </linearGradient>
              <radialGradient id={orbitGlowId} cx="50%" cy="50%" r="50%">
                <stop offset="0%" style={{ stopColor: "var(--logo-node)", stopOpacity: 0.78 }} />
                <stop offset="52%" style={{ stopColor: "var(--logo-node)", stopOpacity: 0.22 }} />
                <stop offset="100%" style={{ stopColor: "var(--logo-node)", stopOpacity: 0 }} />
              </radialGradient>
            </defs>

            {/* Primary tilted FVM Orbit ellipse (kept strictly within visible hero bounds) */}
            <g transform="rotate(-16 228 76)">
              <ellipse
                cx="228"
                cy="76"
                rx="146"
                ry="38"
                fill="none"
                stroke={`url(#${orbitRingId})`}
                strokeWidth="1.25"
                style={{ opacity: "var(--about-orbit-opacity)" }}
              />
              <path
                d="M 104.2,55.9 A 146,38 0 0 1 366.9,64.3"
                fill="none"
                stroke={`url(#${orbitLeadId})`}
                strokeWidth="1.75"
                strokeLinecap="round"
                style={{ opacity: "var(--about-orbit-lead-opacity)" }}
              />
              {/* Cyan satellite node centered cleanly on ellipse */}
              <circle
                cx="366.9"
                cy="64.3"
                r="13"
                fill={`url(#${orbitGlowId})`}
                className="orbit-node-pulse"
              />
              <circle cx="366.9" cy="64.3" r="3" style={{ fill: "var(--logo-node)" }} />
              <circle cx="366.1" cy="63.5" r="1" fill="#ffffff" fillOpacity="0.9" />
              {/* Distant amethyst micro-node on opposite arc */}
              <circle
                cx="92.6"
                cy="90.2"
                r="2.1"
                style={{ fill: "var(--logo-orbit-start)", opacity: 0.58 }}
              />
            </g>

            {/* Secondary whisper-fine counter-tilted dashed ring */}
            <g transform="rotate(13 228 76)">
              <ellipse
                cx="228"
                cy="76"
                rx="108"
                ry="29"
                fill="none"
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="3 5"
                opacity="0.52"
              />
            </g>
          </svg>

          {/* Top-right Close Button */}
          <button
            type="button"
            onClick={closeAbout}
            title={t("about.closeTooltip")}
            aria-label={t("about.closeAria")}
            className="absolute top-3.5 right-3.5 z-10 p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)]/80 transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Centerpiece Squircle App Icon */}
          <div className="relative z-10 mx-auto mb-2.5 w-[88px] h-[88px] flex items-center justify-center">
            <div
              className="pointer-events-none absolute -inset-2 rounded-full blur-xl"
              style={{ background: "var(--about-icon-glow)" }}
            />
            <img
              src={
                effectiveIcon === "light"
                  ? "/icons/app-icon-light.png"
                  : "/icons/app-icon-dark.png"
              }
              alt="FVM Orbit"
              draggable={false}
              className="relative w-[88px] h-[88px] object-contain drop-shadow-[0_14px_26px_rgba(0,0,0,0.34)] transition-transform duration-300 hover:scale-105 select-none"
            />
          </div>

          {/* Brand Wordmark & Tagline */}
          <h2 className="relative z-10 text-xl font-bold tracking-tight text-[var(--foreground)]">
            FVM Orbit
          </h2>
          <p className="relative z-10 mt-1 text-xs text-[var(--muted-foreground)] leading-relaxed max-w-[330px] mx-auto">
            {t("about.tagline")}
          </p>

          {/* Version, Platform & Live Update Status Pills */}
          <div className="relative z-10 mt-3.5 flex flex-wrap items-center justify-center gap-1.5">
            <button
              type="button"
              onClick={handleCopyVersion}
              title={t("about.copyVersionTooltip")}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--secondary)]/90 border border-[var(--border)] hover:border-[var(--primary)]/60 text-xs font-mono font-semibold text-[var(--foreground)] transition cursor-pointer"
            >
              <span className="tabular-nums">v{currentVersion}</span>
              {copiedVersion ? (
                <Check className="w-3 h-3 text-[var(--success)]" />
              ) : (
                <Copy className="w-3 h-3 text-[var(--muted-foreground)] opacity-75" />
              )}
            </button>

            {platformLabel && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-full bg-[var(--background)]/85 border border-[var(--border)] text-xs font-mono text-[var(--muted-foreground)]">
                {platformLabel}
              </span>
            )}

            {hasUpdate && updateResult ? (
              <button
                type="button"
                onClick={handleUpdateAction}
                title={t("about.updateAvailableTooltip", { version: updateResult.latestVersion })}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--primary)]/15 border border-[var(--primary)]/50 hover:bg-[var(--primary)]/22 text-xs font-mono font-semibold text-[var(--primary)] transition cursor-pointer"
              >
                <ArrowUpCircle className="w-3 h-3 shrink-0" />
                <span>{t("about.updateAvailableBadge", { version: updateResult.latestVersion })}</span>
              </button>
            ) : updateResult ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-[var(--success)]/12 border border-[var(--success)]/35 text-xs font-medium text-[var(--success)]">
                <CheckCircle2 className="w-3 h-3 shrink-0" />
                <span>{t("about.upToDateBadge")}</span>
              </span>
            ) : null}
          </div>
        </div>

        {/* Body: Live Telemetry Grid, Quick Links & Credits */}
        <div className="px-5 py-4 space-y-3.5 overflow-y-auto scroll-thin">
          {/* 2×2 Live Environment Telemetry Bento */}
          <div className="grid grid-cols-2 gap-2">
            <div className="px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <Terminal className="w-3 h-3 shrink-0 text-[var(--accent)]" />
                <span className="truncate">{t("about.fvmCliLabel")}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs font-mono font-semibold text-[var(--foreground)] truncate tabular-nums">
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    fvmVersion ? "bg-[var(--success)]" : "bg-[var(--muted-foreground)]/60"
                  }`}
                />
                <span className="truncate">
                  {fvmVersion ? `v${fvmVersion}` : t("about.notDetected")}
                </span>
              </div>
            </div>

            <div className="px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <Layers className="w-3 h-3 shrink-0 text-[var(--primary)]" />
                <span className="truncate">{t("about.globalSdkLabel")}</span>
              </div>
              <div className="text-xs font-mono font-semibold text-[var(--foreground)] truncate tabular-nums">
                {globalSdk ?? t("common.notSet")}
              </div>
            </div>

            <div
              className="px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1 min-w-0"
              title={
                snapshot && cacheSizeLabel
                  ? t("about.workspaceTooltip", {
                      sdks: sdkCount,
                      size: cacheSizeLabel,
                      projects: projectCount,
                    })
                  : undefined
              }
            >
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <HardDrive className="w-3 h-3 shrink-0 text-[var(--chart-4)]" />
                <span className="truncate">{t("about.workspaceLabel")}</span>
              </div>
              <div className="text-xs font-mono font-semibold text-[var(--foreground)] truncate tabular-nums">
                {snapshot && cacheSizeLabel
                  ? t("about.workspaceSummary", { sdks: sdkCount, size: cacheSizeLabel })
                  : "—"}
              </div>
            </div>

            <div className="px-3 py-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1 min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-[var(--muted-foreground)]">
                <Cpu className="w-3 h-3 shrink-0 text-[var(--chart-2)]" />
                <span className="truncate">{t("about.engineLabel")}</span>
              </div>
              <div className="text-xs font-mono font-semibold text-[var(--foreground)] tracking-tight truncate">
                Tauri v2 · Rust · React
              </div>
            </div>
          </div>

          {/* 2×2 Tactile Quick Links */}
          <div className="grid grid-cols-2 gap-2">
            {quickLinks.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => void openExternalUrl(item.url)}
                className="group px-3 py-2 rounded-xl bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)]/60 hover:bg-[var(--sidebar)]/60 transition flex items-center justify-between gap-2 text-xs font-medium text-[var(--foreground)] cursor-pointer min-w-0"
              >
                <span className="flex items-center gap-2 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                <ArrowUpRight className="w-3.5 h-3.5 text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform shrink-0" />
              </button>
            ))}
          </div>

          {/* Ecosystem Credits & Copyright */}
          <div className="pt-0.5 text-center space-y-1 text-[11px] text-[var(--muted-foreground)]">
            <div className="flex flex-wrap items-center justify-center gap-x-1 gap-y-0.5 leading-relaxed">
              <span>{t("about.creditsPrefix")}</span>
              <button
                type="button"
                onClick={() => void openExternalUrl(FVM_REPO_URL)}
                className="font-mono font-medium text-[var(--link)] hover:underline cursor-pointer"
              >
                btwld/fvm
              </button>
              <span>{t("about.creditsAnd")}</span>
              <button
                type="button"
                onClick={() => void openExternalUrl(TAURI_URL)}
                className="font-mono font-medium text-[var(--link)] hover:underline cursor-pointer"
              >
                Tauri v2
              </button>
              {t("about.creditsSuffix") && <span>{t("about.creditsSuffix")}</span>}
              <span className="opacity-50">·</span>
              <button
                type="button"
                onClick={() => void openExternalUrl(FVM_DOCS_URL)}
                className="hover:text-[var(--foreground)] hover:underline transition cursor-pointer"
              >
                {t("about.fvmDocsLink")}
              </button>
            </div>
            <div className="text-[11px] text-[var(--muted-foreground)]/80">
              © {currentYear} FVM Orbit ·{" "}
              <button
                type="button"
                onClick={() => void openExternalUrl(AUTHOR_URL)}
                className="hover:text-[var(--foreground)] hover:underline transition cursor-pointer"
              >
                {t("about.craftedBy", { author: "hanklee9820" })}
              </button>
            </div>
          </div>
        </div>

        {/* Action Footer */}
        <div className="px-5 py-3 bg-[var(--sidebar)] border-t border-[var(--border)] flex items-center justify-between gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCopyDiagnostics}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)]/60 text-xs font-medium text-[var(--foreground)] transition cursor-pointer"
          >
            {copiedInfo ? (
              <Check className="w-3.5 h-3.5 text-[var(--success)]" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-[var(--muted-foreground)]" />
            )}
            <span>{copiedInfo ? t("about.copiedInfoBtn") : t("about.copyInfoBtn")}</span>
          </button>

          <button
            type="button"
            onClick={handleUpdateAction}
            disabled={checkingUpdates}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 text-xs font-semibold transition cursor-pointer disabled:opacity-60"
          >
            {checkingUpdates ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : hasUpdate ? (
              <ArrowUpCircle className="w-3.5 h-3.5" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>
              {checkingUpdates
                ? t("about.checkingUpdatesBtn")
                : hasUpdate && updateResult
                  ? t("about.viewUpdateBtn", { version: updateResult.latestVersion })
                  : t("about.checkUpdatesBtn")}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
