import React from "react";

export function InputUrl(props: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="url"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder="https://your-app.com"
      spellCheck={false}
      autoCapitalize="none"
      autoCorrect="off"
      inputMode="url"
      className="min-w-[320px] flex-1 rounded-xl border border-white/15 bg-black/30 px-3 py-3 text-sm text-slate-100 outline-none ring-0 placeholder:text-slate-500 focus:border-white/25 focus:outline-none"
    />
  );
}

