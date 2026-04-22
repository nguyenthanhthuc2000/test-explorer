import React, { useEffect, useState } from "react";
import type { RunRow } from "@db/repository/run.repo";
import type { StepRow } from "@db/repository/step.repo";
import { qa } from "../lib/qa";

function statusBadge(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fail")) return "bg-red-400 text-slate-950";
  if (s.includes("pass") || s.includes("complete")) return "bg-emerald-300 text-slate-950";
  return "bg-sky-300 text-slate-950";
}

export function RunDetail(props: { id: string; onBack: () => void }) {
  const [run, setRun] = useState<RunRow | null>(null);
  const [steps, setSteps] = useState<StepRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await qa().getRun(props.id);
        if (!mounted) return;
        if (!res) {
          setRun(null);
          setSteps([]);
          setError("Không tìm thấy run trong DB.");
          return;
        }
        setRun(res.run);
        setSteps(res.steps);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, [props.id]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-base font-extrabold">Run detail</div>
          <div className="text-xs text-slate-400">
            Run: <code className="rounded bg-white/10 px-1 py-0.5">{props.id}</code>
          </div>
        </div>
        <button
          onClick={props.onBack}
          className="rounded-xl bg-white/10 px-3 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15"
        >
          Back
        </button>
      </div>

      {loading ? <div className="text-sm text-slate-400">Loading...</div> : null}
      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      {run ? (
        <div className="grid gap-3">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold">{run.url}</div>
              <div className={["rounded-full px-2 py-0.5 text-[11px] font-extrabold", statusBadge(run.status)].join(" ")}>
                {run.status}
              </div>
            </div>
            <div className="mt-2 grid gap-1 text-xs text-slate-400">
              <div>Started: {run.started_at}</div>
              {run.finished_at ? <div>Finished: {run.finished_at}</div> : null}
            </div>
          </div>

          <div className="grid gap-2">
            <div className="font-extrabold">Steps</div>
            {steps.map((s) => (
              <div key={s.id} className="rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="font-bold">{s.title}</div>
                  <div className={["rounded-full px-2 py-0.5 text-[11px] font-extrabold", statusBadge(s.status)].join(" ")}>
                    {s.status.toUpperCase()}
                  </div>
                </div>
                {s.details ? <div className="mt-1 text-sm text-slate-300">{s.details}</div> : null}
              </div>
            ))}
          </div>

          {run.ai_summary ? (
            <div className="grid gap-2">
              <div className="font-extrabold">AI summary</div>
              <pre className="max-h-72 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100">
                {run.ai_summary}
              </pre>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

