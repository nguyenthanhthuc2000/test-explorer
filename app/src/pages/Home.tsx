import React from "react";
import type { AppMode } from "@core/config";

function useTypewriter(lines: string[], msPerChar: number) {
  const [idx, setIdx] = React.useState(0);
  const [char, setChar] = React.useState(0);

  React.useEffect(() => {
    const t = setInterval(() => {
      setChar((c) => c + 1);
    }, msPerChar);
    return () => clearInterval(t);
  }, [msPerChar]);

  React.useEffect(() => {
    const current = lines[idx] ?? "";
    if (char >= current.length) {
      const t = setTimeout(() => {
        setIdx((i) => (i + 1) % lines.length);
        setChar(0);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [char, idx, lines]);

  const current = lines[idx] ?? "";
  return current.slice(0, Math.min(char, current.length));
}

export function Home(props: { onStart: (mode: AppMode) => void }) {
  const typed = useTypewriter(
    [
      "Tự động QA cho Web App bằng AI.",
      "Không cần viết test script thủ công.",
      "Chạy UI + Console/Network checks, lưu History.",
      "API mode: chạy request + validate + log."
    ],
    28
  );

  const [spark, setSpark] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setSpark((s) => (s + 1) % 100000), 150);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 p-5">
      <div
        className="pointer-events-none absolute inset-0 opacity-70"
        style={{
          background:
            "radial-gradient(800px 300px at 20% 10%, rgba(59,130,246,0.35), transparent 60%), radial-gradient(700px 260px at 80% 20%, rgba(16,185,129,0.25), transparent 55%), radial-gradient(900px 320px at 50% 90%, rgba(168,85,247,0.18), transparent 60%)"
        }}
      />

      <div className="relative grid gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs font-extrabold text-slate-300">INTRO</div>
            <div className="mt-1 text-2xl font-extrabold tracking-tight text-slate-100">
              AI QA Desktop Tool
            </div>
            <div className="mt-2 flex items-center gap-2 text-sm text-slate-300">
              <span className="font-semibold text-slate-200">{typed}</span>
              <span className="h-4 w-2 animate-pulse rounded bg-slate-200/80" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
            <div className="text-xs font-extrabold text-slate-300">Live</div>
            <div className="mt-1 grid gap-1 text-xs text-slate-300">
              <div className="flex items-center justify-between gap-6">
                <span>AI planner</span>
                <span className="font-extrabold text-emerald-300">
                  {spark % 7 === 0 ? "thinking" : "ready"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span>Runner</span>
                <span className="font-extrabold text-blue-300">
                  {spark % 11 === 0 ? "warming" : "idle"}
                </span>
              </div>
              <div className="flex items-center justify-between gap-6">
                <span>History</span>
                <span className="font-extrabold text-purple-300">local SQLite</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-extrabold text-slate-100">Web / UI</div>
            <div className="mt-1 text-sm text-slate-300">
              Chạy smoke QA nhanh: mở trang, bắt console error, request fail/4xx/5xx, và report theo step.
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-extrabold text-slate-100">API Test</div>
            <div className="mt-1 text-sm text-slate-300">
              Gửi request nhiều method, validate status/time/body, xem log từng lần chạy và generate scenario (Ollama).
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
            <div className="text-sm font-extrabold text-slate-100">Config</div>
            <div className="mt-1 text-sm text-slate-300">
              Chọn provider (Ollama/OpenAI), kiểm tra kết nối, set timeout, lưu config local.
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 pt-1">
          <button
            onClick={() => props.onStart("web")}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-400"
          >
            Bắt đầu kiểm thử Web/UI
          </button>
          <button
            onClick={() => props.onStart("api")}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15"
          >
            Bắt đầu kiểm thử API
          </button>
          <div className="text-xs text-slate-400">
            Gợi ý: vào <b className="text-slate-200">Config</b> để cấu hình AI provider trước.
          </div>
        </div>
      </div>
    </div>
  );
}

