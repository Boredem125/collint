// Sequential ramp from ink towards the canvas; order carries rank, not category identity.
function tone(i: number, n: number): string {
  const strength = n <= 1 ? 100 : Math.round(100 - (i / (n - 1)) * 78);
  return `color-mix(in oklab, var(--ink) ${strength}%, var(--canvas))`;
}

export function SectorSplit({ items }: { items: { label: string; value: number }[] }) {
  const rows = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, i) => s + i.value, 0);
  if (total <= 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }
  const share = (v: number) => (v / total) * 100;

  return (
    <div>
      <div
        role="img"
        aria-label={`Sector split. ${rows.map((r) => `${r.label} ${Math.round(share(r.value))} percent`).join(", ")}`}
        className="flex h-[10px] w-full gap-[2px]"
      >
        {rows.map((r, i) => (
          <span
            key={r.label}
            title={`${r.label}: ${r.value.toLocaleString("en-IN")} (${Math.round(share(r.value))}%)`}
            className="block h-full min-w-[2px]"
            style={{ width: `${share(r.value)}%`, background: tone(i, rows.length) }}
          />
        ))}
      </div>
      <ul className="mt-3 grid grid-cols-1 gap-x-8 sm:grid-cols-2">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-baseline justify-between gap-3 border-b border-line py-1.5 text-[13px]">
            <span className="inline-flex min-w-0 items-center gap-2 text-ink">
              <span aria-hidden className="h-2 w-2 shrink-0" style={{ background: tone(i, rows.length) }} />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="tnum whitespace-nowrap font-mono text-[11px] text-faint">
              {r.value.toLocaleString("en-IN")} <span className="ml-1.5 text-ink">{Math.round(share(r.value))}%</span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
