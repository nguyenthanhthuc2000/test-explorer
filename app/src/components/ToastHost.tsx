import React, { createContext, useCallback, useContext, useMemo, useState } from "react";

type Toast = {
  id: string;
  message: string;
  kind: "success" | "error" | "info";
};

type ToastCtx = {
  push: (t: Omit<Toast, "id">) => void;
};

const Ctx = createContext<ToastCtx | null>(null);

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function ToastHost(props: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const push = useCallback((t: Omit<Toast, "id">) => {
    const id = newId();
    const toast: Toast = { id, ...t };
    setToasts((prev) => [toast, ...prev].slice(0, 3));
    window.setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== id));
    }, 2400);
  }, []);

  const value = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={value}>
      {props.children}
      <div className="pointer-events-none fixed right-4 top-4 z-50 grid w-[360px] max-w-[calc(100vw-2rem)] gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={[
              "pointer-events-auto rounded-2xl border px-3 py-2 text-sm font-bold shadow-lg backdrop-blur",
              t.kind === "success"
                ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                : t.kind === "error"
                  ? "border-red-400/30 bg-red-500/15 text-red-100"
                  : "border-white/10 bg-white/10 text-slate-100"
            ].join(" ")}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useToast must be used within ToastHost");
  return ctx;
}

