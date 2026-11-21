import { Copy, RefreshCw, Terminal, Wrench } from "lucide-react";
import { useEffect } from "react";
import { useFvmStore } from "../../store/useFvmStore";

const ZSH_EXPORT_CMD = 'export PATH="$HOME/fvm/default/bin:$PATH"';

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
  const {
    snapshot,
    doctorReport,
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
                {pathOk
                  ? "环境变量 PATH 优先级已就绪"
                  : "本机实测告警：系统 Flutter PATH 遮蔽了 FVM 全局链接"}
              </h2>
            </div>
            <p className="text-xs text-[var(--muted-foreground)] leading-relaxed">
              {pathOk
                ? "当前登录 Shell 优先解析 FVM 全局软链，执行 fvm global 后终端将立即生效。"
                : "当前终端解析到的 flutter 路径优先于 ~/fvm/default/bin，导致 fvm global 切换后在终端内被原 Flutter 覆盖。"}
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => copyText(ZSH_EXPORT_CMD, "已复制 ~/.zshrc PATH 修复命令")}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>复制 PATH 命令</span>
            </button>
            <button
              type="button"
              onClick={() => void fixPathInZshrc()}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-semibold cursor-pointer hover:opacity-90"
            >
              <Wrench className="w-3.5 h-3.5" />
              <span>安全写入 ~/.zshrc</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
          <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
            <div className="text-[var(--muted-foreground)]">当前 Shell 解析结果</div>
            <div className={`break-all ${pathOk ? "text-[var(--success)]" : "text-[var(--error)]"}`}>
              {context.activeFlutterPath ?? "未检测到全局 flutter"}
            </div>
          </div>
          <div className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] space-y-1">
            <div className="text-[var(--muted-foreground)]">FVM 期望的 Global Link</div>
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
            <span className="text-sm font-semibold">VS Code / Antigravity IDE 同步</span>
            <button
              type="button"
              onClick={() => copyText(VSCODE_SNIPPET, "已复制 .vscode/settings.json 片段")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>复制配置</span>
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            开启 <code className="font-mono">updateVscodeSettings: true</code> 时，
            <code className="font-mono">fvm use</code> 会自动写入{" "}
            <code className="font-mono">dart.flutterSdkPath</code> 并排除符号链接搜索噪声。
          </p>
          <pre className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--code-foreground)] overflow-x-auto m-0 select-text">
            {VSCODE_SNIPPET}
          </pre>
        </div>

        {/* Dart MCP Server */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Dart MCP Server (AI Agent 联动)</span>
            <button
              type="button"
              onClick={() => copyText(MCP_SNIPPET, "已复制 Dart MCP Server 配置 JSON")}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[var(--primary)] text-[var(--primary-foreground)] text-xs font-medium cursor-pointer"
            >
              <Copy className="w-3 h-3" />
              <span>复制 MCP JSON</span>
            </button>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            防止 AI 编程助手误用系统全局 Flutter，将 Dart MCP Server 显式指向当前项目的{" "}
            <code className="font-mono">.fvm/flutter_sdk</code>：
          </p>
          <pre className="p-3 rounded-xl bg-[var(--background)] border border-[var(--border)] font-mono text-xs text-[var(--code-foreground)] overflow-x-auto m-0 select-text">
            {MCP_SNIPPET}
          </pre>
        </div>

        {/* Android Studio / IntelliJ */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Android Studio / IntelliJ 符号链接巡检</span>
            <span
              className={`px-2 py-0.5 rounded text-xs ${
                ideaNeedsRefresh.length > 0
                  ? "bg-[var(--warning)]/15 text-[var(--warning)]"
                  : "bg-[var(--success)]/15 text-[var(--success)]"
              }`}
            >
              {ideaNeedsRefresh.length > 0 ? `${ideaNeedsRefresh.length} 项目需刷新` : "状态良好"}
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            IntelliJ 有时会把软链解析成硬编码缓存路径导致切换不跟随。自动巡检所有已追踪项目的{" "}
            <code className="font-mono">.idea/libraries/Dart_SDK.xml</code> 与{" "}
            <code className="font-mono">android/local.properties</code>。
          </p>
          {ideaNeedsRefresh.length > 0 ? (
            <div className="space-y-1.5">
              {ideaNeedsRefresh.map((p) => (
                <div
                  key={p.id}
                  className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono flex items-center justify-between"
                >
                  <span className="truncate">{p.name}/.idea</span>
                  <span className="text-[var(--warning)] shrink-0">未指向 .fvm/flutter_sdk</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs text-[var(--muted-foreground)]">
              已巡检 {projects.length} 个追踪项目，未发现硬编码 SDK 路径漂移。
            </div>
          )}
        </div>

        {/* Melos Monorepo */}
        <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">Melos Monorepo 自动同步</span>
            <span className="px-2 py-0.5 rounded text-xs bg-[var(--success)]/15 text-[var(--success)]">
              {melosProjects.length > 0 ? `${melosProjects.length} 个 Monorepo` : "FVM 3.3+ 原生支持"}
            </span>
          </div>
          <p className="text-xs text-[var(--muted-foreground)]">
            在 Monorepo 根目录执行 <code className="font-mono">fvm use</code> 时，FVM 自动维护{" "}
            <code className="font-mono">melos.yaml</code> 中的{" "}
            <code className="font-mono">sdkPath: .fvm/flutter_sdk</code>。
          </p>
          <div className="p-2.5 rounded-xl bg-[var(--background)] border border-[var(--border)] text-xs font-mono text-[var(--code-foreground)]">
            sdkPath: .fvm/flutter_sdk
          </div>
        </div>
      </div>

      {/* Live Raw `fvm doctor` Output */}
      <div className="rounded-2xl bg-[var(--card)] border border-[var(--border)] overflow-hidden">
        <div className="px-4 py-3 border-b border-[var(--border)] bg-[var(--sidebar)] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Terminal className="w-4 h-4 text-[var(--primary)]" />
            <span className="text-sm font-semibold">实时 fvm doctor 诊断原文</span>
          </div>
          <button
            type="button"
            onClick={() => void refreshDoctor(activeProj?.path)}
            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[var(--secondary)] text-[var(--secondary-foreground)] text-xs cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>重新运行 fvm doctor</span>
          </button>
        </div>
        <pre className="p-4 m-0 max-h-64 overflow-auto scroll-thin bg-[var(--background)] font-mono text-xs text-[var(--code-foreground)] leading-relaxed whitespace-pre-wrap select-text">
          {doctorReport?.rawOutput || "正在运行 fvm doctor…"}
        </pre>
      </div>

      {/* Machine Fingerprint */}
      <div className="p-4 rounded-2xl bg-[var(--card)] border border-[var(--border)] grid grid-cols-2 md:grid-cols-4 gap-3 text-xs font-mono">
        <div>
          <div className="text-[var(--muted-foreground)]">FVM CLI</div>
          <div className="font-semibold mt-0.5 truncate">
            {context.fvmVersion} ({context.fvmBin})
          </div>
        </div>
        <div>
          <div className="text-[var(--muted-foreground)]">OS & Arch</div>
          <div className="font-semibold mt-0.5">
            {context.osLabel} · {context.archLabel}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted-foreground)]">Config File</div>
          <div className="font-semibold mt-0.5 truncate" title={context.appConfigPath}>
            {context.appConfigPath.split("/").slice(-2).join("/")}
          </div>
        </div>
        <div>
          <div className="text-[var(--muted-foreground)]">Privileged Symlink</div>
          <div className="font-semibold mt-0.5 text-[var(--success)]">
            {context.privilegedAccess ? "Enabled (true)" : "Disabled"}
          </div>
        </div>
      </div>
    </div>
  );
}
