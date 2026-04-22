"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.runOrchestrator = runOrchestrator;
const env_1 = require("../config/env");
const ollama_1 = require("../ai/ollama");
const prompt_1 = require("../ai/prompt");
function newId() {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}
async function runOrchestrator(input) {
    const runId = newId();
    const startedAt = new Date().toISOString();
    const steps = [
        { id: newId(), title: "Open target URL", status: "info", details: input.url },
        { id: newId(), title: "Crawl (placeholder)", status: "info", details: "TODO: Playwright crawler" },
        { id: newId(), title: "Validate (placeholder)", status: "info", details: "TODO: console/network validators" }
    ];
    let aiSummary;
    if (env_1.env.enableAi) {
        const prompt = (0, prompt_1.buildNextActionPrompt)({
            url: input.url,
            pageSummary: "Placeholder page summary (no browser yet).",
            recentActions: ["navigate(url)"]
        });
        const out = await (0, ollama_1.ollamaGenerate)({ prompt, stream: false });
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
