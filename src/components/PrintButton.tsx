"use client";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print rounded bg-brand px-3 py-1.5 text-sm font-medium text-white"
    >
      {label}
    </button>
  );
}
