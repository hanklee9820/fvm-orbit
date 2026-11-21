import { X } from "lucide-react";
import { formatBytes, useFvmStore } from "../store/useFvmStore";

export function MenuBarPopover() {
  const {
    menubarOpen,
    setMenubarOpen,
    snapshot,
    selectedProjectId,
    selectProject,
    applyProjectBinding,
    setGlobalSdk,
    setActiveTab,
  } = useFvmStore();

  if (!menubarOpen || !snapshot) return null;

  const activeProj =
    snapshot.projects.find((p) => p.id === selectedProjectId) ?? snapshot.projects[0];
  const cached = snapshot.versions.slice(0, 6);

  return (
    <div className="fixed top-14 right-4 z-50 w-80 rounded-2xl bg-[var(--card)] border border-[var(--border)] glass-elevated overflow-hidden">
      <div className="px-4 py-3 bg-[var(--sidebar)] border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
          <span className="text-xs font-semibold">FVM Orbit · 快切舱</span>
        </div>
        <button
          type="button"
          onClick={() => setMenubarOpen(false)}
          className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="p-3.5 space-y-3 text-xs">
        <div className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span>当前聚焦项目</span>
            <span className="text-[var(--success)]">实时同步</span>
          </div>
          <div className="font-semibold truncate">
            {activeProj ? activeProj.name : "暂无已追踪项目"}
          </div>
          {activeProj && cached.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {cached.map((sdk) => {
                const isBound = activeProj.pinnedVersion === sdk.name;
                return (
                  <button
                    key={sdk.name}
                    type="button"
                    onClick={() => {
                      selectProject(activeProj.id, "__default__");
                      void applyProjectBinding("__default__", sdk.name);
                    }}
                    className={`px-2 py-1 rounded-md font-mono border cursor-pointer transition ${
                      isBound
                        ? "bg-[var(--primary)] text-[var(--primary-foreground)] border-[var(--primary)]"
                        : "bg-[var(--card)] border-[var(--border)] hover:border-[var(--primary)]"
                    }`}
                  >
                    {sdk.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-[var(--muted-foreground)]">
            <span>全局默认 SDK (fvm global)</span>
            <span className="font-mono font-semibold text-[var(--primary)]">
              {snapshot.context.globalVersion ?? "未设置"}
            </span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {cached.length === 0 ? (
              <span className="text-[var(--muted-foreground)]">暂无已缓存 SDK</span>
            ) : (
              cached.map((sdk) => (
                <button
                  key={sdk.name}
                  type="button"
                  onClick={() => void setGlobalSdk(sdk.name)}
                  className={`px-2 py-1 rounded-md font-mono border cursor-pointer transition ${
                    sdk.isGlobal
                      ? "bg-[var(--success)]/15 border-[var(--success)] text-[var(--success)]"
                      : "bg-[var(--background)] border-[var(--border)] hover:border-[var(--primary)]"
                  }`}
                >
                  {sdk.name}
                </button>
              ))
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
          <span className="text-[var(--muted-foreground)] font-mono">
            缓存 {formatBytes(snapshot.totalCacheBytes)}
          </span>
          <button
            type="button"
            onClick={() => {
              setMenubarOpen(false);
              setActiveTab("cleanup");
            }}
            className="text-[var(--primary)] font-medium cursor-pointer hover:underline"
          >
            打开瘦身雷达
          </button>
        </div>
      </div>
    </div>
  );
}
