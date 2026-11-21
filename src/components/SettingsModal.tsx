import {
  AppWindow,
  Check,
  Globe,
  Loader2,
  RefreshCw,
  Settings,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { testProxyConnectivity } from "../services/fvmBridge";
import {
  getProxyDisplaySummary,
  resolveEffectiveAppIcon,
  useFvmStore,
} from "../store/useFvmStore";
import type {
  AppIconStyle,
  ProxyMode,
  ProxyProtocol,
  ProxySettings,
  ProxyTestResult,
} from "../types/fvm";

const PORT_PRESETS: {
  label: string;
  protocol: ProxyProtocol;
  host: string;
  port: string;
}[] = [
  { label: "Clash · 7890", protocol: "http", host: "127.0.0.1", port: "7890" },
  { label: "Clash Verge · 7897", protocol: "http", host: "127.0.0.1", port: "7897" },
  { label: "Surge · 6152", protocol: "http", host: "127.0.0.1", port: "6152" },
  { label: "V2Ray · 10808", protocol: "socks5", host: "127.0.0.1", port: "10808" },
];

function settingsEqual(a: ProxySettings, b: ProxySettings): boolean {
  return (
    a.mode === b.mode &&
    a.protocol === b.protocol &&
    a.host === b.host &&
    a.port === b.port &&
    a.username === b.username &&
    a.password === b.password &&
    a.bypass === b.bypass
  );
}

export function SettingsModal() {
  const {
    settingsOpen,
    settingsTab,
    closeSettings,
    setSettingsTab,
    proxySettings,
    systemProxyInfo,
    detectingSystemProxy,
    updateProxySettings,
    refreshSystemProxy,
    theme,
    appIconStyle,
    setAppIconStyle,
    snapshot,
    releases,
  } = useFvmStore();

  const [draft, setDraft] = useState<ProxySettings>(proxySettings);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<ProxyTestResult | null>(null);

  useEffect(() => {
    if (settingsOpen) {
      setDraft(proxySettings);
      setTestResult(null);
    }
  }, [settingsOpen, proxySettings]);

  const dirty = !settingsEqual(draft, proxySettings);
  const effectiveIcon = resolveEffectiveAppIcon(appIconStyle, theme);
  const summary = getProxyDisplaySummary(draft, systemProxyInfo);
  const sampleVersion = releases?.channels.stable?.version ?? "3.50.1";

  const envPreview = useMemo(() => {
    if (draft.mode === "direct") {
      return `unset HTTP_PROXY HTTPS_PROXY ALL_PROXY && NO_PROXY="*" fvm install ${sampleVersion}`;
    }
    if (draft.mode === "system") {
      if (systemProxyInfo?.effectiveUrl) {
        const u = systemProxyInfo.effectiveUrl;
        return `HTTP_PROXY="${u}" HTTPS_PROXY="${u}" fvm install ${sampleVersion}`;
      }
      return `# 未检测到 macOS 系统代理，将回退直连执行 fvm install ${sampleVersion}`;
    }
    const scheme = draft.protocol === "socks5" ? "socks5h" : draft.protocol;
    const host = draft.host.trim() || "127.0.0.1";
    const port = draft.port.trim() || "7890";
    const authPart = draft.username.trim()
      ? `${draft.username.trim()}${draft.password ? ":***" : ""}@`
      : "";
    const url = `${scheme}://${authPart}${host}:${port}`;
    const bypassPart = draft.bypass.trim() ? ` NO_PROXY="${draft.bypass.trim()}"` : "";
    return `HTTP_PROXY="${url}" HTTPS_PROXY="${url}" ALL_PROXY="${url}"${bypassPart} fvm install ${sampleVersion}`;
  }, [draft, systemProxyInfo, sampleVersion]);

  if (!settingsOpen) return null;

  const dotClass =
    summary.tone === "active"
      ? "bg-[var(--success)]"
      : summary.tone === "warning"
        ? "bg-[var(--warning)]"
        : "bg-[var(--muted-foreground)]";

  const handleModeSelect = async (mode: ProxyMode) => {
    const next: ProxySettings = { ...draft, mode };
    setDraft(next);
    setTestResult(null);
    if (mode !== "custom" || (next.host.trim() && next.port.trim())) {
      setSaving(true);
      await updateProxySettings(next);
      setSaving(false);
    }
  };

  const handlePresetClick = async (preset: (typeof PORT_PRESETS)[number]) => {
    const next: ProxySettings = {
      ...draft,
      mode: "custom",
      protocol: preset.protocol,
      host: preset.host,
      port: preset.port,
    };
    setDraft(next);
    setTestResult(null);
    setSaving(true);
    await updateProxySettings(next);
    setSaving(false);
  };

  const handleSaveCustom = async (): Promise<boolean> => {
    if (!dirty) return true;
    setSaving(true);
    const ok = await updateProxySettings(draft);
    setSaving(false);
    return ok;
  };

  const handleDone = async () => {
    if (dirty) {
      const ok = await handleSaveCustom();
      if (!ok) return;
    }
    closeSettings();
  };

  const handleTestConnectivity = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await testProxyConnectivity(draft, snapshot?.context.flutterUrl);
      setTestResult(res);
    } catch (err) {
      setTestResult({
        ok: false,
        latencyMs: 0,
        targetUrl: snapshot?.context.flutterUrl ?? "",
        proxyUsed: null,
        httpStatus: null,
        message: String(err),
      });
    } finally {
      setTesting(false);
    }
  };

  const iconNavBadge =
    appIconStyle === "dark" ? "黑底" : appIconStyle === "light" ? "白底" : "自动";

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

  const proxyModeCards: {
    id: ProxyMode;
    title: string;
    desc: string;
  }[] = [
    {
      id: "direct",
      title: "直连（不走代理）",
      desc: "强制忽略系统代理，适合国内镜像源",
    },
    {
      id: "system",
      title: "跟随系统代理",
      desc: "自动读取 macOS 当前网络代理端口",
    },
    {
      id: "custom",
      title: "自定义代理",
      desc: "独立配置 HTTP / SOCKS5 代理地址",
    },
  ];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-xs"
      onClick={(e) => {
        if (e.target === e.currentTarget) void handleDone();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="FVM Orbit 设置"
        className="w-full max-w-2xl rounded-2xl bg-[var(--card)] border border-[var(--border)] glass-elevated overflow-hidden flex flex-col max-h-[88vh]"
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-[var(--sidebar)] border-b border-[var(--border)] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="w-7 h-7 rounded-lg bg-[var(--primary)]/12 text-[var(--primary)] flex items-center justify-center">
              <Settings className="w-4 h-4" />
            </span>
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-semibold">设置</h2>
              <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono text-xs">
                ⌘,
              </kbd>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void handleDone()}
            title="关闭 (Esc)"
            aria-label="关闭设置"
            className="p-1.5 rounded-lg text-[var(--muted-foreground)] hover:text-[var(--foreground)] hover:bg-[var(--secondary)] transition cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Two-Column Body */}
        <div className="flex flex-col sm:flex-row flex-1 min-h-0 overflow-hidden">
          {/* Left Category Navigation */}
          <nav className="sm:w-44 shrink-0 bg-[var(--sidebar)]/60 border-b sm:border-b-0 sm:border-r border-[var(--border)] p-2.5 flex sm:flex-col gap-1.5 select-none">
            <button
              type="button"
              onClick={() => setSettingsTab("proxy")}
              className={`flex-1 sm:flex-none text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-medium transition cursor-pointer ${
                settingsTab === "proxy"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "hover:bg-[var(--card)] text-[var(--foreground)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <Globe
                  className={`w-4 h-4 shrink-0 ${
                    settingsTab === "proxy"
                      ? "text-[var(--primary-foreground)]"
                      : "text-[var(--muted-foreground)]"
                  }`}
                />
                <span>网络代理</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs ${
                  settingsTab === "proxy"
                    ? "bg-white/20 text-[var(--primary-foreground)]"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                }`}
              >
                {summary.navBadge}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSettingsTab("appearance")}
              className={`flex-1 sm:flex-none text-left px-3 py-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-medium transition cursor-pointer ${
                settingsTab === "appearance"
                  ? "bg-[var(--primary)] text-[var(--primary-foreground)]"
                  : "hover:bg-[var(--card)] text-[var(--foreground)]"
              }`}
            >
              <span className="flex items-center gap-2">
                <AppWindow
                  className={`w-4 h-4 shrink-0 ${
                    settingsTab === "appearance"
                      ? "text-[var(--primary-foreground)]"
                      : "text-[var(--muted-foreground)]"
                  }`}
                />
                <span>桌面图标</span>
              </span>
              <span
                className={`px-1.5 py-0.5 rounded text-xs ${
                  settingsTab === "appearance"
                    ? "bg-white/20 text-[var(--primary-foreground)]"
                    : "bg-[var(--secondary)] text-[var(--muted-foreground)]"
                }`}
              >
                {iconNavBadge}
              </span>
            </button>
          </nav>

          {/* Right Pane */}
          <div className="flex-1 p-5 overflow-y-auto scroll-thin space-y-4">
            {settingsTab === "proxy" ? (
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold">Flutter 下载网络代理</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      控制下载 Flutter SDK、拉取官方发布列表及克隆 Git 仓库时是否走代理
                    </p>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs font-medium shrink-0">
                    <span className={`w-2 h-2 rounded-full ${dotClass}`} />
                    <span>{summary.statusLabel}</span>
                  </span>
                </div>

                {/* 3-Way Mode Selector */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {proxyModeCards.map((card) => {
                    const active = draft.mode === card.id;
                    return (
                      <button
                        key={card.id}
                        type="button"
                        onClick={() => void handleModeSelect(card.id)}
                        className={`text-left p-3 rounded-xl border transition cursor-pointer space-y-1 ${
                          active
                            ? "bg-[var(--primary)]/10 border-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                            : "bg-[var(--background)] border-[var(--border)] hover:border-[var(--primary)]/60"
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-semibold">{card.title}</span>
                          <span
                            className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              active
                                ? "border-[var(--primary)] bg-[var(--primary)]"
                                : "border-[var(--muted-foreground)]/50"
                            }`}
                          >
                            {active && (
                              <span className="w-1.5 h-1.5 rounded-full bg-[var(--primary-foreground)]" />
                            )}
                          </span>
                        </div>
                        <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
                          {card.desc}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Mode Detail: DIRECT */}
                {draft.mode === "direct" && (
                  <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-2 text-xs">
                    <div className="flex items-center gap-2 font-medium">
                      <span className="w-2 h-2 rounded-full bg-[var(--success)]" />
                      <span>已强制绕过一切系统及终端代理环境变量</span>
                    </div>
                    <p className="text-[var(--muted-foreground)] leading-relaxed">
                      执行{" "}
                      <code className="font-mono text-[var(--code-foreground)]">fvm install</code>{" "}
                      时会自动清除{" "}
                      <code className="font-mono text-[var(--code-foreground)]">HTTP_PROXY</code> /{" "}
                      <code className="font-mono text-[var(--code-foreground)]">HTTPS_PROXY</code> /{" "}
                      <code className="font-mono text-[var(--code-foreground)]">ALL_PROXY</code>{" "}
                      并设置{" "}
                      <code className="font-mono text-[var(--code-foreground)]">NO_PROXY=*</code>
                      ，避免国内清华镜像误走代理导致减速或握手失败。
                    </p>
                  </div>
                )}

                {/* Mode Detail: SYSTEM */}
                {draft.mode === "system" && (
                  <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-3 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-medium">
                        macOS 系统代理实时探测 (
                        <code className="font-mono text-[var(--code-foreground)]">
                          scutil --proxy
                        </code>
                        )
                      </span>
                      <button
                        type="button"
                        onClick={() => void refreshSystemProxy()}
                        disabled={detectingSystemProxy}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 transition cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw
                          className={`w-3 h-3 ${detectingSystemProxy ? "animate-spin" : ""}`}
                        />
                        <span>重新检测</span>
                      </button>
                    </div>

                    {systemProxyInfo?.effectiveUrl ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 font-mono">
                        <div className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between gap-2">
                          <span className="text-[var(--muted-foreground)]">HTTP / HTTPS</span>
                          <span
                            className={
                              systemProxyInfo.httpsEnabled || systemProxyInfo.httpEnabled
                                ? "text-[var(--success)] font-medium truncate"
                                : "text-[var(--muted-foreground)]"
                            }
                          >
                            {systemProxyInfo.httpsEnabled &&
                            systemProxyInfo.httpsHost &&
                            systemProxyInfo.httpsPort
                              ? `${systemProxyInfo.httpsHost}:${systemProxyInfo.httpsPort}`
                              : systemProxyInfo.httpEnabled &&
                                  systemProxyInfo.httpHost &&
                                  systemProxyInfo.httpPort
                                ? `${systemProxyInfo.httpHost}:${systemProxyInfo.httpPort}`
                                : "未开启"}
                          </span>
                        </div>
                        <div className="px-3 py-2 rounded-lg bg-[var(--card)] border border-[var(--border)] flex items-center justify-between gap-2">
                          <span className="text-[var(--muted-foreground)]">SOCKS5</span>
                          <span
                            className={
                              systemProxyInfo.socksEnabled
                                ? "text-[var(--success)] font-medium truncate"
                                : "text-[var(--muted-foreground)]"
                            }
                          >
                            {systemProxyInfo.socksEnabled &&
                            systemProxyInfo.socksHost &&
                            systemProxyInfo.socksPort
                              ? `${systemProxyInfo.socksHost}:${systemProxyInfo.socksPort}`
                              : "未开启"}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="px-3 py-2.5 rounded-lg bg-[var(--warning)]/12 border border-[var(--warning)]/40 text-[var(--warning)] leading-relaxed">
                        未检测到已启用的 macOS 系统代理（Clash / Surge 等未开启系统代理），下载将自动回退为直连。
                      </div>
                    )}
                  </div>
                )}

                {/* Mode Detail: CUSTOM */}
                {draft.mode === "custom" && (
                  <div className="p-3.5 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-3 text-xs">
                    <div className="grid grid-cols-12 gap-2.5">
                      <label className="col-span-4 sm:col-span-3 space-y-1">
                        <span className="text-[var(--muted-foreground)]">协议</span>
                        <select
                          value={draft.protocol}
                          onChange={(e) => {
                            const next: ProxySettings = {
                              ...draft,
                              protocol: e.target.value as ProxyProtocol,
                            };
                            setDraft(next);
                            setTestResult(null);
                          }}
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono outline-none focus:border-[var(--primary)]"
                        >
                          <option value="http">HTTP</option>
                          <option value="https">HTTPS</option>
                          <option value="socks5">SOCKS5</option>
                        </select>
                      </label>

                      <label className="col-span-5 sm:col-span-6 space-y-1">
                        <span className="text-[var(--muted-foreground)]">代理主机</span>
                        <input
                          type="text"
                          value={draft.host}
                          onChange={(e) => {
                            setDraft({ ...draft, host: e.target.value });
                            setTestResult(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveCustom();
                          }}
                          placeholder="127.0.0.1"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono outline-none focus:border-[var(--primary)]"
                        />
                      </label>

                      <label className="col-span-3 space-y-1">
                        <span className="text-[var(--muted-foreground)]">端口</span>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={draft.port}
                          onChange={(e) => {
                            setDraft({ ...draft, port: e.target.value });
                            setTestResult(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void handleSaveCustom();
                          }}
                          placeholder="7890"
                          className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono outline-none focus:border-[var(--primary)]"
                        />
                      </label>
                    </div>

                    {/* Quick Port Presets */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[var(--muted-foreground)]">常用端口：</span>
                      {PORT_PRESETS.map((preset) => {
                        const matched =
                          draft.protocol === preset.protocol &&
                          draft.host === preset.host &&
                          draft.port === preset.port;
                        return (
                          <button
                            key={preset.label}
                            type="button"
                            onClick={() => void handlePresetClick(preset)}
                            className={`px-2 py-0.5 rounded-md font-mono border transition cursor-pointer ${
                              matched
                                ? "bg-[var(--primary)]/15 text-[var(--primary)] border-[var(--primary)]/50"
                                : "bg-[var(--secondary)] text-[var(--secondary-foreground)] border-transparent hover:border-[var(--primary)]/50"
                            }`}
                          >
                            {preset.label}
                          </button>
                        );
                      })}
                    </div>

                    {/* Collapsible Advanced Options */}
                    <details className="pt-1.5 border-t border-[var(--border)]">
                      <summary className="text-[var(--muted-foreground)] hover:text-[var(--foreground)] cursor-pointer select-none">
                        高级选项：绕过列表 (NO_PROXY) 与身份认证
                      </summary>
                      <div className="pt-2.5 space-y-2.5">
                        <label className="block space-y-1">
                          <span className="text-[var(--muted-foreground)]">
                            不走代理的域名 / 网段 (NO_PROXY)
                          </span>
                          <input
                            type="text"
                            value={draft.bypass}
                            onChange={(e) => setDraft({ ...draft, bypass: e.target.value })}
                            placeholder="localhost,127.0.0.1,::1,.local"
                            className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] font-mono outline-none focus:border-[var(--primary)]"
                          />
                        </label>
                        <div className="grid grid-cols-2 gap-2.5">
                          <label className="space-y-1">
                            <span className="text-[var(--muted-foreground)]">用户名（可选）</span>
                            <input
                              type="text"
                              value={draft.username}
                              onChange={(e) => setDraft({ ...draft, username: e.target.value })}
                              placeholder="留空则无需认证"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                            />
                          </label>
                          <label className="space-y-1">
                            <span className="text-[var(--muted-foreground)]">密码（可选）</span>
                            <input
                              type="password"
                              value={draft.password}
                              onChange={(e) => setDraft({ ...draft, password: e.target.value })}
                              placeholder="••••••••"
                              className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--card)] border border-[var(--border)] text-[var(--foreground)] outline-none focus:border-[var(--primary)]"
                            />
                          </label>
                        </div>
                      </div>
                    </details>
                  </div>
                )}

                {/* Connectivity Test & Live Env Preview */}
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <span className="text-[var(--muted-foreground)] font-medium">
                      下载进程环境变量预览
                    </span>
                    <div className="flex flex-wrap items-center gap-2">
                      {testResult && (
                        <span
                          title={testResult.targetUrl}
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium max-w-[240px] truncate ${
                            testResult.ok
                              ? "bg-[var(--success)]/15 text-[var(--success)]"
                              : "bg-[var(--error)]/15 text-[var(--error)]"
                          }`}
                        >
                          <span>{testResult.ok ? "✓" : "✕"}</span>
                          <span className="truncate">{testResult.message}</span>
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleTestConnectivity()}
                        disabled={testing}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 font-medium transition cursor-pointer disabled:opacity-50"
                      >
                        {testing && <Loader2 className="w-3 h-3 animate-spin" />}
                        <span>测试下载源连通性</span>
                      </button>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--code-foreground)] overflow-x-auto whitespace-nowrap select-text">
                    $ {envPreview}
                  </div>
                </div>
              </div>
            ) : (
              /* TAB 2: DESKTOP APP LOGO */
              <div className="space-y-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <h3 className="text-sm font-semibold">桌面应用图标 (App Logo)</h3>
                    <p className="text-xs text-[var(--muted-foreground)]">
                      即时切换 macOS Dock 与 ⌘+Tab 切换器中的 FVM Orbit 图标风格，重启后自动保持
                    </p>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs shrink-0">
                    当前：{effectiveIcon === "light" ? "白底瓷光" : "黑底曜石"}
                  </span>
                </div>

                <div className="space-y-2.5">
                  {iconOptions.map((opt) => {
                    const active = appIconStyle === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => void setAppIconStyle(opt.id)}
                        className={`group w-full text-left p-3.5 rounded-xl border transition flex items-center gap-3.5 cursor-pointer ${
                          active
                            ? "bg-[var(--primary)]/10 border-[var(--primary)] ring-1 ring-[var(--primary)]/40"
                            : "bg-[var(--background)] border-[var(--border)] hover:border-[var(--primary)]/60"
                        }`}
                      >
                        <div className="relative w-12 h-12 shrink-0 flex items-center justify-center">
                          {opt.id === "dark" && (
                            <img
                              src="/icons/app-icon-dark.png"
                              alt="黑底曜石 App Logo"
                              className="w-12 h-12 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                            />
                          )}
                          {opt.id === "light" && (
                            <img
                              src="/icons/app-icon-light.png"
                              alt="白底瓷光 App Logo"
                              className="w-12 h-12 object-contain drop-shadow-sm transition-transform group-hover:scale-105"
                            />
                          )}
                          {opt.id === "auto" && (
                            <div className="relative w-12 h-12 transition-transform group-hover:scale-105">
                              <img
                                src="/icons/app-icon-light.png"
                                alt="白底部分"
                                className="absolute inset-0 w-12 h-12 object-contain"
                                style={{ clipPath: "polygon(0 0, 100% 0, 0 100%)" }}
                              />
                              <img
                                src="/icons/app-icon-dark.png"
                                alt="黑底部分"
                                className="absolute inset-0 w-12 h-12 object-contain"
                                style={{ clipPath: "polygon(100% 0, 100% 100%, 0 100%)" }}
                              />
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1 space-y-0.5">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs font-semibold truncate">{opt.title}</span>
                            {active ? (
                              <span className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-md bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold shrink-0">
                                <Check className="w-3 h-3" />
                                <span>已选</span>
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-md bg-[var(--secondary)] text-[var(--muted-foreground)] font-mono text-xs shrink-0">
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
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 bg-[var(--sidebar)] border-t border-[var(--border)] flex items-center justify-between gap-3 text-xs shrink-0">
          <span className="text-[var(--muted-foreground)]">
            {dirty
              ? "有未保存的代理配置修改"
              : "配置已自动持久化，立即作用于下次 Flutter 下载"}
          </span>
          <div className="flex items-center gap-2">
            {dirty && (
              <button
                type="button"
                onClick={() => void handleSaveCustom()}
                disabled={saving}
                className="px-3.5 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] hover:opacity-90 font-semibold cursor-pointer transition disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存代理配置"}
              </button>
            )}
            <button
              type="button"
              onClick={() => void handleDone()}
              disabled={saving}
              className="px-3.5 py-1.5 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 font-medium cursor-pointer transition disabled:opacity-50"
            >
              完成
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
