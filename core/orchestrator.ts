import { env } from "../config/env";
import { ollamaGenerate } from "../ai/ollama";
import { buildNextActionPrompt, buildTestScenariosPrompt } from "../ai/prompt";
import type { RunReport } from "./types";
import { getConfig } from "../db/repository/config.repo";
import { insertRun } from "../db/repository/run.repo";
import { insertSteps } from "../db/repository/step.repo";
import type { AppConfig, TestModuleKey } from "./config";
import { openPage } from "../playwright/browser";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

const moduleLabels: Record<TestModuleKey, string> = {
  ui_interaction: "UI interaction",
  navigation: "Navigation / flow",
  form: "Form testing",
  api_network: "API / network",
  console_error: "Console errors",
  visual: "Visual testing"
};

function enabledModules(cfg: AppConfig) {
  return (Object.keys(cfg.modules) as TestModuleKey[]).filter((k) => cfg.modules[k]);
}

function buildModuleSteps(cfg: AppConfig) {
  const modules = enabledModules(cfg);
  if (modules.length === 0) {
    return [
      {
        id: newId(),
        title: "No modules selected",
        status: "fail" as const,
        details: "Bạn đang tắt hết module. Hãy bật ít nhất 1 module trong Config."
      }
    ];
  }

  const steps: RunReport["steps"] = [];

  for (const k of modules) {
    steps.push({
      id: newId(),
      title: `[${moduleLabels[k]}] Plan`,
      status: "info",
      details: "TODO: build real engine per module (Playwright crawler/executor/validators)."
    });

    if (k === "ui_interaction") {
      steps.push({
        id: newId(),
        title: `[${moduleLabels[k]}] Click & basic interactions`,
        status: "info",
        details: "Placeholder: sẽ detect element không click được / UI crash."
      });
    } else if (k === "navigation") {
      steps.push({
        id: newId(),
        title: `[${moduleLabels[k]}] Crawl links & detect dead/loop`,
        status: "info",
        details: `Placeholder BFS: maxDepth=${cfg.crawl.maxDepth}, maxPages=${cfg.crawl.maxPages}`
      });
    } else if (k === "form") {
      steps.push({
        id: newId(),
        title: `[${moduleLabels[k]}] Fill + submit + validate`,
        status: "info",
        details: "Placeholder: sẽ thử data invalid/empty và check validation messages."
      });
    } else if (k === "api_network") {
      steps.push({
        id: newId(),
        title: `[${moduleLabels[k]}] Intercept requests`,
        status: "info",
        details: "Placeholder: sẽ check status code 4xx/5xx, timeout, failed requests."
      });
    } else if (k === "console_error") {
      steps.push({
        id: newId(),
        title: `[${moduleLabels[k]}] Capture console errors`,
        status: "info",
        details: "Placeholder: sẽ fail nếu có Uncaught/SEVERE warnings."
      });
    } else if (k === "visual") {
      steps.push({
        id: newId(),
        title: `[${moduleLabels[k]}] Screenshot diff`,
        status: "info",
        details: "Placeholder: sẽ so sánh baseline vs current (phase 3)."
      });
    }
  }

  return steps;
}

