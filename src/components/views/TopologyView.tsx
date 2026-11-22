import { Copy, FolderPlus, Loader2, Play, Plus, Trash2 } from "lucide-react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../../i18n/useI18n";
import { formatBytes, useFvmStore } from "../../store/useFvmStore";
import type { ProjectInfo } from "../../types/fvm";
import { BrandLogo } from "../BrandLogo";

function channelBadgeClass(channel: string | null | undefined): string {
  if (channel === "stable") return "bg-[var(--success)]/15 text-[var(--success)]";
  if (channel === "beta") return "bg-[var(--chart-2)]/15 text-[var(--chart-2)]";
  if (channel === "dev") return "bg-[var(--warning)]/15 text-[var(--warning)]";
  if (channel === "fork") return "bg-[var(--chart-4)]/15 text-[var(--chart-4)]";
  return "bg-[var(--secondary)] text-[var(--secondary-foreground)]";
}

interface CableLine {
  key: string;
  d: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  stroke: string;
  width: number;
  opacity: number;
  animated: boolean;
}

export function TopologyView() {
  const { t } = useI18n();
  const {
    snapshot,
    releases,
    selectedProjectId,
    selectedFlavor,
    pendingSdk,
    useFlags,
    extraProjects,
    selectProject,
    setPendingSdk,
    toggleUseFlag,
    bindProjectDialog,
    removeExtraProject,
    applyProjectBinding,
    installingSdks,
    installSdk,
    pushToast,
  } = useFvmStore();

  const [addingFlavor, setAddingFlavor] = useState(false);
  const [newFlavorName, setNewFlavorName] = useState("");
  const [cables, setCables] = useState<CableLine[]>([]);
  const [svgSize, setSvgSize] = useState({ w: 160, h: 320 });

  const matrixRef = useRef<HTMLDivElement>(null);
  const svgWrapRef = useRef<HTMLDivElement>(null);

  const projects = snapshot?.projects ?? [];
  const versions = snapshot?.versions ?? [];
  const cleanup = snapshot?.cleanup ?? { upgrades: [], unused: [], removable: [] };

  const selectedProject: ProjectInfo | undefined =
    projects.find((p) => p.id === selectedProjectId) ?? projects[0];

  const upgradeFromMap = useMemo(() => {
    const m: Record<string, string> = {};
    cleanup.upgrades.forEach((u) => {
      m[u.fromVersion] = u.toVersion;
    });
    return m;
  }, [cleanup.upgrades]);

  const activeFlavorSdk = selectedProject
    ? selectedFlavor === "__default__"
      ? selectedProject.pinnedVersion
      : selectedProject.flavors[selectedFlavor] ?? null
    : null;
  const targetSdk = pendingSdk ?? activeFlavorSdk;

  const refCountMap = useMemo(() => {
    const counts: Record<string, number> = {};
    projects.forEach((p) => {
      const used = new Set<string>();
      if (p.pinnedVersion) used.add(p.pinnedVersion);
      Object.values(p.flavors).forEach((v) => used.add(v));
      used.forEach((v) => {
        counts[v] = (counts[v] ?? 0) + 1;
      });
    });
    return counts;
  }, [projects]);

  const recomputeCables = useCallback(() => {
    const wrap = svgWrapRef.current;
    const root = matrixRef.current;
    if (!wrap || !root) return;
    const sr = wrap.getBoundingClientRect();
    if (sr.width < 8 || sr.height < 8) return;

    setSvgSize({ w: sr.width, h: sr.height });
    const next: CableLine[] = [];

    projects.forEach((p) => {
      const pEl = root.querySelector<HTMLElement>(`[data-topo-proj="${CSS.escape(p.id)}"]`);
      if (!pEl) return;
      const r1 = pEl.getBoundingClientRect();
      const y1 = r1.top + r1.height / 2 - sr.top;
      const isSel = selectedProject?.id === p.id;

      const links: { sdk: string; flavor: string }[] = [];
      if (p.pinnedVersion) links.push({ sdk: p.pinnedVersion, flavor: "__default__" });
      Object.entries(p.flavors).forEach(([fl, ver]) => {
        links.push({ sdk: ver, flavor: fl });
      });

      links.forEach((lnk) => {
        const sEl = root.querySelector<HTMLElement>(`[data-topo-sdk="${CSS.escape(lnk.sdk)}"]`);
        if (!sEl) return;
        const r2 = sEl.getBoundingClientRect();
        const y2 = r2.top + r2.height / 2 - sr.top;
        const exact = isSel && selectedFlavor === lnk.flavor;
        const upgradable = Boolean(upgradeFromMap[lnk.sdk]);

        const stroke = exact
          ? "var(--primary)"
          : upgradable
            ? "var(--warning)"
            : isSel
              ? "var(--success)"
              : "var(--border)";
        const w = sr.width;
        next.push({
          key: `${p.id}-${lnk.flavor}-${lnk.sdk}`,
          d: `M 4 ${y1} C ${w * 0.44} ${y1}, ${w * 0.56} ${y2}, ${w - 4} ${y2}`,
          x1: 4,
          y1,
          x2: w - 4,
          y2,
          stroke,
          width: exact ? 2.8 : isSel ? 2 : 1.4,
          opacity: exact ? 1 : isSel ? 0.8 : 0.45,
          animated: exact,
        });
      });
    });

    if (selectedProject && pendingSdk) {
      const pEl = root.querySelector<HTMLElement>(
        `[data-topo-proj="${CSS.escape(selectedProject.id)}"]`
      );
      const sEl = root.querySelector<HTMLElement>(
        `[data-topo-sdk="${CSS.escape(pendingSdk)}"]`
      );
      if (pEl && sEl) {
        const r1 = pEl.getBoundingClientRect();
        const r2 = sEl.getBoundingClientRect();
        const y1 = r1.top + r1.height / 2 - sr.top;
        const y2 = r2.top + r2.height / 2 - sr.top;
        const w = sr.width;
        next.push({
          key: `pending-${selectedProject.id}-${pendingSdk}`,
          d: `M 4 ${y1} C ${w * 0.44} ${y1}, ${w * 0.56} ${y2}, ${w - 4} ${y2}`,
          x1: 4,
          y1,
          x2: w - 4,
          y2,
          stroke: "var(--chart-2)",
          width: 3,
          opacity: 1,
          animated: true,
        });
      }
    }

    setCables(next);
  }, [projects, selectedProject, selectedFlavor, pendingSdk, upgradeFromMap]);

  useLayoutEffect(() => {
    const raf = requestAnimationFrame(recomputeCables);
    const observer = new ResizeObserver(() => requestAnimationFrame(recomputeCables));
    if (matrixRef.current) observer.observe(matrixRef.current);
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
    };
  }, [recomputeCables, versions.length]);

  if (!snapshot) return null;

  const totalFlavors = projects.reduce((acc, p) => acc + Object.keys(p.flavors).length, 0);
  const removableBytes = versions
    .filter((v) => cleanup.removable.includes(v.name))
    .reduce((acc, v) => acc + v.sizeBytes, 0);
  const latestStable = releases?.channels.stable?.version ?? "3.50.1";
  const isInstallingLatest = Boolean(installingSdks[latestStable]);

  const previewCmd = (() => {
    if (!selectedProject || !targetSdk) return "";
    const parts = ["fvm", "use", targetSdk];
    if (selectedFlavor !== "__default__") parts.push("--flavor", selectedFlavor);
    if (useFlags.pin) parts.push("--pin");
    if (useFlags.skipPubGet) parts.push("--skip-pub-get");
    if (useFlags.skipSetup) parts.push("--skip-setup");
    if (useFlags.force) parts.push("--force");
    return parts.join(" ");
  })();

  const fvmrcPreview = (() => {
    if (!selectedProject) return "";
    const obj: Record<string, unknown> = {
      flutter:
        selectedFlavor === "__default__" && targetSdk
          ? targetSdk
          : selectedProject.pinnedVersion ?? targetSdk ?? "",
    };
    const nextFlavors = { ...selectedProject.flavors };
    if (selectedFlavor !== "__default__" && targetSdk) {
      nextFlavors[selectedFlavor] = targetSdk;
    }
    if (Object.keys(nextFlavors).length > 0) obj.flavors = nextFlavors;
    obj.updateVscodeSettings = true;
    obj.updateGitIgnore = true;
    if (selectedProject.hasMelos) obj.updateMelosSettings = true;
    obj.runPubGetOnSdkChanges = !useFlags.skipPubGet;
    return JSON.stringify(obj, null, 2);
  })();

  const handleAddFlavor = () => {
    const clean = newFlavorName.trim().replace(/\s+/g, "_");
    if (!clean || !selectedProject) return;
    selectProject(selectedProject.id, clean);
    setAddingFlavor(false);
    setNewFlavorName("");
    pushToast(t("topology.flavorCreatedToast", { name: clean }), "info");
  };

  return (
    <div className="space-y-5">
      {/* KPI Strip */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] space-y-1">
          <div className="text-xs text-[var(--muted-foreground)]">{t("topology.kpiCachedSdk")}</div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-bold tabular-nums">{versions.length}</span>
            <span className="text-xs font-mono text-[var(--primary)]">
              {snapshot.totalCacheBytes > 0
                ? formatBytes(snapshot.totalCacheBytes)
                : snapshot.totalCacheSizeLabel}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] space-y-1">
          <div className="text-xs text-[var(--muted-foreground)]">
            {t("topology.kpiProjectsFlavors")}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-bold tabular-nums">{projects.length}</span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {t("topology.kpiFlavorCount", { count: totalFlavors })}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] space-y-1">
          <div className="text-xs text-[var(--muted-foreground)]">
            {t("topology.kpiGlobalDefault")}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-base font-bold font-mono truncate">
              {snapshot.context.globalVersion ?? t("common.notSet")}
            </span>
            <span
              className={`text-xs shrink-0 ${
                snapshot.context.pathPriorityOk ? "text-[var(--success)]" : "text-[var(--warning)]"
              }`}
            >
              {snapshot.context.pathPriorityOk
                ? t("topology.kpiPathOk")
                : t("topology.kpiPathConflict")}
            </span>
          </div>
        </div>

        <div className="p-3.5 rounded-xl bg-[var(--card)] border border-[var(--card-border)] space-y-1">
          <div className="text-xs text-[var(--muted-foreground)]">
            {t("topology.kpiReclaimable")}
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xl font-bold tabular-nums text-[var(--warning)]">
              {formatBytes(removableBytes)}
            </span>
            <span className="text-xs text-[var(--muted-foreground)]">
              {t("topology.kpiCleanupSummary", {
                upgrades: cleanup.upgrades.length,
                removable: cleanup.removable.length,
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Empty Real Cache Onboarding */}
      {versions.length === 0 && projects.length === 0 ? (
        <div className="p-8 rounded-2xl bg-[var(--card)] border border-[var(--border)] text-center space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-[var(--secondary)] border border-[var(--border)] flex items-center justify-center">
            <BrandLogo className="w-8 h-8" />
          </div>
          <div className="space-y-1.5 max-w-lg mx-auto">
            <h2 className="text-base font-semibold">
              {t("topology.emptyTitle", { version: snapshot.context.fvmVersion })}
            </h2>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              {t("topology.emptyDescBeforePath")}{" "}
              <code className="font-mono text-[var(--code-foreground)]">
                {snapshot.context.versionsCachePath}
              </code>
              {t("topology.emptyDescBetweenPathAndVer")}{" "}
              <strong className="font-mono">Flutter {latestStable}</strong>
              {t("topology.emptyDescAfterVer")}
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              disabled={isInstallingLatest}
              aria-busy={isInstallingLatest}
              onClick={() => void installSdk(latestStable, { setGlobal: true })}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold transition ${
                isInstallingLatest
                  ? "bg-[var(--warning)]/15 text-[var(--warning)] cursor-not-allowed"
                  : "bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
              }`}
            >
              {isInstallingLatest && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              <span>
                {isInstallingLatest
                  ? t("common.installing")
                  : t("topology.emptyInstallBtn", { version: latestStable })}
              </span>
            </button>
            <button
              type="button"
              onClick={() => void bindProjectDialog()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs font-medium cursor-pointer hover:opacity-90 transition"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t("topology.emptyPickDirBtn")}</span>
            </button>
          </div>
        </div>
      ) : (
        /* Interactive Topology Matrix */
        <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
          <div className="px-4 py-3 border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2 bg-[var(--sidebar)]">
            <div>
              <h2 className="text-sm font-semibold">{t("topology.matrixTitle")}</h2>
              <p className="text-xs text-[var(--muted-foreground)]">
                {t("topology.matrixSubBeforeCode")}{" "}
                <code className="font-mono">.fvmrc</code>
                {t("topology.matrixSubAfterCode")}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void bindProjectDialog()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs font-medium hover:opacity-90 transition cursor-pointer"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              <span>{t("topology.bindProjectBtn")}</span>
            </button>
          </div>

          <div
            ref={matrixRef}
            className="p-4 grid grid-cols-1 lg:grid-cols-12 gap-3 items-stretch relative"
          >
            {/* Left: Tracked Projects */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="text-xs font-semibold text-[var(--muted-foreground)] px-1 flex items-center justify-between">
                <span>{t("topology.trackedProjectsHeading", { count: projects.length })}</span>
                <span className="font-mono">projects.json</span>
              </div>

              {projects.length === 0 ? (
                <div className="p-5 rounded-xl bg-[var(--background)] border border-dashed border-[var(--border)] text-center text-xs text-[var(--muted-foreground)] space-y-2">
                  <div>{t("topology.noProjectsYet")}</div>
                  <button
                    type="button"
                    onClick={() => void bindProjectDialog()}
                    className="px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] font-medium cursor-pointer"
                  >
                    {t("topology.selectProjectDirBtn")}
                  </button>
                </div>
              ) : (
                projects.map((p) => {
                  const isSel = selectedProject?.id === p.id;
                  const hasUpgrade = Boolean(p.pinnedVersion && upgradeFromMap[p.pinnedVersion]);
                  const flavorKeys = Object.keys(p.flavors);
                  const isManual = extraProjects.includes(p.path);

                  return (
                    <div
                      key={p.id}
                      data-topo-proj={p.id}
                      onClick={() => selectProject(p.id, "__default__")}
                      className={`p-3 rounded-xl border transition cursor-pointer space-y-2 ${
                        isSel
                          ? "bg-[var(--sidebar)] border-[var(--primary)] ring-1 ring-[var(--primary)]"
                          : "bg-[var(--background)] border-[var(--card-border)] hover:border-[var(--primary)]/60"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                              hasUpgrade ? "bg-[var(--warning)]" : "bg-[var(--primary)]"
                            }`}
                          />
                          <span className="text-xs font-semibold truncate">{p.name}</span>
                          {p.hasMelos && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-mono bg-[var(--chart-4)]/15 text-[var(--chart-4)]">
                              Melos
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="px-2 py-0.5 rounded-md text-xs font-mono bg-[var(--secondary)] text-[var(--secondary-foreground)]">
                            {p.pinnedVersion ?? t("common.unbound")}
                          </span>
                          {isManual && (
                            <button
                              type="button"
                              title={t("topology.removeFromListTooltip")}
                              onClick={(e) => {
                                e.stopPropagation();
                                void removeExtraProject(p.path);
                              }}
                              className="p-1 text-[var(--muted-foreground)] hover:text-[var(--error)] cursor-pointer"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="text-xs font-mono text-[var(--muted-foreground)] truncate">
                        {p.path}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            selectProject(p.id, "__default__");
                          }}
                          className={`px-2 py-0.5 rounded-md text-xs font-mono border transition cursor-pointer ${
                            isSel && selectedFlavor === "__default__"
                              ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                              : "bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"
                          }`}
                        >
                          default: {p.pinnedVersion ?? "--"}
                        </button>

                        {flavorKeys.map((fl) => (
                          <button
                            key={fl}
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              selectProject(p.id, fl);
                            }}
                            className={`px-2 py-0.5 rounded-md text-xs font-mono border transition cursor-pointer ${
                              isSel && selectedFlavor === fl
                                ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                                : "bg-[var(--card)] text-[var(--muted-foreground)] border-[var(--border)] hover:text-[var(--foreground)]"
                            }`}
                          >
                            {fl}: {p.flavors[fl]}
                          </button>
                        ))}

                        {isSel && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setAddingFlavor((v) => !v);
                            }}
                            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-xs border border-dashed border-[var(--border)] text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Flavor</span>
                          </button>
                        )}

                        {hasUpgrade && p.pinnedVersion && (
                          <span className="px-2 py-0.5 rounded-md text-xs bg-[var(--warning)]/15 text-[var(--warning)]">
                            {t("topology.upgradableBadge", {
                              version: upgradeFromMap[p.pinnedVersion],
                            })}
                          </span>
                        )}
                      </div>

                      {isSel && addingFlavor && (
                        <div
                          className="flex items-center gap-1.5 pt-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="text"
                            value={newFlavorName}
                            onChange={(e) => setNewFlavorName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAddFlavor();
                            }}
                            placeholder={t("topology.flavorPlaceholder")}
                            className="flex-1 px-2.5 py-1 rounded-md bg-[var(--background)] border border-[var(--border)] text-xs font-mono outline-none focus:border-[var(--primary)]"
                          />
                          <button
                            type="button"
                            onClick={handleAddFlavor}
                            className="px-2.5 py-1 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-medium cursor-pointer"
                          >
                            {t("common.confirm")}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>

            {/* Center: DOM-Measured SVG Gravity Cables */}
            <div ref={svgWrapRef} className="hidden lg:block lg:col-span-2 relative min-h-[260px]">
              <svg
                className="w-full h-full overflow-visible"
                viewBox={`0 0 ${svgSize.w} ${svgSize.h}`}
              >
                {cables.map((c) => (
                  <g key={c.key}>
                    <path
                      d={c.d}
                      fill="none"
                      stroke={c.stroke}
                      strokeWidth={c.width}
                      strokeOpacity={c.opacity}
                      className={c.animated ? "cable-animated" : ""}
                    />
                    <circle cx={c.x1} cy={c.y1} r={c.animated ? 4 : 2.5} fill={c.stroke} opacity={c.opacity} />
                    <circle cx={c.x2} cy={c.y2} r={c.animated ? 4 : 2.5} fill={c.stroke} opacity={c.opacity} />
                  </g>
                ))}
              </svg>
            </div>

            {/* Right: Cached SDK Nodes */}
            <div className="lg:col-span-5 space-y-2.5">
              <div className="text-xs font-semibold text-[var(--muted-foreground)] px-1 flex items-center justify-between">
                <span>{t("topology.cachedSdksHeading", { count: versions.length })}</span>
                <span className="font-mono truncate max-w-[180px]">
                  {snapshot.context.versionsCachePath}
                </span>
              </div>

              {versions.length === 0 ? (
                <div className="p-5 rounded-xl bg-[var(--background)] border border-dashed border-[var(--border)] text-center text-xs text-[var(--muted-foreground)] space-y-2">
                  <div>{t("topology.noCachedSdks")}</div>
                  <button
                    type="button"
                    disabled={isInstallingLatest}
                    aria-busy={isInstallingLatest}
                    onClick={() => void installSdk(latestStable, { setGlobal: true })}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium transition ${
                      isInstallingLatest
                        ? "bg-[var(--warning)]/15 text-[var(--warning)] cursor-not-allowed"
                        : "bg-[var(--primary)] text-[var(--primary-foreground)] cursor-pointer hover:opacity-90"
                    }`}
                  >
                    {isInstallingLatest && <Loader2 className="w-3 h-3 animate-spin" />}
                    <span>
                      {isInstallingLatest
                        ? t("common.installing")
                        : t("topology.installVersionBtn", { version: latestStable })}
                    </span>
                  </button>
                </div>
              ) : (
                versions.map((sdk) => {
                  const refCount = refCountMap[sdk.name] ?? 0;
                  const isBoundToSel = activeFlavorSdk === sdk.name;
                  const isPending = pendingSdk === sdk.name;

                  return (
                    <div
                      key={sdk.name}
                      data-topo-sdk={sdk.name}
                      onClick={() => setPendingSdk(sdk.name)}
                      className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-2 ${
                        isPending
                          ? "bg-[var(--primary)]/12 border-[var(--primary)] ring-1 ring-[var(--primary)]"
                          : isBoundToSel
                            ? "bg-[var(--sidebar)] border-[var(--success)]"
                            : "bg-[var(--background)] border-[var(--card-border)] hover:border-[var(--primary)]/70"
                      }`}
                    >
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-mono font-semibold">{sdk.name}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-xs font-mono ${channelBadgeClass(
                              sdk.releaseFromChannel ?? sdk.sdkType
                            )}`}
                          >
                            {sdk.releaseFromChannel ?? sdk.sdkType}
                          </span>
                          {sdk.isGlobal && (
                            <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-[var(--primary)]/15 text-[var(--primary)]">
                              Global
                            </span>
                          )}
                          {sdk.isUnreferenced && (
                            <span className="px-1.5 py-0.5 rounded text-xs bg-[var(--warning)]/15 text-[var(--warning)]">
                              Unused
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-[var(--muted-foreground)] font-mono flex items-center gap-2 flex-wrap">
                          <span>Dart {sdk.dartSdkVersion ?? "--"}</span>
                          <span>·</span>
                          <span className="tabular-nums">{formatBytes(sdk.sizeBytes)}</span>
                          <span>·</span>
                          <span>{t("topology.projectRefs", { count: refCount })}</span>
                        </div>
                      </div>

                      <div
                        className={`shrink-0 text-xs font-medium ${
                          isPending
                            ? "text-[var(--primary)]"
                            : isBoundToSel
                              ? "text-[var(--success)]"
                              : "text-[var(--muted-foreground)]"
                        }`}
                      >
                        {isPending
                          ? t("topology.statePending")
                          : isBoundToSel
                            ? t("topology.stateBound")
                            : t("topology.stateBindAction")}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Action Inspector & Live .fvmrc Diff */}
          {selectedProject && (
            <div className="px-4 py-3.5 border-t border-[var(--border)] bg-[var(--sidebar)] grid grid-cols-1 xl:grid-cols-12 gap-4 items-center">
              <div className="xl:col-span-7 space-y-2.5">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-semibold">{t("topology.quickBindLabel")}</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">
                    {selectedProject.name}
                    {selectedFlavor !== "__default__" ? ` [${selectedFlavor}]` : ""}
                  </span>
                  <span className="text-[var(--muted-foreground)]">→</span>
                  <span className="font-mono px-2 py-0.5 rounded bg-[var(--primary)]/15 text-[var(--primary)] font-semibold">
                    {targetSdk ?? t("topology.selectSdkPrompt")}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-[var(--muted-foreground)]">
                  {(
                    [
                      ["pin", t("topology.flagPinLabel")],
                      ["skipPubGet", "--skip-pub-get"],
                      ["skipSetup", "--skip-setup"],
                      ["force", "--force"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={useFlags[key]}
                        onChange={() => toggleUseFlag(key)}
                        className="accent-[var(--primary)] cursor-pointer"
                      />
                      <span className="font-mono">{label}</span>
                    </label>
                  ))}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <code className="flex-1 min-w-52 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--code-foreground)] truncate">
                    $ {previewCmd || "fvm use <version>"}
                  </code>
                  <button
                    type="button"
                    disabled={!targetSdk}
                    onClick={() => void applyProjectBinding()}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                  >
                    <Play className="w-3.5 h-3.5" />
                    <span>{t("topology.applyBindBtn")}</span>
                  </button>
                  <button
                    type="button"
                    disabled={!previewCmd}
                    onClick={() => {
                      void navigator.clipboard?.writeText(previewCmd);
                      pushToast(t("common.copied", { text: previewCmd }), "success");
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-xs transition cursor-pointer disabled:opacity-50"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>{t("common.copy")}</span>
                  </button>
                </div>
              </div>

              <div className="xl:col-span-5">
                <div className="rounded-xl bg-[var(--background)] border border-[var(--border)] p-3 font-mono text-xs overflow-x-auto">
                  <div className="flex items-center justify-between text-[var(--muted-foreground)] pb-1.5 mb-1.5 border-b border-[var(--border)]">
                    <span>{t("topology.fvmrcPreviewTitle", { name: selectedProject.name })}</span>
                    <span className="text-[var(--success)]">{t("common.liveSync")}</span>
                  </div>
                  <pre className="m-0 leading-relaxed text-[var(--code-foreground)] select-text">
                    {fvmrcPreview}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
