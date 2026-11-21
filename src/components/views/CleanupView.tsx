import { AlertTriangle, Sparkles, Trash2 } from "lucide-react";
import { useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes, useFvmStore } from "../../store/useFvmStore";

const CHART_VARS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
  "var(--chart-6)",
];

export function CleanupView() {
  const { t } = useI18n();
  const {
    snapshot,
    runPatchUpgrade,
    runCleanupRemovable,
    removeSdk,
    runDestroyCache,
  } = useFvmStore();

  const [confirmDestroy, setConfirmDestroy] = useState(false);

  if (!snapshot) return null;

  const { versions, cleanup, context } = snapshot;
  const gitCacheBytes = context.gitCacheBytes ?? 0;
  const totalBytes = snapshot.totalCacheBytes + gitCacheBytes;

  const upgradeTargetSet = new Set(cleanup.upgrades.map((u) => u.toVersion));
  const removableBytes = versions
    .filter((v) => cleanup.removable.includes(v.name))
    .reduce((acc, v) => acc + v.sizeBytes, 0);

  return (
    <div className="space-y-5">
      {/* Disk Footprint Segmented Bar */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t("cleanup.diskTitle")}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("cleanup.diskSubBeforeFirst")}{" "}
              <code className="font-mono">fvm api list</code>
              {t("cleanup.diskSubBetween")}{" "}
              <code className="font-mono">fvm api cleanup</code>
              {t("cleanup.diskSubAfterSecond")}
            </p>
          </div>
          <div className="text-right">
            <div className="text-base font-bold font-mono tabular-nums">
              {formatBytes(totalBytes)}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {t("cleanup.includesGitCache", { size: formatBytes(gitCacheBytes) })}
            </div>
          </div>
        </div>

        {totalBytes > 0 ? (
          <>
            <div className="w-full h-5 rounded-xl overflow-hidden flex gap-0.5 bg-[var(--secondary)] p-0.5">
              {versions.map((s, idx) => (
                <div
                  key={s.name}
                  style={{
                    width: `${Math.max(1.5, (s.sizeBytes / totalBytes) * 100)}%`,
                    background: CHART_VARS[idx % CHART_VARS.length],
                  }}
                  title={`${s.name}: ${formatBytes(s.sizeBytes)}`}
                  className="h-full rounded-md transition-all"
                />
              ))}
              {gitCacheBytes > 0 && (
                <div
                  style={{
                    width: `${Math.max(1.5, (gitCacheBytes / totalBytes) * 100)}%`,
                    background: "var(--muted-foreground)",
                  }}
                  title={`cache.git: ${formatBytes(gitCacheBytes)}`}
                  className="h-full rounded-md opacity-55"
                />
              )}
            </div>

            <div className="flex flex-wrap gap-3 text-xs">
              {versions.map((s, idx) => (
                <span key={s.name} className="inline-flex items-center gap-1.5 font-mono">
                  <span
                    className="w-2.5 h-2.5 rounded-sm"
                    style={{ background: CHART_VARS[idx % CHART_VARS.length] }}
                  />
                  <span>{s.name}</span>
                  <span className="text-[var(--muted-foreground)] tabular-nums">
                    {formatBytes(s.sizeBytes)}
                  </span>
                </span>
              ))}
              {gitCacheBytes > 0 && (
                <span className="inline-flex items-center gap-1.5 font-mono text-[var(--muted-foreground)]">
                  <span className="w-2.5 h-2.5 rounded-sm bg-[var(--muted-foreground)] opacity-55" />
                  <span>cache.git {formatBytes(gitCacheBytes)}</span>
                </span>
              )}
            </div>
          </>
        ) : (
          <div className="text-xs text-[var(--muted-foreground)] py-2">
            {t("cleanup.diskEmpty")}
          </div>
        )}
      </div>

      {/* Same-Line Patch Upgrade Consolidation */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{t("cleanup.patchTitle")}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">{t("cleanup.patchSubtitle")}</p>
          </div>
          <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-[var(--warning)]/15 text-[var(--warning)] shrink-0">
            {t("cleanup.patchBadgeCount", { count: cleanup.upgrades.length })}
          </span>
        </div>

        <div className="p-4 space-y-3">
          {cleanup.upgrades.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)] py-3 text-center">
              {t("cleanup.patchEmpty")}
            </div>
          ) : (
            cleanup.upgrades.map((u) => (
              <div
                key={`${u.fromVersion}-${u.toVersion}`}
                className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--warning)]/40 flex flex-wrap items-center justify-between gap-3"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 text-xs font-mono font-semibold">
                    <span className="px-2 py-0.5 rounded bg-[var(--secondary)]">
                      {u.fromVersion}
                    </span>
                    <span className="text-[var(--warning)]">→</span>
                    <span className="px-2 py-0.5 rounded bg-[var(--success)]/15 text-[var(--success)]">
                      {u.toVersion}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--muted-foreground)]">{u.reason}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {u.actions.map((a, idx) => (
                      <span
                        key={idx}
                        className="px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] text-xs font-mono"
                      >
                        {a.workingDirectory ? `${a.workingDirectory.split("/").pop()} : ` : "global : "}
                        fvm {a.arguments.join(" ")}
                      </span>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    void runPatchUpgrade(
                      u.actions,
                      t("cleanup.patchMigrateToast", {
                        to: u.toVersion,
                        from: u.fromVersion,
                      })
                    )
                  }
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90 shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{t("cleanup.patchMigrateBtn", { version: u.toVersion })}</span>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Unused vs Removable SDK Pool */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold">{t("cleanup.poolTitle")}</h3>
            <p className="text-xs text-[var(--muted-foreground)]">
              {t("cleanup.poolSubBeforeCode")}{" "}
              <code className="font-mono">removable</code> {t("cleanup.poolSubAfterCode")}
            </p>
          </div>
          <button
            type="button"
            disabled={cleanup.removable.length === 0}
            onClick={() => void runCleanupRemovable()}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition ${
              cleanup.removable.length > 0
                ? "bg-[var(--warning)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
                : "bg-[var(--secondary)] text-[var(--muted-foreground)] opacity-60 cursor-not-allowed"
            }`}
          >
            {t("cleanup.cleanRemovableBtn", { size: formatBytes(removableBytes) })}
          </button>
        </div>

        <div className="p-4">
          {cleanup.unused.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)] py-3 text-center">
              {t("cleanup.poolEmpty")}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {cleanup.unused.map((name) => {
                const sdk = versions.find((v) => v.name === name);
                const isProtected = upgradeTargetSet.has(name) || !cleanup.removable.includes(name);
                return (
                  <div
                    key={name}
                    className={`p-3 rounded-xl bg-[var(--background)] border ${
                      isProtected ? "border-[var(--primary)]/40" : "border-[var(--border)]"
                    } flex items-center justify-between gap-2`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-semibold">{name}</span>
                        {isProtected ? (
                          <span className="px-2 py-0.5 rounded text-xs bg-[var(--primary)]/15 text-[var(--primary)]">
                            {t("cleanup.protectedBadge")}
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-xs bg-[var(--error)]/15 text-[var(--error)]">
                            {t("cleanup.safeRemoveBadge")}
                          </span>
                        )}
                      </div>
                      {sdk && (
                        <div className="text-xs text-[var(--muted-foreground)] font-mono">
                          {formatBytes(sdk.sizeBytes)} · Dart {sdk.dartSdkVersion ?? "--"}
                        </div>
                      )}
                    </div>
                    {!isProtected && (
                      <button
                        type="button"
                        onClick={() => void removeSdk(name)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--error)]/40 text-[var(--error)] text-xs cursor-pointer hover:bg-[var(--error)]/10"
                      >
                        <Trash2 className="w-3 h-3" />
                        <span>{t("common.remove")}</span>
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Danger Zone */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--error)]/40 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="w-4 h-4 text-[var(--error)] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <div className="text-xs font-semibold text-[var(--error)]">
              {t("cleanup.dangerTitle")}
            </div>
            <div className="text-xs text-[var(--muted-foreground)]">
              {t("cleanup.dangerSubBeforePath")}{" "}
              <code className="font-mono">{context.versionsCachePath}</code>
              {t("cleanup.dangerSubAfterPath")}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {confirmDestroy ? (
            <>
              <button
                type="button"
                onClick={() => setConfirmDestroy(false)}
                className="px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-xs cursor-pointer"
              >
                {t("common.cancel")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirmDestroy(false);
                  void runDestroyCache();
                }}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--error)] text-white text-xs font-semibold cursor-pointer"
              >
                {t("cleanup.dangerConfirmBtn")}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmDestroy(true)}
              className="px-3.5 py-1.5 rounded-lg border border-[var(--error)] text-[var(--error)] hover:bg-[var(--error)] hover:text-white text-xs font-semibold transition cursor-pointer"
            >
              fvm destroy --force
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
