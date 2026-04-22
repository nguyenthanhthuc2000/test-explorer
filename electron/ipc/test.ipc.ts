import { ipcMain } from "electron";
import { runOrchestrator } from "../../core/orchestrator";

export const IPC_CHANNELS = {
  runTest: "run-test"
} as const;

export function registerTestIpc() {
  ipcMain.handle(IPC_CHANNELS.runTest, async (_event, payload: { url: string }) => {
    return await runOrchestrator({ url: payload.url });
  });
}

