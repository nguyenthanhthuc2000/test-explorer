"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.env = void 0;
function readBool(v, fallback) {
    if (v == null)
        return fallback;
    return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}
exports.env = {
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
    ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
    enableAi: readBool(process.env.ENABLE_AI, false)
};
