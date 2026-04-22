import { env } from "../config/env";

export type OllamaGenerateRequest = {
  model?: string;
  prompt: string;
  system?: string;
  stream?: boolean;
};

export type OllamaGenerateResponse = {
  model: string;
  response: string;
  done: boolean;
};

export async function ollamaGenerate(req: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
  const url = new URL("/api/generate", env.ollamaBaseUrl).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: req.model ?? env.ollamaModel,
      prompt: req.prompt,
      system: req.system,
      stream: req.stream ?? false
    })
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  return (await res.json()) as OllamaGenerateResponse;
}

