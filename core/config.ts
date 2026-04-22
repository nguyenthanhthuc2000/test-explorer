export type TestModuleKey =
  | "ui_interaction"
  | "navigation"
  | "form"
  | "api_network"
  | "console_error"
  | "visual";

export type AppConfig = {
  targetUrl: string;
  context?: string;
  crawl: {
    maxDepth: number;
    maxPages: number;
  };
  modules: Record<TestModuleKey, boolean>;
  ai: {
    enabled: boolean;
  };
};

export const defaultConfig: AppConfig = {
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
  ai: { enabled: false }
};

