import React, { useEffect, useState } from "react";
import type { RunRow } from "@db/repository/run.repo";
import { qa } from "../lib/qa";

export function History(props: { onOpenRun: (id: string) => void }) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await qa().listRuns(50);
        if (mounted) setRuns(r);
      } catch (e) {
        if (mounted) setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div className="grid gap-3">
      <div>
        <div className="text-base font-extrabold">History</div>
        <div className="text-sm text-slate-300">Danh sách runs được lưu trong SQLite.</div>
      </div>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-400">Loading...</div> : null}

      <div className="grid gap-2">
        {runs.length === 0 && !loading ? (
          <div className="text-sm text-slate-400">Chưa có run nào. Hãy chạy test ở Home.</div>
        ) : null}

        {runs.map((r) => (
          <button
            key={r.id}
            onClick={() => props.onOpenRun(r.id)}
            className="rounded-xl border border-white/10 bg-black/20 p-3 text-left hover:bg-white/5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-extrabold">{r.url}</div>
              <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200">
                {r.status}
              </div>
            </div>
            <div className="mt-1 text-xs text-slate-400">
              <div>
                Run: <code className="rounded bg-white/10 px-1 py-0.5">{r.id}</code>
              </div>
              <div>Started: {r.started_at}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

