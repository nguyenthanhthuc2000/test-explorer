import { ipcMain } from "electron";
import { runOrchestrator } from "../../core/orchestrator";
import { setConfig } from "../../db/repository/config.repo";
import { clearAllHistory, countHistory, getRun, listRuns } from "../../db/repository/run.repo";
import { listSteps } from "../../db/repository/step.repo";
import type { AppConfig } from "../../core/config";
import { defaultConfig } from "../../core/config";
import { IPC_CHANNELS } from "./channels";
import { env } from "../../config/env";
import { getConfig } from "../../db/repository/config.repo";
import { ollamaGenerate } from "../../ai/ollama";
import { buildApiTestScenariosPrompt } from "../../ai/prompt";

export function registerTestIpc() {
  ipcMain.handle(IPC_CHANNELS.runTest, async (_event, payload: { url: string }) => {
    return await runOrchestrator({ url: payload.url });
  });

  ipcMain.handle(IPC_CHANNELS.getConfig, async () => {
    return getConfig();
  });

  ipcMain.handle(IPC_CHANNELS.setConfig, async (_event, payload: { config: AppConfig }) => {
    setConfig(payload.config);
    return true;
  });

  ipcMain.handle(IPC_CHANNELS.listRuns, async (_event, payload: { limit?: number }) => {
    return listRuns(payload.limit ?? 50);
  });

  ipcMain.handle("clear-history", async () => {
    const before = countHistory();
    const deleted = clearAllHistory();
    const after = countHistory();
    return { before, deleted, after };
  });

  ipcMain.handle("reset-config", async () => {
    setConfig(defaultConfig);
    return defaultConfig;
  });

  ipcMain.handle(IPC_CHANNELS.getRun, async (_event, payload: { id: string }) => {
    const run = getRun(payload.id);
    if (!run) return null;
    const steps = listSteps(payload.id);
    return { run, steps };
  });

  ipcMain.handle("run-api", async (_event, payload: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    bodyType?: "none" | "raw" | "json" | "form_urlencoded" | "form_data" | "binary";
    bodyText?: string;
    bodyFields?: Array<{ key: string; value: string }>;
    binary?: { filename?: string; mime?: string; base64: string };
    timeoutMs?: number;
    expect?: { status?: number; maxMs?: number };
  }) => {
    const started = Date.now();
    const timeoutMs = Math.max(0, Math.trunc(payload.timeoutMs ?? 0));
    const ctrl = timeoutMs > 0 ? new AbortController() : null;
    const t = ctrl ? setTimeout(() => ctrl.abort(), timeoutMs) : null;
    const headers: Record<string, string> = { ...(payload.headers ?? {}) };
    const bodyType = payload.bodyType ?? "raw";
    let body: any = undefined;

    function hasHeader(name: string) {
      const n = name.toLowerCase();
      return Object.keys(headers).some((k) => k.toLowerCase() === n);
    }

    if (bodyType === "none") {
      body = undefined;
    } else if (bodyType === "raw") {
      body = payload.bodyText ?? "";
    } else if (bodyType === "json") {
      body = payload.bodyText ?? "";
      if (!hasHeader("content-type")) headers["content-type"] = "application/json";
    } else if (bodyType === "form_urlencoded") {
      const params = new URLSearchParams();
      for (const kv of payload.bodyFields ?? []) {
        const k = (kv.key ?? "").trim();
        if (!k) continue;
        params.append(k, String(kv.value ?? ""));
      }
      body = params.toString();
      if (!hasHeader("content-type")) headers["content-type"] = "application/x-www-form-urlencoded";
    } else if (bodyType === "form_data") {
      const fd = new FormData();
      for (const kv of payload.bodyFields ?? []) {
        const k = (kv.key ?? "").trim();
        if (!k) continue;
        fd.append(k, String(kv.value ?? ""));
      }
      body = fd;
      // Let fetch set boundary; do not set content-type manually.
      for (const k of Object.keys(headers)) {
        if (k.toLowerCase() === "content-type") delete headers[k];
      }
    } else if (bodyType === "binary") {
      const b64 = payload.binary?.base64 ?? "";
      if (!b64) throw new Error("Chưa chọn file (binary).");
      body = Buffer.from(b64, "base64");
      if (payload.binary?.mime && !hasHeader("content-type")) headers["content-type"] = payload.binary.mime;
    }

    const res = await fetch(payload.url, {
      method: payload.method,
      headers,
      body,
      signal: ctrl?.signal
    }).finally(() => {
      if (t) clearTimeout(t);
    });
    const bodyText = await res.text();
    const elapsedMs = Date.now() - started;

    const validations: Array<{ name: string; ok: boolean; details?: string }> = [];
    if (payload.expect?.status != null) {
      const ok = res.status === payload.expect.status;
      validations.push({ name: "status", ok, details: ok ? undefined : `expected ${payload.expect.status}, got ${res.status}` });
    }
    if (payload.expect?.maxMs != null) {
      const ok = elapsedMs <= payload.expect.maxMs;
      validations.push({ name: "time", ok, details: ok ? undefined : `expected <= ${payload.expect.maxMs}ms, got ${elapsedMs}ms` });
    }

    const ok = validations.every((v) => v.ok);
    return { ok, status: res.status, elapsedMs, bodyText, validations };
  });

  ipcMain.handle("generate-api-scenarios", async (_event, payload: { baseUrl: string; context?: string }) => {
    const cfg = getConfig();
    if (!env.enableAi || !cfg.ai.enabled) {
      throw new Error("AI đang tắt. Bật ENABLE_AI=true trong .env và bật 'Enable AI' trong Config.");
    }
    if (!(cfg.ai.baseUrl ?? "").trim()) throw new Error("Chưa nhập Ollama Base URL.");
    if (!(cfg.ai.model ?? "").trim()) throw new Error("Chưa cấu hình Ollama model.");

    const maxScenarios = Math.max(1, Math.min(30, Math.trunc(cfg.ai.maxScenarios ?? 5)));
    const prompt = buildApiTestScenariosPrompt({
      baseUrl: payload.baseUrl,
      context: payload.context,
      maxScenarios,
      scenarioHint: cfg.ai.scenarioHint
    });
    const out = await ollamaGenerate({
      baseUrl: cfg.ai.baseUrl!.trim(),
      model: cfg.ai.model!.trim(),
      prompt,
      stream: false
    });
    return out.response?.trim() ?? "";
  });

  ipcMain.handle("get-metrics", async () => {
    const mem = process.memoryUsage();
    // Available in Electron main.
    const procInfo = await process.getProcessMemoryInfo();
    return {
      rssBytes: mem.rss,
      heapUsedBytes: mem.heapUsed,
      heapTotalBytes: mem.heapTotal,
      externalBytes: mem.external,
      electron: procInfo
    };
  });

  ipcMain.handle("test-ollama", async () => {
    const cfg = getConfig();
    const baseUrlRaw = (cfg.ai.baseUrl ?? "").trim().replace(/^`|`$/g, "");
    if (!baseUrlRaw) throw new Error("Chưa nhập Ollama Base URL.");
    const timeoutSec = Number.isFinite(cfg.ai.ollamaTimeoutSec as number) ? Number(cfg.ai.ollamaTimeoutSec) : 0.1;
    const timeoutMs = Math.max(50, Math.trunc(timeoutSec * 1000));

    function normalizeBaseUrl(input: string) {
      let u: URL;
      try {
        u = new URL(input);
      } catch {
        throw new Error("Ollama Base URL không hợp lệ. Ví dụ đúng: http://localhost:11434/");
      }
      if (u.pathname && u.pathname !== "/") {
        throw new Error("Ollama Base URL phải là URL gốc (không kèm path). Ví dụ đúng: http://localhost:11434/");
      }
      if (u.search || u.hash) {
        throw new Error("Ollama Base URL không được kèm query/hash.");
      }
      return `${u.origin}/`;
    }

    async function doFetch(u: string) {
      const ctrl = new AbortController();
      const t = setTimeout(() => ctrl.abort(), timeoutMs);
      try {
        // Use global fetch; Electron/Node provides it. AbortController works too.
        const res = await fetch(u, { signal: ctrl.signal });
        const text = await res.text();
        let json: unknown = null;
        try {
          json = JSON.parse(text);
        } catch {
          // ignore
        }
        return { ok: res.status === 200, status: res.status, url: u, json, text };
      } finally {
        clearTimeout(t);
      }
    }

    const baseUrl = normalizeBaseUrl(baseUrlRaw);
    const url = new URL("/api/tags", baseUrl).toString();
    try {
      return await doFetch(url);
    } catch (e) {
      // Common on macOS: localhost -> ::1 but Ollama binds IPv4 only.
      if (baseUrlRaw.includes("localhost")) {
        const ipv4Base = baseUrlRaw.replace("localhost", "127.0.0.1");
        const baseUrl2 = normalizeBaseUrl(ipv4Base);
        const url2 = new URL("/api/tags", baseUrl2).toString();
        try {
          return await doFetch(url2);
        } catch {
          // fallthrough
        }
      }
      throw e;
    }
  });

  ipcMain.handle("test-openai", async () => {
    const cfg = getConfig();
    const baseUrl = (cfg.ai.openaiBaseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
    const apiKey = (cfg.ai.openaiApiKey ?? "").trim();
    if (!apiKey) throw new Error("Chưa nhập OpenAI API key.");
    const timeoutSec = Number.isFinite(cfg.ai.openaiTimeoutSec as number) ? Number(cfg.ai.openaiTimeoutSec) : 0.1;
    const timeoutMs = Math.max(50, Math.trunc(timeoutSec * 1000));
    const url = `${baseUrl}/v1/models`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, {
      headers: { authorization: `Bearer ${apiKey}` },
      signal: ctrl.signal
    }).finally(() => clearTimeout(t));
    const text = await res.text();
    let json: unknown = null;
    try {
      json = JSON.parse(text);
    } catch {
      // ignore
    }
    return { ok: res.ok, status: res.status, url, json, text };
  });

  ipcMain.handle("list-openai-models", async () => {
    const cfg = getConfig();
    const baseUrl = (cfg.ai.openaiBaseUrl ?? "https://api.openai.com").replace(/\/+$/, "");
    const apiKey = (cfg.ai.openaiApiKey ?? "").trim();
    if (!apiKey) throw new Error("Chưa nhập OpenAI API key.");
    const timeoutSec = Number.isFinite(cfg.ai.openaiTimeoutSec as number) ? Number(cfg.ai.openaiTimeoutSec) : 0.1;
    const timeoutMs = Math.max(50, Math.trunc(timeoutSec * 1000));
    const url = `${baseUrl}/v1/models`;
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    const res = await fetch(url, { headers: { authorization: `Bearer ${apiKey}` }, signal: ctrl.signal }).finally(() => clearTimeout(t));
    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Không thể kết nối OpenAI (HTTP ${res.status}).`);
    }
    const json = JSON.parse(text) as { data?: Array<{ id: string }> };
    const ids = (json.data ?? []).map((m) => m.id).filter(Boolean).sort();
    return { url, models: ids };
  });
}

