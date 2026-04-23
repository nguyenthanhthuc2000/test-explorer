import yaml from "js-yaml";

export type ImportKind = "curl" | "yaml" | "grpcurl" | "raw";

export type ImportedApiRequest = {
  name?: string;
  context?: string;
  method: string;
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, string>;
  body?: { type?: "none" | "raw" | "json" | "form_urlencoded" | "form_data"; text?: string; fields?: Array<{ key: string; value: string }> };
  timeoutMs?: number;
  expect?: { status?: number; maxMs?: number };
};

function unquote(s: string) {
  const t = s.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function tokenizeShellLike(input: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quote: "'" | '"' | null = null;
  let esc = false;
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (esc) {
      cur += ch;
      esc = false;
      continue;
    }
    if (quote) {
      if (quote === '"' && ch === "\\") {
        esc = true;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      cur += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (cur) out.push(cur), (cur = "");
      continue;
    }
    cur += ch;
  }
  if (cur) out.push(cur);
  return out;
}

function parseHeaderLine(line: string) {
  const idx = line.indexOf(":");
  if (idx <= 0) return null;
  const key = line.slice(0, idx).trim();
  const value = line.slice(idx + 1).trim();
  if (!key) return null;
  return { key, value };
}

export function importFromCurl(text: string): ImportedApiRequest[] {
  const tokens = tokenizeShellLike(text.trim());
  if (!tokens.length) throw new Error("cURL trống.");
  if (tokens[0] !== "curl") {
    // allow pasted "curl ..." or just the command without leading curl?
    // We'll still try to parse if it contains curl later, but this keeps errors clearer.
  }

  let method: string | undefined;
  const headers: Record<string, string> = {};
  let bodyText: string | undefined;
  let hasData = false;
  let bodyType: ImportedApiRequest["body"] extends infer B ? (B extends any ? B : never) : never;
  let url = "";
  const formFields: Array<{ key: string; value: string }> = [];

  function takeValue(i: number) {
    const v = tokens[i + 1];
    if (!v) throw new Error(`Thiếu value cho flag ${tokens[i]}`);
    return v;
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "curl") continue;
    if (!t.startsWith("-") && /^https?:\/\//i.test(t)) {
      url = t;
      continue;
    }
    if (t === "-X" || t === "--request") {
      method = takeValue(i);
      i++;
      continue;
    }
    if (t === "-I" || t === "--head") {
      method = "HEAD";
      continue;
    }
    if (t === "-H" || t === "--header") {
      const hv = takeValue(i);
      const parsed = parseHeaderLine(hv);
      if (parsed) headers[parsed.key] = parsed.value;
      i++;
      continue;
    }
    if (
      t === "-d" ||
      t === "--data" ||
      t === "--data-raw" ||
      t === "--data-binary" ||
      t === "--data-urlencode"
    ) {
      const dv = takeValue(i);
      bodyText = (bodyText ?? "") + (bodyText ? "&" : "") + dv;
      hasData = true;
      i++;
      continue;
    }
    if (t === "-F" || t === "--form") {
      const fv = takeValue(i);
      const eq = fv.indexOf("=");
      if (eq > 0) {
        const k = fv.slice(0, eq).trim();
        const v = fv.slice(eq + 1);
        if (k) formFields.push({ key: k, value: unquote(v) });
      }
      hasData = true;
      i++;
      continue;
    }
    // ignore other flags; keep URL if present
  }

  if (!url) {
    const maybeUrl = tokens.find((x) => /^https?:\/\//i.test(x));
    if (maybeUrl) url = maybeUrl;
  }
  if (!url) throw new Error("Không tìm thấy URL trong cURL.");

  if (!method) method = hasData ? "POST" : "GET";

  // best-effort detect json
  let body: ImportedApiRequest["body"] | undefined = undefined;
  const ctKey = Object.keys(headers).find((k) => k.toLowerCase() === "content-type");
  const contentType = ctKey ? headers[ctKey] : undefined;

  if (formFields.length) {
    body = { type: "form_data", fields: formFields };
  } else if (hasData) {
    const raw = bodyText ?? "";
    const looksJson = raw.trim().startsWith("{") || raw.trim().startsWith("[");
    if ((contentType ?? "").toLowerCase().includes("application/json") || looksJson) {
      body = { type: "json", text: raw };
      if (!contentType) headers["content-type"] = "application/json";
    } else {
      body = { type: "raw", text: raw };
    }
  } else {
    body = { type: "none" };
  }

  return [{ method: String(method).toUpperCase(), url, headers, body }];
}

export function importFromGrpcurl(text: string): ImportedApiRequest[] {
  const tokens = tokenizeShellLike(text.trim());
  if (!tokens.length) throw new Error("gRPCurl trống.");
  if (tokens[0] !== "grpcurl") {
    // still attempt
  }

  const headers: Record<string, string> = {};
  let dataText = "";
  let address = "";
  let fullMethod = "";
  let plaintext = false;
  let insecure = false;

  function takeValue(i: number) {
    const v = tokens[i + 1];
    if (!v) throw new Error(`Thiếu value cho flag ${tokens[i]}`);
    return v;
  }

  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i]!;
    if (t === "grpcurl") continue;
    if (t === "-H" || t === "--H" || t === "--header") {
      const hv = takeValue(i);
      const parsed = parseHeaderLine(hv);
      if (parsed) headers[parsed.key] = parsed.value;
      i++;
      continue;
    }
    if (t === "-d" || t === "--data") {
      dataText = takeValue(i);
      i++;
      continue;
    }
    if (t === "-plaintext") {
      plaintext = true;
      continue;
    }
    if (t === "-insecure") {
      insecure = true;
      continue;
    }
    if (!t.startsWith("-") && !address) {
      address = t;
      continue;
    }
    if (!t.startsWith("-")) {
      fullMethod = t;
      continue;
    }
  }

  if (!address || !fullMethod) {
    throw new Error("gRPCurl cần ít nhất: `grpcurl <address> <service/method>` (và có thể kèm -d, -H...).");
  }

  const scheme = plaintext ? "grpc" : "grpcs";
  const url = `${scheme}://${address}/${fullMethod.replace(/^\//, "")}`;
  const contextLines: string[] = [];
  contextLines.push("Imported from grpcurl (note: hiện tại app chưa hỗ trợ chạy gRPC, chỉ lưu để tham khảo).");
  if (insecure) contextLines.push("- flag: -insecure");
  if (plaintext) contextLines.push("- flag: -plaintext");
  return [
    {
      name: `gRPC ${fullMethod}`,
      context: contextLines.join("\n"),
      method: "POST",
      url,
      headers,
      body: dataText ? { type: "json", text: dataText } : { type: "none" }
    }
  ];
}

