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
};

const qa: QaApi = {
  runTest: (input) => ipcRenderer.invoke(IPC_CHANNELS.runTest, input),
  getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.getConfig),
  setConfig: (config) => ipcRenderer.invoke(IPC_CHANNELS.setConfig, { config }),
  listRuns: (limit) => ipcRenderer.invoke(IPC_CHANNELS.listRuns, { limit }),
  getRun: (id) => ipcRenderer.invoke(IPC_CHANNELS.getRun, { id })
};

console.log("[preload] exposing window.qa");
contextBridge.exposeInMainWorld("qa", qa);

declare global {
  interface Window {
    qa: QaApi;
  }
}

