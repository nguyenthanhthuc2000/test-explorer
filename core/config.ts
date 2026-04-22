export type TestModuleKey =
  | "ui_interaction"
  | "navigation"
  | "form"
  | "api_network"
  | "console_error"
  | "visual";

export type AppMode = "web" | "api";

export type AppConfig = {
  mode: AppMode;
  targetUrl: string;
  context?: string;
  crawl: {
    maxDepth: number;
    maxPages: number;
  };
  modules: Record<TestModuleKey, boolean>;
  ai: {
    enabled: boolean;
    provider?: "ollama" | "openai";
    baseUrl?: string;
    model?: string;
    ollamaTimeoutSec?: number;
    openaiBaseUrl?: string;
    openaiApiKey?: string;
    openaiModel?: string;
    openaiTimeoutSec?: number;
    maxScenarios: number;
    scenarioHint?: string;
  };
};

export const defaultConfig: AppConfig = {
  mode: "web",
  targetUrl: "https://example.com",
  context: "",
  crawl: { maxDepth: 2, maxPages: 30 },
  modules: {
    ui_interaction: true,
    navigation: true,
    form: false,
    api_network: false,
    console_error: true,
    visual: false
  },
  ai: {
    enabled: false,
    provider: "ollama",
    baseUrl: "",
    model: "llama3.2",
    ollamaTimeoutSec: 0.1,
    openaiBaseUrl: "https://api.openai.com",
    openaiApiKey: "",
    openaiModel: "gpt-4.1-mini",
    openaiTimeoutSec: 0.1,
    maxScenarios: 5,
    scenarioHint: ""
  }
};

