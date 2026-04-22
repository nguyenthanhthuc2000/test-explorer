import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  root: path.resolve(__dirname, "app"),
  plugins: [react()],
  resolve: {
    alias: {
      "@app": path.resolve(__dirname, "app/src"),
      "@core": path.resolve(__dirname, "core"),
      "@ai": path.resolve(__dirname, "ai"),
      "@db": path.resolve(__dirname, "db"),
      "@report": path.resolve(__dirname, "report"),
      "@pw": path.resolve(__dirname, "playwright")
    }
  },
  build: {
    outDir: path.resolve(__dirname, "dist/renderer"),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    strictPort: true
  }
});

