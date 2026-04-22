import { contextBridge, ipcRenderer } from "electron";
import type { RunReport } from "../core/types";
import { IPC_CHANNELS } from "./ipc/test.ipc";

export type QaApi = {
  runTest: (input: { url: string }) => Promise<RunReport>;
};

const qa: QaApi = {
  runTest: (input) => ipcRenderer.invoke(IPC_CHANNELS.runTest, input)
};

contextBridge.exposeInMainWorld("qa", qa);

declare global {
  interface Window {
    qa: QaApi;
  }
}

