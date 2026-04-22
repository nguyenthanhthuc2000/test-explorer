export type Env = {
  enableAi: boolean;
};

function readBool(v: string | undefined, fallback: boolean) {
  if (v == null) return fallback;
  return ["1", "true", "yes", "on"].includes(v.toLowerCase());
}

export const env: Env = {
  enableAi: readBool(process.env.ENABLE_AI, false)
};