export async function runOrchestrator(input: { url: string }): Promise<RunReport> {
  const cfg = getConfig();
  const runId = newId();
  const startedAt = new Date().toISOString();

  const steps: RunReport["steps"] = [];
  steps.push({ id: newId(), title: "Open target URL", status: "info", details: input.url });
  steps.push({
    id: newId(),
    title: "Selected modules",
    status: "info",
    details: enabledModules(cfg).map((k) => moduleLabels[k]).join(", ")
  });
  if (cfg.context?.trim()) {
    steps.push({ id: newId(), title: "AI context", status: "info", details: cfg.context.trim() });
  }

  const modules = enabledModules(cfg);
  if (modules.length === 0) {
    steps.push({
      id: newId(),
      title: "No modules selected",
      status: "fail",
      details: "Bạn đang tắt hết module. Hãy bật ít nhất 1 module trong Config."
    });
  }

  // Real MVP execution for high-value modules.
  let consoleErrors: string[] = [];
  let pageErrors: string[] = [];
  let failedRequests: string[] = [];
  let badResponses: string[] = [];

  if (modules.length > 0 && (cfg.modules.console_error || cfg.modules.api_network)) {
    const session = await openPage(input.url);
    try {
      session.page.on("pageerror", (err) => {
        pageErrors.push(String(err?.message ?? err));
      });
      session.page.on("console", (msg) => {
        const type = msg.type();
        if (type === "error") consoleErrors.push(msg.text());
      });
      session.page.on("requestfailed", (req) => {
        const fail = req.failure();
        failedRequests.push(`${req.method()} ${req.url()}${fail?.errorText ? ` - ${fail.errorText}` : ""}`);
      });
      session.page.on("response", (res) => {
        const status = res.status();
        if (status >= 400) badResponses.push(`${status} ${res.request().method()} ${res.url()}`);
      });

      // Give the page a moment to settle and emit console/network events.
      await session.page.waitForTimeout(2500);
    } finally {
      await session.close();
    }
  }

  // AI scenarios (optional): generate a bounded test plan.
  if (env.enableAi && cfg.ai.enabled) {
    const maxScenarios = Math.max(1, Math.min(30, Math.trunc(cfg.ai.maxScenarios ?? 5)));
    try {
      if ((cfg.ai.provider ?? "ollama") !== "ollama") {
        throw new Error("Hiện tại chỉ hỗ trợ AI provider: Ollama.");
      }
      const baseUrl = (cfg.ai.baseUrl ?? "").trim();
      if (!baseUrl) throw new Error("Chưa nhập Ollama Base URL trong Config.");
      const model = (cfg.ai.model ?? "").trim();
      if (!model) throw new Error("Chưa cấu hình Ollama model.");

      const prompt = buildTestScenariosPrompt({
        url: input.url,
        context: cfg.context,
        enabledModules: modules.map((m) => moduleLabels[m]),
        maxScenarios,
        scenarioHint: cfg.ai.scenarioHint
      });
      const out = await ollamaGenerate({
        baseUrl,
        model,
        prompt,
        stream: false
      });
      const raw = out.response?.trim() ?? "";

      const jsonStart = raw.indexOf("{");
      const jsonEnd = raw.lastIndexOf("}");
      const jsonText = jsonStart >= 0 && jsonEnd >= 0 ? raw.slice(jsonStart, jsonEnd + 1) : "";
      const parsed = jsonText ? (JSON.parse(jsonText) as { scenarios?: Array<{ title?: string; goal?: string; steps?: string[]; assertions?: string[] }> }) : null;
      const scenarios = parsed?.scenarios ?? [];

      steps.push({
        id: newId(),
        title: "AI scenarios (plan)",
        status: scenarios.length ? "info" : "fail",
        details: scenarios.length
          ? scenarios
              .slice(0, maxScenarios)
              .map((s, i) => {
                const lines: string[] = [];
                lines.push(`${i + 1}. ${s.title ?? "Untitled"}`);
                if (s.goal) lines.push(`   Goal: ${s.goal}`);
                if (s.steps?.length) lines.push(...s.steps.slice(0, 12).map((x) => `   - ${x}`));
                if (s.assertions?.length) lines.push(...s.assertions.slice(0, 10).map((x) => `   Assert: ${x}`));
                return lines.join("\n");
              })
              .join("\n\n")
          : "AI không trả về JSON scenarios hợp lệ."
      });
    } catch (e) {
      steps.push({
        id: newId(),
        title: "AI scenarios (plan)",
        status: "fail",
        details: e instanceof Error ? e.message : String(e)
      });
    }
  }

  // Build per-module steps (some are real, some placeholders).
  steps.push(...buildModuleSteps(cfg));

  if (cfg.modules.console_error) {
    const errs = [...pageErrors, ...consoleErrors].filter(Boolean);
    steps.push({
      id: newId(),
      title: `[${moduleLabels.console_error}] Result`,
      status: errs.length ? "fail" : "pass",
      details: errs.length ? errs.slice(0, 20).join("\n") : "No pageerror / console.error detected."
    });
  }

  if (cfg.modules.api_network) {
    const issues = [...failedRequests, ...badResponses].filter(Boolean);
    steps.push({
      id: newId(),
      title: `[${moduleLabels.api_network}] Result`,
      status: issues.length ? "fail" : "pass",
      details: issues.length ? issues.slice(0, 20).join("\n") : "No failed requests / 4xx/5xx responses detected."
    });
  }

  let aiSummary: string | undefined;
  if (env.enableAi && cfg.ai.enabled) {
    try {
      if ((cfg.ai.provider ?? "ollama") !== "ollama") {
        throw new Error("Hiện tại chỉ hỗ trợ AI provider: Ollama.");
      }
      const baseUrl = (cfg.ai.baseUrl ?? "").trim();
      if (!baseUrl) throw new Error("Chưa nhập Ollama Base URL trong Config.");
      const model = (cfg.ai.model ?? "").trim();
      if (!model) throw new Error("Chưa cấu hình Ollama model.");

      const prompt = buildNextActionPrompt({
        url: input.url,
        pageSummary: "Placeholder page summary (no browser yet).",
        recentActions: ["navigate(url)"],
        context: cfg.context
      });
      const out = await ollamaGenerate({
        baseUrl,
        model,
        prompt,
        stream: false
      });
      aiSummary = out.response?.trim() || undefined;
    } catch (e) {
      steps.push({
        id: newId(),
        title: "AI summary",
        status: "fail",
        details: e instanceof Error ? e.message : String(e)
      });
    }
  }

  const report: RunReport = {
    runId,
    url: input.url,
    status: steps.some((s) => s.status === "fail") ? "failed" : "completed",
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    aiSummary
  };

  insertRun(report, JSON.stringify(cfg));
  insertSteps(report.runId, report.steps);

  return report;
}

