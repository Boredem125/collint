import type { FactStatus } from "@/lib/types";
import { STATUS_LABEL, type Unit } from "@/lib/metrics";
import { fmtNum } from "@/lib/facts";

// Desktop draws at 600 units; phones get a narrow canvas so labels stay at ~10px rendered.
const WIDE = 600;
const NARROW = 340;
const PAD = { l: 14, r: 14, t: 22, b: 28 };

// Paired series read as muted (earlier / claimed) against ink (current / verified).
function seriesFills(n: number): string[] {
  if (n <= 1) return ["fill-ink"];
  if (n === 2) return ["fill-line-strong", "fill-ink"];
  return ["fill-ink", "fill-faint", "fill-line-strong", "fill-muted", "fill-sunken"];
}

export function GroupedBars({
  groups,
  unit,
  height = 200,
}: {
  groups: { label: string; bars: { name: string; value: number | null; status?: FactStatus }[] }[];
  unit: Unit;
  height?: number;
}) {
  const vals0 = groups.flatMap((g) => g.bars.map((b) => b.value)).filter((v): v is number => v !== null);
  if (vals0.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }
  return (
    <div>
      <div className="hidden sm:block">
        <Plot groups={groups} unit={unit} height={height} W={WIDE} />
      </div>
      <div className="sm:hidden">
        <Plot groups={groups} unit={unit} height={height} W={NARROW} />
      </div>
      <Legend groups={groups} />
    </div>
  );
}

function Legend({ groups }: { groups: { bars: { name: string }[] }[] }) {
  const names = [...new Set(groups.flatMap((g) => g.bars.map((b) => b.name)))];
  const fills = seriesFills(names.length);
  const fill = (si: number) => fills[si % fills.length];
  return names.length > 1 ? (
    <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[12px] text-muted">
      {names.map((n, i) => (
        <li key={n} className="inline-flex items-center gap-1.5">
          <svg aria-hidden width="10" height="10" viewBox="0 0 10 10">
            <rect width="10" height="10" className={fill(i)} />
          </svg>
          {n}
        </li>
      ))}
    </ul>
  ) : null;
}

function Plot({
  groups,
  unit,
  height,
  W,
}: {
  groups: { label: string; bars: { name: string; value: number | null; status?: FactStatus }[] }[];
  unit: Unit;
  height: number;
  W: number;
}) {
  const names = [...new Set(groups.flatMap((g) => g.bars.map((b) => b.name)))];
  const vals = groups.flatMap((g) => g.bars.map((b) => b.value)).filter((v): v is number => v !== null);
  if (vals.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }

  const fills = seriesFills(names.length);
  const fill = (si: number) => fills[si % fills.length];
  const max = Math.max(...vals, 0) || 1;
  const innerH = height - PAD.t - PAD.b;
  const groupW = (W - PAD.l - PAD.r) / groups.length;
  const slots = Math.max(1, names.length);
  const barW = Math.min(24, (groupW * 0.6) / slots);
  const h = (v: number) => (Math.max(0, v) / max) * innerH;
  const base = PAD.t + innerH;
  // Value labels are dropped when bars get too narrow to carry them.
  const showValues = barW >= 16;
  // Thin the group labels when groups sit closer than a label is wide.
  const every = Math.max(1, Math.ceil(52 / groupW));

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
        <line x1={PAD.l} x2={W - PAD.r} y1={base + 0.5} y2={base + 0.5} className="stroke-line-strong" />
        {groups.map((g, gi) => {
          const cx = PAD.l + groupW * gi + groupW / 2;
          const start = cx - (barW * slots) / 2;
          return (
            <g key={`${g.label}-${gi}`}>
              {gi % every === 0 || gi === groups.length - 1 ? (
                <text x={cx} y={height - 8} textAnchor="middle" fontSize="10.5" className="fill-faint font-mono">
                  {g.label}
                </text>
              ) : null}
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
                      className="fill-faint font-mono"
                    >
                      <title>{`${g.label} · ${b.name}: Not available`}</title>
                      n/a
                    </text>
                  );
                }
                const bh = Math.max(1, h(b.value));
                return (
                  <g key={b.name} data-evidence={b.status}>
                    <rect x={bx + 1} y={base - bh} width={barW - 2} height={bh} className={fill(si)}>
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
                        className={`font-mono ${fill(si) === "fill-ink" ? "fill-ink" : "fill-muted"}`}
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
    </div>
  );
}
