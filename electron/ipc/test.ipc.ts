import { ipcMain } from "electron";
import { runOrchestrator } from "../../core/orchestrator";
import { getConfig, setConfig } from "../../db/repository/config.repo";
import { getRun, listRuns } from "../../db/repository/run.repo";
import { listSteps } from "../../db/repository/step.repo";
import type { AppConfig } from "../../core/config";
import { IPC_CHANNELS } from "./channels";

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

  ipcMain.handle(IPC_CHANNELS.getRun, async (_event, payload: { id: string }) => {
    const run = getRun(payload.id);
    if (!run) return null;
    const steps = listSteps(payload.id);
    return { run, steps };
  });
}

