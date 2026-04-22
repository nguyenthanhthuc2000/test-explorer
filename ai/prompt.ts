export function buildNextActionPrompt(input: {
  url: string;
  pageSummary: string;
  recentActions: string[];
  context?: string;
}) {
  return [
    `You are an assistant helping decide the next QA exploration action.`,
    `Return a short suggestion (1-3 actions) with selectors if possible.`,
    ``,
    `URL: ${input.url}`,
    input.context?.trim() ? `Context: ${input.context.trim()}` : `Context: (none)`,
    `Page summary: ${input.pageSummary}`,
    `Recent actions: ${input.recentActions.join(" | ") || "(none)"}`
  ].join("\n");
}

export function buildTestScenariosPrompt(input: {
  url: string;
  context?: string;
  enabledModules: string[];
  maxScenarios: number;
  scenarioHint?: string;
}) {
  return [
    `You are a QA lead generating test scenarios for an AI-driven web testing tool.`,
    `Return ONLY valid JSON (no markdown) in this shape:`,
    `{"scenarios":[{"title":"...","goal":"...","steps":["..."],"assertions":["..."]}]}`,
    ``,
    `Constraints:`,
    `- scenarios.length must be between 1 and ${input.maxScenarios}`,
    `- Each scenario must be concise (3-8 steps, 1-5 assertions).`,
    `- Prefer scenarios that match enabled modules: ${input.enabledModules.join(", ") || "(none)"}`,
    `- If context is provided, use it to make scenarios domain-specific.`,
    ``,
    `URL: ${input.url}`,
    input.context?.trim() ? `Context: ${input.context.trim()}` : `Context: (none)`,
    input.scenarioHint?.trim() ? `User hint: ${input.scenarioHint.trim()}` : `User hint: (none)`
  ].join("\n");
}

export function buildApiTestScenariosPrompt(input: {
  baseUrl: string;
  context?: string;
  maxScenarios: number;
  scenarioHint?: string;
}) {
  return [
    `You are a QA lead generating API test scenarios.`,
    `Return ONLY valid JSON (no markdown) in this shape:`,
    `{"scenarios":[{"title":"...","requests":[{"method":"GET","url":"...","headers":{"k":"v"},"body":"optional"}],"expects":[{"requestIndex":0,"status":200,"maxMs":1000,"bodyContains":"optional"}]}]}`,
    ``,
    `Constraints:`,
    `- scenarios.length must be between 1 and ${input.maxScenarios}`,
    `- Use common HTTP methods (GET/POST/PUT/PATCH/DELETE).`,
    `- Keep it practical: health checks, auth, CRUD, permissions, error cases.`,
    ``,
    `Base URL / example endpoint: ${input.baseUrl}`,
    input.context?.trim() ? `Context: ${input.context.trim()}` : `Context: (none)`,
    input.scenarioHint?.trim() ? `User hint: ${input.scenarioHint.trim()}` : `User hint: (none)`
  ].join("\n");
}

