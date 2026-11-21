import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useFvmStore } from "../store/useFvmStore";

interface CmdItem {
  id: string;
  title: string;
  sub: string;
  action: () => void;
}

export function CommandPalette() {
  const {
    cmdkOpen,
    setCmdkOpen,
    setActiveTab,
    snapshot,
    releases,
    selectProject,
    installSdk,
    refreshAll,
    refreshDoctor,
  } = useFvmStore();

  const [query, setQuery] = useState("");
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (cmdkOpen) {
      setQuery("");
      setCursor(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [cmdkOpen]);

  const items = useMemo<CmdItem[]>(() => {
    const base: CmdItem[] = [
      {
        id: "nav-topology",
        title: "前往：引力拓扑台 (Project ↔ SDK)",
        sub: "可视化管理项目与 Flavor 绑定",
        action: () => setActiveTab("topology"),
      },
      {
        id: "nav-releases",
        title: "前往：版本宇宙 (Releases)",
        sub: "浏览官方发布库并安装 SDK",
        action: () => setActiveTab("releases"),
      },
      {
        id: "nav-cleanup",
        title: "前往：瘦身雷达 (fvm cleanup)",
        sub: "同系补丁收拢与未引用缓存清理",
        action: () => setActiveTab("cleanup"),
      },
      {
        id: "nav-spawn",
        title: "前往：Spawn 并发测试舱 (fvm spawn)",
        sub: "跨版本并行运行 flutter test / analyze",
        action: () => setActiveTab("spawn"),
      },
      {
        id: "nav-doctor",
        title: "前往：环境体检 & IDE/MCP (fvm doctor)",
        sub: "检查 PATH、VS Code、Android Studio、Dart MCP",
        action: () => {
          setActiveTab("doctor");
          void refreshDoctor();
        },
      },
      {
        id: "nav-config",
        title: "前往：Forks & 全局配置 (fvm config)",
        sub: "自定义 Flutter Fork 别名与镜像源设置",
        action: () => setActiveTab("config"),
      },
      {
        id: "act-refresh",
        title: "刷新：重新同步本地 FVM 缓存与项目",
        sub: "fvm api context & list & cleanup",
        action: () => void refreshAll(),
      },
    ];

    const latestStable = releases?.channels.stable?.version;
    if (latestStable) {
      base.push({
        id: `install-${latestStable}`,
        title: `安装：最新稳定版 Flutter ${latestStable}`,
        sub: `fvm install ${latestStable}`,
        action: () => void installSdk(latestStable),
      });
    }

    (snapshot?.projects ?? []).forEach((p) => {
      base.push({
        id: `proj-${p.id}`,
        title: `聚焦项目：${p.name}`,
        sub: `${p.path} (${p.pinnedVersion ?? "未绑定"})`,
        action: () => {
          selectProject(p.id);
          setActiveTab("topology");
        },
      });
    });

    const term = query.trim().toLowerCase();
    return base.filter(
      (i) =>
        !term ||
        i.title.toLowerCase().includes(term) ||
        i.sub.toLowerCase().includes(term)
    );
  }, [query, snapshot, releases, setActiveTab, selectProject, installSdk, refreshAll, refreshDoctor]);

  if (!cmdkOpen) return null;

  const execute = (item?: CmdItem) => {
    if (!item) return;
    setCmdkOpen(false);
    item.action();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-20 px-4 bg-black/50 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) setCmdkOpen(false);
      }}
    >
      <div className="w-full max-w-xl rounded-2xl bg-[var(--card)] border border-[var(--border)] glass-elevated overflow-hidden">
        <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[var(--border)]">
          <Search className="w-4 h-4 text-[var(--muted-foreground)] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setCursor(0);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setCursor((c) => Math.min(items.length - 1, c + 1));
              } else if (e.key === "ArrowUp") {
                e.preventDefault();
                setCursor((c) => Math.max(0, c - 1));
              } else if (e.key === "Enter") {
                e.preventDefault();
                execute(items[cursor]);
              } else if (e.key === "Escape") {
                setCmdkOpen(false);
              }
            }}
            placeholder="输入版本号、项目名或指令（cleanup / doctor / spawn）…"
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto scroll-thin p-2 space-y-1">
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
              未找到匹配指令
            </div>
          ) : (
            items.map((item, idx) => (
              <button
                key={item.id}
                type="button"
                onMouseEnter={() => setCursor(idx)}
                onClick={() => execute(item)}
                className={`w-full text-left px-3 py-2.5 rounded-xl transition flex items-center justify-between gap-2 cursor-pointer ${
                  idx === cursor ? "bg-[var(--sidebar)] ring-1 ring-[var(--primary)]/50" : ""
                }`}
              >
                <div className="min-w-0">
                  <div className="text-xs font-semibold truncate">{item.title}</div>
                  <div className="text-xs text-[var(--muted-foreground)] font-mono truncate">
                    {item.sub}
                  </div>
                </div>
                <span className="text-xs text-[var(--muted-foreground)] shrink-0">↵</span>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
