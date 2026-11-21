import { ChevronDown, ChevronUp, Copy, Square, Trash2 } from "lucide-react";
import { useFvmStore } from "../store/useFvmStore";

export function CliConsole() {
  const {
    logs,
    consoleOpen,
    setConsoleOpen,
    clearLogs,
    activeRequestIds,
    cancelRequest,
    pushToast,
  } = useFvmStore();

  const latest = logs[0];
  const hasRunning = activeRequestIds.length > 0;

  const copyCommand = (cmd: string) => {
    void navigator.clipboard?.writeText(cmd);
    pushToast(`已复制: ${cmd}`, "success");
  };

  return (
    <section className="shrink-0 border-t border-[var(--border)] bg-[var(--sidebar)]">
      <div className="px-4 py-2 flex items-center justify-between gap-3 border-b border-[var(--border)]">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className={`w-2 h-2 rounded-full shrink-0 ${
              hasRunning ? "bg-[var(--warning)] pulse-dot" : "bg-[var(--success)]"
            }`}
          />
          <span className="text-xs font-semibold tracking-wide uppercase text-[var(--muted-foreground)] shrink-0">
            实时 CLI 透明控制台
          </span>
          {latest && (
            <span className="hidden sm:inline font-mono text-xs text-[var(--code-foreground)] truncate max-w-md px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)]">
              $ {latest.cmd}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={clearLogs}
            className="flex items-center gap-1 text-xs px-2 py-1 rounded hover:bg-[var(--secondary)] text-[var(--muted-foreground)] transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>清空</span>
          </button>
          <button
            type="button"
            onClick={() => setConsoleOpen(!consoleOpen)}
            className="flex items-center gap-1 text-xs px-2.5 py-1 rounded bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] transition cursor-pointer"
          >
            {consoleOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronUp className="w-3.5 h-3.5" />}
            <span>{consoleOpen ? "收起" : "展开"}</span>
          </button>
        </div>
      </div>

      {consoleOpen && (
        <div className="h-40 overflow-y-auto scroll-thin px-4 py-2 font-mono text-xs space-y-2 bg-[var(--background)] select-text">
          {logs.length === 0 ? (
            <div className="py-6 text-center text-[var(--muted-foreground)]">
              暂无 CLI 执行记录，在上方触发任意操作将在此实时流式输出对应 fvm 指令与日志。
            </div>
          ) : (
            logs.map((l) => {
              const badgeClass =
                l.status === "OK"
                  ? "text-[var(--success)]"
                  : l.status === "ERR"
                    ? "text-[var(--error)]"
                    : l.status === "RUNNING"
                      ? "text-[var(--warning)]"
                      : "text-[var(--muted-foreground)]";
              const isRunning = activeRequestIds.includes(l.id);

              return (
                <div
                  key={l.id}
                  className="py-1.5 border-b border-[var(--border)]/50 last:border-none space-y-1"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex items-center gap-2 flex-wrap">
                      <span className="text-[var(--muted-foreground)] tabular-nums">{l.time}</span>
                      <span className={`font-semibold ${badgeClass}`}>[{l.status}]</span>
                      <span className="text-[var(--foreground)] break-all">$ {l.cmd}</span>
                      {l.cwd && (
                        <span className="text-[var(--muted-foreground)]">
                          @{l.cwd.split("/").pop()}
                        </span>
                      )}
                      {l.durationMs != null && (
                        <span className="text-[var(--muted-foreground)] tabular-nums">
                          ({(l.durationMs / 1000).toFixed(2)}s)
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      {isRunning && (
                        <button
                          type="button"
                          onClick={() => void cancelRequest(l.id)}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--error)]/15 text-[var(--error)] border border-[var(--error)]/40 cursor-pointer"
                        >
                          <Square className="w-2.5 h-2.5 fill-current" />
                          <span>中止</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => copyCommand(l.cmd)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--card)] border border-[var(--border)] hover:border-[var(--primary)] text-[var(--muted-foreground)] cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>复制</span>
                      </button>
                    </div>
                  </div>

                  {l.lines.length > 0 && (
                    <div className="pl-16 space-y-0.5 text-[var(--muted-foreground)] whitespace-pre-wrap break-all">
                      {l.lines.slice(-12).map((line, i) => (
                        <div key={i}>{line}</div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </section>
  );
}
