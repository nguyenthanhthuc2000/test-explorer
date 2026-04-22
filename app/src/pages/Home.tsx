import React, { useMemo, useState } from "react";
import { InputUrl } from "../components/InputUrl";
import { RunButton } from "../components/RunButton";
import type { RunReport } from "@core/types";
import { qa } from "../lib/qa";

export function Home(props: { onReport: (report: RunReport) => void }) {
  const [url, setUrl] = useState("https://example.com");
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await qa().getConfig();
        if (mounted && cfg?.targetUrl) setUrl(cfg.targetUrl);
      } catch {
        // ignore
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const canRun = useMemo(() => {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }, [url]);

  async function onRun() {
    setRunning(true);
    setError(null);
    try {
      const report = await qa().runTest({ url });
      props.onReport(report);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="grid gap-3">
      <div className="text-sm text-slate-300">
        Nhập URL và bấm <b className="text-slate-100">Run Test</b>. Hiện tại flow trả report giả lập; nếu bật AI thì sẽ gọi Ollama để tạo gợi ý hành động.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <InputUrl value={url} onChange={setUrl} />
        <RunButton disabled={!canRun || running} running={running} onClick={onRun} />
      </div>

      {error ? (
        <div className="text-sm text-red-300">
          <b>Error:</b> {error}
        </div>
      ) : null}

      <div className="text-xs text-slate-400">
        Tip: chạy Ollama bằng Docker, rồi set <code className="rounded bg-white/10 px-1 py-0.5">ENABLE_AI=true</code> trong{" "}
        <code className="rounded bg-white/10 px-1 py-0.5">.env</code>.
      </div>
    </div>
  );
}

