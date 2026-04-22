import type { QaApi } from "../../../electron/preload";

export function qa(): QaApi {
  const api = (window as unknown as { qa?: QaApi }).qa;
  if (!api) {
    throw new Error(
      "Không thấy window.qa. Bạn đang mở UI bằng browser (Vite) hay preload Electron chưa load? Hãy chạy bằng Electron qua `npm run dev`."
    );
  }
  return api;
}

