import { Copy, RefreshCw, Terminal, Wrench } from "lucide-react";
import { useEffect } from "react";
import { useI18n } from "../../i18n/useI18n";
import { useFvmStore } from "../../store/useFvmStore";

const ZSH_EXPORT_CMD = 'export PATH="$HOME/fvm/default/bin:$PATH"';

const ANSI_ESCAPE_RE =
  /\x1b(?:\[[0-?]*[ -/]*[@-~]|\][^\x07\x1b]*(?:\x07|\x1b\\)|[PX^_][^\x1b]*\x1b\\|[@-Z\\-_])|\u009b[0-?]*[ -/]*[@-~]/g;

function stripAnsi(text: string): string {
  return text.replace(ANSI_ESCAPE_RE, "").replace(/\r\n/g, "\n");
}

const MCP_SNIPPET = JSON.stringify(
  {
    mcpServers: {
      dart: {
        command: "dart",
        args: ["mcp-server", "--flutter-sdk", ".fvm/flutter_sdk"],
      },
    },
  },
  null,
  2
);

const VSCODE_SNIPPET = JSON.stringify(
  {
    "dart.flutterSdkPath": ".fvm/flutter_sdk",
    "search.exclude": { "**/.fvm": true },
    "files.watcherExclude": { "**/.fvm": true },
  },
  null,
  2
);

