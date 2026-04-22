export type Env = {
  ollamaBaseUrl: string;
  ollamaModel: string;
  enableAi: boolean;
};

function readBool(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const env: Env = {
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL ?? "http://localhost:11434",
  ollamaModel: process.env.OLLAMA_MODEL ?? "llama3.2",
  enableAi: readBool(process.env.ENABLE_AI, false)
};

