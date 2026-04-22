import React from "react";
import type { StepResult } from "@core/types";

function badgeClass(status: StepResult["status"]) {
  if (status === "pass") return "bg-emerald-400 text-slate-950";
  if (status === "fail") return "bg-red-400 text-slate-950";
  return "bg-sky-300 text-slate-950";
}

export function ResultList(props: { steps: StepResult[] }) {
  return (
    <div className="grid gap-2">
      <div className="font-extrabold">Steps</div>
      {props.steps.map((s) => (
        <div
          key={s.id}
          className="grid gap-1.5 rounded-xl border border-white/10 bg-black/20 p-3"
        >
          <div className="flex items-center justify-between gap-3">
            <div className="font-bold">{s.title}</div>
            <div
              className={[
                "rounded-full px-2 py-0.5 text-[11px] font-extrabold tracking-wide",
                badgeClass(s.status)
              ].join(" ")}
            >
              {s.status.toUpperCase()}
            </div>
          </div>
          {s.details ? <div className="text-sm text-slate-300">{s.details}</div> : null}
        </div>
      ))}
    </div>
  );
}

