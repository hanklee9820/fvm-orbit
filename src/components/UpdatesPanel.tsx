import {
  AlertCircle,
  ArrowUpCircle,
  CheckCircle2,
  Download,
  ExternalLink,
  FolderOpen,
  Globe,
  Info,
  Loader2,
  PackageCheck,
  RefreshCw,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useI18n } from "../i18n/useI18n";
import { openExternalUrl, revealPathInFinder } from "../services/fvmBridge";
import {
  FALLBACK_APP_VERSION,
  formatBytes,
  resolveEffectiveAppIcon,
  useFvmStore,
} from "../store/useFvmStore";

const DEFAULT_REPO_URL = "https://github.com/hanklee9820/fvm-orbit";
const DEFAULT_RELEASES_URL = "https://github.com/hanklee9820/fvm-orbit/releases";

function formatPublishedDate(iso: string | null, locale: "zh" | "en"): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return iso.slice(0, 10);
  try {
    return new Intl.DateTimeFormat(locale === "zh" ? "zh-CN" : "en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    }).format(parsed);
  } catch {
    return iso.slice(0, 10);
  }
}

function renderInlineMarkdown(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      nodes.push(text.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith("**") && token.endsWith("**")) {
      nodes.push(
        <strong key={key++} className="font-semibold text-[var(--foreground)]">
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("`") && token.endsWith("`")) {
      nodes.push(
        <code
          key={key++}
          className="px-1 py-0.5 rounded bg-[var(--secondary)] text-[var(--code-foreground)] font-mono text-[11px]"
        >
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/.exec(token);
      if (linkMatch) {
        const [, label, href] = linkMatch;
        nodes.push(
          <button
            key={key++}
            type="button"
            onClick={() => void openExternalUrl(href)}
            className="text-[var(--link)] hover:underline cursor-pointer inline"
          >
            {label}
          </button>
        );
      } else {
        nodes.push(token);
      }
    }
    lastIndex = match.index + token.length;
  }

  if (lastIndex < text.length) {
    nodes.push(text.slice(lastIndex));
  }
  return nodes;
}

function ReleaseNotesBlock({ notes }: { notes: string }) {
  const lines = notes.replace(/\r\n/g, "\n").split("\n");
  return (
    <div className="space-y-1.5 text-xs text-[var(--muted-foreground)] leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return null;
        if (line.startsWith("### ")) {
          return (
            <div key={idx} className="pt-1 font-semibold text-[var(--foreground)]">
              {renderInlineMarkdown(line.slice(4))}
            </div>
          );
        }
        if (line.startsWith("## ") || line.startsWith("# ")) {
          const title = line.replace(/^#{1,2}\s+/, "");
          return (
            <div key={idx} className="pt-1 text-xs font-semibold text-[var(--foreground)]">
              {renderInlineMarkdown(title)}
            </div>
          );
        }
        if (line.startsWith("- ") || line.startsWith("* ")) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span className="mt-1.5 w-1 h-1 rounded-full bg-[var(--primary)] shrink-0" />
              <span className="min-w-0 break-words">{renderInlineMarkdown(line.slice(2))}</span>
            </div>
          );
        }
        return (
          <p key={idx} className="break-words">
            {renderInlineMarkdown(line)}
          </p>
        );
      })}
    </div>
  );
}

