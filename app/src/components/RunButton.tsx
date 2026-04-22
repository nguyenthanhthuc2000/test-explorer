import React from "react";

export function RunButton(props: {
  running: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      disabled={props.disabled}
      onClick={props.onClick}
      className="rounded-xl bg-blue-500 px-4 py-3 text-sm font-bold text-white hover:bg-blue-400 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {props.running ? "Running..." : "Run Test"}
    </button>
  );
}

