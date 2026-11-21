import { useFvmStore } from "../store/useFvmStore";

export function ToastContainer() {
  const { toasts, dismissToast } = useFvmStore();
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-48 right-5 z-50 space-y-2 pointer-events-none">
      {toasts.map((t) => {
        const borderClass =
          t.tone === "success"
            ? "border-[var(--success)]"
            : t.tone === "warning"
              ? "border-[var(--warning)]"
              : t.tone === "error"
                ? "border-[var(--error)]"
                : "border-[var(--primary)]";
        const dotClass =
          t.tone === "success"
            ? "bg-[var(--success)]"
            : t.tone === "warning"
              ? "bg-[var(--warning)]"
              : t.tone === "error"
                ? "bg-[var(--error)]"
                : "bg-[var(--primary)]";

        return (
          <div
            key={t.id}
            onClick={() => dismissToast(t.id)}
            className={`pointer-events-auto cursor-pointer px-3.5 py-2.5 rounded-xl bg-[var(--card)] border ${borderClass} text-xs text-[var(--foreground)] glass-elevated flex items-center gap-2 max-w-md`}
          >
            <span className={`w-2 h-2 rounded-full shrink-0 ${dotClass}`} />
            <span className="leading-snug">{t.message}</span>
          </div>
        );
      })}
    </div>
  );
}
