import React from "react";
import type { RunReport } from "@core/types";
import { ResultList } from "../components/ResultList";

export function Report(props: { report: RunReport; onBack: () => void }) {
  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-extrabold">Report</div>
          <div className="text-xs text-slate-400">
            Run: <code className="rounded bg-white/10 px-1 py-0.5">{props.report.runId}</code>
          </div>
        </div>
        <button
          onClick={props.onBack}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-slate-100 hover:bg-white/15"
        >
          Back
        </button>
      </div>

      <div className="text-sm text-slate-300">
        <div>
          <b>URL:</b> {props.report.url}
        </div>
        <div>
          <b>Status:</b> {props.report.status}
        </div>
        <div>
          <b>Started:</b> {props.report.startedAt}
        </div>
        {props.report.finishedAt ? (
          <div>
            <b>Finished:</b> {props.report.finishedAt}
          </div>
        ) : null}
      </div>

      <ResultList steps={props.report.steps} />

      {props.report.aiSummary ? (
        <div className="grid gap-2">
          <div className="font-extrabold">AI summary (Ollama)</div>
          <pre className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100">
            {props.report.aiSummary}
          </pre>
        </div>
      ) : (
        <div className="text-xs text-slate-400">
          AI đang tắt (ENABLE_AI=false) hoặc chưa có phản hồi.
        </div>
      )}
    </div>
  );
}

