import type { FactT, FactStatus } from "./types";
import { METRICS, SOURCE_PRECEDENCE, metric, type ModuleKey, type Unit } from "./metrics";

const usable = (f: FactT) => f.status !== "UNAVAILABLE" && (f.valueNum !== null || f.valueText !== null);

const rank = (f: FactT) => SOURCE_PRECEDENCE.indexOf(f.sourceType);

// Best first: source precedence, then most recent asOfDate.
const byPrecedence = (a: FactT, b: FactT) => rank(a) - rank(b) || b.asOfDate.localeCompare(a.asOfDate);

/** Every Fact recorded for a metric and period, best source first. Institution-level unless programmeId is given. */
export function all(facts: FactT[], key: string, period = "current", programmeId: string | null = null): FactT[] {
  return facts
    .filter((f) => f.metricKey === key && f.period === period && f.programmeId === programmeId)
    .sort(byPrecedence);
}

/** Headline Fact: the usable Fact from the highest-precedence source. */
export function pick(
  facts: FactT[],
  key: string,
  period = "current",
  programmeId: string | null = null,
): FactT | undefined {
  return all(facts, key, period, programmeId).find(usable);
}

/** Periods that have at least one Fact for the metric, oldest first. */
export function periods(facts: FactT[], key: string, programmeId: string | null = null): string[] {
  const set = new Set(facts.filter((f) => f.metricKey === key && f.programmeId === programmeId).map((f) => f.period));
  return [...set].sort();
}

export interface SeriesPoint {
  period: string;
  fact: FactT | undefined;
  value: number | null;
}

/** Headline Fact per period, oldest first. */
export function series(facts: FactT[], key: string, programmeId: string | null = null): SeriesPoint[] {
  return periods(facts, key, programmeId).map((period) => {
    const fact = pick(facts, key, period, programmeId);
    return { period, fact, value: fact?.valueNum ?? null };
  });
}

/** Headline Fact for the most recent period. */
export function latest(facts: FactT[], key: string, programmeId: string | null = null): FactT | undefined {
  const s = series(facts, key, programmeId).filter((p) => p.fact);
  return s[s.length - 1]?.fact;
}

export interface Variance {
  claimed: FactT;
  verified: FactT;
  diff: number;
  // Share of the claim that is not supported, 0-100
  pct: number;
}

/**
 * Gap between what the institution claims and the best independent source.
 * Null unless both an INSTITUTION Fact and a non-institution Fact exist.
 */
export function variance(
  facts: FactT[],
  key: string,
  period = "current",
  programmeId: string | null = null,
): Variance | null {
  const rows = all(facts, key, period, programmeId).filter((f) => usable(f) && f.valueNum !== null);
  const claimed = rows.find((f) => f.sourceType === "INSTITUTION");
  const verified = rows.find((f) => f.sourceType !== "INSTITUTION" && f.sourceType !== "INTERNAL");
  if (!claimed || !verified) return null;
  const diff = claimed.valueNum! - verified.valueNum!;
  const pct = claimed.valueNum === 0 ? 0 : (diff / claimed.valueNum!) * 100;
  return { claimed, verified, diff, pct };
}

export interface DerivedValue {
  value: number;
  basis: FactT[];
}

/** Admissions divided by approved intake for an academic year, as a percentage. */
export function utilisation(facts: FactT[], period: string, programmeId: string | null = null): DerivedValue | null {
  const intake = pick(facts, "intake.approved", period, programmeId);
  const adm = pick(facts, "admissions.total", period, programmeId);
  if (!intake?.valueNum || adm?.valueNum == null) return null;
  return { value: (adm.valueNum / intake.valueNum) * 100, basis: [adm, intake] };
}

/** Utilisation for every academic year that has intake data, oldest first. */
export function utilisationSeries(facts: FactT[]): { period: string; derived: DerivedValue | null }[] {
  return periods(facts, "intake.approved").map((period) => ({ period, derived: utilisation(facts, period) }));
}

/** Compound annual growth rate in percent between first and last value over `years` intervals. */
export function cagr(first: number, last: number, years: number): number | null {
  if (first <= 0 || years <= 0) return null;
  return (Math.pow(last / first, 1 / years) - 1) * 100;
}

export type TrendDir = "up" | "flat" | "down" | "unknown";

/** Direction from first to last non-null value. Changes within `tolerance` percent count as flat. */
export function trend(values: (number | null)[], tolerance = 3): TrendDir {
  const v = values.filter((x): x is number => x !== null);
  if (v.length < 2) return "unknown";
  const first = v[0];
  const last = v[v.length - 1];
  if (first === 0) return last > 0 ? "up" : "flat";
  const change = ((last - first) / Math.abs(first)) * 100;
  if (Math.abs(change) <= tolerance) return "flat";
  return change > 0 ? "up" : "down";
}

const STATUS_WEAKNESS: FactStatus[] = ["VERIFIED", "SELF_REPORTED", "NEEDS_VALIDATION", "UNAVAILABLE"];

/** A derived number is only as strong as its weakest input. */
export function weakestStatus(facts: FactT[]): FactStatus {
  return facts.reduce<FactStatus>(
    (worst, f) => (STATUS_WEAKNESS.indexOf(f.status) > STATUS_WEAKNESS.indexOf(worst) ? f.status : worst),
    "VERIFIED",
  );
}

export interface Coverage {
  expected: number;
  present: number;
  verified: number;
  // Share of expected metrics backed by a VERIFIED Fact, 0-100
  pct: number;
}

/** How much of a module's expected evidence exists. Rates the diligence, not the college. */
export function coverage(facts: FactT[], module?: ModuleKey): Coverage {
  const defs = METRICS.filter((d) => d.expected && (!module || d.module === module));
  let present = 0;
  let verified = 0;
  for (const d of defs) {
    const rows = facts.filter((f) => f.metricKey === d.key && usable(f));
    if (rows.length) present++;
    if (rows.some((f) => f.status === "VERIFIED")) verified++;
  }
  return { expected: defs.length, present, verified, pct: defs.length ? (verified / defs.length) * 100 : 0 };
}

const inr = (n: number): string => {
  const abs = Math.abs(n);
  if (abs >= 1e7) return `₹${(n / 1e7).toFixed(abs >= 1e8 ? 1 : 2).replace(/\.?0+$/, "")} Cr`;
  if (abs >= 1e5) return `₹${(n / 1e5).toFixed(1).replace(/\.0$/, "")}L`;
  return `₹${Math.round(n).toLocaleString("en-IN")}`;
};

/** Format a raw number for display in the given unit. */
export function fmtNum(n: number, unit: Unit): string {
  switch (unit) {
    case "percent":
      return `${Math.round(n)}%`;
    case "inr":
      return inr(n);
    case "rank":
      return `#${Math.round(n)}`;
    case "ratio":
      return `1:${Math.round(n)}`;
    case "acre":
      return `${n.toLocaleString("en-IN")} acres`;
    case "sqft":
      return `${Math.round(n).toLocaleString("en-IN")} sq ft`;
    default:
      return Math.round(n).toLocaleString("en-IN");
  }
}

export function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" }).replace(/ /g, "-");
}

/** Display string for a Fact, using its metric's unit unless overridden. */
export function fmtFact(f: FactT | undefined, unit?: Unit): string {
  if (!f || f.status === "UNAVAILABLE") return "Not available";
  const u = unit ?? metric(f.metricKey)?.unit ?? "count";
  if (u === "date" && f.valueText) return fmtDate(f.valueText);
  if (f.valueNum !== null) return fmtNum(f.valueNum, u);
  return f.valueText ?? "Not available";
}
