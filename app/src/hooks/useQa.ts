import type { RunReport } from "@core/types";

export async function runTest(url: string): Promise<RunReport> {
  return await window.qa.runTest({ url });
}

