import { contextBridge, ipcRenderer } from "electron";
import type { RunReport } from "../core/types";
import type { AppConfig } from "../core/config";
import type { RunRow } from "../db/repository/run.repo";
import type { StepRow } from "../db/repository/step.repo";

// Keep preload self-contained (no local requires) to avoid resolution/race issues in dev.
const IPC_CHANNELS = {
  runTest: "run-test",
  getConfig: "get-config",
  setConfig: "set-config",
  listRuns: "list-runs",
  getRun: "get-run"
} as const;

export type QaApi = {
  runTest: (input: { url: string }) => Promise<RunReport>;
  getConfig: () => Promise<AppConfig>;
  setConfig: (config: AppConfig) => Promise<boolean>;
  listRuns: (limit?: number) => Promise<RunRow[]>;
  getRun: (id: string) => Promise<{ run: RunRow; steps: StepRow[] } | null>;
  runApi: (input: {
    method: string;
    url: string;
    headers?: Record<string, string>;
    bodyType?: "none" | "raw" | "json" | "form_urlencoded" | "form_data" | "binary";
    bodyText?: string;
    bodyFields?: Array<{ key: string; value: string }>;
    binary?: { filename?: string; mime?: string; base64: string };
    timeoutMs?: number;
    expect?: { status?: number; maxMs?: number };
    insecureTls?: boolean;
    useCookieJar?: boolean;
  }) => Promise<{
    ok: boolean;
    status: number;
    elapsedMs: number;
    bodyText: string;
    validations: Array<{ name: string; ok: boolean; details?: string }>;
  }>;
  generateApiScenarios: (input: { baseUrl: string; context?: string }) => Promise<string>;
  getMetrics: () => Promise<{
    rssBytes: number;
    heapUsedBytes: number;
    heapTotalBytes: number;
    externalBytes: number;
    electron: any;
  }>;
  clearHistory: () => Promise<{
    before: { runs: number; steps: number };
    deleted: { runsDeleted: number; stepsDeleted: number };
    after: { runs: number; steps: number };
  }>;
  resetConfig: () => Promise<AppConfig>;
  testOllama: () => Promise<{ ok: boolean; status: number; url: string; json: any; text: string }>;
  testOpenAI: () => Promise<{ ok: boolean; status: number; url: string; json: any; text: string }>;
  listOpenAIModels: () => Promise<{ url: string; models: string[] }>;
  clearCookies: () => Promise<boolean>;
};

const qa: QaApi = {
  runTest: (input) => ipcRenderer.invoke(IPC_CHANNELS.runTest, input),
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.getConfig),
  setConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.setConfig, { config }),
  listRuns: (limit) => ipcRenderer.invoke(IPC_CHANNELS.listRuns, { limit }),
  getRun: (id) => ipcRenderer.invoke(IPC_CHANNELS.getRun, { id }),
  runApi: (input) => ipcRenderer.invoke("run-api", input),
  generateApiScenarios: (input) => ipcRenderer.invoke("generate-api-scenarios", input),
  getMetrics: () => ipcRenderer.invoke("get-metrics")
  ,
  clearHistory: () => ipcRenderer.invoke("clear-history"),
  resetConfig: () => ipcRenderer.invoke("reset-config")
  ,
  testOllama: () => ipcRenderer.invoke("test-ollama"),
  testOpenAI: () => ipcRenderer.invoke("test-openai"),
  listOpenAIModels: () => ipcRenderer.invoke("list-openai-models"),
  clearCookies: () => ipcRenderer.invoke("clear-cookies")
};

console.log("[preload] exposing window.qa");
contextBridge.exposeInMainWorld("qa", qa);

declare global {
  interface Window {
    qa: QaApi;
  }
}

