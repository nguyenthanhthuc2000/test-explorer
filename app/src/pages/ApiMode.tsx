import React, { useEffect, useMemo, useRef, useState } from "react";
import { qa } from "../lib/qa";
import type { AppConfig } from "@core/config";
import { importApiText } from "../lib/apiImport";
import type { ImportKind, ImportedApiRequest } from "../lib/apiImport";

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE" | "HEAD" | "OPTIONS";
type HeaderRow = { id: string; enabled: boolean; key: string; value: string };
type BodyType = "none" | "raw" | "json" | "form_urlencoded" | "form_data" | "binary";
type KvRow = { id: string; enabled: boolean; key: string; value: string };

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

type ApiRequestTab = {
  id: string;
  name: string;
  folder: string;
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
  insecureTls: boolean;
  useCookieJar: boolean;
};

function rowsToHeaders(rows: HeaderRow[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const r of rows) {
    if (r.enabled === false) continue;
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
    folder: "",
    context: "",
    method: "GET",
    url: "https://example.com",
    params: [{ id: newId(), enabled: true, key: "", value: "" }],
    auth: { type: "none", bearerToken: "", basicUser: "", basicPass: "" },
    headers: [{ id: newId(), enabled: true, key: "accept", value: "application/json" }],
    body: {
      type: "json",
      text: "",
      fields: [{ id: newId(), enabled: true, key: "", value: "" }],
      binary: null
    },
    expect: { status: 200, maxMs: 3000 },
    timeoutMs: 5000,
    insecureTls: false
    ,
    useCookieJar: true
  };
}

function normalizeTab(t: any, fallbackName: string): ApiRequestTab {
  const base = newDefaultApiTab();
  return {
    ...base,
    ...t,
    id: typeof t?.id === "string" && t.id ? t.id : base.id,
    name: typeof t?.name === "string" && t.name.trim() ? t.name : fallbackName,
    folder: typeof t?.folder === "string" ? t.folder : "",
    context: typeof t?.context === "string" ? t.context : "",
    method: (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const).includes(t?.method) ? t.method : base.method,
    url: typeof t?.url === "string" && t.url ? t.url : base.url,
    params: Array.isArray(t?.params)
      ? t.params.map((r: any) => ({
          id: typeof r?.id === "string" && r.id ? r.id : newId(),
          enabled: r?.enabled !== false,
          key: typeof r?.key === "string" ? r.key : "",
          value: typeof r?.value === "string" ? r.value : ""
        }))
      : base.params,
    auth: {
      ...base.auth,
      ...(t?.auth ?? {}),
      type: (["none", "bearer", "basic"] as const).includes(t?.auth?.type) ? t.auth.type : "none",
      bearerToken: typeof t?.auth?.bearerToken === "string" ? t.auth.bearerToken : "",
      basicUser: typeof t?.auth?.basicUser === "string" ? t.auth.basicUser : "",
      basicPass: typeof t?.auth?.basicPass === "string" ? t.auth.basicPass : ""
    },
    headers: Array.isArray(t?.headers)
      ? t.headers.map((r: any) => ({
          id: typeof r?.id === "string" && r.id ? r.id : newId(),
          enabled: r?.enabled !== false,
          key: typeof r?.key === "string" ? r.key : "",
          value: typeof r?.value === "string" ? r.value : ""
        }))
      : base.headers,
    body: {
      ...base.body,
      ...(t?.body ?? {}),
      type: (["none", "raw", "json", "form_urlencoded", "form_data", "binary"] as const).includes(t?.body?.type) ? t.body.type : base.body.type,
      text: typeof t?.body?.text === "string" ? t.body.text : "",
      fields: Array.isArray(t?.body?.fields)
        ? t.body.fields.map((r: any) => ({
            id: typeof r?.id === "string" && r.id ? r.id : newId(),
            enabled: r?.enabled !== false,
            key: typeof r?.key === "string" ? r.key : "",
            value: typeof r?.value === "string" ? r.value : ""
          }))
        : base.body.fields,
      binary: t?.body?.binary && typeof t.body.binary?.base64 === "string" ? t.body.binary : null
    },
    expect: {
      ...base.expect,
      ...(t?.expect ?? {}),
      status: Number.isFinite(t?.expect?.status) ? Number(t.expect.status) : base.expect.status,
      maxMs: Number.isFinite(t?.expect?.maxMs) ? Number(t.expect.maxMs) : base.expect.maxMs
    },
    timeoutMs: Number.isFinite(t?.timeoutMs) ? Number(t.timeoutMs) : base.timeoutMs,
    insecureTls: typeof t?.insecureTls === "boolean" ? t.insecureTls : base.insecureTls,
    useCookieJar: typeof t?.useCookieJar === "boolean" ? t.useCookieJar : base.useCookieJar
  };
}

