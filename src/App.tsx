import { useEffect } from "react";
import { AboutModal } from "./components/AboutModal";
import { CliConsole } from "./components/CliConsole";
import { CommandPalette } from "./components/CommandPalette";
import { MenuBarPopover } from "./components/MenuBarPopover";
import { SettingsModal } from "./components/SettingsModal";
import { Sidebar } from "./components/Sidebar";
import { TitleBar } from "./components/TitleBar";
import { ToastContainer } from "./components/ToastContainer";
import { CleanupView } from "./components/views/CleanupView";
import { ConfigView } from "./components/views/ConfigView";
import { DoctorView } from "./components/views/DoctorView";
import { ReleasesView } from "./components/views/ReleasesView";
import { SpawnView } from "./components/views/SpawnView";
import { TopologyView } from "./components/views/TopologyView";
import { useI18n } from "./i18n/useI18n";
import { subscribeNativeEvents } from "./services/fvmBridge";
import { applyThemeToDomAndWindow, syncNativeAppIcon, useFvmStore } from "./store/useFvmStore";
import type { TabId } from "./types/fvm";

export function App() {
  const { t } = useI18n();
  const {
    activeTab,
    error,
    bootstrap,
    refreshAll,
    setActiveTab,
    setGlobalSdk,
    setCmdkOpen,
    setMenubarOpen,
    openAbout,
    closeAbout,
    openSettings,
    closeSettings,
    checkForUpdates,
  } = useFvmStore();

  useEffect(() => {
    void bootstrap();

    let cleanups: (() => void)[] = [];
    void subscribeNativeEvents({
      onFsChanged: () => {
        const state = useFvmStore.getState();
        if (
          Object.keys(state.installingSdks).length > 0 ||
          state.activeRequestIds.length > 0
        ) {
          return;
        }
        void refreshAll(true);
      },
      onNavigate: (tab) => {
        const valid: TabId[] = ["topology", "releases", "cleanup", "spawn", "doctor", "config"];
        if (valid.includes(tab as TabId)) setActiveTab(tab as TabId);
      },
      onRefresh: () => void refreshAll(),
      onTraySetGlobal: (ver) => void setGlobalSdk(ver),
      onOpenAbout: () => openAbout(),
      onOpenSettings: () => openSettings(),
      onCheckUpdates: () => void checkForUpdates({ manual: true, openModal: true }),
    }).then((fns) => {
      cleanups = fns;
    });

    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setCmdkOpen(true);
      } else if ((e.metaKey || e.ctrlKey) && e.key === ",") {
        e.preventDefault();
        openSettings();
      } else if (e.key === "Escape") {
        setCmdkOpen(false);
        setMenubarOpen(false);
        closeAbout();
        closeSettings();
      }
    };
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const onSystemThemeChange = () => {
      const state = useFvmStore.getState();
      if (state.theme === "system") {
        applyThemeToDomAndWindow("system");
        if (state.appIconStyle === "auto") {
          syncNativeAppIcon("auto", "system");
        }
      }
    };
    mediaQuery.addEventListener("change", onSystemThemeChange);

    window.addEventListener("keydown", onKeyDown);

    return () => {
      mediaQuery.removeEventListener("change", onSystemThemeChange);
      window.removeEventListener("keydown", onKeyDown);
      cleanups.forEach((fn) => fn());
    };
  }, [
    bootstrap,
    refreshAll,
    setActiveTab,
    setGlobalSdk,
    setCmdkOpen,
    setMenubarOpen,
    openAbout,
    closeAbout,
    openSettings,
    closeSettings,
    checkForUpdates,
  ]);

  return (
    <div className="h-screen w-screen flex flex-col bg-[var(--background)] text-[var(--foreground)] overflow-hidden">
      <TitleBar />

      <div className="flex-1 flex min-h-0">
        <Sidebar />

        <main className="flex-1 min-w-0 flex flex-col bg-[var(--background)]">
          {error && (
            <div className="mx-5 mt-4 px-4 py-2.5 rounded-xl bg-[var(--error)]/12 border border-[var(--error)]/40 text-xs text-[var(--error)] flex items-center justify-between gap-2">
              <span className="truncate">{error}</span>
              <button
                type="button"
                onClick={() => void refreshAll()}
                className="px-2.5 py-1 rounded bg-[var(--error)] text-white font-medium shrink-0 cursor-pointer"
              >
                {t("app.retry")}
              </button>
            </div>
          )}

          <div className="flex-1 p-5 overflow-y-auto scroll-thin">
            {activeTab === "topology" && <TopologyView />}
            {activeTab === "releases" && <ReleasesView />}
            {activeTab === "cleanup" && <CleanupView />}
            {activeTab === "spawn" && <SpawnView />}
            {activeTab === "doctor" && <DoctorView />}
            {activeTab === "config" && <ConfigView />}
          </div>

          <CliConsole />
        </main>
      </div>

      <MenuBarPopover />
      <AboutModal />
      <SettingsModal />
      <CommandPalette />
      <ToastContainer />
    </div>
  );
}

export default App;
