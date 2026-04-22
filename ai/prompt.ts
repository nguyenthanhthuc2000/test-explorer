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

