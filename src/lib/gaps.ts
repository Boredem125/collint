import type { FactStatus, FactT, Profile } from "./types";
import { METRICS, MODULES, STATUS_LABEL, type MetricDef, type ModuleKey } from "./metrics";
import { fmtFact, pick, variance, weakestStatus, type Variance } from "./facts";

export type GapKind = "MISSING" | "UNVERIFIED" | "DISPUTED";

export interface Gap {
  id: string;
  kind: GapKind;
  module: ModuleKey;
  moduleLabel: string;
  metricKey: string;
  label: string;
  // Period the request targets: "2025-26", "2025" or "current"
  period: string;
  // Latest period with any usable figure, when it differs from `period`
  lastSeen: string | null;
  status: FactStatus;
  // Best figure on record for `period`, if any
  fact?: FactT;
  variance?: Variance;
  source: string;
  request: string;
}

// Claim vs independent source gap, percent of the claim, above which a figure is disputed.
export const DISPUTE_PCT = 5;

// First matching prefix wins. "Source" here is the document to ask for, which also tells you whom to ask.
export const SOURCE_RULES: [prefixes: string[], source: string][] = [
  [["admissions.", "intake.", "students.", "capacity.", "pass.", "backlog."], "University examination / registration portal"],
  [["placement."], "NIRF data submission / AISHE"],
  [["naac."], "NAAC certificate"],
  [["aicte."], "AICTE EOA letter"],
  [["ugc."], "UGC 2(f)/12B list"],
  [["affiliation."], "University affiliation order"],
  [["faculty.", "dropout.", "attendance.", "graduation.", "progression."], "AISHE DCF return"],
  [
    ["land.", "builtup.", "hostel.", "classrooms.", "labs.", "library.", "transport.", "sports."],
    "AISHE DCF / campus visit",
  ],
  [["fee.", "revenue.", "scholarship.", "discount.", "refunds."], "Audited fee register (management)"],
];

export const FALLBACK_SOURCE = "Institution management";

export function sourceFor(key: string): string {
  return SOURCE_RULES.find(([prefixes]) => prefixes.some((p) => key.startsWith(p)))?.[1] ?? FALLBACK_SOURCE;
}

const usable = (f: FactT) => f.status !== "UNAVAILABLE" && (f.valueNum !== null || f.valueText !== null);

const AY = /^\d{4}-\d{2}$/;
const YEAR = /^\d{4}$/;

/** Most recent period of the metric's kind seen anywhere in the module, so a missing latest year still shows up. */
function targetPeriod(facts: FactT[], def: MetricDef): string {
  if (def.period === "CURRENT") return "current";
  const re = def.period === "AY" ? AY : YEAR;
  const keys = new Set(METRICS.filter((m) => m.module === def.module && m.period === def.period).map((m) => m.key));
  const pool = facts.filter((f) => keys.has(f.metricKey) && re.test(f.period)).map((f) => f.period);
  return pool.sort().at(-1) ?? (def.period === "AY" ? "latest academic year" : "latest year");
}

const when = (period: string) => (period === "current" ? "the current position" : period);

function requestFor(kind: GapKind, def: MetricDef, period: string, source: string, fact?: FactT, v?: Variance): string {
  const label = def.label.toLowerCase();
  if (kind === "MISSING") {
    return `Please provide the ${label} for ${when(period)}, with a copy of the ${source} as supporting evidence.`;
  }
  if (kind === "DISPUTED" && v) {
    return (
      `Please reconcile the ${label} for ${when(period)}: the institution reports ${fmtFact(v.claimed)}, ` +
      `while ${v.verified.sourceName} shows ${fmtFact(v.verified)} (a ${Math.abs(v.pct).toFixed(1)}% gap). ` +
      `Share the ${source} extract that supports your figure.`
    );
  }
  const seen = fact ? `${fmtFact(fact)} (${STATUS_LABEL[fact.status].toLowerCase()}, from ${fact.sourceName})` : "on record";
  return `Please confirm the ${label} for ${when(period)}, currently ${seen}, with a copy of the ${source}.`;
}

/**
 * Every expected metric whose evidence is missing, not verified, or disputed between the institution's claim
 * and an independent source, for the most recent period. Pure: reads only the profile.
 */
