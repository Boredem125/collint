import { describe, expect, it } from "vitest";
import type { FactT } from "./types";
import { METRICS } from "./metrics";
import { all, cagr, coverage, fmtFact, fmtNum, latest, pick, series, trend, utilisation, utilisationSeries, variance, weakestStatus } from "./facts";

let n = 0;
const mkFact = (metricKey: string, period: string, value: number | string | null, over: Partial<FactT> = {}): FactT => ({
  id: `f${++n}`,
  institutionId: "i1",
  metricKey,
  period,
  programmeId: null,
  valueNum: typeof value === "number" ? value : null,
  valueText: typeof value === "string" ? value : null,
  sourceType: "UNIVERSITY_PORTAL",
  sourceName: "University examination portal",
  sourceUrl: null,
  asOfDate: "2025-01-01T00:00:00.000Z",
  status: "VERIFIED",
  note: null,
  ...over,
});

const claim = (key: string, period: string, value: number) =>
  mkFact(key, period, value, { sourceType: "INSTITUTION", sourceName: "Mandatory disclosure", status: "SELF_REPORTED" });

describe("pick", () => {
  it("prefers UNIVERSITY_PORTAL over INSTITUTION regardless of order", () => {
    const facts = [claim("admissions.total", "2024-25", 950), mkFact("admissions.total", "2024-25", 812)];
    expect(pick(facts, "admissions.total", "2024-25")?.valueNum).toBe(812);
    expect(all(facts, "admissions.total", "2024-25").map((f) => f.valueNum)).toEqual([812, 950]);
  });

  it("skips UNAVAILABLE facts and falls back to the next source", () => {
    const facts = [
      mkFact("admissions.total", "2025-26", null, { status: "UNAVAILABLE" }),
      claim("admissions.total", "2025-26", 965),
    ];
    expect(pick(facts, "admissions.total", "2025-26")?.valueNum).toBe(965);
  });

  it("returns undefined when nothing usable exists", () => {
    expect(pick([mkFact("admissions.total", "2025-26", null, { status: "UNAVAILABLE" })], "admissions.total", "2025-26")).toBeUndefined();
    expect(pick([], "admissions.total", "2025-26")).toBeUndefined();
  });

  it("breaks ties within a source by most recent asOfDate", () => {
    const facts = [
      mkFact("students.total", "2024-25", 100, { asOfDate: "2025-01-01T00:00:00.000Z" }),
      mkFact("students.total", "2024-25", 120, { asOfDate: "2025-06-01T00:00:00.000Z" }),
    ];
    expect(pick(facts, "students.total", "2024-25")?.valueNum).toBe(120);
  });

  it("keeps institution-level and programme-level facts apart", () => {
    const facts = [mkFact("admissions.total", "2024-25", 812), mkFact("admissions.total", "2024-25", 338, { programmeId: "p1" })];
    expect(pick(facts, "admissions.total", "2024-25")?.valueNum).toBe(812);
    expect(pick(facts, "admissions.total", "2024-25", "p1")?.valueNum).toBe(338);
  });
});

describe("variance", () => {
  it("gives 138 / 14.5% for a claim of 950 against 812", () => {
    const v = variance([claim("admissions.total", "2024-25", 950), mkFact("admissions.total", "2024-25", 812)], "admissions.total", "2024-25");
    expect(v).not.toBeNull();
    expect(v!.diff).toBe(138);
    expect(v!.pct).toBeCloseTo(14.526, 2);
    expect(v!.claimed.valueNum).toBe(950);
    expect(v!.verified.valueNum).toBe(812);
  });

  it("is null with only one source", () => {
    expect(variance([claim("admissions.total", "2024-25", 950)], "admissions.total", "2024-25")).toBeNull();
    expect(variance([mkFact("admissions.total", "2024-25", 812)], "admissions.total", "2024-25")).toBeNull();
  });

  it("does not treat INTERNAL or UNAVAILABLE facts as the independent source", () => {
    const facts = [
      claim("admissions.total", "2024-25", 950),
      mkFact("admissions.total", "2024-25", 900, { sourceType: "INTERNAL" }),
      mkFact("admissions.total", "2024-25", null, { status: "UNAVAILABLE" }),
    ];
    expect(variance(facts, "admissions.total", "2024-25")).toBeNull();
  });
});

describe("utilisation", () => {
  const facts = [
    mkFact("intake.approved", "2023-24", 1000, { sourceType: "REGULATOR" }),
    mkFact("admissions.total", "2023-24", 800),
    mkFact("intake.approved", "2024-25", 1200, { sourceType: "REGULATOR" }),
    mkFact("admissions.total", "2024-25", 812),
    claim("admissions.total", "2024-25", 950),
    mkFact("intake.approved", "2025-26", 1200, { sourceType: "REGULATOR" }),
  ];

  it("divides headline admissions by approved intake", () => {
    const u = utilisation(facts, "2024-25");
    expect(u!.value).toBeCloseTo(67.67, 2);
    expect(u!.basis.map((f) => f.valueNum)).toEqual([812, 1200]);
  });

  it("is null when either side is missing", () => {
    expect(utilisation(facts, "2025-26")).toBeNull();
    expect(utilisation(facts, "2020-21")).toBeNull();
  });

  it("returns one entry per intake year, oldest first", () => {
    const s = utilisationSeries(facts);
    expect(s.map((x) => x.period)).toEqual(["2023-24", "2024-25", "2025-26"]);
    expect(s[0].derived!.value).toBe(80);
    expect(s[2].derived).toBeNull();
  });
});

