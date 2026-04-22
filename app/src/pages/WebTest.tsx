import React, { useMemo, useState } from "react";
import { InputUrl } from "../components/InputUrl";
import { RunButton } from "../components/RunButton";
import type { RunReport } from "@core/types";
import { qa } from "../lib/qa";
import type { AppConfig, TestModuleKey } from "@core/config";
import { defaultConfig } from "@core/config";

const moduleMeta: Record<TestModuleKey, { label: string; phase: string; desc: string }> = {
  ui_interaction: {
    label: "UI Interaction Testing",
    phase: "Phase 1 (core)",
    desc: "Click/navigate/open modal/toggle… phát hiện UI crash, redirect sai, page không load."
  },
  navigation: {
    label: "Navigation / Flow Testing",
    phase: "Phase 1",
    desc: "Broken navigation, dead link, loop navigation."
  },
  form: { label: "Form Testing", phase: "Phase 2", desc: "Fill/submit/validation." },
  api_network: { label: "API / Network Testing", phase: "Phase 2", desc: "Intercept request: status, failed request, latency." },
  console_error: { label: "Console Error Testing", phase: "Phase 2", desc: "Detect JS error / warning nghiêm trọng." },
  visual: { label: "Visual Testing", phase: "Phase 3", desc: "Screenshot diff / layout broken." }
};

export function WebTest(props: { onReport: (report: RunReport) => void }) {
  const [url, setUrl] = useState("https://example.com");
  const [cfg, setCfg] = useState<AppConfig>(defaultConfig);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = await qa().getConfig();
        if (!mounted) return;
        setCfg(cfg ?? defaultConfig);
        if (cfg?.targetUrl) setUrl(cfg.targetUrl);
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
      // Save Web/UI-related config right before running (no auto-save while typing)
      const next: AppConfig = { ...cfg, targetUrl: url, context: cfg.context ?? "" };
      await qa().setConfig(next);
      setCfg(next);
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
        Nhập URL và bấm <b className="text-slate-100">Run Test</b>.
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <InputUrl value={url} onChange={setUrl} />
        <RunButton disabled={!canRun || running} running={running} onClick={onRun} />
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-extrabold">Test modules (Web/UI)</div>
        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(moduleMeta) as TestModuleKey[]).map((k) => (
            <label key={k} className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10">
              <input
                type="checkbox"
                checked={cfg.modules[k]}
                onChange={(e) => setCfg((c) => ({ ...c, modules: { ...c.modules, [k]: e.target.checked } }))}
                className="mt-1"
              />
              <div className="grid gap-0.5">
                <div className="flex flex-wrap items-center gap-2">
                  <div className="font-extrabold">{moduleMeta[k].label}</div>
                  <div className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200">
                    {moduleMeta[k].phase}
                  </div>
                </div>
                <div className="text-sm text-slate-300">{moduleMeta[k].desc}</div>
              </div>
            </label>
          ))}
        </div>

        <label className="grid gap-1">
          <div className="text-xs font-bold text-slate-300">Context (optional)</div>
          <textarea
            value={cfg.context ?? ""}
            onChange={(e) => setCfg((c) => ({ ...c, context: e.target.value }))}
            rows={5}
            className="resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
            placeholder={[
              "Mô tả để AI hiểu đúng app và ưu tiên test:",
              "- Domain / loại hệ thống (e-commerce, fintech, admin portal...)",
              "- Role/user (guest/user/admin) + quyền quan trọng",
              "- Flow quan trọng cần cover (login -> dashboard -> orders...)",
              "- Những thứ cần tránh (xoá dữ liệu thật, gọi prod, thao tác destructive...)"
            ].join("\n")}
          />
        </label>
      </div>

      {error ? (
        <div className="text-sm text-red-300">
          <b>Error:</b> {error}
        </div>
      ) : null}
    </div>
  );
}

