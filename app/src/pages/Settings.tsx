import React, { useEffect, useMemo, useRef, useState } from "react";
import type { AppConfig } from "@core/config";
import { defaultConfig } from "@core/config";
import { qa } from "../lib/qa";
import { useToast } from "../components/ToastHost";

function clampInt(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, Math.trunc(v)));
}

function clampFloat(v: number, min: number, max: number) {
  if (!Number.isFinite(v)) return min;
  return Math.max(min, Math.min(max, v));
}

export function Settings() {
  const [cfg, setCfg] = useState<AppConfig>(defaultConfig);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const toast = useToast();
  const [openAiModels, setOpenAiModels] = useState<string[]>([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [conn, setConn] = useState<{
    ollama: { status: "unknown" | "ok" | "fail" | "not_configured"; detail?: string };
    openai: { status: "unknown" | "ok" | "fail" | "not_configured"; detail?: string };
  }>({
    ollama: { status: "unknown" },
    openai: { status: "unknown" }
  });
  const didAutoCheckRef = useRef(false);

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

  useEffect(() => {
    let mounted = true;
    if (!cfg) return;
    if (loading) return;
    if (didAutoCheckRef.current) return;
    didAutoCheckRef.current = true;

    (async () => {
      // Ollama
      try {
        const baseUrl = (cfg.ai.baseUrl ?? "").trim();
        if (!baseUrl) {
          if (mounted) setConn((p) => ({ ...p, ollama: { status: "not_configured" } }));
        } else {
          const r = await qa().testOllama();
          if (mounted) setConn((p) => ({ ...p, ollama: { status: r.ok ? "ok" : "fail" } }));
          if (!r.ok) toast.push({ kind: "error", message: "Kết nối Ollama thất bại." });
        }
      } catch (e) {
        if (mounted) setConn((p) => ({ ...p, ollama: { status: "fail", detail: e instanceof Error ? e.message : String(e) } }));
        toast.push({ kind: "error", message: "Kết nối Ollama thất bại." });
      }

      // OpenAI
      try {
        const apiKey = (cfg.ai.openaiApiKey ?? "").trim();
        if (!apiKey) {
          if (mounted) setConn((p) => ({ ...p, openai: { status: "not_configured" } }));
        } else {
          const r = await qa().testOpenAI();
          if (mounted) setConn((p) => ({ ...p, openai: { status: r.ok ? "ok" : "fail" } }));
          if (!r.ok) toast.push({ kind: "error", message: "Kết nối OpenAI thất bại." });
        }
      } catch (e) {
        if (mounted) setConn((p) => ({ ...p, openai: { status: "fail", detail: e instanceof Error ? e.message : String(e) } }));
        toast.push({ kind: "error", message: "Kết nối OpenAI thất bại." });
      }
    })();

    return () => {
      mounted = false;
    };
    // Only run once when page loads (after config loaded)
  }, [cfg, loading, toast]);

  function pill(s: "unknown" | "ok" | "fail" | "not_configured") {
    if (s === "ok") return "bg-emerald-300 text-slate-950";
    if (s === "fail") return "bg-red-400 text-slate-950";
    if (s === "not_configured") return "bg-white/10 text-slate-200";
    return "bg-white/10 text-slate-200";
  }

  function label(s: "unknown" | "ok" | "fail" | "not_configured") {
    if (s === "ok") return "Connected";
    if (s === "fail") return "Failed";
    if (s === "not_configured") return "Not configured";
    return "Checking…";
  }

  const enabledCount = useMemo(() => Object.values(cfg.modules).filter(Boolean).length, [cfg.modules]);

  async function onSave() {
    setSaving(true);
    try {
      const next: AppConfig = {
        ...cfg,
        crawl: {
          maxDepth: clampInt(cfg.crawl.maxDepth, 1, 20),
          maxPages: clampInt(cfg.crawl.maxPages, 1, 500)
        },
        ai: {
          ...cfg.ai,
          maxScenarios: clampInt(cfg.ai.maxScenarios ?? defaultConfig.ai.maxScenarios, 1, 30),
          scenarioHint: cfg.ai.scenarioHint ?? "",
          baseUrl: (cfg.ai.baseUrl ?? "").trim(),
          model: (cfg.ai.model ?? "").trim() || defaultConfig.ai.model,
          ollamaTimeoutSec: clampFloat(Number(cfg.ai.ollamaTimeoutSec ?? defaultConfig.ai.ollamaTimeoutSec ?? 0.1), 0.1, 60),
          openaiBaseUrl: (cfg.ai.openaiBaseUrl ?? "").trim() || defaultConfig.ai.openaiBaseUrl,
          openaiApiKey: cfg.ai.openaiApiKey ?? "",
          openaiModel: (cfg.ai.openaiModel ?? "").trim() || defaultConfig.ai.openaiModel,
          openaiTimeoutSec: clampFloat(Number(cfg.ai.openaiTimeoutSec ?? defaultConfig.ai.openaiTimeoutSec ?? 0.1), 0.1, 60),
          provider: cfg.ai.provider ?? defaultConfig.ai.provider,
          enabled: true
        },
        context: cfg.context ?? ""
      };
      await qa().setConfig(next);
      setCfg(next);
      toast.push({ kind: "success", message: "Đã lưu config." });
    } catch (e) {
      toast.push({ kind: "error", message: e instanceof Error ? e.message : String(e) });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="text-base font-extrabold">Cấu hình</div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={async () => {
              if (!confirm("Reset config về mặc định?")) return;
              const next = await qa().resetConfig();
              setCfg(next);
              toast.push({ kind: "success", message: "Đã reset config." });
            }}
            disabled={loading || saving}
            className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset
          </button>
          <button
            onClick={onSave}
            disabled={loading || saving}
            className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm font-extrabold">AI provider</div>
        </div>

        <div className="grid gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-white/10">
              <input
                type="radio"
                name="ai-provider"
                checked={(cfg.ai.provider ?? "ollama") === "ollama"}
                onChange={() => setCfg((c) => ({ ...c, ai: { ...c.ai, provider: "ollama" } }))}
              />
              Ollama
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-extrabold text-slate-200 hover:bg-white/10">
              <input
                type="radio"
                name="ai-provider"
                checked={(cfg.ai.provider ?? "ollama") === "openai"}
                onChange={() => setCfg((c) => ({ ...c, ai: { ...c.ai, provider: "openai" } }))}
              />
              OpenAI
            </label>
          </div>
        </div>

        {(cfg.ai.provider ?? "ollama") === "ollama" ? (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold">Ollama</div>
              <span className={["rounded-full px-2 py-0.5 text-[11px] font-extrabold", pill(conn.ollama.status)].join(" ")}>
                {label(conn.ollama.status)}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Base URL</div>
                <input
                  value={cfg.ai.baseUrl ?? ""}
                  onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, baseUrl: e.target.value } }))}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                  placeholder="http://localhost:11434"
                />
              </label>
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Model</div>
                <input
                  value={cfg.ai.model ?? defaultConfig.ai.model}
                  onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, model: e.target.value } }))}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                  placeholder="llama3.2"
                />
              </label>
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Timeout (seconds)</div>
                <input
                  type="number"
                  step="0.1"
                  min={0.1}
                  value={cfg.ai.ollamaTimeoutSec ?? defaultConfig.ai.ollamaTimeoutSec ?? 0.1}
                  onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, ollamaTimeoutSec: Number(e.target.value) } }))}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                  placeholder="0.1"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  try {
                    // Save first, then test (no need to click Save)
                    const baseUrl = (cfg.ai.baseUrl ?? "").trim();
                    if (!baseUrl) throw new Error("Chưa nhập Ollama Base URL.");
                    try {
                      const u = new URL(baseUrl);
                      if (u.pathname && u.pathname !== "/") {
                        throw new Error("Ollama Base URL phải là URL gốc (không kèm path). Ví dụ đúng: http://localhost:11434/");
                      }
                    } catch (e) {
                      if (e instanceof Error) throw e;
                      throw new Error("Ollama Base URL không hợp lệ. Ví dụ đúng: http://localhost:11434/");
                    }
                    const next: AppConfig = {
                      ...cfg,
                      ai: {
                        ...cfg.ai,
                        provider: "ollama",
                        baseUrl,
                        model: (cfg.ai.model ?? "").trim() || defaultConfig.ai.model,
                        ollamaTimeoutSec: clampFloat(
                          Number(cfg.ai.ollamaTimeoutSec ?? defaultConfig.ai.ollamaTimeoutSec ?? 0.1),
                          0.1,
                          600
                        ),
                        maxScenarios: clampInt(cfg.ai.maxScenarios ?? defaultConfig.ai.maxScenarios, 1, 30),
                        scenarioHint: cfg.ai.scenarioHint ?? ""
                      }
                    };
                    await qa().setConfig(next);
                    setCfg(next);

                    const r = await qa().testOllama();
                    console.log(r);
                    setConn((p) => ({ ...p, ollama: { status: r.ok ? "ok" : "fail" } }));
                    if (r.ok) toast.push({ kind: "success", message: "Kết nối Ollama thành công." });
                    else toast.push({ kind: "error", message: "Kết nối Ollama thất bại." });
                  } catch (e) {
                    setConn((p) => ({ ...p, ollama: { status: "fail" } }));
                    toast.push({ kind: "error", message: "Kết nối Ollama thất bại." });
                  }
                }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15"
              >
                Kiểm tra kết nối
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-2 rounded-2xl border border-white/10 bg-black/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-sm font-extrabold">OpenAI config</div>
              <span className={["rounded-full px-2 py-0.5 text-[11px] font-extrabold", pill(conn.openai.status)].join(" ")}>
                {label(conn.openai.status)}
              </span>
            </div>
            <div className="grid gap-2 md:grid-cols-2">
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Base URL</div>
                <input
                  value={(cfg.ai.openaiBaseUrl ?? defaultConfig.ai.openaiBaseUrl) as string}
                  readOnly
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                  placeholder="https://api.openai.com"
                />
              </label>
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Model</div>
                <select
                  value={cfg.ai.openaiModel ?? defaultConfig.ai.openaiModel}
                  onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, openaiModel: e.target.value } }))}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-white/25"
                >
                  {(openAiModels.length ? openAiModels : [cfg.ai.openaiModel ?? defaultConfig.ai.openaiModel]).map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <label className="grid gap-1">
              <div className="text-xs font-bold text-slate-300">Timeout (seconds)</div>
              <input
                type="number"
                step="0.1"
                min={0.1}
                value={cfg.ai.openaiTimeoutSec ?? defaultConfig.ai.openaiTimeoutSec ?? 0.1}
                onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, openaiTimeoutSec: Number(e.target.value) } }))}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                placeholder="0.1"
              />
            </label>
            <label className="grid gap-1">
              <div className="text-xs font-bold text-slate-300">API key</div>
              <input
                type="password"
                value={cfg.ai.openaiApiKey ?? ""}
                onChange={(e) => setCfg((c) => ({ ...c, ai: { ...c.ai, openaiApiKey: e.target.value } }))}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                placeholder="sk-..."
              />
            </label>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={async () => {
                  setLoadingModels(true);
                  try {
                    const next: AppConfig = {
                      ...cfg,
                      ai: {
                        ...cfg.ai,
                        provider: "openai",
                        openaiBaseUrl: defaultConfig.ai.openaiBaseUrl,
                        openaiModel: (cfg.ai.openaiModel ?? defaultConfig.ai.openaiModel ?? "gpt-4.1-mini").trim(),
                        openaiApiKey: (cfg.ai.openaiApiKey ?? "").trim(),
                        openaiTimeoutSec: clampFloat(
                          Number(cfg.ai.openaiTimeoutSec ?? defaultConfig.ai.openaiTimeoutSec ?? 0.1),
                          0.1,
                          60
                        ),
                        maxScenarios: clampInt(cfg.ai.maxScenarios ?? defaultConfig.ai.maxScenarios, 1, 30)
                      }
                    };
                    await qa().setConfig(next);
                    setCfg(next);

                    const r = await qa().listOpenAIModels();
                    setOpenAiModels(r.models);
                    toast.push({ kind: "success", message: `Đã tải ${r.models.length} model.` });
                  } catch (e) {
                    toast.push({ kind: "error", message: "Không thể tải danh sách model. Vui lòng kiểm tra API key và kết nối mạng." });
                  } finally {
                    setLoadingModels(false);
                  }
                }}
                disabled={loadingModels}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15 disabled:opacity-60"
              >
                {loadingModels ? "Đang tải..." : "Tải danh sách model"}
              </button>
              <button
                onClick={async () => {
                  try {
                    const next: AppConfig = {
                      ...cfg,
                      ai: {
                        ...cfg.ai,
                        provider: "openai",
                        openaiBaseUrl: defaultConfig.ai.openaiBaseUrl,
                        openaiModel: (cfg.ai.openaiModel ?? "").trim() || defaultConfig.ai.openaiModel,
                        openaiApiKey: (cfg.ai.openaiApiKey ?? "").trim(),
                        openaiTimeoutSec: clampFloat(
                          Number(cfg.ai.openaiTimeoutSec ?? defaultConfig.ai.openaiTimeoutSec ?? 0.1),
                          0.1,
                          60
                        ),
                        maxScenarios: clampInt(cfg.ai.maxScenarios ?? defaultConfig.ai.maxScenarios, 1, 30),
                        scenarioHint: cfg.ai.scenarioHint ?? ""
                      }
                    };
                    await qa().setConfig(next);
                    setCfg(next);

                    const r = await qa().testOpenAI();
                    setConn((p) => ({ ...p, openai: { status: r.ok ? "ok" : "fail" } }));
                    if (r.ok) toast.push({ kind: "success", message: "Kết nối OpenAI thành công." });
                    else toast.push({ kind: "error", message: `Kết nối OpenAI thất bại (HTTP ${r.status}).` });
                  } catch (e) {
                    setConn((p) => ({ ...p, openai: { status: "fail" } }));
                    toast.push({ kind: "error", message: e instanceof Error ? e.message : String(e) });
                  }
                }}
                className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15"
              >
                Kiểm tra kết nối
              </button>
            </div>
          </div>
        )}

      </div>

      {loading ? <div className="text-sm text-slate-400">Loading...</div> : null}
    </div>
  );
}

