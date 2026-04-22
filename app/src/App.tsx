import React, { useMemo, useState } from "react";
import { Home } from "@app/pages/Home";
import { Report } from "@app/pages/Report";
import type { RunReport } from "@core/types";
import { Settings } from "@app/pages/Settings";
import { History } from "@app/pages/History";
import { RunDetail } from "./pages/RunDetail";
import type { QaApi } from "../../electron/preload";

type View =
  | { name: "home" }
  | { name: "report"; report: RunReport }
  | { name: "settings" }
  | { name: "history" }
  | { name: "run"; id: string };

export function App() {
  const [view, setView] = useState<View>({ name: "home" });
  const hasQa = Boolean((window as unknown as { qa?: QaApi }).qa);

  const header = useMemo(() => {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold tracking-tight">AI QA Desktop Tool</div>
          <div className="text-sm text-slate-300">
            Electron + React · Core Orchestrator · (Optional) Ollama
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
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {header}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        {view.name === "home" ? (
          <Home onReport={(report) => setView({ name: "report", report })} />
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

