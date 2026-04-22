import React, { useEffect, useMemo, useRef, useState } from "react";
import { qa } from "../lib/qa";
import type { AppConfig } from "@core/config";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
type HeaderRow = { id: string; key: string; value: string };
type BodyType = "none" | "raw" | "json" | "form_urlencoded" | "form_data" | "binary";
type KvRow = { id: string; key: string; value: string };

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type ApiRequestTab = {
  id: string;
  name: string;
  context: string;
  method: HttpMethod;
  url: string;
  params: KvRow[];
  auth: { type: "none" | "bearer" | "basic"; bearerToken: string; basicUser: string; basicPass: string };
  headers: HeaderRow[];
  body: {
    type: BodyType;
    text: string;
    fields: KvRow[];
    binary: { filename?: string; mime?: string; base64: string } | null;
  };
  expect: { status: number; maxMs: number };
  timeoutMs: number;
};

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    const k = (r.key ?? "").trim();
    if (!k) continue;
    out[k] = (r.value ?? "").trim();
  }
  return out;
}

function newDefaultApiTab(): ApiRequestTab {
  return {
    id: newId(),
    name: "Request 1",
    context: "",
    method: "GET",
    url: "https://example.com",
    params: [{ id: newId(), key: "", value: "" }],
    auth: { type: "none", bearerToken: "", basicUser: "", basicPass: "" },
    headers: [{ id: newId(), key: "accept", value: "application/json" }],
    body: {
      type: "json",
      text: "",
      fields: [{ id: newId(), key: "", value: "" }],
      binary: null
    },
    expect: { status: 200, maxMs: 3000 },
    timeoutMs: 5000
  };
}

function normalizeTab(t: any, fallbackName: string): ApiRequestTab {
  const base = newDefaultApiTab();
  return {
    ...base,
    ...t,
    id: typeof t?.id === "string" && t.id ? t.id : base.id,
    name: typeof t?.name === "string" && t.name.trim() ? t.name : fallbackName,
    context: typeof t?.context === "string" ? t.context : "",
    method: (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const).includes(t?.method) ? t.method : base.method,
    url: typeof t?.url === "string" && t.url ? t.url : base.url,
    params: Array.isArray(t?.params) ? t.params : base.params,
    auth: {
      ...base.auth,
      ...(t?.auth ?? {}),
      type: (["none", "bearer", "basic"] as const).includes(t?.auth?.type) ? t.auth.type : "none",
      bearerToken: typeof t?.auth?.bearerToken === "string" ? t.auth.bearerToken : "",
      basicUser: typeof t?.auth?.basicUser === "string" ? t.auth.basicUser : "",
      basicPass: typeof t?.auth?.basicPass === "string" ? t.auth.basicPass : ""
    },
    headers: Array.isArray(t?.headers) ? t.headers : base.headers,
    body: {
      ...base.body,
      ...(t?.body ?? {}),
      type: (["none", "raw", "json", "form_urlencoded", "form_data", "binary"] as const).includes(t?.body?.type) ? t.body.type : base.body.type,
      text: typeof t?.body?.text === "string" ? t.body.text : "",
      fields: Array.isArray(t?.body?.fields) ? t.body.fields : base.body.fields,
      binary: t?.body?.binary && typeof t.body.binary?.base64 === "string" ? t.body.binary : null
    },
    expect: {
      ...base.expect,
      ...(t?.expect ?? {}),
      status: Number.isFinite(t?.expect?.status) ? Number(t.expect.status) : base.expect.status,
      maxMs: Number.isFinite(t?.expect?.maxMs) ? Number(t.expect.maxMs) : base.expect.maxMs
    },
    timeoutMs: Number.isFinite(t?.timeoutMs) ? Number(t.timeoutMs) : base.timeoutMs
  };
}

