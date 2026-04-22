import React, { useMemo, useState } from "react";
import { Home } from "@app/pages/Home";
import { Report } from "@app/pages/Report";
import type { RunReport } from "@core/types";

type View = { name: "home" } | { name: "report"; report: RunReport };

export function App() {
  const [view, setView] = useState<View>({ name: "home" });

  const header = useMemo(() => {
    return (
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-lg font-extrabold tracking-tight">AI QA Desktop Tool</div>
          <div className="text-sm text-slate-300">
            Electron + React · Core Orchestrator · (Optional) Ollama
          </div>
        </div>
        <div className="text-xs text-slate-400">MVP skeleton</div>
      </div>
    );
  }, []);

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      {header}
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] backdrop-blur">
        {view.name === "home" ? (
          <Home
            onReport={(report) => setView({ name: "report", report })}
          />
        ) : (
          <Report report={view.report} onBack={() => setView({ name: "home" })} />
        )}
      </div>
    </div>
  );
}

