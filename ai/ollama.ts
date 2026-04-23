export type OllamaGenerateRequest = {
  baseUrl: string;
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  timeoutMs?: number;
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

  function urlFor(base: string) {
    return new URL("/api/generate", base).toString();
  }

  const timeoutMs = Number.isFinite(req.timeoutMs as number) ? Math.max(1000, Math.trunc(req.timeoutMs as number)) : 30_000;
  async function doFetch(url: string) {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), timeoutMs);
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          model: "llama3.2",
          prompt: req.prompt,
          system: req.system,
          stream: req.stream ?? false
        }),
        signal: ctrl.signal
      });
    } catch (e: any) {
      if (e?.name === "AbortError") {
        throw new Error(`Ollama timeout sau ${timeoutMs}ms. Hãy tăng Ollama timeout trong Config.`);
      }
      throw e;
    } finally {
      clearTimeout(t);
    }
  }

  let res: Response;
  try {
    res = await doFetch(urlFor(baseUrl));
  } catch (e: any) {
    // Common on macOS: localhost resolves to ::1 but Ollama binds IPv4 only.
    if ((baseUrl ?? "").includes("localhost")) {
      const base2 = baseUrl.replace("localhost", "127.0.0.1");
      res = await doFetch(urlFor(base2));
    } else {
      throw e;
    }
  }

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Ollama error: ${res.status} ${res.statusText}${text ? ` - ${text}` : ""}`);
  }

  return (await res.json()) as OllamaGenerateResponse;
}