describe("series and latest", () => {
  const facts = [mkFact("placement.rate", "2025", 71), mkFact("placement.rate", "2023", 70), mkFact("placement.rate", "2024", null, { status: "UNAVAILABLE" })];

  it("orders periods oldest first and leaves gaps as null", () => {
    expect(series(facts, "placement.rate").map((p) => [p.period, p.value])).toEqual([
      ["2023", 70],
      ["2024", null],
      ["2025", 71],
    ]);
  });

  it("latest returns the most recent usable fact", () => {
    expect(latest(facts, "placement.rate")?.valueNum).toBe(71);
    expect(latest(facts.slice(1), "placement.rate")?.valueNum).toBe(70);
  });
});

describe("cagr", () => {
  it("computes compound growth", () => {
    expect(cagr(100, 121, 2)).toBeCloseTo(10, 6);
    expect(cagr(555, 743, 4)).toBeCloseTo(7.57, 1);
    expect(cagr(200, 100, 1)).toBeCloseTo(-50, 6);
  });

  it("is null for a non-positive base or zero years", () => {
    expect(cagr(0, 100, 3)).toBeNull();
    expect(cagr(100, 120, 0)).toBeNull();
  });
});

describe("trend", () => {
  it("classifies direction from first to last value", () => {
    expect(trend([100, 90, 120])).toBe("up");
    expect(trend([100, 120, 80])).toBe("down");
    expect(trend([100, 150, 102])).toBe("flat");
  });

  it("ignores nulls and needs two values", () => {
    expect(trend([null, 100, null, 110])).toBe("up");
    expect(trend([100, null])).toBe("unknown");
    expect(trend([])).toBe("unknown");
  });

  it("honours the tolerance argument", () => {
    expect(trend([100, 104])).toBe("up");
    expect(trend([100, 104], 5)).toBe("flat");
  });
});

describe("weakestStatus", () => {
  it("returns the weakest status in the basis", () => {
    expect(weakestStatus([mkFact("a", "x", 1), claim("a", "x", 2)])).toBe("SELF_REPORTED");
    expect(weakestStatus([mkFact("a", "x", 1)])).toBe("VERIFIED");
  });
});

describe("coverage", () => {
  const expectedAdmissions = METRICS.filter((d) => d.expected && d.module === "admissions").length;

  it("counts expected metrics present and verified for a module", () => {
    const facts = [
      mkFact("intake.approved", "2024-25", 1200),
      mkFact("admissions.total", "2024-25", 812),
      claim("students.total", "2024-25", 3000),
      mkFact("capacity.total", "current", null, { status: "UNAVAILABLE" }),
      mkFact("placement.rate", "2025", 71),
    ];
    const c = coverage(facts, "admissions");
    expect(c.expected).toBe(expectedAdmissions);
    expect(c.present).toBe(3);
    expect(c.verified).toBe(2);
    expect(c.pct).toBeCloseTo((2 / expectedAdmissions) * 100, 6);
  });

  it("covers every module when none is given", () => {
    const c = coverage([]);
    expect(c.expected).toBe(METRICS.filter((d) => d.expected).length);
    expect(c.present).toBe(0);
    expect(c.pct).toBe(0);
  });
});

describe("fmtNum", () => {
  it("formats rupees in lakh and crore", () => {
    expect(fmtNum(250000, "inr")).toBe("₹2.5L");
    expect(fmtNum(155000000, "inr")).toBe("₹15.5 Cr");
    expect(fmtNum(100000000, "inr")).toBe("₹10 Cr");
    expect(fmtNum(12500000, "inr")).toBe("₹1.25 Cr");
    expect(fmtNum(300000, "inr")).toBe("₹3L");
    expect(fmtNum(42000, "inr")).toBe("₹42,000");
  });

  it("formats percent, rank, ratio and count", () => {
    expect(fmtNum(67.67, "percent")).toBe("68%");
    expect(fmtNum(108, "rank")).toBe("#108");
    expect(fmtNum(28.4, "ratio")).toBe("1:28");
    expect(fmtNum(125000, "count")).toBe("1,25,000");
  });
});

describe("fmtFact", () => {
  it("says Not available for missing or UNAVAILABLE facts", () => {
    expect(fmtFact(undefined)).toBe("Not available");
    expect(fmtFact(mkFact("placement.rate", "2025", null, { status: "UNAVAILABLE" }))).toBe("Not available");
  });

  it("uses the metric's unit", () => {
    expect(fmtFact(mkFact("placement.rate", "2025", 71))).toBe("71%");
    expect(fmtFact(mkFact("naac.validUntil", "current", "2029-06-30"))).toBe("30-Jun-2029");
    expect(fmtFact(mkFact("naac.grade", "current", "A"))).toBe("A");
  });
});
