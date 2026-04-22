"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ollamaGenerate = ollamaGenerate;
const env_1 = require("../config/env");
async function ollamaGenerate(req) {
    const url = new URL("/api/generate", env_1.env.ollamaBaseUrl).toString();
    const res = await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
            model: req.model ?? env_1.env.ollamaModel,
            prompt: req.prompt,
            system: req.system,
            stream: req.stream ?? false
        })
    });
    if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`Ollama error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
    }
    return (await res.json());
}
