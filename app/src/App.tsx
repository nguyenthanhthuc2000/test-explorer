import React, { useMemo, useState } from "react";
import { Home } from "@app/pages/Home";
import { WebTest } from "@app/pages/WebTest";
import { Report } from "@app/pages/Report";
import type { RunReport } from "@core/types";
import { Settings } from "@app/pages/Settings";
import { History } from "@app/pages/History";
import { RunDetail } from "./pages/RunDetail";
import type { QaApi } from "../../electron/preload";
import type { AppConfig } from "@core/config";
import { qa } from "./lib/qa";
import { ApiMode } from "@app/pages/ApiMode";

type View =
  | { name: "home" }
  | { name: "web" }
  | { name: "api" }
  | { name: "report"; report: RunReport }
  | { name: "settings" }
  | { name: "history" }
  | { name: "run"; id: string };

export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const [cfg, setCfg] = useState<AppConfig | null>(null);
  const hasQa = Boolean((window as unknown as { qa?: QaApi }).qa);
  const [mem, setMem] = useState<{ rssMb: number; heapMb: number } | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const c = await qa().getConfig();
        if (!mounted) return;
        setCfg(c);
      } catch {
        // ignore
      }
    })();
    const t = setInterval(async () => {
      try {
        const m = await qa().getMetrics();
        if (!mounted) return;
        setMem({
          rssMb: Number((m.rssBytes / 1024 / 1024).toFixed(1)),
          heapMb: Number((m.heapUsedBytes / 1024 / 1024).toFixed(1))
        });
      } catch {
        // ignore
      }
    }, 1500);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  const header = useMemo(() => {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold tracking-tight">AI QA Desktop Tool</div>
          <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            {mem ? (
              <>
                <div className="rounded-full bg-white/10 px-2 py-0.5 font-extrabold text-slate-200">
                  RAM: {mem.rssMb}MB
                </div>
                <div className="rounded-full bg-white/10 px-2 py-0.5 font-extrabold text-slate-200">
                  Heap: {mem.heapMb}MB
                </div>
              </>
            ) : (
              <div className="text-slate-400">RAM/Heap: ...</div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <button
            className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-slate-100 hover:bg-white/15"
            onClick={() => setView({ name: "home" })}
          >
            Home
          </button>
          <button
            className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-slate-100 hover:bg-white/15"
            onClick={() => setView({ name: "web" })}
          >
            Test Web/UI
          </button>
          <button
            className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-slate-100 hover:bg-white/15"
            onClick={() => setView({ name: "api" })}
          >
            Test API
          </button>
          <button
            className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-slate-100 hover:bg-white/15"
            onClick={() => setView({ name: "settings" })}
          >
            Config
          </button>
          <button
            className="rounded-lg bg-white/10 px-2 py-1 font-semibold text-slate-100 hover:bg-white/15"
            onClick={() => setView({ name: "history" })}
          >
            History
          </button>
          <div className={["rounded-full px-2 py-0.5 font-extrabold", hasQa ? "bg-emerald-300 text-slate-950" : "bg-red-300 text-slate-950"].join(" ")}>
            {hasQa ? "Electron OK" : "No preload"}
          </div>
        </div>
      </div>
    );
  }, [hasQa, mem]);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {header}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        {view.name === "api" ? (
          <ApiMode />
        ) : view.name === "web" ? (
          <WebTest onReport={(report) => setView({ name: "report", report })} />
        ) : view.name === "home" ? (
          <Home
            onStart={(mode) => {
              if (mode === "api") setView({ name: "api" });
              else setView({ name: "web" });
            }}
          />
        ) : view.name === "report" ? (
          <Report report={view.report} onBack={() => setView({ name: "home" })} />
        ) : view.name === "settings" ? (
          <Settings />
        ) : view.name === "history" ? (
          <History onOpenRun={(id) => setView({ name: "run", id })} />
        ) : (
          <RunDetail id={view.id} onBack={() => setView({ name: "history" })} />
        )}
      </div>
    </div>
  );
}