export function DoctorView() {
  const { t } = useI18n();
  const {
    snapshot,
    doctorReport,
    loadingDoctor,
    doctorUpdatedAt,
    doctorRunSeq,
    selectedProjectId,
    refreshDoctor,
    fixPathInZshrc,
    pushToast,
  } = useFvmStore();

  const activeProj = snapshot?.projects.find((p) => p.id === selectedProjectId);

  useEffect(() => {
    if (!doctorReport) {
      void refreshDoctor(activeProj?.path);
    }
  }, [doctorReport, activeProj?.path, refreshDoctor]);

  if (!snapshot) return null;

  const { context, projects } = snapshot;
  const pathOk = context.pathPriorityOk;
  const ideaNeedsRefresh = projects.filter((p) => p.hasIdeaDir && !p.ideaSynced);
  const melosProjects = projects.filter((p) => p.hasMelos);

  const copyText = (text: string, msg: string) => {
    void navigator.clipboard?.writeText(text);
    pushToast(msg, "success");
  };

  return (
    <div className="space-y-5">
      {/* PATH Priority Diagnostic Banner */}
      <div
        className={`p-4 rounded-2xl bg-[var(--card)] border ${
          pathOk ? "border-[var(--success)]/50" : "border-[var(--error)]/50"
        } space-y-3`}
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  pathOk ? "bg-[var(--success)]" : "bg-[var(--error)]"
                }`}
              />
              <h2 className="text-sm font-semibold">
                {pathOk ? t("doctor.pathOkTitle") : t("doctor.pathBadTitle")}
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              {pathOk ? t("doctor.pathOkDesc") : t("doctor.pathBadDesc")}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyText(ZSH_EXPORT_CMD, t("doctor.copyPathToast"))}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{t("doctor.copyPathBtn")}</span>
            </button>
            <button
              type="button"
              onClick={() => void fixPathInZshrc()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>{t("doctor.patchZshrcBtn")}</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
            <div className="text-[var(--muted-foreground)]">{t("doctor.activeShellLabel")}</div>
            <div className={`break-all ${pathOk ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
              {context.activeFlutterPath ?? t("doctor.noGlobalFlutter")}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
            <div className="text-[var(--muted-foreground)]">{t("doctor.expectedGlobalLabel")}</div>
            <div className="text-[var(--code-foreground)] break-all">
              {context.globalCacheBinPath}
            </div>
          </div>
        </div>
      </div>

      {/* 4 Ecosystem Integration Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* VS Code / Antigravity */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("doctor.vscodeTitle")}</span>
            <button
              type="button"
              onClick={() => copyText(VSCODE_SNIPPET, t("doctor.copyVscodeToast"))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{t("doctor.copyConfigBtn")}</span>
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("doctor.vscodeDescBefore1")}{" "}
            <code className="font-mono">updateVscodeSettings: true</code>{" "}
            {t("doctor.vscodeDescBetween1And2")}{" "}
            <code className="font-mono">fvm use</code>{" "}
            {t("doctor.vscodeDescBetween2And3")}{" "}
            <code className="font-mono">dart.flutterSdkPath</code>{" "}
            {t("doctor.vscodeDescAfter3")}
          </p>
          <pre className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--code-foreground)] overflow-x-auto m-0 select-text">
            {VSCODE_SNIPPET}
          </pre>
        </div>

        {/* Dart MCP Server */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("doctor.mcpTitle")}</span>
            <button
              type="button"
              onClick={() => copyText(MCP_SNIPPET, t("doctor.copyMcpToast"))}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-medium cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>{t("doctor.copyMcpBtn")}</span>
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("doctor.mcpDescBeforeCode")}{" "}
            <code className="font-mono">.fvm/flutter_sdk</code>
            {t("doctor.mcpDescAfterCode")}
          </p>
          <pre className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--code-foreground)] overflow-x-auto m-0 select-text">
            {MCP_SNIPPET}
          </pre>
        </div>

        {/* Android Studio / IntelliJ */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("doctor.ideaTitle")}</span>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                ideaNeedsRefresh.length > 0
                  ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                  : "bg-[var(--success)]/15 text-[var(--success)]"
              }`}
            >
              {ideaNeedsRefresh.length > 0
                ? t("doctor.ideaNeedRefresh", { count: ideaNeedsRefresh.length })
                : t("doctor.ideaHealthy")}
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("doctor.ideaDescBefore1")}{" "}
            <code className="font-mono">.idea/libraries/Dart_SDK.xml</code>{" "}
            {t("doctor.ideaDescBetween")}{" "}
            <code className="font-mono">android/local.properties</code>
            {t("doctor.ideaDescAfter2")}
          </p>
          {ideaNeedsRefresh.length > 0 ? (
            <div className="space-y-1.5">
              {ideaNeedsRefresh.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono flex items-center justify-between"
                >
                  <span className="truncate">{p.name}/.idea</span>
                  <span className="text-[var(--warning)] shrink-0">
                    {t("doctor.ideaNotPointing")}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted-foreground)]">
              {t("doctor.ideaAuditOk", { count: projects.length })}
            </div>
          )}
        </div>

        {/* Melos Monorepo */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{t("doctor.melosTitle")}</span>
            <span className="px-2 py-0.5 rounded text-xs bg-[var(--success)]/15 text-[var(--success)]">
              {melosProjects.length > 0
                ? t("doctor.melosCount", { count: melosProjects.length })
                : t("doctor.melosNative")}
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            {t("doctor.melosDescBefore1")}{" "}
            <code className="font-mono">fvm use</code>{" "}
            {t("doctor.melosDescBetween1And2")}{" "}
            <code className="font-mono">melos.yaml</code>{" "}
            {t("doctor.melosDescBetween2And3")}{" "}
            <code className="font-mono">sdkPath: .fvm/flutter_sdk</code>
            {t("doctor.melosDescAfter3")}
          </p>
          <div className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono text-[var(--code-foreground)]">
            sdkPath: .fvm/flutter_sdk
          </div>
        </div>
      </div>

      {/* Live Raw `fvm doctor` Output */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal className="w-4 h-4 text-[var(--primary)] shrink-0" />
            <span className="text-sm font-semibold">{t("doctor.liveDoctorTitle")}</span>
            {loadingDoctor ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-mono text-[var(--warning)]">
                <span className="w-1.5 h-1.5 rounded-full bg-[var(--warning)] pulse-dot" />
                <span>{t("common.running")}</span>
              </span>
            ) : doctorUpdatedAt ? (
              <span className="text-xs font-mono text-[var(--muted-foreground)] tabular-nums">
                {t("doctor.updatedAt", { time: doctorUpdatedAt })}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            disabled={loadingDoctor}
            onClick={() => void refreshDoctor(activeProj?.path, true)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] hover:opacity-90 disabled:opacity-65 disabled:cursor-wait text-xs transition cursor-pointer shrink-0"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingDoctor ? "animate-spin" : ""}`} />
            <span>{loadingDoctor ? t("doctor.runningBtn") : t("doctor.rerunBtn")}</span>
          </button>
        </div>
        <pre
          className={`p-4 m-0 max-h-64 overflow-auto scroll-thin bg-[var(--background)] font-mono text-xs text-[var(--code-foreground)] leading-snug whitespace-pre select-text transition-opacity duration-150 ${
            loadingDoctor ? "opacity-45" : "opacity-100"
          }`}
        >
          <code key={doctorRunSeq} className="block font-mono animate-soft-fade">
            {doctorReport?.rawOutput
              ? stripAnsi(doctorReport.rawOutput)
              : t("doctor.initialLoading")}
          </code>
        </pre>
      </div>

      {/* Machine Fingerprint */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <div className="text-[var(--muted-foreground)]">{t("doctor.fpCli")}</div>
          <div className="font-semibold mt-0.5 truncate">
            {context.fvmVersion} ({context.fvmBin})
          </div>
        </div>
        <div>
          <div className="text-[var(--muted-foreground)]">{t("doctor.fpOsArch")}</div>
          <div className="font-semibold mt-0.5">
            {context.osLabel} · {context.archLabel}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted-foreground)]">{t("doctor.fpConfig")}</div>
          <div className="font-semibold mt-0.5 truncate" title={context.appConfigPath}>
            {context.appConfigPath.split("/").slice(-2).join("/")}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted-foreground)]">{t("doctor.fpSymlink")}</div>
          <div className="font-semibold mt-0.5 text-[var(--success)]">
            {context.privilegedAccess ? t("doctor.fpEnabled") : t("doctor.fpDisabled")}
          </div>
        </div>
      </div>
    </div>
  );
}
