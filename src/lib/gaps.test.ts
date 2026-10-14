import { describe, expect, it } from "vitest";
import type { FactT, Profile } from "./types";
import { METRICS } from "./metrics";
import { DISPUTE_PCT, evidenceGaps, gapVerdict, groupBySource, sourceFor } from "./gaps";

let n = 0;
const mk = (metricKey: string, period: string, value: number | string | null, over: Partial<FactT> = {}): FactT => ({
  id: `f${++n}`,
  institutionId: "i1",
  metricKey,
  period,
  programmeId: null,
  valueNum: typeof value === "number" ? value : null,
  valueText: typeof value === "string" ? value : null,
  sourceType: "GOVERNMENT",
  sourceName: "Independent source",
  sourceUrl: null,
  asOfDate: "2026-01-01T00:00:00.000Z",
  status: "VERIFIED",
  note: null,
  ...over,
});

const profile = (facts: FactT[]): Profile => ({
  inst: {
    id: "i1",
    name: "Test College",
    aisheCode: "C-1",
    city: "X",
    state: "Y",
    established: null,
    ownership: "Trust",
    university: "U",
    campusStatus: "Operational",
    isSample: true,
    overallRisk: null,
    overallRiskNote: null,
    opportunity: null,
    opportunityNote: null,
    stage: "SCREENING",
    stageUpdatedAt: "2026-01-01T00:00:00.000Z",
  },
  facts,
  programmes: [],
  promoters: [],
  legal: [],
  recruiters: [],
  notes: [],
});

const EXPECTED = METRICS.filter((m) => m.expected);
const periodFor = (p: string) => (p === "AY" ? "2025-26" : p === "YEAR" ? "2025" : "current");

// One verified figure for every expected metric in its latest period.
const complete = () =>
  EXPECTED.map((m) => mk(m.key, periodFor(m.period), m.unit === "text" || m.unit === "date" ? "2030-01-01" : 100));

describe("evidenceGaps", () => {
  it("reports every expected metric as missing on an empty profile", () => {
    const gaps = evidenceGaps(profile([]));
    expect(gaps).toHaveLength(EXPECTED.length);
    expect(gaps.every((g) => g.kind === "MISSING" && g.status === "UNAVAILABLE")).toBe(true);
  });

  it("reports nothing when every expected metric is verified", () => {
    expect(evidenceGaps(profile(complete()))).toEqual([]);
  });

  it("flags a self-reported figure as unverified and names the source to ask", () => {
    const facts = complete().map((f) =>
      f.metricKey === "placement.rate" ? { ...f, sourceType: "INSTITUTION" as const, status: "SELF_REPORTED" as const } : f,
    );
    const [g] = evidenceGaps(profile(facts));
    expect(g.kind).toBe("UNVERIFIED");
    expect(g.metricKey).toBe("placement.rate");
    expect(g.period).toBe("2025");
    expect(g.status).toBe("SELF_REPORTED");
    expect(g.source).toBe("NIRF data submission / AISHE");
    expect(g.request).toContain("placement rate");
    expect(g.request).toContain("NIRF data submission / AISHE");
  });

  it("flags a claim more than 5% above the independent source as disputed", () => {
    const facts = [...complete(), mk("admissions.total", "2025-26", 120, { sourceType: "INSTITUTION", status: "SELF_REPORTED" })];
    const gaps = evidenceGaps(profile(facts));
    expect(gaps).toHaveLength(1);
    expect(gaps[0].kind).toBe("DISPUTED");
    expect(gaps[0].variance?.pct).toBeGreaterThan(DISPUTE_PCT);
    expect(gaps[0].source).toBe("University examination / registration portal");
    expect(gaps[0].request).toMatch(/reconcile/);
  });

  it("still reports an earlier-year dispute when the latest year rests on the claim alone", () => {
    const facts = complete()
      .filter((f) => f.metricKey !== "admissions.total")
      .concat([
        mk("admissions.total", "2024-25", 80),
        mk("admissions.total", "2024-25", 100, { sourceType: "INSTITUTION", status: "SELF_REPORTED" }),
        mk("admissions.total", "2025-26", 110, { sourceType: "INSTITUTION", status: "SELF_REPORTED" }),
      ]);
    const gaps = evidenceGaps(profile(facts)).filter((g) => g.metricKey === "admissions.total");
    expect(gaps.map((g) => [g.kind, g.period])).toEqual([
      ["UNVERIFIED", "2025-26"],
      ["DISPUTED", "2024-25"],
    ]);
  });

  it("ignores a claim within the 5% tolerance", () => {
    const facts = [...complete(), mk("admissions.total", "2025-26", 104, { sourceType: "INSTITUTION", status: "SELF_REPORTED" })];
    expect(evidenceGaps(profile(facts))).toEqual([]);
  });

  it("treats an older-year-only figure as missing for the latest period", () => {
    const facts = complete().map((f) => (f.metricKey === "faculty.total" ? { ...f, period: "2023-24" } : f));
    const gaps = evidenceGaps(profile([...facts, mk("pass.rate", "2025-26", 90)]));
    const g = gaps.find((x) => x.metricKey === "faculty.total");
    expect(g?.kind).toBe("MISSING");
    expect(g?.period).toBe("2025-26");
    expect(g?.lastSeen).toBe("2023-24");
  });

  it("does not count an UNAVAILABLE record as evidence", () => {
    const facts = complete().map((f) => (f.metricKey === "naac.grade" ? { ...f, status: "UNAVAILABLE" as const } : f));
    const g = evidenceGaps(profile(facts)).find((x) => x.metricKey === "naac.grade");
    expect(g?.kind).toBe("MISSING");
    expect(g?.source).toBe("NAAC certificate");
  });

  it("judges a per-programme-only metric by its weakest programme", () => {
    const facts = complete()
      .filter((f) => f.metricKey !== "fee.annual")
      .concat([
        mk("fee.annual", "2025-26", 150000, { programmeId: "p1" }),
        mk("fee.annual", "2025-26", 160000, { programmeId: "p2", status: "SELF_REPORTED", sourceType: "INSTITUTION" }),
      ]);
    const gaps = evidenceGaps(profile(facts));
    expect(gaps).toHaveLength(1);
    expect(gaps[0]).toMatchObject({ metricKey: "fee.annual", kind: "UNVERIFIED", status: "SELF_REPORTED" });
    expect(gaps[0].source).toBe("Audited fee register (management)");
  });
});

describe("helpers", () => {
  it("maps metric keys to sources", () => {
    expect(sourceFor("aicte.status")).toBe("AICTE EOA letter");
    expect(sourceFor("ugc.status")).toBe("UGC 2(f)/12B list");
    expect(sourceFor("affiliation.status")).toBe("University affiliation order");
    expect(sourceFor("hostel.capacity")).toBe("AISHE DCF / campus visit");
    expect(sourceFor("unknown.key")).toBe("Institution management");
  });

  it("writes the verdict sentence and groups by source", () => {
    const facts = complete()
      .filter((f) => f.metricKey !== "land.acres" && f.metricKey !== "hostel.capacity")
      .map((f) => (f.metricKey === "naac.grade" ? { ...f, status: "SELF_REPORTED" as const } : f));
    const gaps = evidenceGaps(profile(facts));
    expect(gapVerdict(gaps)).toBe("3 gaps: 2 missing, 1 unverified");
    expect(groupBySource(gaps)[0]).toMatchObject({ source: "AISHE DCF / campus visit" });
    expect(gapVerdict([])).toMatch(/^No evidence gaps/);
  });
});
