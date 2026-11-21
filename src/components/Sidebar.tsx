import {
  Activity,
  Box,
  FlaskConical,
  GitFork,
  Network,
  Sparkles,
} from "lucide-react";
import { formatBytes, useFvmStore } from "../store/useFvmStore";
import type { TabId } from "../types/fvm";

export function Sidebar() {
  const { activeTab, setActiveTab, snapshot } = useFvmStore();

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
    badge: string | null;
    badgeTone?: "warning" | "error" | "success" | "neutral";
    Icon: typeof Network;
  }[] = [
    {
      id: "topology",
      label: "引力拓扑台",
      sub: "项目 ↔ SDK 绑定",
      badge: projectCount ? String(projectCount) : null,
      Icon: Network,
    },
    {
      id: "releases",
      label: "版本宇宙",
      sub: "缓存 & 官方发布库",
      badge: String(sdkCount),
      Icon: Box,
    },
    {
      id: "cleanup",
      label: "瘦身雷达",
      sub: "补丁收拢 & 空间清理",
      badge: cleanupCount > 0 ? String(cleanupCount) : null,
      badgeTone: cleanupCount > 0 ? "warning" : "neutral",
      Icon: Sparkles,
    },
    {
      id: "spawn",
      label: "Spawn 测试舱",
      sub: "多版本 / Flavor 并发",
      badge: null,
      Icon: FlaskConical,
    },
    {
      id: "doctor",
      label: "体检 & IDE/MCP",
      sub: "PATH / VSCode / MCP",
      badge: pathOk ? "OK" : "1",
      badgeTone: pathOk ? "success" : "error",
      Icon: Activity,
    },
    {
      id: "config",
      label: "Forks & 配置",
      sub: "镜像源 / Git Cache",
      badge: forkCount ? String(forkCount) : null,
      Icon: GitFork,
    },
  ];

  const gbBarPct = Math.min(100, (totalBytes / (15 * 1024 * 1024 * 1024)) * 100);

  return (
    <aside className="w-56 shrink-0 bg-[var(--sidebar)] border-r border-[var(--border)] flex flex-col justify-between p-3 gap-4 select-none">
      <nav className="space-y-1">
        {navItems.map(({ id, label, sub, badge, badgeTone, Icon }) => {
          const active = activeTab === id;
          const badgeClass =
            badgeTone === "warning"
              ? "bg-[var(--warning)]/20 text-[var(--warning)]"
              : badgeTone === "error"
                ? "bg-[var(--error)]/20 text-[var(--error)]"
                : badgeTone === "success"
                  ? "bg-[var(--success)]/20 text-[var(--success)]"
                  : active
                    ? "bg-white/20 text-[var(--primary-foreground)]"
                    : "bg-[var(--secondary)] text-[var(--secondary-foreground)]";

          return (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
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
                      active ? "opacity-80" : "text-[var(--muted-foreground)]"
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

      {/* Bottom Cache & Global Status Card */}
      <div className="space-y-3 pt-3 border-t border-[var(--border)]">
        <div className="p-3 rounded-xl bg-[var(--card)] border border-[var(--card-border)] space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">全局默认 SDK</span>
            <span className="font-mono font-semibold text-[var(--primary)] truncate max-w-[100px]">
              {globalSdk ?? "未设置"}
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-[var(--muted-foreground)]">本地缓存占用</span>
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

        <div className="px-1 text-xs text-[var(--muted-foreground)] flex items-center justify-between">
          <span>驱动引擎</span>
          <code className="font-mono text-[var(--code-foreground)]">fvm api *</code>
        </div>
      </div>
    </aside>
  );
}
