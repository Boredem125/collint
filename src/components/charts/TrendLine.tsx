"use client";

import type { FactStatus } from "@/lib/types";
import { STATUS_LABEL, type Unit } from "@/lib/metrics";
import { fmtNum } from "@/lib/facts";
import { useTrustLens } from "@/components/evidence/TrustLens";

// Desktop draws at 600 units; phones get a narrow canvas so labels stay at ~10px rendered.
const WIDE = 600;
const NARROW = 340;
const PAD = { l: 18, r: 18, t: 24, b: 26 };

export const STATUS_FILL: Record<FactStatus, string> = {
  VERIFIED: "var(--verified)",
  SELF_REPORTED: "var(--selfreported)",
  NEEDS_VALIDATION: "var(--validate)",
  UNAVAILABLE: "var(--unavailable)",
};

export function TrendLine({
  points,
  unit,
  height = 180,
}: {
  points: { label: string; value: number | null; status?: FactStatus }[];
  unit: Unit;
  height?: number;
}) {
  const { on } = useTrustLens();
  if (!points.some((p) => p.value !== null)) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }
  return (
    <>
      <div className="hidden sm:block">
        <Plot points={points} unit={unit} height={height} on={on} W={WIDE} />
      </div>
      <div className="sm:hidden">
        <Plot points={points} unit={unit} height={height} on={on} W={NARROW} />
      </div>
    </>
  );
}

function Plot({
  points,
  unit,
  height,
  on,
  W,
}: {
  points: { label: string; value: number | null; status?: FactStatus }[];
  unit: Unit;
  height: number;
  on: boolean;
  W: number;
}) {
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.abs(max) || 1;
  const lo = min >= 0 ? Math.max(0, min - span * 0.35) : min - span * 0.35;
  const hi = max + span * 0.2;
  const innerH = height - PAD.t - PAD.b;
  const inset = 28;
  const step = points.length > 1 ? (W - PAD.l - PAD.r - inset * 2) / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? PAD.l + inset + i * step : W / 2);
  // A lower rank number is better, so rank charts are drawn inverted.
  const y = (v: number) => {
    const t = (v - lo) / (hi - lo);
    return PAD.t + (unit === "rank" ? t : 1 - t) * innerH;
  };

  // With the Trust lens on, unverified points no longer join the line.
  const joins = (p: (typeof points)[number]) => p.value !== null && !(on && p.status && p.status !== "VERIFIED");
  const segments: string[] = [];
  let run: string[] = [];
  points.forEach((p, i) => {
    if (joins(p)) run.push(`${x(i)},${y(p.value as number)}`);
    else {
      if (run.length > 1) segments.push(run.join(" "));
      run = [];
    }
  });
  if (run.length > 1) segments.push(run.join(" "));

  // Label every point when there is room; otherwise only the ends and the extremes.
  const present = points.map((p, i) => (p.value === null ? -1 : i)).filter((i) => i >= 0);
  const first = present[0];
  const last = present[present.length - 1];
  const crowded = points.length > 6 || step < 70;
  const labelled = new Set<number>(
    crowded
      ? [
          first,
          last,
          present.reduce((a, b) => ((points[b].value as number) > (points[a].value as number) ? b : a), first),
          present.reduce((a, b) => ((points[b].value as number) < (points[a].value as number) ? b : a), first),
        ]
      : present,
  );

  const summary = points
    .map((p) => `${p.label}: ${p.value === null ? "not available" : fmtNum(p.value, unit)}`)
    .join("; ");
  const base = PAD.t + innerH;
  // Thin the axis labels when points sit closer than a label is wide.
  const every = step > 0 ? Math.max(1, Math.ceil(52 / step)) : 1;
  const axis = (i: number) => i === points.length - 1 || (i % every === 0 && points.length - 1 - i >= every);

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Trend. ${summary}`} className="block h-auto w-full">
      <line x1={PAD.l} x2={W - PAD.r} y1={base + 6} y2={base + 6} className="stroke-line" strokeWidth="1" />
      {segments.map((s) => (
        <polyline
          key={s}
          points={s}
          fill="none"
          className="stroke-ink"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          {axis(i) ? (
            <text x={x(i)} y={height - 6} textAnchor="middle" fontSize="10.5" className="fill-faint font-mono">
              {p.label}
            </text>
          ) : null}
          {p.value === null ? (
            <text x={x(i)} y={PAD.t + innerH / 2} textAnchor="middle" fontSize="10" className="fill-faint font-mono">
              Not available
            </text>
          ) : (
            <g data-evidence={p.status}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="3"
                strokeWidth="1.5"
                className="fill-surface"
                stroke={p.status && p.status !== "VERIFIED" ? STATUS_FILL[p.status] : "var(--ink)"}
              >
                <title>
                  {`${p.label}: ${fmtNum(p.value, unit)}${p.status ? ` (${STATUS_LABEL[p.status]})` : ""}`}
                </title>
              </circle>
              {labelled.has(i) ? (
                <text
                  x={x(i)}
                  y={y(p.value) - 9}
                  textAnchor="middle"
                  fontSize="11"
                  className={`font-mono ${i === last ? "fill-ink" : "fill-muted"}`}
                  fontWeight={i === last ? 600 : 400}
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {fmtNum(p.value, unit)}
                </text>
              ) : null}
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