export function evidenceGaps(profile: Profile): Gap[] {
  const { facts } = profile;
  const gaps: Gap[] = [];
  const moduleLabel = (k: ModuleKey) => MODULES.find((m) => m.key === k)?.label ?? k;

  for (const def of METRICS) {
    if (!def.expected) continue;
    const period = targetPeriod(facts, def);
    const instLevel = facts.some((f) => f.metricKey === def.key && f.programmeId === null);

    let fact: FactT | undefined;
    let status: FactStatus;
    let v: Variance | null = null;
    if (instLevel || !def.perProgramme) {
      fact = pick(facts, def.key, period);
      status = fact?.status ?? "UNAVAILABLE";
      v = fact ? variance(facts, def.key, period) : null;
    } else {
      // Recorded per programme only: as strong as the weakest programme's figure.
      const picks = [...new Set(facts.filter((f) => f.metricKey === def.key && f.programmeId).map((f) => f.programmeId))]
        .map((pid) => pick(facts, def.key, period, pid))
        .filter((f): f is FactT => !!f);
      status = picks.length ? weakestStatus(picks) : "UNAVAILABLE";
      fact = picks.find((f) => f.status === status);
    }

    const disputed = (x: Variance | null): x is Variance => !!x && Math.abs(x.pct) > DISPUTE_PCT;
    const kind: GapKind | null = !fact ? "MISSING" : disputed(v) ? "DISPUTED" : status !== "VERIFIED" ? "UNVERIFIED" : null;

    const seenPeriods = facts.filter((f) => f.metricKey === def.key && usable(f)).map((f) => f.period).sort();
    const last = seenPeriods.at(-1) ?? null;
    const source = sourceFor(def.key);
    const push = (k: GapKind, p: string, f: FactT | undefined, st: FactStatus, va: Variance | null) =>
      gaps.push({
        id: `${def.key}|${p}`,
        kind: k,
        module: def.module,
        moduleLabel: moduleLabel(def.module),
        metricKey: def.key,
        label: def.label,
        period: p,
        lastSeen: k === "MISSING" && last && last !== p ? last : null,
        status: st,
        fact: f,
        variance: k === "DISPUTED" && va ? va : undefined,
        source,
        request: requestFor(k, def, p, source, f, va ?? undefined),
      });
    if (kind) push(kind, period, fact, status, v);

    // An unresolved claim gap in an earlier year still needs reconciling, even if the latest year cannot be compared.
    if (kind !== "DISPUTED" && instLevel) {
      const prior = [...new Set(facts.filter((f) => f.metricKey === def.key && f.period !== period).map((f) => f.period))]
        .sort()
        .reverse()
        .map((p) => ({ p, va: variance(facts, def.key, p) }))
        .find((x) => x.va);
      if (prior && disputed(prior.va)) {
        const best = pick(facts, def.key, prior.p)!;
        push("DISPUTED", prior.p, best, best.status, prior.va);
      }
    }
  }
  return gaps;
}

export interface GapCounts {
  total: number;
  missing: number;
  unverified: number;
  disputed: number;
}

export function countGaps(gaps: Gap[]): GapCounts {
  return {
    total: gaps.length,
    missing: gaps.filter((g) => g.kind === "MISSING").length,
    unverified: gaps.filter((g) => g.kind === "UNVERIFIED").length,
    disputed: gaps.filter((g) => g.kind === "DISPUTED").length,
  };
}

/** "11 gaps: 4 missing, 6 unverified, 1 disputed". */
export function gapVerdict(gaps: Gap[]): string {
  const c = countGaps(gaps);
  if (!c.total) return "No evidence gaps: every expected metric is verified for its latest period.";
  const parts = [
    c.missing ? `${c.missing} missing` : "",
    c.unverified ? `${c.unverified} unverified` : "",
    c.disputed ? `${c.disputed} disputed` : "",
  ].filter(Boolean);
  return `${c.total} ${c.total === 1 ? "gap" : "gaps"}: ${parts.join(", ")}`;
}

/** Gaps grouped by the source to request them from, largest group first. */
export function groupBySource(gaps: Gap[]): { source: string; gaps: Gap[] }[] {
  const map = new Map<string, Gap[]>();
  for (const g of gaps) map.set(g.source, [...(map.get(g.source) ?? []), g]);
  return [...map.entries()]
    .map(([source, gs]) => ({ source, gaps: gs }))
    .sort((a, b) => b.gaps.length - a.gaps.length || a.source.localeCompare(b.source));
}