export function importFromRawJson(text: string): ImportedApiRequest[] {
  const raw = text.trim();
  if (!raw) throw new Error("Raw trống.");
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch {
    // Allow raw URL as shortcut
    if (/^https?:\/\//i.test(raw)) return [{ method: "GET", url: raw, headers: {}, body: { type: "none" } }];
    throw new Error("Raw phải là JSON hợp lệ (hoặc dán thẳng URL).");
  }
  const list = Array.isArray(parsed) ? parsed : [parsed];
  return list.map((x, idx) => {
    const method = String(x?.method ?? "GET").toUpperCase();
    const url = String(x?.url ?? "");
    if (!url) throw new Error(`Raw JSON item #${idx + 1} thiếu url.`);
    const headers = (x?.headers && typeof x.headers === "object") ? (x.headers as Record<string, string>) : {};
    const body: ImportedApiRequest["body"] | undefined =
      x?.body && typeof x.body === "object"
        ? {
            type: x.body.type,
            text: typeof x.body.text === "string" ? x.body.text : undefined,
            fields: Array.isArray(x.body.fields) ? x.body.fields : undefined
          }
        : x?.bodyText != null
          ? { type: x?.bodyType ?? "raw", text: String(x.bodyText) }
          : undefined;
    return {
      name: typeof x?.name === "string" ? x.name : `Imported ${idx + 1}`,
      context: typeof x?.context === "string" ? x.context : undefined,
      method,
      url,
      headers,
      body,
      timeoutMs: Number.isFinite(x?.timeoutMs) ? Number(x.timeoutMs) : undefined,
      expect: x?.expect
    };
  });
}

export function importFromYaml(text: string): ImportedApiRequest[] {
  const raw = text.trim();
  if (!raw) throw new Error("YAML trống.");
  let parsed: any;
  try {
    parsed = yaml.load(raw);
  } catch (e) {
    throw new Error(e instanceof Error ? e.message : "YAML không hợp lệ.");
  }
  if (!parsed) throw new Error("YAML rỗng.");
  const list = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.requests) ? parsed.requests : [parsed]);
  if (!Array.isArray(list) || list.length === 0) throw new Error("YAML không có request nào.");
  return list.map((x, idx) => {
    const method = String(x?.method ?? "GET").toUpperCase();
    const url = String(x?.url ?? "");
    if (!url) throw new Error(`YAML item #${idx + 1} thiếu url.`);
    const headers = (x?.headers && typeof x.headers === "object") ? (x.headers as Record<string, string>) : {};
    const body: ImportedApiRequest["body"] | undefined =
      x?.body && typeof x.body === "object"
        ? {
            type: x.body.type,
            text: typeof x.body.text === "string" ? x.body.text : undefined,
            fields: Array.isArray(x.body.fields) ? x.body.fields : undefined
          }
        : x?.bodyText != null
          ? { type: x?.bodyType ?? "raw", text: String(x.bodyText) }
          : undefined;
    return {
      name: typeof x?.name === "string" ? x.name : `Imported ${idx + 1}`,
      context: typeof x?.context === "string" ? x.context : undefined,
      method,
      url,
      headers,
      body,
      timeoutMs: Number.isFinite(x?.timeoutMs) ? Number(x.timeoutMs) : undefined,
      expect: x?.expect
    };
  });
}

export function importApiText(kind: ImportKind, text: string): ImportedApiRequest[] {
  if (kind === "curl") return importFromCurl(text);
  if (kind === "yaml") return importFromYaml(text);
  if (kind === "grpcurl") return importFromGrpcurl(text);
  return importFromRawJson(text);
}