export function UpdatesPanel() {
  const { locale, t } = useI18n();
  const {
    appVersionInfo,
    snapshot,
    theme,
    appIconStyle,
    autoCheckUpdates,
    skippedUpdateVersion,
    checkingUpdates,
    updateResult,
    updateError,
    updateCheckedAt,
    updateDownload,
    setAutoCheckUpdates,
    skipUpdateVersion,
    checkForUpdates,
    downloadRecommendedUpdate,
    cancelUpdateDownload,
    openDownloadedInstaller,
    openAbout,
    setSettingsTab,
  } = useFvmStore();

  const effectiveIcon = resolveEffectiveAppIcon(appIconStyle, theme);
  const currentVersion =
    appVersionInfo?.version ?? updateResult?.currentVersion ?? FALLBACK_APP_VERSION;
  const osRaw = (appVersionInfo?.os ?? snapshot?.context.osLabel ?? "").toLowerCase();
  const osDisplay =
    osRaw === "windows" ? "Windows" : osRaw === "linux" ? "Linux" : "macOS";
  const archRaw = appVersionInfo?.arch ?? snapshot?.context.archLabel ?? "";
  const archDisplay = archRaw === "aarch64" ? "arm64" : archRaw;
  const platformLabel = `${osDisplay} ${archDisplay}`.trim();
  const repoUrl = appVersionInfo?.repoUrl ?? DEFAULT_REPO_URL;
  const releasesUrl = updateResult?.releaseUrl ?? appVersionInfo?.releasesUrl ?? DEFAULT_RELEASES_URL;

  const isSkippedLatest = Boolean(
    updateResult?.hasUpdate &&
      skippedUpdateVersion &&
      updateResult.latestVersion === skippedUpdateVersion
  );

  const publishedDate = formatPublishedDate(updateResult?.publishedAt ?? null, locale);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-0.5 min-w-0 flex-1">
          <h3 className="text-sm font-semibold">{t("settings.updates.heading")}</h3>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            {t("settings.updates.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => openAbout()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 text-xs font-medium transition cursor-pointer shrink-0"
          >
            <Info className="w-3 h-3" />
            <span>{t("settings.updates.openAboutBtn")}</span>
          </button>
          <button
            type="button"
            onClick={() => void openExternalUrl(repoUrl)}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 text-xs font-medium transition cursor-pointer shrink-0"
          >
            <span>{t("settings.updates.openRepoBtn")}</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* App Identity & Manual Check Card */}
      <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <img
            src={effectiveIcon === "light" ? "/icons/app-icon-light.png" : "/icons/app-icon-dark.png"}
            alt="FVM Orbit"
            className="w-10 h-10 rounded-xl object-contain shrink-0"
          />
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-sm font-semibold whitespace-nowrap">FVM Orbit</span>
              <span className="px-1.5 py-0.5 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs font-semibold whitespace-nowrap">
                v{currentVersion}
              </span>
              {platformLabel && (
                <span className="px-2 py-0.5 rounded-full bg-[var(--card)] border border-[var(--border)] text-[var(--muted-foreground)] font-mono text-[11px] whitespace-nowrap">
                  {platformLabel}
                </span>
              )}
            </div>
            <div className="text-xs text-[var(--muted-foreground)] truncate">
              {updateCheckedAt
                ? t("settings.updates.lastChecked", { time: updateCheckedAt })
                : t("settings.updates.notCheckedYet")}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void checkForUpdates({ manual: true })}
          disabled={checkingUpdates}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 text-xs font-semibold transition cursor-pointer disabled:opacity-60 shrink-0 whitespace-nowrap"
        >
          {checkingUpdates ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          <span>
            {checkingUpdates
              ? t("settings.updates.checkingBtn")
              : t("settings.updates.checkNowBtn")}
          </span>
        </button>
      </div>

      {/* Auto-Check Preference */}
      <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-between gap-3">
        <div className="space-y-0.5 min-w-0">
          <div className="text-xs font-semibold">{t("settings.updates.autoCheckTitle")}</div>
          <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
            {t("settings.updates.autoCheckDesc")}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={autoCheckUpdates}
          onClick={() => setAutoCheckUpdates(!autoCheckUpdates)}
          className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
            autoCheckUpdates ? "bg-[var(--primary)]" : "bg-[var(--secondary)]"
          }`}
        >
          <span
            className={`inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform ${
              autoCheckUpdates ? "translate-x-[18px]" : "translate-x-[3px]"
            }`}
          />
        </button>
      </div>

      {/* Dynamic Update Result / Progress / Error Panel */}
      {checkingUpdates ? (
        <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center gap-3 text-xs text-[var(--muted-foreground)]">
          <Loader2 className="w-4 h-4 animate-spin text-[var(--primary)] shrink-0" />
          <span>{t("settings.updates.checkingHint")}</span>
        </div>
      ) : updateError ? (
        <div className="p-4 rounded-xl bg-[var(--error)]/10 border border-[var(--error)]/35 space-y-3 text-xs">
          <div className="flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
            <div className="space-y-1 min-w-0">
              <div className="font-semibold text-[var(--error)]">
                {t("settings.updates.errorTitle")}
              </div>
              <p className="text-[var(--foreground)]/85 break-words font-mono text-[11px]">
                {updateError}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <button
              type="button"
              onClick={() => void checkForUpdates({ manual: true })}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--error)] text-white font-medium hover:opacity-90 transition cursor-pointer"
            >
              <RefreshCw className="w-3 h-3" />
              <span>{t("settings.updates.retryBtn")}</span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsTab("proxy")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] hover:border-[var(--primary)] font-medium transition cursor-pointer"
            >
              <Globe className="w-3 h-3" />
              <span>{t("settings.updates.openProxyBtn")}</span>
            </button>
          </div>
        </div>
      ) : updateResult?.hasUpdate ? (
        <div className="p-4 rounded-xl bg-[var(--primary)]/8 border border-[var(--primary)]/45 space-y-3.5 text-xs">
          {/* New Version Header */}
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="flex items-start gap-2.5 min-w-0">
              <ArrowUpCircle className="w-4 h-4 text-[var(--primary)] shrink-0 mt-0.5" />
              <div className="space-y-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-[var(--foreground)]">
                    {t("settings.updates.newVersionTitle", {
                      version: updateResult.latestVersion,
                    })}
                  </span>
                  <span className="px-2 py-0.5 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] font-mono text-[11px] font-semibold">
                    {t("settings.updates.versionDelta", {
                      current: updateResult.currentVersion,
                      latest: updateResult.latestVersion,
                    })}
                  </span>
                  {updateResult.prerelease && (
                    <span className="px-2 py-0.5 rounded-md bg-[var(--warning)]/15 text-[var(--warning)] text-[11px] font-medium">
                      {t("settings.updates.prereleaseBadge")}
                    </span>
                  )}
                </div>
                {publishedDate && (
                  <div className="text-[var(--muted-foreground)]">
                    {t("settings.updates.publishedAt", { date: publishedDate })}
                  </div>
                )}
              </div>
            </div>
          </div>

          {isSkippedLatest && (
            <div className="px-3 py-2 rounded-lg bg-[var(--warning)]/12 border border-[var(--warning)]/35 text-[var(--warning)] flex flex-wrap items-center justify-between gap-2">
              <span>
                {t("settings.updates.skippedNotice", { version: updateResult.latestVersion })}
              </span>
              <button
                type="button"
                onClick={() => skipUpdateVersion(null)}
                className="underline font-semibold cursor-pointer shrink-0"
              >
                {t("settings.updates.unskipBtn")}
              </button>
            </div>
          )}

          {/* Release Notes */}
          <div className="space-y-1.5">
            <div className="font-medium text-[var(--muted-foreground)]">
              {t("settings.updates.releaseNotesHeading")}
            </div>
            <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] max-h-40 overflow-y-auto scroll-thin">
              {updateResult.releaseNotes ? (
                <ReleaseNotesBlock notes={updateResult.releaseNotes} />
              ) : (
                <p className="text-[var(--muted-foreground)]">
                  {t("settings.updates.noReleaseNotes")}
                </p>
              )}
            </div>
          </div>

          {/* Matched Installer Download Card */}
          {updateResult.recommendedAsset && (
            <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--border)] space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-0.5 min-w-0">
                  <div className="text-[11px] text-[var(--muted-foreground)]">
                    {t("settings.updates.recommendedAssetLabel")}
                  </div>
                  <div className="font-mono font-semibold text-[var(--foreground)] truncate">
                    {updateResult.recommendedAsset.name}
                  </div>
                </div>
                {updateResult.recommendedAsset.sizeBytes > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono tabular-nums text-[11px] shrink-0">
                    {formatBytes(updateResult.recommendedAsset.sizeBytes)}
                  </span>
                )}
              </div>

              {updateDownload.status === "downloading" ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="text-[var(--muted-foreground)] truncate">
                      {t("settings.updates.downloadingLabel", {
                        name: updateDownload.assetName ?? updateResult.recommendedAsset.name,
                      })}
                    </span>
                    <span className="font-mono tabular-nums font-medium shrink-0">
                      {formatBytes(updateDownload.downloadedBytes)}
                      {updateDownload.totalBytes > 0
                        ? ` / ${formatBytes(updateDownload.totalBytes)}`
                        : ""}
                      {updateDownload.percent !== null ? ` · ${updateDownload.percent}%` : ""}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-[var(--secondary)] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[var(--primary)] transition-all duration-200"
                      style={{ width: `${updateDownload.percent ?? 25}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={() => void cancelUpdateDownload()}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 font-medium cursor-pointer"
                    >
                      <X className="w-3 h-3" />
                      <span>{t("settings.updates.cancelDownloadBtn")}</span>
                    </button>
                  </div>
                </div>
              ) : updateDownload.status === "downloaded" && updateDownload.savedPath ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5 text-[var(--success)] font-medium">
                    <PackageCheck className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("settings.updates.downloadedReadyTitle")}</span>
                  </div>
                  <div className="font-mono text-[11px] text-[var(--muted-foreground)] truncate select-text">
                    {updateDownload.savedPath}
                  </div>
                  <div className="flex flex-wrap items-center gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => void openDownloadedInstaller()}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--success)] text-white font-semibold hover:opacity-90 transition cursor-pointer"
                    >
                      <PackageCheck className="w-3.5 h-3.5" />
                      <span>{t("settings.updates.openInstallerBtn")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void revealPathInFinder(updateDownload.savedPath!)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 font-medium transition cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      <span>{t("settings.updates.revealInFinderBtn")}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void downloadRecommendedUpdate()}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] transition cursor-pointer"
                    >
                      <RefreshCw className="w-3 h-3" />
                      <span>{t("settings.updates.redownloadBtn")}</span>
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {updateDownload.status === "error" && updateDownload.error && (
                    <div className="text-[var(--error)] font-mono text-[11px] break-words">
                      {updateDownload.error}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => void downloadRecommendedUpdate()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 font-semibold transition cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("settings.updates.downloadBtn")}</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Footer Action Row */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void openExternalUrl(releasesUrl)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition cursor-pointer ${
                  updateResult.recommendedAsset
                    ? "bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)] font-medium"
                    : "bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 font-semibold"
                }`}
              >
                <span>{t("settings.updates.openGithubBtn")}</span>
                <ExternalLink className="w-3 h-3" />
              </button>
              {!isSkippedLatest && (
                <button
                  type="button"
                  onClick={() => skipUpdateVersion(updateResult.latestVersion)}
                  className="px-2.5 py-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--card)] transition cursor-pointer"
                >
                  {t("settings.updates.skipVersionBtn")}
                </button>
              )}
            </div>
          </div>

          {/* Route / Fallback Metadata */}
          <div className="pt-2 border-t border-[var(--border)]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted-foreground)]">
            <span>
              {updateResult.proxyUsed
                ? t("settings.updates.viaProxyNote", { proxy: updateResult.proxyUsed })
                : t("settings.updates.viaDirectNote")}
            </span>
            {updateResult.checkedVia === "github-redirect" && (
              <span>{t("settings.updates.redirectFallbackNote")}</span>
            )}
          </div>
        </div>
      ) : updateResult ? (
        <div className="p-4 rounded-xl bg-[var(--success)]/10 border border-[var(--success)]/35 space-y-2.5 text-xs">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-4 h-4 text-[var(--success)] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <div className="font-semibold text-[var(--success)]">
                  {t("settings.updates.upToDateTitle")}
                </div>
                <p className="text-[var(--foreground)]/85 leading-relaxed">
                  {updateResult.checkedVia === "no-release"
                    ? t("settings.updates.noReleaseDesc", {
                        version: updateResult.currentVersion,
                      })
                    : t("settings.updates.upToDateDesc", {
                        version: updateResult.currentVersion,
                      })}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void openExternalUrl(releasesUrl)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--foreground)] font-medium transition cursor-pointer shrink-0"
            >
              <span>{t("settings.updates.openGithubBtn")}</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
          <div className="pt-2 border-t border-[var(--border)]/60 flex flex-wrap items-center justify-between gap-2 text-[11px] text-[var(--muted-foreground)]">
            <span>
              {updateResult.proxyUsed
                ? t("settings.updates.viaProxyNote", { proxy: updateResult.proxyUsed })
                : t("settings.updates.viaDirectNote")}
            </span>
            {publishedDate && (
              <span>{t("settings.updates.publishedAt", { date: publishedDate })}</span>
            )}
          </div>
        </div>
      ) : (
        <div className="p-4 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted-foreground)] leading-relaxed">
          {t("settings.updates.idleHint")}
        </div>
      )}
    </div>
  );
}
