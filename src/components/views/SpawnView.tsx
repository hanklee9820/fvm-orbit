import { Play, Square } from "lucide-react";
import { useI18n } from "../../i18n/useI18n";
import { useFvmStore } from "../../store/useFvmStore";

const PRESETS = ["test", "analyze", "doctor -v", "pub outdated", "build apk --debug"];

export function SpawnView() {
  const { t } = useI18n();
  const {
    snapshot,
    spawnMode,
    spawnCommand,
    spawnTargets,
    spawnProjectId,
    spawnRunning,
    spawnResults,
    setSpawnMode,
    setSpawnCommand,
    toggleSpawnTarget,
    setSpawnProjectId,
    runSpawnMatrix,
    cancelSpawnMatrix,
  } = useFvmStore();

  const projects = snapshot?.projects ?? [];
  const versions = snapshot?.versions ?? [];
  const activeProject = projects.find((p) => p.id === spawnProjectId) ?? projects[0];
  const flavorList = activeProject ? Object.keys(activeProject.flavors) : [];

  const availableTargets =
    spawnMode === "flavor" ? flavorList : versions.map((v) => v.name);

  return (
    <div className="space-y-5">
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">{t("spawn.title")}</h2>
            <p className="text-xs text-[var(--muted-foreground)]">{t("spawn.subtitle")}</p>
          </div>
          <div className="flex items-center p-0.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs">
            {(
              [
                ["spawn", t("spawn.modeSpawn")],
                ["flavor", t("spawn.modeFlavor")],
                ["exec", t("spawn.modeExec")],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setSpawnMode(id)}
                className={`px-2.5 py-1 rounded-md cursor-pointer transition ${
                  spawnMode === id
                    ? "bg-[var(--primary)] text-[var(--primary-foreground)] font-medium"
                    : "text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-4 space-y-4">
          {/* Working Directory Picker */}
          {projects.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-[var(--muted-foreground)] font-medium">
                {t("spawn.workingDirLabel")}
              </span>
              <select
                value={activeProject?.id ?? ""}
                onChange={(e) => setSpawnProjectId(e.target.value)}
                className="px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} ({p.path})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Command Bar + Presets */}
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1.5 rounded-lg bg-[var(--secondary)] font-mono text-xs text-[var(--secondary-foreground)]">
                {spawnMode === "spawn"
                  ? "fvm spawn <ver>"
                  : spawnMode === "flavor"
                    ? "fvm flavor <flavor>"
                    : "fvm exec"}
              </span>
              <input
                type="text"
                value={spawnCommand}
                onChange={(e) => setSpawnCommand(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !spawnRunning) void runSpawnMatrix();
                }}
                placeholder={
                  spawnMode === "exec"
                    ? t("spawn.placeholderExec")
                    : t("spawn.placeholderDefault")
                }
                className="flex-1 min-w-52 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
              />
              {spawnRunning ? (
                <button
                  type="button"
                  onClick={() => void cancelSpawnMatrix()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--error)] text-white text-xs font-semibold cursor-pointer"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>{t("spawn.stopMatrix")}</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void runSpawnMatrix()}
                  className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>{t("spawn.runMatrix")}</span>
                </button>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[var(--muted-foreground)]">{t("spawn.presetsLabel")}</span>
              {PRESETS.map((pr) => (
                <button
                  key={pr}
                  type="button"
                  onClick={() => setSpawnCommand(pr)}
                  className="px-2 py-0.5 rounded-md bg-[var(--background)] border border-[var(--border)] hover:border-[var(--primary)] font-mono cursor-pointer"
                >
                  {pr}
                </button>
              ))}
            </div>
          </div>

          {/* Target Multi-Selector */}
          {spawnMode !== "exec" && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-[var(--muted-foreground)]">
                {spawnMode === "flavor"
                  ? t("spawn.selectFlavorsHeading", { project: activeProject?.name ?? "--" })
                  : t("spawn.selectSdksHeading")}
              </div>
              {availableTargets.length === 0 ? (
                <div className="text-xs text-[var(--muted-foreground)]">
                  {spawnMode === "flavor" ? t("spawn.noFlavorsHint") : t("spawn.noSdksHint")}
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {availableTargets.map((target) => {
                    const checked = spawnTargets.includes(target);
                    return (
                      <label
                        key={target}
                        className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono cursor-pointer transition select-none ${
                          checked
                            ? "bg-[var(--primary)]/15 border-[var(--primary)] text-[var(--foreground)]"
                            : "bg-[var(--background)] border-[var(--border)] text-[var(--muted-foreground)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleSpawnTarget(target)}
                          className="accent-[var(--primary)] cursor-pointer"
                        />
                        <span>{target}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* Matrix Execution Cards */}
          {spawnResults.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-2">
              {spawnResults.map((res) => {
                const borderCls =
                  res.status === "PASS"
                    ? "border-[var(--success)]/50"
                    : res.status === "FAIL"
                      ? "border-[var(--error)]/50"
                      : "border-[var(--primary)]/50";
                const badgeCls =
                  res.status === "PASS"
                    ? "bg-[var(--success)]/15 text-[var(--success)]"
                    : res.status === "FAIL"
                      ? "bg-[var(--error)]/15 text-[var(--error)]"
                      : "bg-[var(--primary)]/15 text-[var(--primary)]";

                return (
                  <div
                    key={res.taskId}
                    className={`p-3.5 rounded-xl bg-[var(--background)] border ${borderCls} space-y-2 flex flex-col`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-semibold truncate">{res.label}</span>
                      <span className={`px-2 py-0.5 rounded text-xs font-mono font-semibold ${badgeCls}`}>
                        {res.status}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-[var(--muted-foreground)] truncate">
                      $ {res.cmd}
                    </div>
                    <div className="flex-1 max-h-44 overflow-y-auto scroll-thin p-2.5 rounded-lg bg-[var(--card)] border border-[var(--card-border)] font-mono text-xs text-[var(--code-foreground)] leading-relaxed whitespace-pre-wrap break-all select-text">
                      {res.lines.length > 0
                        ? res.lines.join("\n")
                        : res.status === "RUNNING"
                          ? t("spawn.streamingOutput")
                          : t("spawn.noOutput")}
                    </div>
                    <div className="text-xs text-[var(--muted-foreground)] tabular-nums text-right">
                      {res.durationMs != null
                        ? t("spawn.durationExit", {
                            sec: (res.durationMs / 1000).toFixed(2),
                            code: res.exitCode ?? 0,
                          })
                        : t("common.running")}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 rounded-xl bg-[var(--background)] border border-dashed border-[var(--border)] text-center text-xs text-[var(--muted-foreground)]">
              {t("spawn.emptyHint")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
