"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildNextActionPrompt = buildNextActionPrompt;
function buildNextActionPrompt(input) {
    return [
        `You are an assistant helping decide the next QA exploration action.`,
        `Return a short suggestion (1-3 actions) with selectors if possible.`,
        ``,
        `URL: ${input.url}`,
        `Page summary: ${input.pageSummary}`,
        `Recent actions: ${input.recentActions.join(" | ") || "(none)"}`
    ].join("\n");
}
