"use client";

import type { FactStatus } from "@/lib/types";
import { STATUS_LABEL, type Unit } from "@/lib/metrics";
import { fmtNum } from "@/lib/facts";
import { useTrustLens } from "@/components/evidence/TrustLens";

const W = 600;
const PAD = { l: 14, r: 14, t: 26, b: 26 };

export const STATUS_FILL: Record<FactStatus, string> = {
  VERIFIED: "var(--color-verified)",
  SELF_REPORTED: "var(--color-selfreported)",
  NEEDS_VALIDATION: "var(--color-validate)",
  UNAVAILABLE: "var(--color-unavailable)",
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
  const vals = points.map((p) => p.value).filter((v): v is number => v !== null);
  if (vals.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }

  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || Math.abs(max) || 1;
  const lo = min >= 0 ? Math.max(0, min - span * 0.25) : min - span * 0.25;
  const hi = max + span * 0.15;
  const innerH = height - PAD.t - PAD.b;
  const step = points.length > 1 ? (W - PAD.l - PAD.r - 40) / (points.length - 1) : 0;
  const x = (i: number) => (points.length > 1 ? PAD.l + 20 + i * step : W / 2);
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

  const summary = points
    .map((p) => `${p.label}: ${p.value === null ? "not available" : fmtNum(p.value, unit)}`)
    .join("; ");

  return (
    <svg viewBox={`0 0 ${W} ${height}`} role="img" aria-label={`Trend. ${summary}`} className="block h-auto w-full">
      {[0, 0.5, 1].map((t) => (
        <line
          key={t}
          x1={PAD.l}
          x2={W - PAD.r}
          y1={PAD.t + t * innerH}
          y2={PAD.t + t * innerH}
          stroke="var(--color-line)"
          strokeWidth="1"
          strokeDasharray={t === 1 ? undefined : "3 4"}
        />
      ))}
      {segments.map((s) => (
        <polyline
          key={s}
          points={s}
          fill="none"
          stroke="var(--color-brand)"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
      {points.map((p, i) => (
        <g key={`${p.label}-${i}`}>
          <text x={x(i)} y={height - 8} textAnchor="middle" fontSize="11" fill="var(--color-muted)">
            {p.label}
          </text>
          {p.value === null ? (
            <text x={x(i)} y={PAD.t + innerH / 2} textAnchor="middle" fontSize="10" fill="var(--color-unavailable)">
              Not available
            </text>
          ) : (
            <g data-evidence={p.status}>
              <circle
                cx={x(i)}
                cy={y(p.value)}
                r="4.5"
                fill={p.status ? STATUS_FILL[p.status] : "var(--color-brand)"}
                stroke="var(--color-surface)"
                strokeWidth="2"
              >
                <title>
                  {`${p.label}: ${fmtNum(p.value, unit)}${p.status ? ` (${STATUS_LABEL[p.status]})` : ""}`}
                </title>
              </circle>
              <text
                x={x(i)}
                y={y(p.value) - 10}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="var(--color-ink)"
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                {fmtNum(p.value, unit)}
              </text>
            </g>
          )}
        </g>
      ))}
    </svg>
  );
}
