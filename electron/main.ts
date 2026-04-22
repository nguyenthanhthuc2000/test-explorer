import { app, BrowserWindow } from "electron";
import path from "node:path";
import { registerTestIpc } from "./ipc/test.ipc";
import { initDb } from "../db/client";

const isDev = !app.isPackaged;

function createWindow() {
  const preloadPath = path.join(__dirname, "preload.js");
  console.log("[main] creating window, preload:", preloadPath);
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    backgroundColor: "#0b1220",
    webPreferences: {
      preload: preloadPath,
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  if (isDev) {
    win.loadURL("http://localhost:5173");
    win.webContents.openDevTools({ mode: "detach" });
  } else {
    win.loadFile(path.join(__dirname, "../renderer/index.html"));
  }

  win.webContents.on("did-finish-load", async () => {
    try {
      const hasQa = await win.webContents.executeJavaScript("Boolean(window.qa)", true);
      console.log("[main] did-finish-load, window.qa =", hasQa);
    } catch (e) {
      console.log("[main] did-finish-load check failed:", e);
    }
  });

  win.webContents.on("console-message", (_event, level, message) => {
    // Forward renderer/preload console to terminal for debugging.
    console.log(`[renderer:${level}] ${message}`);
  });

  return win;
}

app.whenReady().then(() => {
  initDb({ userDataDir: app.getPath("userData") });
  registerTestIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});

