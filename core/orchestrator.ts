import { env } from "../config/env";
import { ollamaGenerate } from "../ai/ollama";
import { buildNextActionPrompt } from "../ai/prompt";
import type { RunReport } from "./types";
import { getConfig } from "../db/repository/config.repo";
import { insertRun } from "../db/repository/run.repo";
import { insertSteps } from "../db/repository/step.repo";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function runOrchestrator(input: { url: string }): Promise<RunReport> {
  const cfg = getConfig();
  const runId = newId();
  const startedAt = new Date().toISOString();

  const steps: RunReport["steps"] = [
    { id: newId(), title: "Open target URL", status: "info", details: input.url },
    {
      id: newId(),
      title: "Selected modules",
      status: "info",
      details: Object.entries(cfg.modules)
        .filter(([, v]) => v)
        .map(([k]) => k)
        .join(", ")
    },
    { id: newId(), title: "Crawl (placeholder)", status: "info", details: `maxDepth=${cfg.crawl.maxDepth}, maxPages=${cfg.crawl.maxPages}` },
    { id: newId(), title: "Validators (placeholder)", status: "info", details: "TODO: console/network/ui validators" }
  ];

  let aiSummary: string | undefined;
  if (env.enableAi && cfg.ai.enabled) {
    const prompt = buildNextActionPrompt({
      url: input.url,
      pageSummary: "Placeholder page summary (no browser yet).",
      recentActions: ["navigate(url)"]
    });
    const out = await ollamaGenerate({ prompt, stream: false });
    aiSummary = out.response?.trim() || undefined;
  }

  const report: RunReport = {
    runId,
    url: input.url,
    status: "completed",
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    aiSummary
  };

  insertRun(report, JSON.stringify(cfg));
  insertSteps(report.runId, report.steps);

  return report;
}

