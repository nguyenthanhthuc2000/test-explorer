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

export function buildApiBodyCasesPrompt(input: {
  method: string;
  url: string;
  headers?: Record<string, string>;
  bodyType?: "none" | "raw" | "json" | "form_urlencoded" | "form_data" | "binary";
  bodyExample?: string;
  context?: string;
  maxCases: number;
}) {
  const safeHeaders = input.headers && Object.keys(input.headers).length ? JSON.stringify(input.headers) : "{}";
  return [
    `Role: Senior QA/SDET.`,
    `Task: Generate high-quality API request BODY test cases for ONE endpoint.`,
    ``,
    `You MUST return ONLY strict JSON (no markdown, no prose outside JSON).`,
    `JSON schema (exact keys):`,
    `{"cases":[{"name":"string","description":"string","expectStatus":number,"body":"string"}]}`,
    ``,
    `Output constraints:`,
    `- cases.length must be between 1 and ${input.maxCases}`,
    `- Use ONLY double quotes in JSON.`,
    `- No trailing commas, no comments, no code fences.`,
    `- Every array element MUST be a JSON object, NOT a quoted string.`,
    `- Between objects in arrays, you MUST use comma: "},{". Never write ",\"{\"...\"}".`,
    `- Before responding, mentally validate that the JSON parses (e.g., can be parsed by JSON.parse).`,
    ``,
    `Case quality rules:`,
    `- name: short, unique, descriptive (e.g. "Happy path", "Missing required field: ...").`,
    `- description: explain intent + what should happen (validation error / auth error / success).`,
    `- expectStatus: HTTP status expected for this case.`,
    `- body: MUST be a STRING representing the raw request body to send.`,
    `  - If bodyType=json => body must be a parseable JSON string.`,
    `  - If bodyType=form_urlencoded => body should look like "a=1&b=two".`,
    `  - If bodyType=form_data => body is still a string (use JSON string representing key/value pairs).`,
    `  - If bodyType=none => body should be an empty string "" and focus on headers/auth scenarios.`,
    ``,
    `Coverage requirements (think like a senior):`,
    `- Include: 1+ happy path, 2+ negative validations, 1+ boundary/edge case, 1+ security/auth-related case if Context implies it.`,
    `- If Context mentions cookies/csrf/jwt/permissions, generate explicit cases to verify missing/invalid tokens.`,
    `- If Context defines field rules (type, range, format), generate cases that directly test those rules.`,
    `- Prefer realistic payloads and meaningful descriptions.`,
    ``,
    `Formatting example (copy this style):`,
    `{"cases":[`,
    `  {"name":"Happy path","description":"Valid payload should succeed","expectStatus":200,"body":"{\\"a\\":1}"},`,
    `  {"name":"Missing required field: a","description":"Omit a should fail validation","expectStatus":422,"body":"{\\"b\\":2}"}`,
    `]}`,
    `The example above demonstrates correct commas/brackets/quotes. Your output must follow the same strict JSON rules.`,
    ``,
    `Input (authoritative):`,
    `method: ${String(input.method ?? "").toUpperCase()}`,
    `url: ${input.url}`,
    `headers: ${safeHeaders} (note: headers are informational only; focus on body cases)`,
    `bodyType: ${input.bodyType ?? "raw"}`,
    input.bodyExample?.trim() ? `bodyExample (reference only): ${input.bodyExample.trim()}` : `bodyExample: (none)`,
    input.context?.trim()
      ? `Context (domain rules, IO expectations, auth requirements): ${input.context.trim()}`
      : `Context: (none)`
  ].join("\n");
}

