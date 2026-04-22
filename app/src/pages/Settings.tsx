import React, { useEffect, useMemo, useState } from "react";
import type { AppConfig, TestModuleKey } from "@core/config";
import { defaultConfig } from "@core/config";
import { qa } from "../lib/qa";

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

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

export function Settings() {
  const [cfg, setCfg] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      try {
        const c = await qa().getConfig();
        if (mounted) setCfg(c ?? defaultConfig);
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const enabledCount = useMemo(() => Object.values(cfg.modules).filter(Boolean).length, [cfg.modules]);

  async function onSave() {
    setSaving(true);
    setMsg(null);
    try {
      const next: AppConfig = {
        ...cfg,
        targetUrl: cfg.targetUrl.trim() || defaultConfig.targetUrl,
        crawl: {
          maxDepth: clampInt(cfg.crawl.maxDepth, 1, 20),
          maxPages: clampInt(cfg.crawl.maxPages, 1, 500)
        }
      };
      await qa().setConfig(next);
      setCfg(next);
      setMsg("Đã lưu config vào SQLite.");
    } catch (e) {
      setMsg(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-base font-extrabold">Config</div>
          <div className="text-sm text-slate-300">
            Bật/tắt module test theo phase trong <code className="rounded bg-white/10 px-1 py-0.5">documents/step.md</code>.
            Config được lưu trong SQLite (userData).
          </div>
        </div>
        <button
          onClick={onSave}
          disabled={loading || saving}
          className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      {msg ? (
        <div className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-slate-200">{msg}</div>
      ) : null}

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="text-sm font-extrabold">Target</div>
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Default URL</div>
            <input
              type="url"
              value={cfg.targetUrl}
              onChange={(e) => setCfg((c) => ({ ...c, targetUrl: e.target.value }))}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder="https://your-app.com"
            />
          </label>
          <div className="grid grid-cols-2 gap-2">
            <label className="grid gap-1">
              <div className="text-xs font-bold text-slate-300">Max depth</div>
              <input
                type="number"
                value={cfg.crawl.maxDepth}
                min={1}
                max={20}
                onChange={(e) => setCfg((c) => ({ ...c, crawl: { ...c.crawl, maxDepth: Number(e.target.value) } }))}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
              />
            </label>
            <label className="grid gap-1">
              <div className="text-xs font-bold text-slate-300">Max pages</div>
              <input
                type="number"
                value={cfg.crawl.maxPages}
                min={1}
                max={500}
                onChange={(e) => setCfg((c) => ({ ...c, crawl: { ...c.crawl, maxPages: Number(e.target.value) } }))}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
              />
            </label>
          </div>
        </div>

        <label className="grid gap-1">
          <div className="text-xs font-bold text-slate-300">Context cho AI (optional)</div>
          <textarea
            value={cfg.context ?? ""}
            onChange={(e) => setCfg((c) => ({ ...c, context: e.target.value }))}
            rows={5}
            className="resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
            placeholder={[
              "Ví dụ:",
              "- App domain: e-commerce",
              "- User role: admin",
              "- Mục tiêu: kiểm tra navigation + console error",
              "- Những flow quan trọng: login -> dashboard -> orders"
            ].join("\n")}
          />
          <div className="text-xs text-slate-400">
            Nếu để trống thì AI vẫn chạy như bình thường, chỉ là không có thêm ngữ cảnh.
          </div>
        </label>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-extrabold">Test modules</div>
            <div className="text-xs text-slate-400">Đang bật: {enabledCount}</div>
          </div>
          <label className="flex items-center gap-2 text-xs font-bold text-slate-200">
            <input
              type="checkbox"
              checked={cfg.ai.enabled}
              onChange={(e) => setCfg((c) => ({ ...c, ai: { enabled: e.target.checked } }))}
            />
            Enable AI (Ollama)
          </label>
        </div>

        <div className="grid gap-2 md:grid-cols-2">
          {(Object.keys(moduleMeta) as TestModuleKey[]).map((k) => (
            <label
              key={k}
              className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3 hover:bg-white/10"
            >
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
      </div>

      {loading ? <div className="text-sm text-slate-400">Loading...</div> : null}
    </div>
  );
}

