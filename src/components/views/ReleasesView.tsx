import { Check, Download, FolderOpen, Globe, Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { revealPathInFinder } from "../../services/fvmBridge";
import { formatBytes, useFvmStore } from "../../store/useFvmStore";

function channelBadge(ch: string | null | undefined): string {
  if (ch === "stable") return "bg-[var(--success)]/15 text-[var(--success)]";
  if (ch === "beta") return "bg-[var(--chart-2)]/15 text-[var(--chart-2)]";
  if (ch === "dev") return "bg-[var(--warning)]/15 text-[var(--warning)]";
  if (ch === "fork") return "bg-[var(--chart-4)]/15 text-[var(--chart-4)]";
  return "bg-[var(--secondary)] text-[var(--secondary-foreground)]";
}

export function ReleasesView() {
  const { t } = useI18n();
  const {
    snapshot,
    releases,
    loadingReleases,
    installingSdks,
    installSdk,
    removeSdk,
    setGlobalSdk,
    unlinkGlobalSdk,
    refreshReleases,
  } = useFvmStore();

  const [filter, setFilter] = useState<"all" | "stable" | "beta" | "dev" | "installed">("all");
  const [search, setSearch] = useState("");
  const [customInput, setCustomInput] = useState("");
  const [noSetup, setNoSetup] = useState(false);

  const cachedList = snapshot?.versions ?? [];
  const installedSet = useMemo(() => new Set(cachedList.map((v) => v.name)), [cachedList]);
  const trimmedCustom = customInput.trim();
  const isCustomInstalling = Boolean(trimmedCustom && installingSdks[trimmedCustom]);

  const refCountMap = useMemo(() => {
    const map: Record<string, number> = {};
    (snapshot?.projects ?? []).forEach((p) => {
      const used = new Set<string>();
      if (p.pinnedVersion) used.add(p.pinnedVersion);
      Object.values(p.flavors).forEach((v) => used.add(v));
      used.forEach((v) => {
        map[v] = (map[v] ?? 0) + 1;
      });
    });
    return map;
  }, [snapshot?.projects]);

  const filteredReleases = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (releases?.versions ?? []).filter((r) => {
      if (filter === "installed" && !installedSet.has(r.version)) return false;
      if (filter !== "all" && filter !== "installed" && r.channel !== filter) return false;
      if (
        q &&
        !r.version.toLowerCase().includes(q) &&
        !r.dartSdkVersion.toLowerCase().includes(q) &&
        !r.hash.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [releases?.versions, filter, search, installedSet]);

  const channels = [
    {
      name: "stable",
      ver: releases?.channels.stable?.version ?? "3.50.1",
      dart: releases?.channels.stable?.dartSdkVersion ?? "3.14.0",
      date: (releases?.channels.stable?.releaseDate ?? "").slice(0, 10) || "latest",
    },
    {
      name: "beta",
      ver: releases?.channels.beta?.version ?? "3.51.0-0.2.pre",
      dart: releases?.channels.beta?.dartSdkVersion ?? "3.15.0",
      date: (releases?.channels.beta?.releaseDate ?? "").slice(0, 10) || "latest",
    },
    {
      name: "dev",
      ver: releases?.channels.dev?.version ?? "2.13.0-0.1.pre",
      dart: releases?.channels.dev?.dartSdkVersion ?? "2.17.0",
      date: (releases?.channels.dev?.releaseDate ?? "").slice(0, 10) || "legacy",
    },
    {
      name: "master",
      ver: "master",
      dart: "bleeding-edge",
      date: "rolling",
    },
  ];

  return (
    <div className="space-y-5">
      {/* Channel Spotlight Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {channels.map((ch) => {
          const isChannelInstalling = Boolean(installingSdks[ch.ver] || installingSdks[ch.name]);
          const cachedName = installedSet.has(ch.ver)
            ? ch.ver
            : installedSet.has(ch.name)
              ? ch.name
              : null;

          return (
            <div
              key={ch.name}
              className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between">
                <span className={`px-2 py-0.5 rounded-md text-xs font-mono font-semibold ${channelBadge(ch.name)}`}>
                  {ch.name}
                </span>
                <span className="text-xs text-[var(--muted-foreground)] font-mono">{ch.date}</span>
              </div>
              <div>
                <div className="text-sm font-bold font-mono truncate">{ch.ver}</div>
                <div className="text-xs text-[var(--muted-foreground)] font-mono truncate">
                  Dart {ch.dart}
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                {isChannelInstalling ? (
                  <button
                    type="button"
                    disabled
                    aria-busy="true"
                    className="flex-1 inline-flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-[var(--warning)]/15 text-[var(--warning)] text-xs font-semibold cursor-not-allowed"
                  >
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t("common.installing")}</span>
                  </button>
                ) : cachedName ? (
                  <button
                    type="button"
                    onClick={() => void setGlobalSdk(cachedName)}
                    className="flex-1 py-1.5 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs font-medium cursor-pointer hover:opacity-90"
                  >
                    {t("releases.setGlobal")}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void installSdk(ch.ver, { noSetup })}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{t("releases.installChannel", { channel: ch.name })}</span>
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Direct Custom Version / Commit Hash / Fork Installer */}
      <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--border)] flex flex-wrap items-center gap-3">
        <span className="text-xs font-semibold shrink-0">{t("releases.directInstallLabel")}</span>
        <input
          type="text"
          value={customInput}
          onChange={(e) => setCustomInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && trimmedCustom && !isCustomInstalling) {
              void installSdk(trimmedCustom, { noSetup });
              setCustomInput("");
            }
          }}
          placeholder={t("releases.directInstallPlaceholder")}
          className="flex-1 min-w-52 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs font-mono text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none focus:border-[var(--primary)]"
        />
        <label className="inline-flex items-center gap-1.5 text-xs text-[var(--muted-foreground)] cursor-pointer select-none">
          <input
            type="checkbox"
            checked={noSetup}
            onChange={(e) => setNoSetup(e.target.checked)}
            className="accent-[var(--primary)] cursor-pointer"
          />
          <span className="font-mono">--no-setup</span>
        </label>
        <button
          type="button"
          disabled={isCustomInstalling}
          onClick={() => {
            if (!trimmedCustom || isCustomInstalling) return;
            void installSdk(trimmedCustom, { noSetup });
            setCustomInput("");
          }}
          className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
            isCustomInstalling
              ? "bg-[var(--warning)]/15 text-[var(--warning)] cursor-not-allowed"
              : "bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
          }`}
        >
          {isCustomInstalling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
          <span>{isCustomInstalling ? t("common.installing") : "fvm install"}</span>
        </button>
      </div>

      {/* Local Cached SDKs */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex items-center justify-between">
          <span className="text-sm font-semibold">
            {t("releases.localCachedHeading", { count: cachedList.length })}
          </span>
          <span className="text-xs font-mono text-[var(--muted-foreground)]">
            {t("releases.totalUsage", { size: formatBytes(snapshot?.totalCacheBytes ?? 0) })}
          </span>
        </div>

        {cachedList.length === 0 ? (
          <div className="p-6 text-center text-xs text-[var(--muted-foreground)]">
            {t("releases.noCachedEmpty")}
          </div>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {cachedList.map((sdk) => {
              const isSdkInstalling = Boolean(installingSdks[sdk.name]);
              return (
                <div
                  key={sdk.name}
                  className="px-4 py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-[var(--sidebar)]/50 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
                    <span className="font-mono text-sm font-semibold">{sdk.name}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-mono ${channelBadge(sdk.releaseFromChannel ?? sdk.sdkType)}`}>
                      {sdk.releaseFromChannel ?? sdk.sdkType}
                    </span>
                    {sdk.isGlobal && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-[var(--primary)]/15 text-[var(--primary)]">
                        <Globe className="w-3 h-3" />
                        <span>Global</span>
                      </span>
                    )}
                    {isSdkInstalling ? (
                      <span
                        aria-busy="true"
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs bg-[var(--warning)]/15 text-[var(--warning)] font-medium"
                      >
                        <Loader2 className="w-3 h-3 animate-spin" />
                        <span>{t("common.installing")}</span>
                      </span>
                    ) : (
                      <span
                        className={`px-2 py-0.5 rounded text-xs ${
                          sdk.isSetup
                            ? "bg-[var(--success)]/15 text-[var(--success)]"
                            : "bg-[var(--warning)]/15 text-[var(--warning)]"
                        }`}
                      >
                        {sdk.isSetup ? t("releases.readyBadge") : t("releases.notSetupBadge")}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-[var(--muted-foreground)] font-mono">
                    <span>Dart {sdk.dartSdkVersion ?? "--"}</span>
                    <span className="tabular-nums">{formatBytes(sdk.sizeBytes)}</span>
                    <span>{t("releases.projectCount", { count: refCountMap[sdk.name] ?? 0 })}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      title={t("releases.revealInFinder")}
                      onClick={() => void revealPathInFinder(sdk.directory)}
                      className="p-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                    {sdk.isGlobal ? (
                      <button
                        type="button"
                        disabled={isSdkInstalling}
                        onClick={() => void unlinkGlobalSdk()}
                        className="px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("releases.unlinkGlobal")}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={isSdkInstalling}
                        onClick={() => void setGlobalSdk(sdk.name)}
                        className="px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {t("releases.setGlobal")}
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={isSdkInstalling}
                      onClick={() => void removeSdk(sdk.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--error)]/40 text-[var(--error)] hover:bg-[var(--error)]/10 text-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>{t("common.remove")}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Official Release Explorer */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{t("releases.officialHeading")}</span>
            <span className="text-xs font-mono text-[var(--muted-foreground)]">
              fvm api releases ({filteredReleases.length})
            </span>
            <button
              type="button"
              onClick={() => void refreshReleases()}
              disabled={loadingReleases}
              className="p-1 rounded hover:bg-[var(--card)] text-[var(--muted-foreground)] cursor-pointer"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingReleases ? "animate-spin" : ""}`} />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center p-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs">
              {(["all", "stable", "beta", "dev", "installed"] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFilter(f)}
                  className={`px-2.5 py-1 rounded-md cursor-pointer transition ${
                    filter === f
                      ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                      : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                  }`}
                >
                  {f === "all"
                    ? t("releases.filterAll")
                    : f === "installed"
                      ? t("releases.filterInstalled")
                      : f}
                </button>
              ))}
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[var(--muted-foreground)] absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("releases.searchPlaceholder")}
                className="w-48 pl-8 pr-2.5 py-1 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none focus:border-[var(--primary)]"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto max-h-96 overflow-y-auto scroll-thin">
          <table className="w-full text-left border-collapse text-xs">
            <thead className="sticky top-0 bg-[var(--sidebar)] border-b border-[var(--border)] text-[var(--muted-foreground)]">
              <tr>
                <th className="py-2.5 px-4 font-medium">{t("releases.colVersion")}</th>
                <th className="py-2.5 px-3 font-medium">{t("releases.colChannel")}</th>
                <th className="py-2.5 px-3 font-medium">{t("releases.colDart")}</th>
                <th className="py-2.5 px-3 font-medium">{t("releases.colDate")}</th>
                <th className="py-2.5 px-3 font-medium">{t("releases.colCommitArch")}</th>
                <th className="py-2.5 px-4 font-medium text-right">{t("releases.colAction")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)]">
              {filteredReleases.map((r) => {
                const isInst = installedSet.has(r.version);
                const isInstalling = Boolean(installingSdks[r.version]);
                return (
                  <tr
                    key={`${r.version}-${r.hash}`}
                    className={
                      isInstalling
                        ? "bg-[var(--warning)]/5 transition"
                        : "hover:bg-[var(--sidebar)]/50 transition"
                    }
                  >
                    <td className="py-2.5 px-4 font-mono font-semibold">
                      <span>{r.version}</span>
                      {r.activeChannel && (
                        <span className="ml-1.5 px-1.5 py-0.5 rounded text-xs bg-[var(--primary)]/15 text-[var(--primary)]">
                          Latest
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-mono ${channelBadge(r.channel)}`}>
                        {r.channel}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">
                      {r.dartSdkVersion || "--"}
                    </td>
                    <td className="py-2.5 px-3 font-mono tabular-nums text-[var(--muted-foreground)]">
                      {r.releaseDate.slice(0, 10)}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[var(--muted-foreground)]">
                      {r.hash.slice(0, 7)} · {r.dartSdkArch || "arm64"}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {isInstalling ? (
                        <span
                          aria-busy="true"
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--warning)]/15 text-[var(--warning)] font-medium whitespace-nowrap"
                        >
                          <Loader2 className="w-3 h-3 animate-spin" />
                          <span>{t("common.installing")}</span>
                        </span>
                      ) : isInst ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--success)]/15 text-[var(--success)] font-medium">
                          <Check className="w-3.5 h-3.5" />
                          <span>{t("common.cached")}</span>
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void installSdk(r.version, { noSetup })}
                          className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium cursor-pointer hover:opacity-90"
                        >
                          <Download className="w-3 h-3" />
                          <span>{t("common.install")}</span>
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
