import { Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useI18n } from "../i18n/useI18n";
import { useFvmStore } from "../store/useFvmStore";

interface CmdItem {
  id: string;
  title: string;
  sub: string;
  action: () => void;
}

export function CommandPalette() {
  const { t, setLanguage } = useI18n();
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
    setAppIconStyle,
    openSettings,
    proxySettings,
    updateProxySettings,
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
        title: t("cmdk.navTopologyTitle"),
        sub: t("cmdk.navTopologySub"),
        action: () => setActiveTab("topology"),
      },
      {
        id: "nav-releases",
        title: t("cmdk.navReleasesTitle"),
        sub: t("cmdk.navReleasesSub"),
        action: () => setActiveTab("releases"),
      },
      {
        id: "nav-cleanup",
        title: t("cmdk.navCleanupTitle"),
        sub: t("cmdk.navCleanupSub"),
        action: () => setActiveTab("cleanup"),
      },
      {
        id: "nav-spawn",
        title: t("cmdk.navSpawnTitle"),
        sub: t("cmdk.navSpawnSub"),
        action: () => setActiveTab("spawn"),
      },
      {
        id: "nav-doctor",
        title: t("cmdk.navDoctorTitle"),
        sub: t("cmdk.navDoctorSub"),
        action: () => {
          setActiveTab("doctor");
          void refreshDoctor();
        },
      },
      {
        id: "nav-config",
        title: t("cmdk.navConfigTitle"),
        sub: t("cmdk.navConfigSub"),
        action: () => setActiveTab("config"),
      },
      {
        id: "act-refresh",
        title: t("cmdk.actRefreshTitle"),
        sub: t("cmdk.actRefreshSub"),
        action: () => void refreshAll(),
      },
      {
        id: "open-settings-proxy",
        title: t("cmdk.openProxyTitle"),
        sub: t("cmdk.openProxySub"),
        action: () => openSettings("proxy"),
      },
      {
        id: "open-settings-icon",
        title: t("cmdk.openIconTitle"),
        sub: t("cmdk.openIconSub"),
        action: () => openSettings("appearance"),
      },
      {
        id: "open-settings-lang",
        title: t("cmdk.openLangTitle"),
        sub: t("cmdk.openLangSub"),
        action: () => openSettings("language"),
      },
      {
        id: "proxy-direct",
        title: t("cmdk.proxyDirectTitle"),
        sub: t("cmdk.proxyDirectSub"),
        action: () => void updateProxySettings({ ...proxySettings, mode: "direct" }),
      },
      {
        id: "proxy-system",
        title: t("cmdk.proxySystemTitle"),
        sub: t("cmdk.proxySystemSub"),
        action: () => void updateProxySettings({ ...proxySettings, mode: "system" }),
      },
      {
        id: "icon-light",
        title: t("cmdk.iconLightTitle"),
        sub: t("cmdk.iconLightSub"),
        action: () => void setAppIconStyle("light"),
      },
      {
        id: "icon-dark",
        title: t("cmdk.iconDarkTitle"),
        sub: t("cmdk.iconDarkSub"),
        action: () => void setAppIconStyle("dark"),
      },
      {
        id: "icon-auto",
        title: t("cmdk.iconAutoTitle"),
        sub: t("cmdk.iconAutoSub"),
        action: () => void setAppIconStyle("auto"),
      },
      {
        id: "lang-zh",
        title: t("cmdk.langZhTitle"),
        sub: t("cmdk.langZhSub"),
        action: () => void setLanguage("zh"),
      },
      {
        id: "lang-en",
        title: t("cmdk.langEnTitle"),
        sub: t("cmdk.langEnSub"),
        action: () => void setLanguage("en"),
      },
      {
        id: "lang-system",
        title: t("cmdk.langSystemTitle"),
        sub: t("cmdk.langSystemSub"),
        action: () => void setLanguage("system"),
      },
    ];

    const latestStable = releases?.channels.stable?.version;
    if (latestStable) {
      base.push({
        id: `install-${latestStable}`,
        title: t("cmdk.installLatestTitle", { version: latestStable }),
        sub: `fvm install ${latestStable}`,
        action: () => void installSdk(latestStable),
      });
    }

    (snapshot?.projects ?? []).forEach((p) => {
      base.push({
        id: `proj-${p.id}`,
        title: t("cmdk.focusProjectTitle", { name: p.name }),
        sub: `${p.path} (${p.pinnedVersion ?? t("common.unbound")})`,
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
  }, [
    t,
    query,
    snapshot,
    releases,
    setActiveTab,
    selectProject,
    installSdk,
    refreshAll,
    refreshDoctor,
    setAppIconStyle,
    setLanguage,
    openSettings,
    proxySettings,
    updateProxySettings,
  ]);

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
            placeholder={t("cmdk.placeholder")}
            className="flex-1 bg-transparent text-sm text-[var(--foreground)] placeholder:text-[var(--placeholder)] outline-none"
          />
          <kbd className="px-1.5 py-0.5 rounded bg-[var(--secondary)] text-[var(--secondary-foreground)] font-mono text-xs">
            ESC
          </kbd>
        </div>

        <div className="max-h-80 overflow-y-auto scroll-thin p-2 space-y-1">
          {items.length === 0 ? (
            <div className="p-4 text-center text-xs text-[var(--muted-foreground)]">
              {t("cmdk.empty")}
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
