export type RunStatus = "queued" | "running" | "completed" | "failed";

export type StepResult = {
  id: string;
  title: string;
  status: "pass" | "fail" | "info";
  details?: string;
};

export type RunReport = {
  runId: string;
  url: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  steps: StepResult[];
  aiSummary?: string;
};

