import { Check, Download, Plus, Save, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { resolveEffectiveAppIcon, useFvmStore } from "../../store/useFvmStore";
import type { AppIconStyle } from "../../types/fvm";

export function ConfigView() {
  const {
    snapshot,
    theme,
    appIconStyle,
    setAppIconStyle,
    addFork,
    removeFork,
    installSdk,
    saveGlobalConfig,
  } = useFvmStore();

  const [forkAlias, setForkAlias] = useState("");
  const [forkUrl, setForkUrl] = useState("");

  const [cachePath, setCachePath] = useState("");
  const [gitCachePath, setGitCachePath] = useState("");
  const [flutterUrl, setFlutterUrl] = useState("");
  const [useGitCache, setUseGitCache] = useState(true);
  const [updateCheck, setUpdateCheck] = useState(true);

  useEffect(() => {
    if (!snapshot) return;
    setCachePath(snapshot.context.versionsCachePath);
    setGitCachePath(snapshot.context.gitCachePath);
    setFlutterUrl(snapshot.context.flutterUrl);
    setUseGitCache(snapshot.context.gitCache);
    setUpdateCheck(!snapshot.context.updateCheckDisabled);
  }, [snapshot]);

  const effectiveIcon = resolveEffectiveAppIcon(appIconStyle, theme);

  const iconOptions: {
    id: AppIconStyle;
    title: string;
    desc: string;
    badge: string;
  }[] = [
    {
      id: "dark",
      title: "黑底曜石 Logo",
      desc: "深邃曜石玻璃底，经典开发者终端质感",
      badge: "Dark",
    },
    {
      id: "light",
      title: "白底瓷光 Logo",
      desc: "纯净瓷白高对比底，适配深色 Dock 与浅色桌面",
      badge: "Light",
    },
    {
      id: "auto",
      title: "跟随外观自动切换",
      desc: `随应用浅色 / 深色模式自动切换（当前：${effectiveIcon === "light" ? "白底" : "黑底"}）`,
      badge: "Auto",
    },
  ];

  const appIconSection = (
    <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
      <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-sm font-semibold">桌面应用图标 (App Logo)</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            即时切换 macOS Dock 与 ⌘+Tab 切换器中的 FVM Orbit 图标风格，重启后自动保持
          </p>
        </div>
        <span className="px-2 py-0.5 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs">
          当前：{effectiveIcon === "light" ? "白底瓷光" : "黑底曜石"}
        </span>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-3 gap-3">
        {iconOptions.map((opt) => {
          const active = appIconStyle === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => void setAppIconStyle(opt.id)}
              className={`group text-left p-3.5 rounded-xl border transition flex items-center gap-3.5 cursor-pointer ${
                active
                  ? "bg-[var(--primary)]/8 border-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                  : "bg-[var(--background)] border-[var(--border)] hover:border-[var(--primary)]/60"
              }`}
            >
              {/* Visual Icon Preview */}
              <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                {opt.id === "dark" && (
                  <img
                    src="/icons/app-icon-dark.png"
                    alt="黑底曜石 App Logo"
                    className="w-14 h-14 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                  />
                )}
                {opt.id === "light" && (
                  <img
                    src="/icons/app-icon-light.png"
                    alt="白底瓷光 App Logo"
                    className="w-14 h-14 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                  />
                )}
                {opt.id === "auto" && (
                  <div className="relative w-14 h-14 transition-transform group-hover:scale-105">
                    <img
                      src="/icons/app-icon-light.png"
                      alt="白底部分"
                      className="absolute inset-0 w-14 h-14 object-contain"
                      style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
                    />
                    <img
                      src="/icons/app-icon-dark.png"
                      alt="黑底部分"
                      className="absolute inset-0 w-14 h-14 object-contain"
                      style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
                    />
                  </div>
                )}
              </div>

              {/* Meta */}
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="text-xs font-semibold truncate">{opt.title}</span>
                  {active ? (
                    <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] text-[10px] font-semibold shrink-0">
                      <Check className="w-3 h-3" />
                      <span>已选</span>
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono text-[10px] shrink-0">
                      {opt.badge}
                    </span>
                  )}
                </div>
                <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                  {opt.desc}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );

  if (!snapshot) {
    return <div className="space-y-5">{appIconSection}</div>;
  }

  const { forks, appConfigPath } = snapshot.context;

  const previewCmd = [
    "fvm config",
    `--cache-path "${cachePath}"`,
    useGitCache ? "--use-git-cache" : "--no-use-git-cache",
    `--git-cache-path "${gitCachePath}"`,
    `--flutter-url "${flutterUrl}"`,
    updateCheck ? "--update-check" : "--no-update-check",
  ].join(" ");

  const handleAddFork = () => {
    if (!forkAlias.trim() || !forkUrl.trim()) return;
    void addFork(forkAlias, forkUrl);
    setForkAlias("");
    setForkUrl("");
  };

  return (
    <div className="space-y-5">
      {/* App Logo Appearance Switcher */}
      {appIconSection}

      {/* Custom Fork Registry */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)]">
          <h2 className="text-sm font-semibold">自定义 Flutter Fork 别名仓库 (fvm fork)</h2>
          <p className="text-xs text-[var(--muted-foreground)]">
            适用于鸿蒙版 Flutter、公司内网定制引擎或社区分支，注册后可直接{" "}
            <code className="font-mono">fvm use alias/stable</code>
          </p>
        </div>

        <div className="p-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <input
              type="text"
              value={forkAlias}
              onChange={(e) => setForkAlias(e.target.value)}
              placeholder="别名（如 myco / ohos）"
              className="w-44 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs font-mono outline-none focus:border-[var(--primary)]"
            />
            <input
              type="text"
              value={forkUrl}
              onChange={(e) => setForkUrl(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFork();
              }}
              placeholder="Git 仓库地址（https://github.com/myco/flutter.git）"
              className="flex-1 min-w-60 px-3 py-1.5 rounded-lg bg-[var(--background)] border border-[var(--border)] text-xs font-mono outline-none focus:border-[var(--primary)]"
            />
            <button
              type="button"
              onClick={handleAddFork}
              className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>注册 Fork</span>
            </button>
          </div>

          {forks.length === 0 ? (
            <div className="text-xs text-[var(--muted-foreground)] py-3 text-center">
              当前未注册任何自定义 Fork 别名。
            </div>
          ) : (
            <div className="space-y-2">
              {forks.map((fk) => (
                <div
                  key={fk.name}
                  className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] flex flex-wrap items-center justify-between gap-2"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="px-2 py-0.5 rounded bg-[var(--chart-4)]/15 text-[var(--chart-4)] font-mono text-xs font-semibold shrink-0">
                      {fk.name}
                    </span>
                    <span className="text-xs font-mono text-[var(--muted-foreground)] truncate">
                      {fk.url}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void installSdk(`${fk.name}/stable`)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs font-mono cursor-pointer"
                    >
                      <Download className="w-3 h-3" />
                      <span>安装 {fk.name}/stable</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void removeFork(fk.name)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-[var(--error)]/40 text-[var(--error)] text-xs cursor-pointer hover:bg-[var(--error)]/10"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>删除</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Global FVM Configuration */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold">全局 FVM 引擎配置 (fvm config)</h2>
            <p className="text-xs text-[var(--muted-foreground)] font-mono">{appConfigPath}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              void saveGlobalConfig({
                cachePath,
                gitCachePath,
                flutterUrl,
                useGitCache,
                updateCheck,
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90"
          >
            <Save className="w-3.5 h-3.5" />
            <span>应用全局配置</span>
          </button>
        </div>

        <div className="p-4 space-y-4 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="space-y-1.5 block">
              <span className="text-[var(--muted-foreground)] font-medium">
                SDK 缓存路径 (--cache-path)
              </span>
              <input
                type="text"
                value={cachePath}
                onChange={(e) => setCachePath(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono outline-none focus:border-[var(--primary)]"
              />
            </label>
            <label className="space-y-1.5 block">
              <span className="text-[var(--muted-foreground)] font-medium">
                Git 参考缓存路径 (--git-cache-path)
              </span>
              <input
                type="text"
                value={gitCachePath}
                onChange={(e) => setGitCachePath(e.target.value)}
                className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono outline-none focus:border-[var(--primary)]"
              />
            </label>
          </div>

          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[var(--muted-foreground)] font-medium">
                Flutter Git 源地址 (--flutter-url)
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setFlutterUrl("https://github.com/flutter/flutter.git")}
                  className="px-2 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] cursor-pointer hover:opacity-90"
                >
                  官方 GitHub
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setFlutterUrl("https://mirrors.tuna.tsinghua.edu.cn/git/flutter-sdk.git")
                  }
                  className="px-2 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] cursor-pointer hover:opacity-90"
                >
                  清华镜像
                </button>
              </div>
            </div>
            <input
              type="text"
              value={flutterUrl}
              onChange={(e) => setFlutterUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-[var(--background)] border border-[var(--border)] font-mono outline-none focus:border-[var(--primary)]"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
            <label className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-between cursor-pointer select-none">
              <div>
                <div className="font-semibold">启用 Git Reference Cache</div>
                <div className="text-[var(--muted-foreground)]">
                  复用本地 Git 对象，多版本安装提速 3-5x
                </div>
              </div>
              <input
                type="checkbox"
                checked={useGitCache}
                onChange={(e) => setUseGitCache(e.target.checked)}
                className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
              />
            </label>

            <label className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] flex items-center justify-between cursor-pointer select-none">
              <div>
                <div className="font-semibold">自动检查 FVM 更新</div>
                <div className="text-[var(--muted-foreground)]">对应 --[no-]update-check</div>
              </div>
              <input
                type="checkbox"
                checked={updateCheck}
                onChange={(e) => setUpdateCheck(e.target.checked)}
                className="accent-[var(--primary)] w-4 h-4 cursor-pointer"
              />
            </label>
          </div>

          <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-[var(--code-foreground)] overflow-x-auto select-text">
            $ {previewCmd}
          </div>
        </div>
      </div>
    </div>
  );
}
