"use client";

export function PrintButton({ label = "Print / save as PDF" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print inline-flex h-8 items-center gap-2 rounded-md bg-ink px-3 text-[13px] font-medium text-canvas transition-opacity hover:opacity-90"
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M4.5 6V2.5h7V6M4.5 11.5h-2v-5h11v5h-2M4.5 9.5h7v4h-7z" strokeLinejoin="round" />
      </svg>
      {label}
    </button>
  );
}