export function ApiMode() {
  const [activePanel, setActivePanel] = useState<"params" | "context" | "authorization" | "headers" | "body">("params");
  const [importOpen, setImportOpen] = useState(false);
  const [importKind, setImportKind] = useState<ImportKind>("curl");
  const [importText, setImportText] = useState("");
  const [importPreview, setImportPreview] = useState<ImportedApiRequest[] | null>(null);
  const [importErr, setImportErr] = useState<string | null>(null);
  const [reqQuery, setReqQuery] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [folderMenuPath, setFolderMenuPath] = useState<string | null>(null);
  const [requestMenuId, setRequestMenuId] = useState<string | null>(null);
  const [newFolderOpen, setNewFolderOpen] = useState(false);
  const [newFolderPath, setNewFolderPath] = useState("api");
  const [dragOverFolder, setDragOverFolder] = useState<string | null>(null);
  const [folders, setFolders] = useState<string[]>(() => {
    try {
      const raw = localStorage.getItem("ai-qa.api.folders.v1");
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      return Array.isArray(parsed) ? parsed.map((x) => String(x)).filter(Boolean) : [];
    } catch {
      return [];
    }
  });
  const [folderExpanded, setFolderExpanded] = useState<Record<string, boolean>>(() => {
    try {
      const raw = localStorage.getItem("ai-qa.api.folders.expanded.v1");
      return raw ? (JSON.parse(raw) as Record<string, boolean>) : {};
    } catch {
      return {};
    }
  });
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
  const responseLogsRef = useRef<HTMLDivElement | null>(null);
  const [running, setRunning] = useState(false);
  const [expandedTabIds, setExpandedTabIds] = useState<Record<string, boolean>>({});
  const [selectedRunIdxByTabId, setSelectedRunIdxByTabId] = useState<Record<string, number>>({});
  const [expandedRunIdxByTabId, setExpandedRunIdxByTabId] = useState<Record<string, number | null>>({});
  const [logFiltersByTabId, setLogFiltersByTabId] = useState<Record<string, { status: "all" | "pass" | "fail"; q: string }>>(
    () => ({})
  );
  const [tabRuns, setTabRuns] = useState<
    Record<
      string,
      {
        error?: string | null;
        result?: { ok: boolean; status: number; elapsedMs: number; bodyText: string; validations: Array<{ name: string; ok: boolean; details?: string }> } | null;
        history?: Array<{
          at: string;
          method: string;
          url: string;
          result: { ok: boolean; status: number; elapsedMs: number; bodyText: string; validations: Array<{ name: string; ok: boolean; details?: string }> };
        }>;
        logs: Array<{ at: string; method: string; url: string; ok: boolean; status: number; elapsedMs: number }>;
      }
    >
  >(() => {
    try {
      const raw = localStorage.getItem("ai-qa.api.runs.v1");
      if (!raw) return {};
      const parsed = JSON.parse(raw) as any;
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  });
  const [preview, setPreview] = useState<{ open: boolean; tabId: string; mode: "raw" | "json" | "html" }>({
    open: false,
    tabId: "",
    mode: "raw"
  });
  const [advancedOpen, setAdvancedOpen] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem("ai-qa.api.advancedOpen.v1");
      return raw ? Boolean(JSON.parse(raw)) : false;
    } catch {
      return false;
    }
  });
  const [scenarios, setScenarios] = useState<string>("");
  const [genLoading, setGenLoading] = useState(false);
  const [scenarioLimit, setScenarioLimit] = useState<number>(5);
  const [scenarioRunLoading, setScenarioRunLoading] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);
  const [metricsError, setMetricsError] = useState<string | null>(null);

  const previewState = preview.open ? tabRuns[preview.tabId] : null;
  const previewBody = String(previewState?.result?.bodyText ?? "");
  const previewJson =
    preview.mode === "json"
      ? (() => {
          try {
            return JSON.stringify(JSON.parse(previewBody), null, 2);
          } catch {
            return null;
          }
        })()
      : null;

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

  useEffect(() => {
    try {
      localStorage.setItem("ai-qa.api.advancedOpen.v1", JSON.stringify(Boolean(advancedOpen)));
    } catch {
      // ignore
    }
  }, [advancedOpen]);

  useEffect(() => {
    // Persist per-tab response/log history
    try {
      const MAX_BODY = 120_000;
      const sanitized: any = {};
      for (const [tabId, st] of Object.entries(tabRuns ?? {})) {
        const history = Array.isArray((st as any).history) ? (st as any).history : [];
        const safeHistory = history.slice(0, 20).map((h: any) => {
          const r = h?.result ?? null;
          const bodyText = String(r?.bodyText ?? "");
          return {
            at: String(h?.at ?? ""),
            method: String(h?.method ?? ""),
            url: String(h?.url ?? ""),
            result: r
              ? {
                  ok: Boolean(r.ok),
                  status: Number(r.status ?? 0),
                  elapsedMs: Number(r.elapsedMs ?? 0),
                  bodyText: bodyText.length > MAX_BODY ? bodyText.slice(0, MAX_BODY) : bodyText,
                  validations: Array.isArray(r.validations) ? r.validations : []
                }
              : null
          };
        });
        sanitized[tabId] = { logs: Array.isArray((st as any).logs) ? (st as any).logs.slice(0, 200) : [], history: safeHistory };
      }
      localStorage.setItem("ai-qa.api.runs.v1", JSON.stringify(sanitized));
    } catch {
      // ignore
    }
  }, [tabRuns]);

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
    try {
      localStorage.setItem("ai-qa.api.folders.expanded.v1", JSON.stringify(folderExpanded));
    } catch {
      // ignore
    }
  }, [folderExpanded]);

  useEffect(() => {
    try {
      localStorage.setItem("ai-qa.api.folders.v1", JSON.stringify(folders));
    } catch {
      // ignore
    }
  }, [folders]);

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

  const activeRun = tabRuns[safeActiveReq.id] ?? { logs: [], result: null, error: null, history: [] as any[] };
  const activeHistory = (activeRun as any).history ?? [];
  const activeFilter = logFiltersByTabId[safeActiveReq.id] ?? { status: "all" as const, q: "" };
  const selectedIdx = selectedRunIdxByTabId[safeActiveReq.id] ?? 0;
  const selectedEntry = activeHistory[selectedIdx] ?? null;
  const activeResult = (selectedEntry?.result ?? activeRun.result) as any;
  const activeBody = String(activeResult?.bodyText ?? "");
  const activeHasBody = Boolean(activeBody.trim());
  const resultOpen = expandedTabIds[safeActiveReq.id] ?? true;
  const expandedIdx = expandedRunIdxByTabId[safeActiveReq.id] ?? null;

  const logStats = useMemo(() => {
    let pass = 0;
    let fail = 0;
    for (const h of activeHistory) {
      if (h?.result?.ok) pass++;
      else fail++;
    }
    return { total: activeHistory.length, pass, fail };
  }, [activeHistory]);

  const filteredHistory = useMemo(() => {
    const q = (activeFilter.q ?? "").trim().toLowerCase();
    const want = activeFilter.status ?? "all";
    const out = activeHistory.filter((h: any) => {
      const ok = Boolean(h?.result?.ok);
      if (want === "pass" && !ok) return false;
      if (want === "fail" && ok) return false;
      if (!q) return true;
      const hay = `${h?.method ?? ""} ${h?.url ?? ""} ${h?.result?.status ?? ""}`.toLowerCase();
      return hay.includes(q);
    });
    return out.slice(0, 200);
  }, [activeHistory, activeFilter.q, activeFilter.status]);

  function openAndScrollToResponse(tabId: string) {
    setExpandedTabIds((p) => ({ ...p, [tabId]: true }));
    // next tick after layout update
    setTimeout(() => {
      try {
        responseLogsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } catch {
        // ignore
      }
    }, 0);
  }

  const filteredTabs = useMemo(() => {
    const q = reqQuery.trim().toLowerCase();
    if (!q) return tabs;
    return tabs.filter((t) => {
      const hay = `${t.folder ?? ""} ${t.name} ${t.method} ${t.url}`.toLowerCase();
      return hay.includes(q);
    });
  }, [tabs, reqQuery]);

  const folderTree = useMemo(() => {
    type Node = { name: string; path: string; explicit: boolean; children: Map<string, Node>; requests: ApiRequestTab[] };
    const root: Node = { name: "", path: "", explicit: false, children: new Map(), requests: [] };
    function ensureNode(path: string, markExplicitLeaf = false) {
      const parts = path.split("/").map((x) => x.trim()).filter(Boolean);
      let cur = root;
      let curPath = "";
      for (const p of parts) {
        curPath = curPath ? `${curPath}/${p}` : p;
        let child = cur.children.get(p);
        if (!child) {
          child = { name: p, path: curPath, explicit: false, children: new Map(), requests: [] };
          cur.children.set(p, child);
        }
        cur = child;
      }
      if (markExplicitLeaf) cur.explicit = true;
      return cur;
    }

    // Seed empty folders so user can create folders without requests.
    for (const f of folders) {
      const folder = String(f ?? "").trim();
      if (!folder) continue;
      ensureNode(folder, true);
    }

    for (const t of filteredTabs) {
      const folder = (t.folder ?? "").trim();
      if (!folder) root.requests.push(t);
      else ensureNode(folder).requests.push(t);
    }
    return root;
  }, [filteredTabs, folders]);

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
    // Newest first (Postman-like)
    setTabsState((s) => ({ tabs: [t, ...s.tabs], activeRequestId: t.id }));
  }

  function addTabInFolder(folderPath: string) {
    const t = newDefaultApiTab();
    t.name = `Request ${tabs.length + 1}`;
    t.folder = normalizeFolderPath(folderPath);
    // Newest first (Postman-like)
    setTabsState((s) => ({ tabs: [t, ...s.tabs], activeRequestId: t.id }));
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
        if (r.enabled === false) continue;
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
  const tabName = safeActiveReq.name;
  const tabFolder = safeActiveReq.folder;
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
  const insecureTls = safeActiveReq.insecureTls;
  const useCookieJar = safeActiveReq.useCookieJar;

  const activeTab = activePanel;
  const setActiveTab = setActivePanel;

  const setTabName = (v: string) => updateActive((t) => ({ ...t, name: v }));
  const setTabFolder = (v: string) => updateActive((t) => ({ ...t, folder: v }));
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
  const setInsecureTls = (v: boolean) => updateActive((t) => ({ ...t, insecureTls: v }));
  const setUseCookieJar = (v: boolean) => updateActive((t) => ({ ...t, useCookieJar: v }));

  // (rename removed)

  async function run() {
    if ((finalUrl ?? "").startsWith("grpc://") || (finalUrl ?? "").startsWith("grpcs://")) {
      setTabRuns((p) => ({
        ...p,
        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: "Chưa hỗ trợ chạy gRPC. Send chỉ hỗ trợ HTTP(S)." }
      }));
      return;
    }
    setRunning(true);
    setExpandedTabIds((p) => ({ ...p, [safeActiveReq.id]: true }));
    setTabRuns((p) => ({
      ...p,
      [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: null, result: null }
    }));
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
        expect: { status: safeActiveReq.expect.status, maxMs: safeActiveReq.expect.maxMs },
        insecureTls: safeActiveReq.insecureTls,
        useCookieJar: safeActiveReq.useCookieJar
      });
      setTabRuns((p) => {
        const prev = p[safeActiveReq.id] ?? { logs: [] as any[] };
        const at = new Date().toISOString();
        const nextLogs = [
          { at, method: safeActiveReq.method, url: finalUrl, ok: res.ok, status: res.status, elapsedMs: res.elapsedMs },
          ...(prev.logs ?? [])
        ].slice(0, 60);
        const nextHistory = [
          { at, method: safeActiveReq.method, url: finalUrl, result: res },
          ...((prev as any).history ?? [])
        ].slice(0, 20);
        return { ...p, [safeActiveReq.id]: { ...prev, result: res, error: null, logs: nextLogs, history: nextHistory } };
      });
      setSelectedRunIdxByTabId((p) => ({ ...p, [safeActiveReq.id]: 0 }));
      setExpandedRunIdxByTabId((p) => ({ ...p, [safeActiveReq.id]: null }));
      openAndScrollToResponse(safeActiveReq.id);
    } catch (e) {
      setTabRuns((p) => ({
        ...p,
        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: e instanceof Error ? e.message : String(e) }
      }));
    } finally {
      setRunning(false);
    }
  }

  async function generateScenarios() {
    setGenLoading(true);
    setTabRuns((p) => ({ ...p, [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: null } }));
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
      setTabRuns((p) => ({
        ...p,
        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: e instanceof Error ? e.message : String(e) }
      }));
    } finally {
      setGenLoading(false);
    }
  }

  function clearLogs() {
    setTabRuns((p) => ({ ...p, [safeActiveReq.id]: { logs: [], result: null, error: null, history: [] } }));
    setSelectedRunIdxByTabId((p) => ({ ...p, [safeActiveReq.id]: 0 }));
    setExpandedRunIdxByTabId((p) => ({ ...p, [safeActiveReq.id]: null }));
  }

  function detectImportKindFromFilename(name: string): ImportKind {
    const n = (name ?? "").toLowerCase().trim();
    if (n.endsWith(".yaml") || n.endsWith(".yml")) return "yaml";
    if (n.endsWith(".json")) return "raw";
    if (n.endsWith(".grpcurl")) return "grpcurl";
    if (n.endsWith(".sh") || n.endsWith(".curl") || n.endsWith(".txt")) return "curl";
    return "raw";
  }

  function normalizeFolderPath(input: string) {
    const raw = String(input ?? "").trim();
    const parts = raw
      .split("/")
      .map((x) => x.trim())
      .filter(Boolean);
    return parts.join("/");
  }

  function ensureFolder(path: string) {
    const p = normalizeFolderPath(path);
    if (!p) return "";
    setFolders((prev) => (prev.includes(p) ? prev : [p, ...prev]));
    setFolderExpanded((prev) => ({ ...prev, [p]: true }));
    return p;
  }

  function moveTabToFolder(tabId: string, folderPath: string) {
    const p = normalizeFolderPath(folderPath);
    if (!p) return;
    ensureFolder(p);
    setTabsState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, folder: p } : t))
    }));
  }

  function moveFolderToFolder(sourcePath: string, targetPath: string) {
    const src = normalizeFolderPath(sourcePath);
    const dst = normalizeFolderPath(targetPath);
    if (!src || !dst) return;
    if (src === dst) return;
    // Prevent moving a folder into itself/descendant.
    if (dst === src || dst.startsWith(src + "/")) return;

    const srcName = src.split("/").filter(Boolean).slice(-1)[0] ?? "";
    if (!srcName) return;
    const nextBase = normalizeFolderPath(`${dst}/${srcName}`);
    if (!nextBase) return;
    if (nextBase === src) return;
    if (nextBase.startsWith(src + "/")) return;

    // Update explicit folders
    setFolders((prev) => {
      const mapped = prev.map((p) => {
        const fp = normalizeFolderPath(p);
        if (!fp) return "";
        if (fp === src) return nextBase;
        if (fp.startsWith(src + "/")) return nextBase + fp.slice(src.length);
        return fp;
      }).filter(Boolean);
      return Array.from(new Set(mapped));
    });

    // Update expanded states
    setFolderExpanded((prev) => {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const fp = normalizeFolderPath(k);
        if (!fp) continue;
        if (fp === src) out[nextBase] = v;
        else if (fp.startsWith(src + "/")) out[nextBase + fp.slice(src.length)] = v;
        else out[fp] = v;
      }
      return out;
    });

    // Update tabs folder path
    setTabsState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => {
        const fp = normalizeFolderPath(t.folder);
        if (!fp) return t;
        if (fp === src) return { ...t, folder: nextBase };
        if (fp.startsWith(src + "/")) return { ...t, folder: nextBase + fp.slice(src.length) };
        return t;
      })
    }));

    setFolderMenuPath(null);
  }

  function moveFolderToRoot(sourcePath: string) {
    const src = normalizeFolderPath(sourcePath);
    if (!src) return;
    if (!src.includes("/")) return; // already root-level
    const name = src.split("/").filter(Boolean).slice(-1)[0] ?? "";
    if (!name) return;
    const nextBase = normalizeFolderPath(name);
    if (!nextBase || nextBase === src) return;

    // Update explicit folders
    setFolders((prev) => {
      const mapped = prev
        .map((p) => {
          const fp = normalizeFolderPath(p);
          if (!fp) return "";
          if (fp === src) return nextBase;
          if (fp.startsWith(src + "/")) return nextBase + fp.slice(src.length);
          return fp;
        })
        .filter(Boolean);
      return Array.from(new Set(mapped));
    });

    // Update expanded states
    setFolderExpanded((prev) => {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const fp = normalizeFolderPath(k);
        if (!fp) continue;
        if (fp === src) out[nextBase] = v;
        else if (fp.startsWith(src + "/")) out[nextBase + fp.slice(src.length)] = v;
        else out[fp] = v;
      }
      return out;
    });

    // Update tabs folder path
    setTabsState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => {
        const fp = normalizeFolderPath(t.folder);
        if (!fp) return t;
        if (fp === src) return { ...t, folder: nextBase };
        if (fp.startsWith(src + "/")) return { ...t, folder: nextBase + fp.slice(src.length) };
        return t;
      })
    }));

    setFolderMenuPath(null);
  }

  function moveTabToRoot(tabId: string) {
    setTabsState((s) => ({
      ...s,
      tabs: s.tabs.map((t) => (t.id === tabId ? { ...t, folder: "" } : t))
    }));
  }

  function deleteFolderTree(folderPath: string) {
    const src = normalizeFolderPath(folderPath);
    if (!src) return;
    if (!confirm(`Xoá folder "${src}" và toàn bộ request/subfolder bên trong?`)) return;

    // remove explicit folders within subtree
    setFolders((prev) => prev.filter((p) => {
      const fp = normalizeFolderPath(p);
      if (!fp) return false;
      return !(fp === src || fp.startsWith(src + "/"));
    }));

    setFolderExpanded((prev) => {
      const out: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev)) {
        const fp = normalizeFolderPath(k);
        if (!fp) continue;
        if (fp === src || fp.startsWith(src + "/")) continue;
        out[fp] = v;
      }
      return out;
    });

    setTabsState((s) => {
      const kept = s.tabs.filter((t) => {
        const fp = normalizeFolderPath(t.folder);
        if (!fp) return true;
        return !(fp === src || fp.startsWith(src + "/"));
      });
      const nextTabs = kept.length ? kept : [newDefaultApiTab()];
      const nextActive = nextTabs.some((t) => t.id === s.activeRequestId) ? s.activeRequestId : nextTabs[0]!.id;
      return { tabs: nextTabs, activeRequestId: nextActive };
    });

    setFolderMenuPath(null);
  }

  async function runScenarioLog(method: string, url: string, headers?: Record<string, string>, body?: string, expect?: any) {
    const res = await qa().runApi({ method, url, headers, bodyType: "raw", bodyText: body, timeoutMs, expect });
    // Keep scenario logs in the active tab scope
    setTabRuns((p) => {
      const prev = p[safeActiveReq.id] ?? { logs: [] as any[] };
      const nextLogs = [
        { at: new Date().toISOString(), method, url, ok: res.ok, status: res.status, elapsedMs: res.elapsedMs },
        ...(prev.logs ?? [])
      ].slice(0, 200);
      return { ...p, [safeActiveReq.id]: { ...prev, logs: nextLogs } };
    });
    return res;
  }

  async function runAllScenarios() {
    setScenarioRunLoading(true);
    setExpandedTabIds((p) => ({ ...p, [safeActiveReq.id]: true }));
    setTabRuns((p) => ({ ...p, [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: null } }));
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
        setTabRuns((p) => {
          const prev = p[safeActiveReq.id] ?? { logs: [] as any[] };
          const nextLogs = [
            { at: new Date().toISOString(), method: "SCENARIO", url: sc?.title ?? `#${sIdx + 1}`, ok: true, status: 0, elapsedMs: 0 },
            ...(prev.logs ?? [])
          ].slice(0, 200);
          return { ...p, [safeActiveReq.id]: { ...prev, logs: nextLogs } };
        });

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
      setTabRuns((p) => ({
        ...p,
        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: e instanceof Error ? e.message : String(e) }
      }));
    } finally {
      setScenarioRunLoading(false);
    }
  }

  return (
    <div className="grid gap-4">
      {menuOpen || folderMenuPath || requestMenuId ? (
        <div
          className="fixed inset-0 z-40 bg-black/60"
          onMouseDown={() => {
            setMenuOpen(false);
            setFolderMenuPath(null);
            setRequestMenuId(null);
          }}
        />
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="text-base font-extrabold">API test mode</div>
          <div className="text-sm text-slate-300">Gửi request và validate theo điều kiện (MVP).</div>
        </div>
        <div />
      </div>

      {importOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70"
          onMouseDown={() => setImportOpen(false)}
        >
          <div
            className="fixed left-1/2 top-1/2 w-[min(880px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--border) bg-slate-950 p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-extrabold">Import</div>
              <button
                onClick={() => setImportOpen(false)}
                className="rounded-xl bg-(--btn) px-3 py-2 text-xs font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid max-h-[80vh] gap-2 overflow-auto pr-1 [scrollbar-gutter:stable]">
            <div className="grid gap-2 md:grid-cols-[220px_1fr]">
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Nguồn import</div>
                <select
                  value={importKind}
                  onChange={(e) => {
                    setImportKind(e.target.value as ImportKind);
                    setImportPreview(null);
                    setImportErr(null);
                  }}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm font-bold text-slate-100 outline-none focus:border-white/25"
                >
                  <option value="curl">cURL</option>
                  <option value="yaml">YAML</option>
                  <option value="grpcurl">gRPCurl</option>
                  <option value="raw">Raw (JSON/URL)</option>
                </select>
              </label>
              <div className="grid content-end text-xs text-slate-400">
                {importKind === "yaml" ? (
                  <div>
                    Hỗ trợ YAML dạng 1 request, danh sách request, hoặc object có field <code className="rounded bg-white/10 px-1">requests</code>.
                  </div>
                ) : importKind === "raw" ? (
                  <div>Hỗ trợ JSON 1 request / mảng request, hoặc dán thẳng URL.</div>
                ) : importKind === "grpcurl" ? (
                  <div>Import để lưu/spec. Chưa hỗ trợ chạy gRPC (Send chỉ chạy HTTP).</div>
                ) : (
                  <div>Dán nguyên lệnh <code className="rounded bg-white/10 px-1">curl ...</code>.</div>
                )}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--border) bg-(--surface-2) p-3">
              <div className="text-xs font-bold text-slate-300">Chọn file để import</div>
              <input
                type="file"
                accept=".txt,.sh,.curl,.yaml,.yml,.json,.grpcurl"
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  try {
                    const t = await f.text();
                    const kind = detectImportKindFromFilename(f.name);
                    setImportKind(kind);
                    setImportText(t);
                    setImportPreview(null);
                    setImportErr(null);
                  } catch (err) {
                    setImportErr(err instanceof Error ? err.message : String(err));
                    setImportPreview(null);
                  } finally {
                    // allow re-selecting same file
                    e.currentTarget.value = "";
                  }
                }}
                className="text-sm text-(--app-fg) file:mr-3 file:rounded-lg file:border-0 file:bg-(--btn) file:px-3 file:py-2 file:text-sm file:font-extrabold file:text-(--app-fg) hover:file:bg-(--btn-hover)"
              />
            </div>

            <textarea
              value={importText}
              onChange={(e) => {
                setImportText(e.target.value);
                setImportPreview(null);
                setImportErr(null);
              }}
              rows={7}
              className="resize-y rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder={
                importKind === "curl"
                  ? 'curl -X POST "https://api.example.com/v1/login" -H "content-type: application/json" -d \'{"email":"a@b.com","password":"***"}\''
                  : importKind === "grpcurl"
                    ? 'grpcurl -plaintext -d \'{"id":"123"}\' localhost:50051 my.service.UserService/GetUser'
                    : importKind === "yaml"
                      ? ["requests:", "  - name: Health", "    method: GET", "    url: https://api.example.com/health"].join("\n")
                      : '{ "name": "Health", "method": "GET", "url": "https://api.example.com/health" }'
              }
            />

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => {
                  try {
                    const imported = importApiText(importKind, importText);
                    setImportPreview(imported);
                    setImportErr(null);
                  } catch (e) {
                    setImportPreview(null);
                    setImportErr(e instanceof Error ? e.message : String(e));
                  }
                }}
                className="rounded-xl bg-(--btn) px-4 py-2 text-sm font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Preview
              </button>
              <button
                onClick={() => {
                  try {
                    const imported = importPreview ?? importApiText(importKind, importText);
                    const nextTabs: ApiRequestTab[] = imported.map((r, idx) => {
                      const base = newDefaultApiTab();
                      const name = (r.name ?? "").trim() || `${importKind.toUpperCase()} ${idx + 1}`;
                      const method = String(r.method ?? "GET").toUpperCase() as HttpMethod;
                      const url = String(r.url ?? "");
                      const headers = r.headers
                        ? Object.entries(r.headers).map(([k, v]) => ({ id: newId(), enabled: true, key: k, value: String(v) }))
                        : base.headers;
                      const bodyType = (r.body?.type ?? "none") as BodyType;
                      const bodyText = typeof r.body?.text === "string" ? r.body.text : "";
                      const bodyFields =
                        Array.isArray(r.body?.fields) && r.body!.fields!.length
                          ? r.body!.fields!.map((kv) => ({ id: newId(), enabled: true, key: String(kv.key ?? ""), value: String(kv.value ?? "") }))
                          : base.body.fields;
                      return {
                        ...base,
                        name,
                        context: r.context ?? "",
                        method: (["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const).includes(method) ? method : "GET",
                        url,
                        headers,
                        body: {
                          ...base.body,
                          type: (["none", "raw", "json", "form_urlencoded", "form_data", "binary"] as const).includes(bodyType) ? bodyType : "raw",
                          text: bodyText,
                          fields: bodyFields
                        },
                        timeoutMs: Number.isFinite(r.timeoutMs as number) ? Number(r.timeoutMs) : base.timeoutMs,
                        insecureTls: Boolean(r.insecureTls) || base.insecureTls,
                        expect: {
                          status: Number.isFinite(r.expect?.status as number) ? Number(r.expect!.status) : base.expect.status,
                          maxMs: Number.isFinite(r.expect?.maxMs as number) ? Number(r.expect!.maxMs) : base.expect.maxMs
                        }
                      };
                    });

                    setTabsState((s) => {
                      const merged = [...nextTabs, ...s.tabs];
                      return { tabs: merged, activeRequestId: nextTabs[0]?.id ?? s.activeRequestId };
                    });
                    setImportErr(null);
                    setImportPreview(null);
                    setImportText("");
                    setImportOpen(false);
                    setMenuOpen(false);
                  } catch (e) {
                    setImportErr(e instanceof Error ? e.message : String(e));
                  }
                }}
                disabled={!importText.trim()}
                className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Apply to tabs
              </button>
              <button
                onClick={() => {
                  setImportText("");
                  setImportPreview(null);
                  setImportErr(null);
                }}
                className="rounded-xl bg-(--btn) px-4 py-2 text-sm font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Clear
              </button>
            </div>

            {importErr ? <div className="text-sm text-red-300">{importErr}</div> : null}
            {importPreview ? (
              <pre className="max-h-56 overflow-auto rounded-xl border border-(--border) bg-(--surface-2) p-3 text-xs text-(--app-fg)">
                {JSON.stringify(importPreview, null, 2)}
              </pre>
            ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {newFolderOpen ? (
        <div
          className="fixed inset-0 z-50 bg-black/70"
          onMouseDown={() => setNewFolderOpen(false)}
        >
          <div
            className="fixed left-1/2 top-1/2 w-[min(520px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--border) bg-slate-950 p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-extrabold">New folder</div>
              <button
                onClick={() => setNewFolderOpen(false)}
                className="rounded-xl bg-(--btn) px-3 py-2 text-xs font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Close
              </button>
            </div>

            <div className="mt-3 grid gap-2">
              <label className="grid gap-1">
                <div className="text-xs font-bold text-slate-300">Folder path</div>
                <input
                  value={newFolderPath}
                  onChange={(e) => setNewFolderPath(e.target.value)}
                  className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
                  placeholder="e.g. api/auth"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const p = ensureFolder(newFolderPath);
                      if (p) setReqQuery("");
                      setNewFolderOpen(false);
                    } else if (e.key === "Escape") {
                      setNewFolderOpen(false);
                    }
                  }}
                />
              </label>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setNewFolderOpen(false)}
                  className="rounded-xl bg-(--btn) px-4 py-2 text-sm font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const p = ensureFolder(newFolderPath);
                    if (p) setReqQuery("");
                    setNewFolderOpen(false);
                  }}
                  className="rounded-xl bg-blue-500 px-4 py-2 text-sm font-extrabold text-white hover:bg-blue-400"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {preview.open ? (
        <div
          className="fixed inset-0 z-60 bg-black/70"
          onMouseDown={() => setPreview((p) => ({ ...p, open: false }))}
        >
          <div
            className="fixed left-1/2 top-1/2 w-[min(980px,calc(100vw-2rem))] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-(--border) bg-slate-950 p-4 shadow-2xl"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="text-sm font-extrabold text-slate-100">Preview</div>
              <button
                type="button"
                onClick={() => setPreview((p) => ({ ...p, open: false }))}
                className="rounded-xl bg-(--btn) px-3 py-1.5 text-xs font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Close
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPreview((p) => ({ ...p, mode: "raw" }))}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs font-extrabold",
                  preview.mode === "raw" ? "bg-blue-500 text-white" : "bg-(--btn) text-(--app-fg) hover:bg-(--btn-hover)"
                ].join(" ")}
              >
                Raw
              </button>
              <button
                type="button"
                onClick={() => setPreview((p) => ({ ...p, mode: "json" }))}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs font-extrabold",
                  preview.mode === "json" ? "bg-blue-500 text-white" : "bg-(--btn) text-(--app-fg) hover:bg-(--btn-hover)"
                ].join(" ")}
              >
                JSON
              </button>
              <button
                type="button"
                onClick={() => setPreview((p) => ({ ...p, mode: "html" }))}
                className={[
                  "rounded-xl px-3 py-1.5 text-xs font-extrabold",
                  preview.mode === "html" ? "bg-blue-500 text-white" : "bg-(--btn) text-(--app-fg) hover:bg-(--btn-hover)"
                ].join(" ")}
              >
                HTML
              </button>
              <div className="ml-auto text-[11px] font-bold text-slate-400">
                Tab: <span className="text-slate-200">{preview.tabId || "-"}</span>
              </div>
            </div>

            {preview.mode === "html" ? (
              <div className="h-[60vh] overflow-hidden rounded-xl border border-white/10 bg-black/30">
                <iframe
                  title="html-preview"
                  sandbox=""
                  className="h-full w-full"
                  srcDoc={previewBody}
                />
              </div>
            ) : (
              <pre className="max-h-[60vh] overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-xs text-slate-100">
                {preview.mode === "json"
                  ? previewJson ?? "Body không phải JSON hợp lệ để preview."
                  : previewBody}
              </pre>
            )}
          </div>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-[340px_1fr]">
        {/* Sidebar (Postman-like) */}
        <div className="flex h-[70vh] min-h-0 flex-col gap-3 rounded-2xl border border-(--border) bg-(--surface) p-3 md:h-[calc(100vh-260px)]">
          <div className="grid gap-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-extrabold text-slate-300">Requests</div>
              <div className="relative flex items-center gap-2">
                <button
                  onClick={addTab}
                  className="rounded-lg bg-blue-500 px-3 py-1 text-xs font-extrabold text-white hover:bg-blue-400"
                >
                  + New
                </button>
                <button
                  onClick={() => setMenuOpen((v) => !v)}
                  className="rounded-lg bg-(--btn) px-2 py-1 text-xs font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                  title="Menu"
                >
                  …
                </button>
                {menuOpen ? (
                  <div
                    className="absolute right-0 top-9 z-50 w-44 overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-xl"
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => {
                        setMenuOpen(false);
                        setNewFolderOpen(true);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-extrabold text-(--app-fg) hover:bg-(--btn)"
                    >
                      New folder
                    </button>
                    <button
                      onClick={() => {
                        setImportOpen(true);
                        setMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-extrabold text-(--app-fg) hover:bg-(--btn)"
                    >
                      Import
                    </button>
                    <button
                      onClick={() => {
                        clearLogs();
                        setMenuOpen(false);
                      }}
                      className="w-full px-3 py-2 text-left text-xs font-extrabold text-(--app-fg) hover:bg-(--btn)"
                    >
                      Clear logs/result
                    </button>
                  </div>
                ) : null}
              </div>
            </div>

            <input
              value={reqQuery}
              onChange={(e) => setReqQuery(e.target.value)}
              placeholder="Search (name / method / url)"
              className="w-full rounded-xl border border-(--border) bg-(--surface-2) px-3 py-2 text-xs font-bold text-(--app-fg) outline-none placeholder:text-(--muted) focus:border-(--btn-hover)"
            />
          </div>

          <div
            className="flex min-h-0 flex-1 flex-col gap-1 overflow-auto pr-1 [scrollbar-gutter:stable]"
            onDragOver={(e) => {
              // Drop to background (outside folder items) => move to root
              e.preventDefault();
              setDragOverFolder("__root__");
              try {
                e.dataTransfer.dropEffect = "move";
              } catch {
                // ignore
              }
            }}
            onDragLeave={() => setDragOverFolder((p) => (p === "__root__" ? null : p))}
            onDrop={(e) => {
              e.preventDefault();
              const folderSrc = e.dataTransfer.getData("text/folder");
              if (folderSrc) {
                moveFolderToRoot(folderSrc);
              } else {
                const id = e.dataTransfer.getData("text/plain");
                if (id) moveTabToRoot(id);
              }
              setDragOverFolder(null);
            }}
            title="Drop here to move to root"
          >
            {/* Root (no folder) */}
            {folderTree.requests.map((t) => (
              <button
                key={t.id}
                onClick={() => {
                  persistTabs();
                  setActiveRequestId(t.id);
                  setExpandedTabIds((p) => ({ ...p, [t.id]: true }));
                }}
                draggable
                onDragStart={(e) => {
                  try {
                    e.dataTransfer.setData("text/plain", t.id);
                    e.dataTransfer.effectAllowed = "move";
                  } catch {
                    // ignore
                  }
                }}
                className={[
                  "flex shrink-0 items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left",
                  t.id === activeRequestId
                    ? "border-(--border) bg-(--btn)"
                    : "border-(--border) bg-(--surface-2) hover:bg-(--btn)"
                ].join(" ")}
                title={t.name}
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-(--btn) px-1.5 py-0.5 text-[11px] font-extrabold text-(--app-fg)">
                      {t.method}
                    </span>
                    <span className="truncate text-xs font-extrabold text-(--app-fg)">{t.name}</span>
                  </div>
                  <div className="mt-1 truncate text-[11px] font-bold text-(--muted)">{t.url || "(no url)"}</div>
                </div>
                <div className="relative flex items-center gap-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      persistTabs();
                      setActiveRequestId(t.id);
                      openAndScrollToResponse(t.id);
                    }}
                    className="rounded-lg bg-(--btn) px-2 py-0.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                    title="Xổ xuống Response/Logs"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setRequestMenuId((cur) => (cur === t.id ? null : t.id));
                    }}
                    className="rounded-lg bg-(--btn) px-2 py-0.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                    title="Menu"
                  >
                    …
                  </button>
                  {requestMenuId === t.id ? (
                    <div
                      className="absolute right-0 top-6 z-60 w-44 overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-xl"
                      onMouseDown={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          closeTab(t.id);
                          setRequestMenuId(null);
                        }}
                        className="w-full px-3 py-2 text-left text-xs font-extrabold text-red-300 hover:bg-(--btn)"
                      >
                        Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              </button>
            ))}

            {/* Folder tree */}
            {(() => {
              const renderNode = (node: any, depth: number): any => {
                const children = Array.from(node.children.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
                const hasContent = Boolean(node.explicit) || children.length > 0 || node.requests.length > 0;
                if (!hasContent) return null;
                const expanded = folderExpanded[node.path] ?? true;
                return (
                  <div key={node.path} className="grid gap-1">
                    <button
                      onClick={() => {
                        setFolderMenuPath((cur) => (cur === node.path ? null : cur));
                      }}
                      draggable
                      onDragStart={(e) => {
                        try {
                          e.dataTransfer.setData("text/folder", node.path);
                          e.dataTransfer.effectAllowed = "move";
                        } catch {
                          // ignore
                        }
                      }}
                      className={[
                        "flex shrink-0 items-center justify-between rounded-xl border border-(--border) px-3 py-2 text-left hover:bg-(--btn)",
                        dragOverFolder === node.path ? "bg-(--btn)" : "bg-(--surface-2)"
                      ].join(" ")}
                      onDragOver={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        setDragOverFolder(node.path);
                        try {
                          e.dataTransfer.dropEffect = "move";
                        } catch {
                          // ignore
                        }
                      }}
                      onDragLeave={(e) => {
                        e.stopPropagation();
                        setDragOverFolder((p) => (p === node.path ? null : p));
                      }}
                      onDrop={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        const folderSrc = e.dataTransfer.getData("text/folder");
                        if (folderSrc) {
                          moveFolderToFolder(folderSrc, node.path);
                        } else {
                          const id = e.dataTransfer.getData("text/plain");
                          if (id) moveTabToFolder(id, node.path);
                        }
                        setDragOverFolder(null);
                      }}
                      data-dropping={dragOverFolder === node.path ? "1" : undefined}
                      style={{ marginLeft: depth ? depth * 12 : 0 }}
                      title={node.path}
                    >
                      <div className="min-w-0 text-xs font-extrabold text-(--app-fg)">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderExpanded((p) => ({ ...p, [node.path]: !(p[node.path] ?? true) }));
                          }}
                          className="mr-2 inline-flex w-5 items-center justify-center rounded bg-(--btn) px-1 py-0.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                          title={expanded ? "Collapse" : "Expand"}
                        >
                          {expanded ? "▾" : "▸"}
                        </button>
                        <span className="truncate">{node.name}</span>
                      </div>
                      <div className="relative flex items-center gap-2">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setFolderMenuPath((cur) => (cur === node.path ? null : node.path));
                          }}
                          className="rounded bg-(--btn) px-2 py-0.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                          title="Folder menu"
                        >
                          …
                        </button>
                        {folderMenuPath === node.path ? (
                          <div
                            className="absolute right-0 top-6 z-60 w-48 overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-xl"
                            onMouseDown={(e) => e.stopPropagation()}
                          >
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                addTabInFolder(node.path);
                                setFolderMenuPath(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-extrabold text-(--app-fg) hover:bg-(--btn)"
                            >
                              Add request
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setNewFolderPath(`${node.path}/`);
                                setNewFolderOpen(true);
                                setFolderMenuPath(null);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-extrabold text-(--app-fg) hover:bg-(--btn)"
                            >
                              Add subfolder
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteFolderTree(node.path);
                              }}
                              className="w-full px-3 py-2 text-left text-xs font-extrabold text-red-300 hover:bg-(--btn)"
                            >
                              Delete folder
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </button>
                    {expanded ? (
                      <div className="grid gap-1">
                        {node.requests.map((t: ApiRequestTab) => (
                          <button
                            key={t.id}
                            onClick={() => {
                              persistTabs();
                              setActiveRequestId(t.id);
                              setExpandedTabIds((p) => ({ ...p, [t.id]: true }));
                            }}
                            draggable
                            onDragStart={(e) => {
                              try {
                                e.dataTransfer.setData("text/plain", t.id);
                                e.dataTransfer.effectAllowed = "move";
                              } catch {
                                // ignore
                              }
                            }}
                            className={[
                              "flex shrink-0 items-start justify-between gap-2 rounded-xl border px-3 py-2 text-left",
                              t.id === activeRequestId
                                ? "border-(--border) bg-(--btn)"
                                : "border-(--border) bg-(--surface-2) hover:bg-(--btn)"
                            ].join(" ")}
                            style={{ marginLeft: (depth + 1) * 12 }}
                            title={t.name}
                          >
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="rounded bg-(--btn) px-1.5 py-0.5 text-[11px] font-extrabold text-(--app-fg)">
                                  {t.method}
                                </span>
                                <span className="truncate text-xs font-extrabold text-(--app-fg)">{t.name}</span>
                              </div>
                              <div className="mt-1 truncate text-[11px] font-bold text-(--muted)">{t.url || "(no url)"}</div>
                            </div>
                            <div className="relative flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  persistTabs();
                                  setActiveRequestId(t.id);
                                  openAndScrollToResponse(t.id);
                                }}
                                className="rounded-lg bg-(--btn) px-2 py-0.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                                title="Xổ xuống Response/Logs"
                              >
                                ↓
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setRequestMenuId((cur) => (cur === t.id ? null : t.id));
                                }}
                                className="rounded-lg bg-(--btn) px-2 py-0.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                                title="Menu"
                              >
                                …
                              </button>
                              {requestMenuId === t.id ? (
                                <div
                                  className="absolute right-0 top-6 z-60 w-44 overflow-hidden rounded-xl border border-(--border) bg-(--surface) shadow-xl"
                                  onMouseDown={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      closeTab(t.id);
                                      setRequestMenuId(null);
                                    }}
                                    className="w-full px-3 py-2 text-left text-xs font-extrabold text-red-300 hover:bg-(--btn)"
                                  >
                                    Delete
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </button>
                        ))}
                        {children.map((c: any) => renderNode(c, depth + 1))}
                      </div>
                    ) : null}
                  </div>
                );
              };
              const top = Array.from(folderTree.children.values()).sort((a: any, b: any) => a.name.localeCompare(b.name));
              return top.map((n: any) => renderNode(n, 0));
            })()}
            {filteredTabs.length === 0 ? (
              <div className="rounded-xl border border-(--border) bg-(--surface-2) p-3 text-xs font-bold text-(--muted)">
                Không có request phù hợp.
              </div>
            ) : null}
          </div>

          <div className="border-t border-(--border) pt-3 text-[11px] font-bold text-(--muted)">
            {filteredTabs.length}/{tabs.length} requests
          </div>
        </div>

        {/* Main editor */}
        <div className="grid gap-3 rounded-2xl border border-(--border) bg-(--surface) p-4">
        <div className="grid gap-2 md:grid-cols-2">
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Name</div>
            <input
              value={tabName}
              onChange={(e) => setTabName(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder="Request name"
            />
          </label>
          <label className="grid gap-1">
            <div className="text-xs font-bold text-slate-300">Folder</div>
            <input
              value={tabFolder}
              onChange={(e) => setTabFolder(e.target.value)}
              className="rounded-xl border border-white/15 bg-black/30 px-3 py-2 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/25"
              placeholder="e.g. api/auth"
            />
          </label>
        </div>

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
              onClick={() => setActiveTab("context")}
              className={[
                "relative -mb-px px-1 py-2 text-sm font-extrabold",
                activeTab === "context" ? "text-slate-100" : "text-slate-300 hover:text-slate-200"
              ].join(" ")}
            >
              Context
              {activeTab === "context" ? <span className="absolute inset-x-0 bottom-0 h-0.5 bg-blue-400" /> : null}
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
                onClick={() => setParamRows((p) => [...p, { id: newId(), enabled: true, key: "", value: "" }])}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
              >
                + Add
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid max-h-[40vh] gap-2 overflow-auto pr-1 [scrollbar-gutter:stable] md:max-h-[calc(100vh-520px)]">
                {paramRows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[28px_1fr_1fr_40px] gap-2">
                  <label className="grid place-items-center">
                    <input
                      type="checkbox"
                      checked={r.enabled !== false}
                      onChange={(e) =>
                        setParamRows((p) => p.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))
                      }
                      title="Use this param when sending"
                    />
                  </label>
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
              </div>
              <div className="text-xs text-slate-400">
                URL: <span className="text-slate-200">{finalUrl}</span>
              </div>
            </div>
          </div>
        ) : activeTab === "context" ? (
          <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
            <label className="grid gap-1">
              <div className="text-xs font-bold text-slate-300">Context (API / validation)</div>
              <textarea
                value={apiContext}
                onChange={(e) => setApiContext(e.target.value)}
                rows={8}
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
                onClick={() => setHeaderRows((p) => [...p, { id: newId(), enabled: true, key: "", value: "" }])}
                className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-extrabold text-slate-200 hover:bg-white/15"
              >
                + Add
              </button>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/20 p-3">
              <div className="grid max-h-[40vh] gap-2 overflow-auto pr-1 [scrollbar-gutter:stable] md:max-h-[calc(100vh-520px)]">
                {headerRows.map((r) => (
                  <div key={r.id} className="grid grid-cols-[28px_1fr_1fr_40px] gap-2">
                  <label className="grid place-items-center">
                    <input
                      type="checkbox"
                      checked={r.enabled !== false}
                      onChange={(e) =>
                        setHeaderRows((p) => p.map((x) => (x.id === r.id ? { ...x, enabled: e.target.checked } : x)))
                      }
                      title="Use this header when sending"
                    />
                  </label>
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
              </div>
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
                      setTabRuns((p) => ({ ...p, [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: null } }));
                    } catch {
                      setTabRuns((p) => ({
                        ...p,
                        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: "Body không phải JSON hợp lệ để format." }
                      }));
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
                    onClick={() => setBodyFields((p) => [...p, { id: newId(), enabled: true, key: "", value: "" }])}
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

        <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
          <button
            type="button"
            onClick={() => setAdvancedOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-left"
          >
            <div className="text-xs font-extrabold text-slate-200">Advanced (AI Testing / TLS / Cookies / Scenarios)</div>
            <div className="text-[11px] font-bold text-slate-400">{advancedOpen ? "Hide" : "Show"}</div>
          </button>

          {!advancedOpen ? (
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-200">
                <span className="text-slate-300">Expect</span>
                <span className="text-slate-100">{expectStatus}</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Max</span>
                <span className="text-slate-100">{maxMs}ms</span>
                <span className="text-slate-500">•</span>
                <span className="text-slate-300">Timeout</span>
                <span className="text-slate-100">{timeoutMs}ms</span>
              </div>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-200">
                <input type="checkbox" checked={insecureTls} onChange={(e) => setInsecureTls(e.target.checked)} />
                TLS ignore
              </label>
              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-200">
                <input type="checkbox" checked={useCookieJar} onChange={(e) => setUseCookieJar(e.target.checked)} />
                Cookie jar
              </label>
              <button
                type="button"
                onClick={clearLogs}
                className="rounded-xl bg-(--btn) px-3 py-2 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Clear logs
              </button>
              <button
                type="button"
                onClick={() => openAndScrollToResponse(safeActiveReq.id)}
                className="rounded-xl bg-(--btn) px-3 py-2 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
              >
                Jump to logs
              </button>
            </div>
          ) : (
            <div className="mt-3 grid gap-2">
              <div className="grid gap-2 md:grid-cols-3">
                <label className="grid gap-1">
                  <div className="text-[11px] font-bold text-slate-300">Expect status</div>
                  <input
                    type="number"
                    value={expectStatus}
                    onChange={(e) => setExpectStatus(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-100 outline-none focus:border-white/20"
                  />
                </label>
                <label className="grid gap-1">
                  <div className="text-[11px] font-bold text-slate-300">Max time (ms)</div>
                  <input
                    type="number"
                    value={maxMs}
                    onChange={(e) => setMaxMs(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-100 outline-none focus:border-white/20"
                  />
                </label>
                <label className="grid gap-1">
                  <div className="text-[11px] font-bold text-slate-300">Timeout (ms)</div>
                  <input
                    type="number"
                    value={timeoutMs}
                    onChange={(e) => setTimeoutMs(Number(e.target.value))}
                    className="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                    placeholder="5000"
                  />
                </label>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-200">
                  <input type="checkbox" checked={insecureTls} onChange={(e) => setInsecureTls(e.target.checked)} />
                  Ignore TLS errors (self-signed) (dev)
                </label>

                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-200">
                  <input type="checkbox" checked={useCookieJar} onChange={(e) => setUseCookieJar(e.target.checked)} />
                  Cookie jar
                </label>

                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await qa().clearCookies();
                      setTabRuns((p) => ({ ...p, [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: null } }));
                    } catch (e) {
                      setTabRuns((p) => ({
                        ...p,
                        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { logs: [] }), error: e instanceof Error ? e.message : String(e) }
                      }));
                    }
                  }}
                  className="rounded-xl bg-(--btn) px-3 py-2 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                >
                  Clear cookies
                </button>

                <button
                  type="button"
                  onClick={clearLogs}
                  className="rounded-xl bg-(--btn) px-3 py-2 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                >
                  Clear logs
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={generateScenarios}
                  disabled={genLoading}
                  className="rounded-xl bg-(--btn) px-3 py-2 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover) disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {genLoading ? "Generating..." : "Tạo kịch bản test"}
                </button>
                <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-extrabold text-slate-200">
                  Limit
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={scenarioLimit}
                    onChange={(e) => setScenarioLimit(Number(e.target.value))}
                    className="w-20 rounded-lg border border-white/10 bg-black/30 px-2 py-1 text-[11px] font-extrabold text-slate-100 outline-none focus:border-white/20"
                  />
                </label>
                <button
                  onClick={runAllScenarios}
                  disabled={scenarioRunLoading || !scenarios.trim()}
                  className="rounded-xl bg-emerald-400 px-3 py-2 text-[11px] font-extrabold text-slate-950 hover:bg-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {scenarioRunLoading ? "Running..." : "Chạy tất cả kịch bản test"}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>
      </div>

      {/* Result + Logs (per active tab) - move to bottom of main detail */}
      <div ref={responseLogsRef} className="rounded-2xl border border-(--border) bg-(--surface-2) p-3">
        <button
          type="button"
          onClick={() => setExpandedTabIds((p) => ({ ...p, [safeActiveReq.id]: !(p[safeActiveReq.id] ?? true) }))}
          className="flex w-full items-center justify-between gap-3 rounded-xl bg-black/20 px-3 py-2 text-left"
        >
          <div className="text-xs font-extrabold text-(--app-fg)">Response / Logs</div>
          <div className="text-[11px] font-bold text-(--muted)">{resultOpen ? "Hide" : "Show"}</div>
        </button>

        {resultOpen ? (
          <div className="mt-3 grid gap-3">
            {activeRun.error ? (
              <div className="text-xs font-extrabold text-red-300">{activeRun.error}</div>
            ) : null}

            {activeHistory.length === 0 ? (
              <div className="text-[11px] font-bold text-(--muted)">Chưa có log cho request này.</div>
            ) : null}

            {activeHistory.length ? (
              <div className="grid gap-2 rounded-xl border border-white/10 bg-black/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-[11px] font-extrabold text-slate-200">
                    Total: <span className="text-slate-100">{logStats.total}</span>
                    <span className="mx-2 text-slate-500">•</span>
                    PASS: <span className="text-emerald-300">{logStats.pass}</span>
                    <span className="mx-2 text-slate-500">•</span>
                    FAIL: <span className="text-red-300">{logStats.fail}</span>
                    <span className="mx-2 text-slate-500">•</span>
                    Showing: <span className="text-slate-100">{filteredHistory.length}</span>
                  </div>
                  <button
                    type="button"
                    onClick={clearLogs}
                    className="rounded-xl bg-(--btn) px-3 py-1.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                  >
                    Clear logs
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/20 p-1">
                    {(["all", "pass", "fail"] as const).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() =>
                          setLogFiltersByTabId((p) => ({
                            ...p,
                            [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { status: "all", q: "" }), status: s }
                          }))
                        }
                        className={[
                          "rounded-lg px-3 py-1 text-[11px] font-extrabold",
                          activeFilter.status === s ? "bg-blue-500 text-white" : "bg-transparent text-slate-200 hover:bg-white/10"
                        ].join(" ")}
                      >
                        {s.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <input
                    value={activeFilter.q}
                    onChange={(e) =>
                      setLogFiltersByTabId((p) => ({
                        ...p,
                        [safeActiveReq.id]: { ...(p[safeActiveReq.id] ?? { status: "all", q: "" }), q: e.target.value }
                      }))
                    }
                    placeholder="Filter by method / URL / status..."
                    className="min-w-[240px] flex-1 rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-[11px] font-bold text-slate-100 outline-none placeholder:text-slate-500 focus:border-white/20"
                  />
                </div>
              </div>
            ) : null}

            {filteredHistory.length ? (
              <div className="max-h-56 overflow-auto rounded-xl border border-(--border) bg-black/20 p-2">
                <div className="grid gap-1">
                  {filteredHistory.slice(0, 120).map((h: any, idx: number) => {
                    const l = {
                      at: h?.at,
                      method: h?.method,
                      url: h?.url,
                      ok: Boolean(h?.result?.ok),
                      status: Number(h?.result?.status ?? 0),
                      elapsedMs: Number(h?.result?.elapsedMs ?? 0)
                    };
                    const isOpen = expandedIdx === idx;
                    const r = h?.result;
                    const bodyText = String(r?.bodyText ?? "");
                    const hasBody = Boolean(bodyText.trim());
                    return (
                    <div key={idx} className="grid gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          // Keep selection within current filtered list; detail uses current selected entry anyway.
                          setSelectedRunIdxByTabId((p) => ({ ...p, [safeActiveReq.id]: idx }));
                          setExpandedRunIdxByTabId((p) => ({
                            ...p,
                            [safeActiveReq.id]: (p[safeActiveReq.id] ?? null) === idx ? null : idx
                          }));
                        }}
                        className={[
                          "flex w-full flex-wrap items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 px-2 py-1.5 text-left hover:bg-black/30",
                          selectedIdx === idx ? "outline outline-blue-400/60" : ""
                        ].join(" ")}
                      >
                        <div className="min-w-0 text-[11px] font-bold text-slate-300">
                          <span className="font-extrabold text-slate-100">{l.method}</span>{" "}
                          <span className="truncate">{l.url}</span>
                        </div>
                        <div className="flex items-center gap-2 text-[11px] font-extrabold">
                          {l.method === "SCENARIO" ? (
                            <span className="rounded-full bg-fuchsia-300 px-2 py-0.5 text-slate-950">SCENARIO</span>
                          ) : (
                            <>
                              <span
                                className={[
                                  "rounded-full px-2 py-0.5",
                                  l.ok ? "bg-emerald-300 text-slate-950" : "bg-red-400 text-slate-950"
                                ].join(" ")}
                              >
                                {l.ok ? "PASS" : "FAIL"}
                              </span>
                              <span className="rounded-full bg-white/10 px-2 py-0.5 text-slate-200">
                                {l.status} • {l.elapsedMs}ms
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                      {isOpen ? (
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="mb-2 flex flex-wrap items-center gap-2">
                            <div className="text-[11px] font-extrabold text-slate-200">{String(l.at ?? "")}</div>
                            <div className="ml-auto flex flex-wrap gap-2">
                              <button
                                type="button"
                                disabled={!hasBody}
                                onClick={() => setPreview({ open: true, tabId: safeActiveReq.id, mode: "raw" })}
                                className="rounded-xl bg-(--btn) px-3 py-1.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover) disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Preview Raw
                              </button>
                              <button
                                type="button"
                                disabled={!hasBody}
                                onClick={() => setPreview({ open: true, tabId: safeActiveReq.id, mode: "json" })}
                                className="rounded-xl bg-(--btn) px-3 py-1.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover) disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Preview JSON
                              </button>
                              <button
                                type="button"
                                disabled={!hasBody}
                                onClick={() => setPreview({ open: true, tabId: safeActiveReq.id, mode: "html" })}
                                className="rounded-xl bg-(--btn) px-3 py-1.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover) disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                Preview HTML
                              </button>
                              <button
                                type="button"
                                onClick={clearLogs}
                                className="rounded-xl bg-(--btn) px-3 py-1.5 text-[11px] font-extrabold text-(--app-fg) hover:bg-(--btn-hover)"
                              >
                                Clear
                              </button>
                            </div>
                          </div>

                          {Array.isArray(r?.validations) && r.validations.length ? (
                            <div className="grid gap-1">
                              <div className="text-xs font-extrabold text-slate-200">Validations</div>
                              {r.validations.map((v: any, i: number) => (
                                <div key={i} className="rounded-lg border border-white/10 bg-black/20 px-2 py-1.5">
                                  <div className="flex flex-wrap items-center justify-between gap-2">
                                    <div className="text-[11px] font-extrabold text-slate-100">{String(v?.name ?? `#${i + 1}`)}</div>
                                    <span
                                      className={[
                                        "rounded-full px-2 py-0.5 text-[11px] font-extrabold",
                                        v?.ok ? "bg-emerald-300 text-slate-950" : "bg-red-400 text-slate-950"
                                      ].join(" ")}
                                    >
                                      {v?.ok ? "PASS" : "FAIL"}
                                    </span>
                                  </div>
                                  {v?.details ? (
                                    <div className="mt-1 text-[11px] font-bold text-slate-400">{String(v.details)}</div>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          ) : (
                            <div className="text-[11px] font-bold text-(--muted)">Không có validations.</div>
                          )}
                        </div>
                      ) : null}
                    </div>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Logs/results are shown in main detail (per active tab). */}

      {scenarios ? (
        <pre className="max-h-80 overflow-auto rounded-xl border border-white/10 bg-black/30 p-3 text-sm text-slate-100">
          {scenarios}
        </pre>
      ) : null}
    </div>
  );
}

