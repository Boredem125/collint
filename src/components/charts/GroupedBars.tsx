import type { FactStatus } from "@/lib/types";
import { STATUS_LABEL, type Unit } from "@/lib/metrics";
import { fmtNum } from "@/lib/facts";

const W = 600;
const PAD = { l: 14, r: 14, t: 22, b: 26 };
const SERIES = ["#1e3a8a", "#0f766e", "#7c3aed", "#475569", "#b45309"];

export function GroupedBars({
  groups,
  unit,
  height = 200,
}: {
  groups: { label: string; bars: { name: string; value: number | null; status?: FactStatus }[] }[];
  unit: Unit;
  height?: number;
}) {
  const names = [...new Set(groups.flatMap((g) => g.bars.map((b) => b.name)))];
  const vals = groups.flatMap((g) => g.bars.map((b) => b.value)).filter((v): v is number => v !== null);
  if (vals.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }

  const max = Math.max(...vals, 0) || 1;
  const innerH = height - PAD.t - PAD.b;
  const groupW = (W - PAD.l - PAD.r) / groups.length;
  const slots = Math.max(1, names.length);
  const barW = Math.min(34, (groupW * 0.72) / slots);
  const h = (v: number) => (Math.max(0, v) / max) * innerH;
  const base = PAD.t + innerH;
  // Value labels are dropped when bars get too narrow to carry them.
  const showValues = barW >= 22;

  const summary = groups
    .map(
      (g) =>
        `${g.label}: ` +
        g.bars.map((b) => `${b.name} ${b.value === null ? "not available" : fmtNum(b.value, unit)}`).join(", "),
    )
    .join("; ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${W} ${height}`}
        role="img"
        aria-label={`Bar chart. ${summary}`}
        className="block h-auto w-full"
      >
        {[0, 0.5].map((t) => (
          <line
            key={t}
            x1={PAD.l}
            x2={W - PAD.r}
            y1={PAD.t + t * innerH}
            y2={PAD.t + t * innerH}
            stroke="var(--color-line)"
            strokeDasharray="3 4"
          />
        ))}
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} stroke="var(--color-line)" />
        {groups.map((g, gi) => {
          const cx = PAD.l + groupW * gi + groupW / 2;
          const start = cx - (barW * slots) / 2;
          return (
            <g key={`${g.label}-${gi}`}>
              <text x={cx} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
                {g.label}
              </text>
              {g.bars.map((b) => {
                const si = names.indexOf(b.name);
                const bx = start + si * barW;
                if (b.value === null) {
                  return (
                    <text
                      key={b.name}
                      x={bx + barW / 2}
                      y={base - 5}
                      textAnchor="middle"
                      fontSize="9"
                      fill="var(--color-unavailable)"
                    >
                      <title>{`${g.label} · ${b.name}: Not available`}</title>
                      n/a
                    </text>
                  );
                }
                const bh = Math.max(1, h(b.value));
                return (
                  <g key={b.name} data-evidence={b.status}>
                    <rect
                      x={bx + 1.5}
                      y={base - bh}
                      width={barW - 3}
                      height={bh}
                      rx="2"
                      fill={SERIES[si % SERIES.length]}
                    >
                      <title>
                        {`${g.label} · ${b.name}: ${fmtNum(b.value, unit)}${b.status ? ` (${STATUS_LABEL[b.status]})` : ""}`}
                      </title>
                    </rect>
                    {showValues ? (
                      <text
                        x={bx + barW / 2}
                        y={base - bh - 5}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="600"
                        fill="var(--color-ink)"
                        style={{ fontVariantNumeric: "tabular-nums" }}
                      >
                        {fmtNum(b.value, unit)}
                      </text>
                    ) : null}
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>
      {names.length > 1 ? (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
          {names.map((n, i) => (
            <li key={n} className="inline-flex items-center gap-1.5">
              <span aria-hidden className="h-2.5 w-2.5 rounded-sm" style={{ background: SERIES[i % SERIES.length] }} />
              {n}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