export function ApiMode() {
  const [activePanel, setActivePanel] = useState<"params" | "authorization" | "headers" | "body">("params");
  const [{ tabs, activeRequestId }, setTabsState] = useState<{ tabs: ApiRequestTab[]; activeRequestId: string }>(() => {
    try {
      const raw = localStorage.getItem("ai-qa.api.tabs.v1");
      if (raw) {
        const parsed = JSON.parse(raw) as { tabs?: ApiRequestTab[]; activeId?: string };
        if (Array.isArray(parsed.tabs) && parsed.tabs.length) {
          const norm = parsed.tabs.map((x, i) => normalizeTab(x, `Request ${i + 1}`));
          const active =
            parsed.activeId && norm.some((t) => t.id === parsed.activeId) ? parsed.activeId : norm[0]!.id;
          return { tabs: norm, activeRequestId: active };
        }
      }
    } catch {
      // ignore
    }
    const t = newDefaultApiTab();
    return { tabs: [t], activeRequestId: t.id };
  });
  const tabsRef = useRef<{ tabs: ApiRequestTab[]; activeId: string }>({ tabs: [], activeId: "" });
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<
    Array<{ at: string; method: string; url: string; ok: boolean; status: number; elapsedMs: number }>
  >([]);
  const [scenarios, setScenarios] = useState<string>("");
  const [genLoading, setGenLoading] = useState(false);
  const [scenarioLimit, setScenarioLimit] = useState<number>(5);
  const [scenarioRunLoading, setScenarioRunLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const cfg = (await qa().getConfig()) as AppConfig;
        if (!mounted) return;
        setScenarioLimit(cfg.ai.maxScenarios ?? 5);
      } catch {
        // ignore
      }
    })();
    async function refresh() {
      try {
        const m = await qa().getMetrics();
        if (!mounted) return;
        setMetrics(m);
        setMetricsError(null);
      } catch (e) {
        if (!mounted) return;
        setMetrics(null);
        setMetricsError(e instanceof Error ? e.message : String(e));
      }
    }
    refresh();
    const t = setInterval(refresh, 1500);
    return () => {
      mounted = false;
      clearInterval(t);
    };
  }, []);

  // Guard against invalid state (prevents falling back to a fresh default tab)
  useEffect(() => {
    if (!tabs.length) {
      const t = newDefaultApiTab();
      setTabsState({ tabs: [t], activeRequestId: t.id });
      return;
    }
    if (!tabs.some((t) => t.id === activeRequestId)) {
      setTabsState((s) => ({ ...s, activeRequestId: s.tabs[0]!.id }));
    }
  }, [tabs, activeRequestId]);

  function persistTabs(snapshot?: { tabs: ApiRequestTab[]; activeId: string }) {
    try {
      const s = snapshot ?? tabsRef.current;
      localStorage.setItem("ai-qa.api.tabs.v1", JSON.stringify(s));
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    tabsRef.current = { tabs, activeId: activeRequestId };
    persistTabs({ tabs, activeId: activeRequestId });
  }, [tabs, activeRequestId]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === "hidden") persistTabs();
    };
    window.addEventListener("visibilitychange", onVis);
    return () => {
      persistTabs();
      window.removeEventListener("visibilitychange", onVis);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeReq = useMemo(() => tabs.find((t) => t.id === activeRequestId) ?? tabs[0]!, [tabs, activeRequestId]);
  const safeActiveReq = activeReq;

  function updateActive(mut: (t: ApiRequestTab) => ApiRequestTab) {
    setTabsState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === s.activeRequestId ? mut(t) : t))
    }));
  }

  function setActiveRequestId(nextId: string) {
    setTabsState((s) => ({ ...s, activeRequestId: nextId }));
  }

  function addTab() {
    const t = newDefaultApiTab();
    t.name = `Request ${tabs.length + 1}`;
    setTabsState((s) => ({ tabs: [...s.tabs, t], activeRequestId: t.id }));
  }

  function closeTab(id: string) {
    setTabsState((s) => {
      const nextTabs = s.tabs.filter((t) => t.id !== id);
      const kept = nextTabs.length ? nextTabs : [newDefaultApiTab()];
      const nextActive = s.activeRequestId === id ? kept[0]!.id : s.activeRequestId;
      return { tabs: kept, activeRequestId: nextActive };
    });
  }

  const headers = useMemo(() => rowsToHeaders(safeActiveReq.headers ?? []), [safeActiveReq]);
  const finalUrl = useMemo(() => {
    try {
      const u = new URL(safeActiveReq.url ?? "");
      for (const r of safeActiveReq.params ?? []) {
        const k = (r.key ?? "").trim();
        if (!k) continue;
        u.searchParams.set(k, String(r.value ?? ""));
      }
      return u.toString();
    } catch {
      return safeActiveReq.url ?? "";
    }
  }, [safeActiveReq]);

  const finalHeaders = useMemo(() => {
    const h = { ...headers };
    const auth = safeActiveReq.auth;
    if (!auth) return h;
    if (auth.type === "bearer") {
      const t = auth.bearerToken.trim();
      if (t) h["authorization"] = `Bearer ${t}`;
    } else if (auth.type === "basic") {
      const raw = `${auth.basicUser}:${auth.basicPass}`;
      h["authorization"] = `Basic ${btoa(raw)}`;
    }
    return h;
  }, [headers, safeActiveReq]);

  // Alias current tab fields to keep JSX simple
  const method = safeActiveReq.method;
  const url = safeActiveReq.url;
  const apiContext = safeActiveReq.context;
  const paramRows = safeActiveReq.params;
  const authType = safeActiveReq.auth.type;
  const bearerToken = safeActiveReq.auth.bearerToken;
  const basicUser = safeActiveReq.auth.basicUser;
  const basicPass = safeActiveReq.auth.basicPass;
  const headerRows = safeActiveReq.headers;
  const bodyType = safeActiveReq.body.type;
  const bodyText = safeActiveReq.body.text;
  const bodyFields = safeActiveReq.body.fields;
  const binary = safeActiveReq.body.binary;
  const expectStatus = safeActiveReq.expect.status;
  const maxMs = safeActiveReq.expect.maxMs;
  const timeoutMs = safeActiveReq.timeoutMs;

  const activeTab = activePanel;
  const setActiveTab = setActivePanel;

  const setMethod = (m: HttpMethod) => updateActive((t) => ({ ...t, method: m }));
  const setUrl = (u: string) => updateActive((t) => ({ ...t, url: u }));
  const setApiContext = (v: string) => updateActive((t) => ({ ...t, context: v }));
  const setParamRows = (fn: (prev: KvRow[]) => KvRow[]) => updateActive((t) => ({ ...t, params: fn(t.params) }));
  const setAuthType = (type: "none" | "bearer" | "basic") =>
    updateActive((t) => ({ ...t, auth: { ...t.auth, type } }));
  const setBearerToken = (v: string) => updateActive((t) => ({ ...t, auth: { ...t.auth, bearerToken: v } }));
  const setBasicUser = (v: string) => updateActive((t) => ({ ...t, auth: { ...t.auth, basicUser: v } }));
  const setBasicPass = (v: string) => updateActive((t) => ({ ...t, auth: { ...t.auth, basicPass: v } }));
  const setHeaderRows = (fn: (prev: HeaderRow[]) => HeaderRow[]) => updateActive((t) => ({ ...t, headers: fn(t.headers) }));
  const setBodyType = (type: BodyType) => updateActive((t) => ({ ...t, body: { ...t.body, type } }));
  const setBodyText = (v: string) => updateActive((t) => ({ ...t, body: { ...t.body, text: v } }));
  const setBodyFields = (fn: (prev: KvRow[]) => KvRow[]) => updateActive((t) => ({ ...t, body: { ...t.body, fields: fn(t.body.fields) } }));
  const setBinary = (b: { filename?: string; mime?: string; base64: string } | null) =>
    updateActive((t) => ({ ...t, body: { ...t.body, binary: b } }));
  const setExpectStatus = (n: number) => updateActive((t) => ({ ...t, expect: { ...t.expect, status: n } }));
  const setMaxMs = (n: number) => updateActive((t) => ({ ...t, expect: { ...t.expect, maxMs: n } }));
  const setTimeoutMs = (n: number) => updateActive((t) => ({ ...t, timeoutMs: n }));

  // (rename removed)

  async function run() {
    setRunning(true);
    setError(null);
    setResult(null);
    try {
      const res = await qa().runApi({
        method: safeActiveReq.method,
        url: finalUrl,
        headers: finalHeaders,
        bodyType: safeActiveReq.body.type,
        bodyText: safeActiveReq.body.text,
        bodyFields: (safeActiveReq.body.fields ?? []).map((x) => ({ key: x.key, value: x.value })),
        binary: safeActiveReq.body.binary ?? undefined,
        timeoutMs: safeActiveReq.timeoutMs,
        expect: { status: safeActiveReq.expect.status, maxMs: safeActiveReq.expect.maxMs }
      });
      setResult(res);
      setLogs((prev) => [
        { at: new Date().toISOString(), method: safeActiveReq.method, url: finalUrl, ok: res.ok, status: res.status, elapsedMs: res.elapsedMs },
        ...prev
      ].slice(0, 30));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setRunning(false);
    }
  }

  async function generateScenarios() {
    setGenLoading(true);
    setError(null);
    try {
      // also persist the limit into config so backend prompt uses it
      try {
        const cfg = await qa().getConfig();
        await qa().setConfig({ ...cfg, ai: { ...cfg.ai, maxScenarios: scenarioLimit } });
      } catch {
        // ignore
      }
      const text = await qa().generateApiScenarios({ baseUrl: url, context: apiContext });
      setScenarios(text);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setGenLoading(false);
    }
  }

  function clearLogs() {
    setLogs([]);
    setResult(null);
    setError(null);
  }

  async function runScenarioLog(method: string, url: string, headers?: Record<string, string>, body?: string, expect?: any) {
    const res = await qa().runApi({ method, url, headers, bodyType: "raw", bodyText: body, timeoutMs, expect });
    setLogs((prev) => [
      { at: new Date().toISOString(), method, url, ok: res.ok, status: res.status, elapsedMs: res.elapsedMs },
      ...prev
    ].slice(0, 200));
    return res;
  }

  async function runAllScenarios() {
    setScenarioRunLoading(true);
    setError(null);
    try {
      const raw = scenarios.trim();
      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      const jsonText = jsonStart >= 0 && jsonEnd >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : "";
      const parsed = JSON.parse(jsonText) as any;
      const list = Array.isArray(parsed?.scenarios) ? parsed.scenarios.slice(0, scenarioLimit) : [];
      if (list.length === 0) throw new Error("Chưa có scenarios JSON hợp lệ để chạy.");

      for (let sIdx = 0; sIdx < list.length; sIdx++) {
        const sc = list[sIdx];
        const reqs = Array.isArray(sc?.requests) ? sc.requests : [];
        const expects = Array.isArray(sc?.expects) ? sc.expects : [];

        // Scenario header log (info-like)
        setLogs((prev) => [
          { at: new Date().toISOString(), method: "SCENARIO", url: sc?.title ?? `#${sIdx + 1}`, ok: true, status: 0, elapsedMs: 0 },
          ...prev
        ].slice(0, 200));

        for (let rIdx = 0; rIdx < reqs.length; rIdx++) {
          const r = reqs[rIdx];
          const exp = expects.find((e: any) => e?.requestIndex === rIdx) ?? {};
          await runScenarioLog(
            String(r?.method ?? "GET").toUpperCase(),
            String(r?.url ?? url),
            r?.headers ?? undefined,
            r?.body ?? undefined,
            { status: exp?.status, maxMs: exp?.maxMs }
          );
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setScenarioRunLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-base font-extrabold">API test mode</div>
        <div className="text-sm text-slate-300">Gửi request và validate theo điều kiện (MVP).</div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="flex min-w-0 flex-wrap items-center gap-2">
          <div className="text-xs font-extrabold text-slate-300">Tabs</div>
          <div className="flex min-w-0 flex-wrap items-center gap-1">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  // Persist first to avoid losing unsaved edits when switching tabs quickly.
                  persistTabs();
                  setActiveRequestId(t.id);
                }}
                className={[
                  "grid max-w-[320px] gap-0.5 rounded-xl border px-3 py-1 text-left",
                  t.id === activeRequestId
                    ? "border-white/15 bg-white/10"
                    : "border-white/10 bg-black/20 hover:bg-white/5"
                ].join(" ")}
                title={t.name}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-extrabold text-slate-100">{t.method}</div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(t.id);
                    }}
                    className="rounded-lg bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
                    title="Close tab"
                  >
                    ×
                  </button>
                </div>
                <div className="max-w-[300px] truncate text-[11px] font-bold text-slate-300">
                  {t.url || "(no url)"}
                </div>
              </button>
            ))}
          </div>
        </div>
        <button
          onClick={addTab}
          className="rounded-xl bg-blue-500 px-3 py-2 text-xs font-extrabold text-white hover:bg-blue-400"
        >
          + New tab
        </button>
      </div>
      <div className="text-xs text-slate-400">
        URL:{" "}
        <span className="inline-block max-w-full truncate align-bottom font-extrabold text-slate-200">
          {safeActiveReq.url}
        </span>
      </div>

      <div className="grid gap-3 rounded-2xl border border-white/10 bg-black/20 p-4">
        <div className="grid gap-2 md:grid-cols-[140px_1fr_auto]">
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Method</div>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-white/25"
            >
              {(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">URL</div>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder="https://api.your-app.com/v1/health"
            />
          </label>
          <div className="grid content-end">
            <button
              onClick={run}
              disabled={running}
              className="h-[38px] rounded-xl bg-blue-500 px-5 text-sm font-extrabold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {running ? "Sending..." : "Send"}
            </button>
          </div>
        </div>

        <label className="grid gap-1">
          <div className="text-xs font-bold text-slate-300">Context (API / validation)</div>
          <textarea
            value={apiContext}
            onChange={(e) => setApiContext(e.target.value)}
            rows={4}
            className="resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
            placeholder={[
              "Mô tả ngữ cảnh API để AI tạo kịch bản test sát hơn:",
              "- Auth (token/cookie), role, base path, version",
              "- Điều kiện validate: status, latency, schema, idempotent, paging...",
              "- Những endpoint nhạy cảm cần tránh (delete/real money...)"
            ].join("\n")}
          />
          <div className="text-xs text-slate-400">
            Context này sẽ được dùng khi bấm <b className="text-slate-200">Tạo kịch bản test</b>.
          </div>
        </label>

        <div className="border-b border-white/10">
          <div className="flex items-center gap-5">
            <button
              onClick={() => setActiveTab("params")}
              className={[
                "relative -mb-px px-1 py-2 text-sm font-extrabold",
                activeTab === "params" ? "text-slate-100" : "text-slate-300 hover:text-slate-200"
              ].join(" ")}
            >
              Params
              {activeTab === "params" ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-400" /> : null}
            </button>
            <button
              onClick={() => setActiveTab("authorization")}
              className={[
                "relative -mb-px px-1 py-2 text-sm font-extrabold",
                activeTab === "authorization" ? "text-slate-100" : "text-slate-300 hover:text-slate-200"
              ].join(" ")}
            >
              Authorization
              {activeTab === "authorization" ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-400" /> : null}
            </button>
            <button
              onClick={() => setActiveTab("headers")}
              className={[
                "relative -mb-px px-1 py-2 text-sm font-extrabold",
                activeTab === "headers" ? "text-slate-100" : "text-slate-300 hover:text-slate-200"
              ].join(" ")}
            >
              Headers
              {activeTab === "headers" ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-400" /> : null}
            </button>
            <button
              onClick={() => setActiveTab("body")}
              className={[
                "relative -mb-px px-1 py-2 text-sm font-extrabold",
                activeTab === "body" ? "text-slate-100" : "text-slate-300 hover:text-slate-200"
              ].join(" ")}
            >
              Body
              {activeTab === "body" ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-400" /> : null}
            </button>
          </div>
        </div>

        {activeTab === "params" ? (
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-300">Query params</div>
              <button
                onClick={() => setParamRows((p) => [...p, { id: newId(), key: "", value: "" }])}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
              >
                + Add
              </button>
            </div>
            <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
              {paramRows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_1fr_40px] gap-2">
                  <input
                    value={r.key}
                    onChange={(e) =>
                      setParamRows((p) => p.map((x) => (x.id === r.id ? { ...x, key: e.target.value } : x)))
                    }
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                    placeholder="Param name"
                  />
                  <input
                    value={r.value}
                    onChange={(e) =>
                      setParamRows((p) => p.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))
                    }
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                    placeholder="Param value"
                  />
                  <button
                    onClick={() => setParamRows((p) => p.filter((x) => x.id !== r.id))}
                    className="rounded-lg bg-white/10 text-sm font-extrabold text-slate-200 hover:bg-white/15"
                    title="Remove param"
                  >
                    ×
                  </button>
                </div>
              ))}
              <div className="text-xs text-slate-400">
                URL thực tế sẽ chạy: <span className="text-slate-200">{finalUrl}</span>
              </div>
            </div>
          </div>
        ) : activeTab === "authorization" ? (
          <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="grid gap-1">
              <div className="text-xs font-bold text-slate-300">Type</div>
              <select
                value={authType}
                onChange={(e) => setAuthType(e.target.value as any)}
                className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-white/25"
              >
                <option value="none">No Auth</option>
                <option value="bearer">Bearer Token</option>
                <option value="basic">Basic Auth</option>
              </select>
            </label>
            {authType === "bearer" ? (
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Token</div>
                <input
                  value={bearerToken}
                  onChange={(e) => setBearerToken(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                  placeholder="eyJhbGciOi..."
                />
              </label>
            ) : authType === "basic" ? (
              <div className="grid gap-2 md:grid-cols-2">
                <label className="grid gap-1">
                  <div className="text-xs font-bold text-slate-300">Username</div>
                  <input
                    value={basicUser}
                    onChange={(e) => setBasicUser(e.target.value)}
                    className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
                  />
                </label>
                <label className="grid gap-1">
                  <div className="text-xs font-bold text-slate-300">Password</div>
                  <input
                    type="password"
                    value={basicPass}
                    onChange={(e) => setBasicPass(e.target.value)}
                    className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
                  />
                </label>
              </div>
            ) : (
              <div className="text-sm text-slate-400">Không set header Authorization.</div>
            )}
            <div className="text-xs text-slate-400">
              Header sẽ gửi:{" "}
              <span className="text-slate-200">
                {finalHeaders.authorization ? `authorization: ${finalHeaders.authorization}` : "(none)"}
              </span>
            </div>
          </div>
        ) : activeTab === "headers" ? (
          <div className="grid gap-1">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold text-slate-300">Headers</div>
              <button
                onClick={() => setHeaderRows((p) => [...p, { id: newId(), key: "", value: "" }])}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
              >
                + Add
              </button>
            </div>
            <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
              {headerRows.map((r) => (
                <div key={r.id} className="grid grid-cols-[1fr_1fr_40px] gap-2">
                  <input
                    value={r.key}
                    onChange={(e) =>
                      setHeaderRows((p) => p.map((x) => (x.id === r.id ? { ...x, key: e.target.value } : x)))
                    }
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                    placeholder="Header name"
                  />
                  <input
                    value={r.value}
                    onChange={(e) =>
                      setHeaderRows((p) => p.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))
                    }
                    className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                    placeholder="Header value"
                  />
                  <button
                    onClick={() => setHeaderRows((p) => p.filter((x) => x.id !== r.id))}
                    className="rounded-lg bg-white/10 text-sm font-extrabold text-slate-200 hover:bg-white/15"
                    title="Remove header"
                  >
                    ×
                  </button>
                </div>
              ))}
              {headerRows.length === 0 ? <div className="text-xs text-slate-400">No headers</div> : null}
            </div>
          </div>
        ) : (
          <div className="grid gap-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Body type</div>
                <select
                  value={bodyType}
                  onChange={(e) => setBodyType(e.target.value as BodyType)}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-white/25"
                >
                  <option value="none">none</option>
                  <option value="raw">raw</option>
                  <option value="json">json</option>
                  <option value="form_urlencoded">x-www-form-urlencoded</option>
                  <option value="form_data">form-data</option>
                  <option value="binary">binary (file)</option>
                </select>
              </label>

              {(bodyType === "json" || bodyType === "raw") ? (
                <button
                  onClick={() => {
                    try {
                      const obj = JSON.parse(bodyText || "null");
                      setBodyText(JSON.stringify(obj, null, 2));
                      setError(null);
                    } catch {
                      setError("Body không phải JSON hợp lệ để format.");
                    }
                  }}
                  className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15"
                >
                  Format JSON
                </button>
              ) : null}
            </div>

            {bodyType === "none" ? (
              <div className="text-sm text-slate-400">Không gửi body.</div>
            ) : bodyType === "binary" ? (
              <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-300">Upload file</div>
                  <button
                    onClick={() => setBinary(null)}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
                  >
                    Clear
                  </button>
                </div>
                <input
                  type="file"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const buf = await f.arrayBuffer();
                    const bytes = new Uint8Array(buf);
                    let bin = "";
                    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
                    const base64 = btoa(bin);
                    setBinary({ filename: f.name, mime: f.type || undefined, base64 });
                  }}
                  className="text-sm text-slate-200 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-slate-100 hover:file:bg-white/15"
                />
                <div className="text-xs text-slate-400">
                  {binary ? (
                    <>
                      Selected: <span className="text-slate-200">{binary.filename}</span>
                      {binary.mime ? <span className="text-slate-500"> • {binary.mime}</span> : null}
                    </>
                  ) : (
                    "Chưa chọn file."
                  )}
                </div>
              </div>
            ) : bodyType === "raw" || bodyType === "json" ? (
              <textarea
                value={bodyText}
                onChange={(e) => setBodyText(e.target.value)}
                rows={7}
                className="resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                placeholder={bodyType === "json" ? '{ "hello": "world" }' : "raw body"}
              />
            ) : (
              <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="text-xs font-bold text-slate-300">Fields</div>
                  <button
                    onClick={() => setBodyFields((p) => [...p, { id: newId(), key: "", value: "" }])}
                    className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
                  >
                    + Add
                  </button>
                </div>
                {bodyFields.map((r) => (
                  <div key={r.id} className="grid grid-cols-[1fr_1fr_40px] gap-2">
                    <input
                      value={r.key}
                      onChange={(e) =>
                        setBodyFields((p) => p.map((x) => (x.id === r.id ? { ...x, key: e.target.value } : x)))
                      }
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                      placeholder="Key"
                    />
                    <input
                      value={r.value}
                      onChange={(e) =>
                        setBodyFields((p) => p.map((x) => (x.id === r.id ? { ...x, value: e.target.value } : x)))
                      }
                      className="rounded-lg border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                      placeholder="Value"
                    />
                    <button
                      onClick={() => setBodyFields((p) => p.filter((x) => x.id !== r.id))}
                      className="rounded-lg bg-white/10 text-sm font-extrabold text-slate-200 hover:bg-white/15"
                      title="Remove field"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="grid gap-2 md:grid-cols-3">
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Expect status</div>
            <input
              type="number"
              value={expectStatus}
              onChange={(e) => setExpectStatus(Number(e.target.value))}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Max time (ms)</div>
            <input
              type="number"
              value={maxMs}
              onChange={(e) => setMaxMs(Number(e.target.value))}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none focus:border-white/25"
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Timeout (ms)</div>
            <input
              type="number"
              value={timeoutMs}
              onChange={(e) => setTimeoutMs(Number(e.target.value))}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder="5000"
            />
          </label>
        </div>

        <div className="flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={generateScenarios}
              disabled={genLoading}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {genLoading ? "Generating..." : "Tạo kịch bản test"}
            </button>
            <label className="grid gap-1">
              <input
                type="number"
                min={1}
                max={30}
                placeholder="5"
                value={scenarioLimit}
                onChange={(e) => setScenarioLimit(Number(e.target.value))}
                className="w-28 rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-xs font-bold text-slate-100 outline-none focus:border-white/25"
              />
            </label>
            <button
              onClick={runAllScenarios}
              disabled={scenarioRunLoading || !scenarios.trim()}
              className="rounded-xl bg-emerald-400 px-4 py-2 text-sm font-extrabold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {scenarioRunLoading ? "Running..." : "Chạy tất cả kịch bản test"}
            </button>
            <button
              onClick={clearLogs}
              className="rounded-xl bg-white/10 px-4 py-2 text-sm font-extrabold text-slate-100 hover:bg-white/15"
            >
              Xóa log
            </button>
          </div>
        </div>
      </div>

      {error ? <div className="text-sm text-red-300">{error}</div> : null}

      {logs.length ? (
        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm font-extrabold">Logs</div>
            <div className="text-xs text-slate-400">Entries: {logs.length} (max 200)</div>
          </div>
          <div className="grid gap-2">
            {logs.map((l, idx) => (
              <div key={idx} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="min-w-0 text-xs text-slate-300">
                  <span className="font-extrabold text-slate-100">{l.method}</span>{" "}
                  <span className="truncate">{l.url}</span>
                  <span className="mx-2 text-slate-500">•</span>
                  <span className="text-slate-400">{l.at}</span>
                </div>
                <div className="flex items-center gap-2">
                  {l.method === "SCENARIO" ? (
                    <span className="rounded-full bg-fuchsia-300 px-2 py-0.5 text-[11px] font-extrabold text-slate-950">
                      SCENARIO
                    </span>
                  ) : (
                    <>
                      <span className={["rounded-full px-2 py-0.5 text-[11px] font-extrabold", l.ok ? "bg-emerald-300 text-slate-950" : "bg-red-400 text-slate-950"].join(" ")}>
                        {l.ok ? "PASS" : "FAIL"}
                      </span>
                      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200">
                        {l.status} • {l.elapsedMs}ms
                      </span>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {result ? (
        <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100">
          {JSON.stringify(result, null, 2)}
        </pre>
      ) : null}

      {scenarios ? (
        <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100">
          {scenarios}
        </pre>
      ) : null}
    </div>
  );
}

