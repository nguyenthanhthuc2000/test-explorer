import type { QaApi } from "../../../electron/preload";

export function qa(): QaApi {
  const api = (window as unknown as { qa?: QaApi }).qa;
  if (!api) {
    throw new Error(
      "Không thấy window.qa. Bạn đang mở UI bằng browser (Vite) hay preload Electron chưa load? Hãy chạy bằng Electron qua `npm run dev`."
    );
  }
  // Dev note: Electron preload changes require restarting the Electron process.
  if (typeof (api as any).generateApiBodyCases !== "function") {
    throw new Error(
      "Thiếu hàm window.qa.generateApiBodyCases. Có thể Electron preload đang chạy bản cũ. Hãy stop `npm run dev` và chạy lại để reload preload."
    );
  }
  return api;
}

