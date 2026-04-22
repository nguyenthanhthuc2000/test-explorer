export type OllamaGenerateRequest = {
  baseUrl: string;
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
};

export type OllamaGenerateResponse = {
  model: string;
  response: string;
  done: boolean;
};

function normalizeOllamaBaseUrl(input: string) {
  const raw = input.trim().replace(/^`|`$/g, "");
  if (!raw) throw new Error("Chưa nhập Ollama Base URL trong Config.");
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    throw new Error("Ollama Base URL không hợp lệ. Ví dụ đúng: http://localhost:11434/");
  }
  if (u.pathname && u.pathname !== "/") {
    throw new Error("Ollama Base URL phải là URL gốc (không kèm path). Ví dụ đúng: http://localhost:11434/");
  }
  if (u.search || u.hash) {
    throw new Error("Ollama Base URL không được kèm query/hash.");
  }
  // Normalize to origin with trailing slash.
  return `${u.origin}/`;
}

export async function ollamaGenerate(req: OllamaGenerateRequest): Promise<OllamaGenerateResponse> {
  const baseUrl = normalizeOllamaBaseUrl(req.baseUrl);
  const model = req.model.trim();
  if (!model) throw new Error("Chưa cấu hình Ollama model.");

  const url = new URL("/api/generate", baseUrl).toString();

  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model,
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

