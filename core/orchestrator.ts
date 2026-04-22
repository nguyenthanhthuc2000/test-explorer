import { env } from "../config/env";
import { ollamaGenerate } from "../ai/ollama";
import { buildNextActionPrompt } from "../ai/prompt";
import type { RunReport } from "./types";

function newId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export async function runOrchestrator(input: { url: string }): Promise<RunReport> {
  const runId = newId();
  const startedAt = new Date().toISOString();

  const steps: RunReport["steps"] = [
    { id: newId(), title: "Open target URL", status: "info", details: input.url },
    { id: newId(), title: "Crawl (placeholder)", status: "info", details: "TODO: Playwright crawler" },
    { id: newId(), title: "Validate (placeholder)", status: "info", details: "TODO: console/network validators" }
  ];

  let aiSummary: string | undefined;
  if (env.enableAi) {
    const prompt = buildNextActionPrompt({
      url: input.url,
      pageSummary: "Placeholder page summary (no browser yet).",
      recentActions: ["navigate(url)"]
    });
    const out = await ollamaGenerate({ prompt, stream: false });
    aiSummary = out.response?.trim() || undefined;
  }

  return {
    runId,
    url: input.url,
    status: "completed",
    startedAt,
    finishedAt: new Date().toISOString(),
    steps,
    aiSummary
  };
}

