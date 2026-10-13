const MAX_CELLS = 120;
const STEPS = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000];

export function SeatMap({ rows }: { rows: { label: string; capacity: number; filled: number }[] }) {
  const usable = rows.filter((r) => r.capacity > 0);
  if (usable.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }

  // One cell stands for `per` seats so the largest row stays within MAX_CELLS.
  const largest = Math.max(...usable.map((r) => r.capacity));
  const per = STEPS.find((s) => largest / s <= MAX_CELLS) ?? Math.ceil(largest / MAX_CELLS);

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r, ri) => {
        if (r.capacity <= 0) {
          return (
            <div key={`${r.label}-${ri}`} className="text-sm">
              <span className="font-medium text-ink">{r.label}</span>
              <span className="ml-2 text-xs text-muted">Not available</span>
            </div>
          );
        }
        const cells = Math.max(1, Math.round(r.capacity / per));
        const filled = Math.max(0, Math.min(r.filled, r.capacity));
        const on = Math.min(cells, Math.round(filled / per));
        const pct = (filled / r.capacity) * 100;
        const over = r.filled > r.capacity;
        return (
          <div key={`${r.label}-${ri}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
              <span className="font-medium text-ink">{r.label}</span>
              <span className="tnum text-xs text-muted">
                {r.filled.toLocaleString("en-IN")} of {r.capacity.toLocaleString("en-IN")} seats ·{" "}
                <span className="font-semibold text-ink">{Math.round(pct)}% filled</span> · {Math.round(100 - pct)}%
                available
                {over ? <span className="ml-1 text-attention">· above sanctioned capacity</span> : null}
              </span>
            </div>
            <div
              role="img"
              aria-label={`${r.label}: ${r.filled} of ${r.capacity} seats filled, ${Math.round(pct)} percent`}
              className="mt-1 flex flex-wrap gap-[2px]"
            >
              {Array.from({ length: cells }, (_, i) => (
                <span
                  key={i}
                  className={`h-2.5 w-2.5 rounded-[2px] ${i < on ? "bg-brand" : "border border-line bg-canvas"}`}
                />
              ))}
            </div>
          </div>
        );
      })}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-line pt-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] bg-brand" />
          Filled
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-[2px] border border-line bg-canvas" />
          Available
        </span>
        <span className="tnum">
          {per === 1 ? "1 square = 1 seat" : `1 square = ${per} seats (rounded; exact figures are in the row totals)`}
        </span>
      </div>
    </div>
  );
}
