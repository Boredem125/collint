const COLOURS = ["#1e3a8a", "#0f766e", "#7c3aed", "#b45309", "#475569", "#be185d", "#0369a1", "#4d7c0f"];

export function SectorSplit({ items }: { items: { label: string; value: number }[] }) {
  const rows = items.filter((i) => i.value > 0).sort((a, b) => b.value - a.value);
  const total = rows.reduce((s, i) => s + i.value, 0);
  if (total <= 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }
  const share = (v: number) => (v / total) * 100;

  let offset = 0;
  return (
    <div>
      <svg
        viewBox="0 0 100 6"
        preserveAspectRatio="none"
        role="img"
        aria-label={`Sector split. ${rows.map((r) => `${r.label} ${Math.round(share(r.value))} percent`).join(", ")}`}
        className="block h-3 w-full overflow-hidden rounded-sm"
      >
        {rows.map((r, i) => {
          const w = share(r.value);
          const x = offset;
          offset += w;
          return (
            <rect key={r.label} x={x} y="0" width={Math.max(0, w - 0.4)} height="6" fill={COLOURS[i % COLOURS.length]}>
              <title>{`${r.label}: ${r.value} (${Math.round(w)}%)`}</title>
            </rect>
          );
        })}
      </svg>
      <ul className="mt-2 grid grid-cols-1 gap-x-4 gap-y-1 text-xs sm:grid-cols-2">
        {rows.map((r, i) => (
          <li key={r.label} className="flex items-center justify-between gap-2">
            <span className="inline-flex min-w-0 items-center gap-1.5 text-ink">
              <span
                aria-hidden
                className="h-2.5 w-2.5 shrink-0 rounded-sm"
                style={{ background: COLOURS[i % COLOURS.length] }}
              />
              <span className="truncate">{r.label}</span>
            </span>
            <span className="tnum whitespace-nowrap text-muted">
              {r.value.toLocaleString("en-IN")} · {Math.round(share(r.value))}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
