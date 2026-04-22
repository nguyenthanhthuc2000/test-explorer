import React, { useEffect, useMemo, useState } from "react";
import type { RunRow } from "@db/repository/run.repo";
import { qa } from "../lib/qa";
import type { AppConfig, TestModuleKey } from "@core/config";

const moduleLabels: Record<TestModuleKey, string> = {
  ui_interaction: "UI",
  navigation: "Nav",
  form: "Form",
  api_network: "API",
  console_error: "Console",
  visual: "Visual"
};

function safeParseConfig(json: string): AppConfig | null {
  try {
    return JSON.parse(json) as AppConfig;
  } catch {
    return null;
  }
}

function statusPill(status: string) {
  const s = status.toLowerCase();
  if (s.includes("fail")) return "bg-red-400 text-slate-950";
  if (s.includes("complete")) return "bg-emerald-300 text-slate-950";
  if (s.includes("run")) return "bg-sky-300 text-slate-950";
  return "bg-white/10 text-slate-200";
}

export function History(props: { onOpenRun: (id: string) => void }) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [modeFilter, setModeFilter] = useState<"all" | "api" | "web">("all");

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const r = await qa().listRuns(50);
      setRuns(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return runs.filter((r) => {
      const cfg = safeParseConfig(r.config_json);
      const mode = cfg?.mode;
      if (modeFilter !== "all" && mode && mode !== modeFilter) return false;
      if (!q) return true;
      return (r.url + " " + r.id + " " + r.status).toLowerCase().includes(q);
    });
  }, [runs, query, modeFilter]);

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-base font-extrabold">History</div>
          <div className="text-sm text-slate-300">Danh sách runs được lưu trong SQLite.</div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Filter mode</div>
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
              <button
                onClick={() => setModeFilter("all")}
                className={[
                  "rounded-lg px-2 py-1 text-xs font-extrabold",
                  modeFilter === "all" ? "bg-white/15 text-slate-100" : "text-slate-300 hover:bg-white/10"
                ].join(" ")}
              >
                All
              </button>
              <button
                onClick={() => setModeFilter("web")}
                className={[
                  "rounded-lg px-2 py-1 text-xs font-extrabold",
                  modeFilter === "web" ? "bg-white/15 text-slate-100" : "text-slate-300 hover:bg-white/10"
                ].join(" ")}
              >
                UI
              </button>
              <button
                onClick={() => setModeFilter("api")}
                className={[
                  "rounded-lg px-2 py-1 text-xs font-extrabold",
                  modeFilter === "api" ? "bg-white/15 text-slate-100" : "text-slate-300 hover:bg-white/10"
                ].join(" ")}
              >
                API
              </button>
            </div>
          </div>
          <div className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Search</div>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-72 max-w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder="url / run id / status"
            />
          </div>
          <button
            onClick={async () => {
              if (!confirm("Xoá toàn bộ history (runs/steps) trong SQLite?")) return;
              setRuns([]);
              const res = await qa().clearHistory();
              console.log("clearHistory:", res);
              await refresh();
            }}
            className="rounded-xl bg-red-400 px-3 py-2 text-sm font-extrabold text-slate-950 hover:bg-red-300"
          >
            Clear all
          </button>
        </div>
      </div>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}
      {loading ? <div className="text-sm text-slate-400">Loading...</div> : null}

      <div className="grid gap-2">
        {filtered.length === 0 && !loading ? (
          <div className="text-sm text-slate-400">Chưa có run nào. Hãy chạy test ở Home.</div>
        ) : null}

        {filtered.map((r) => {
          const cfg = safeParseConfig(r.config_json);
          const enabled =
            cfg ? (Object.keys(cfg.modules) as TestModuleKey[]).filter((k) => cfg.modules[k]) : [];

          return (
            <button
              key={r.id}
              onClick={() => props.onOpenRun(r.id)}
              className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:bg-white/5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-extrabold">{r.url}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    <span className="font-bold">Run</span>{" "}
                    <code className="rounded bg-white/10 px-1 py-0.5">{r.id}</code>
                    <span className="mx-2">•</span>
                    <span className="font-bold">Started</span> {r.started_at}
                    {r.finished_at ? (
                      <>
                        <span className="mx-2">•</span>
                        <span className="font-bold">Finished</span> {r.finished_at}
                      </>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {cfg?.mode ? (
                    <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200">
                      {cfg.mode.toUpperCase()}
                    </span>
                  ) : null}
                  {cfg?.ai.enabled ? (
                    <span className="rounded-full bg-fuchsia-300 px-2 py-0.5 text-[11px] font-extrabold text-slate-950">
                      AI
                    </span>
                  ) : null}
                  <span className={["rounded-full px-2 py-0.5 text-[11px] font-extrabold", statusPill(r.status)].join(" ")}>
                    {r.status}
                  </span>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap gap-1.5">
                {enabled.slice(0, 6).map((k) => (
                  <span
                    key={k}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200"
                  >
                    {moduleLabels[k]}
                  </span>
                ))}
                {cfg ? (
                  <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200">
                    depth {cfg.crawl.maxDepth} • pages {cfg.crawl.maxPages}
                  </span>
                ) : null}
              </div>

              {cfg?.context?.trim() ? (
                <div className="mt-2 max-h-10 overflow-hidden text-xs text-slate-400">
                  <span className="font-bold">Context:</span> {cfg.context.trim()}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

