import React, { useState } from "react";
import type { AppConfig, AppMode } from "@core/config";
import { defaultConfig } from "@core/config";
import { qa } from "../lib/qa";

export function ModeSelect(props: { config: AppConfig | null; onSelected: (mode: AppMode) => void }) {
  const [saving, setSaving] = useState<AppMode | null>(null);
  const cfg = props.config ?? defaultConfig;

  async function selectMode(mode: AppMode) {
    setSaving(mode);
    const next: AppConfig = { ...cfg, mode };
    await qa().setConfig(next);
    props.onSelected(mode);
    setSaving(null);
  }

  return (
    <div className="grid gap-4">
      <div>
        <div className="text-base font-extrabold">Chọn mode</div>
        <div className="text-sm text-slate-300">Bạn có thể đổi mode lại trong Config bất kỳ lúc nào.</div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <button
          onClick={() => selectMode("web")}
          disabled={saving !== null}
          className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:bg-white/5 disabled:opacity-60"
        >
          <div className="text-sm font-extrabold">Web / UI mode</div>
          <div className="mt-1 text-sm text-slate-300">
            Crawl + UI interaction + console/network (qua browser). Dùng cho app web end-to-end.
          </div>
          <div className="mt-3 text-xs text-slate-400">Dành cho `documents/step.md` (Phase 1/2).</div>
        </button>

        <button
          onClick={() => selectMode("api")}
          disabled={saving !== null}
          className="rounded-2xl border border-white/10 bg-black/20 p-4 text-left hover:bg-white/5 disabled:opacity-60"
        >
          <div className="text-sm font-extrabold">API test mode</div>
          <div className="mt-1 text-sm text-slate-300">
            Gửi request all methods (GET/POST/PUT/PATCH/DELETE/…). Validate status/time/body theo rule.
          </div>
          <div className="mt-3 text-xs text-slate-400">Dành cho test API thuần, không cần UI.</div>
        </button>
      </div>

      {saving ? <div className="text-sm text-slate-400">Saving...</div> : null}
    </div>
  );
}

