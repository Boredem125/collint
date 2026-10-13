import { describe, expect, it } from "vitest";
import type { FactT, Flag, LegalRecordT, LegalStage, Profile } from "./types";
import { deriveFlags, THRESHOLDS } from "./risk";

const TODAY = new Date("2026-10-13T00:00:00.000Z");

let n = 0;
const mkFact = (metricKey: string, period: string, value: number | string | null, over: Partial<FactT> = {}): FactT => ({
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

const claim = (key: string, period: string, value: number, status: FactT["status"] = "SELF_REPORTED") =>
  mkFact(key, period, value, { sourceType: "INSTITUTION", sourceName: "College claim", status });

const mkLegal = (stage: LegalStage, currentStatus = "Pending", over: Partial<LegalRecordT> = {}): LegalRecordT => ({
  id: `l-${stage}`,
  promoterId: "pr1",
  stage,
  title: "Sample matter",
  forum: "Sample Forum",
  year: 2024,
  summary: "Neutral summary.",
  currentStatus,
  sourceName: "Sample citation 1/2024",
  sourceUrl: null,
  asOfDate: "2026-08-01T00:00:00.000Z",
  ...over,
});

const mkProfile = (facts: FactT[], legal: LegalRecordT[] = []): Profile => ({
  inst: {
    id: "i1",
    name: "Test College",
    aisheCode: "C-0",
    city: "X",
    state: "Y",
    established: null,
    ownership: "Private Trust",
    university: "U",
    campusStatus: "Operational",
    isSample: true,
    overallRisk: null,
    overallRiskNote: null,
    opportunity: null,
    opportunityNote: null,
  },
  facts,
  programmes: [],
  promoters: [{ id: "pr1", name: "Sample Trust", kind: "TRUST", role: "Sponsor", established: null, sourceName: "s", sourceUrl: null, asOfDate: "2026-01-01T00:00:00.000Z", entities: [] }],
  legal,
  recruiters: [],
});

const run = (facts: FactT[], legal: LegalRecordT[] = []) => deriveFlags(mkProfile(facts, legal), TODAY);
const get = (flags: Flag[], id: string) => flags.find((f) => f.id === id);
const ids = (flags: Flag[]) => flags.map((f) => f.id);

const AYS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"];
/** Intake and verified admissions per year, giving a utilisation series. */
const admissions = (intake: number, adm: number[]) =>
  adm.flatMap((a, i) => [
    mkFact("intake.approved", AYS[i], intake, { sourceType: "REGULATOR" }),
    mkFact("admissions.total", AYS[i], a, { sourceType: "UNIVERSITY_PORTAL" }),
  ]);
const rates = (values: number[], start = 2021) => values.map((v, i) => mkFact("placement.rate", String(start + i), v));

describe("deriveFlags: critical rules", () => {
  it("flags admission variance above 10% in the latest year with both sources", () => {
    const facts = [
      ...admissions(1200, [760, 743, 800, 812]),
      claim("admissions.total", "2024-25", 950),
      // Latest year has a claim only, so the rule must fall back to 2024-25
      claim("admissions.total", "2025-26", 965),
    ];
    const f = get(run(facts), "admissions-variance-critical");
    expect(f?.band).toBe("CRITICAL");
    expect(f!.title).toContain("14.5%");
    expect(f!.title).toContain("2024-25");
    expect(f!.detail).toContain("138");
    expect(f!.evidence.map((e) => e.valueNum)).toEqual([950, 812]);
    expect(get(run(facts), "admissions-variance")).toBeUndefined();
  });

  it.each([
    ["ugc.status", "recognition-ugc", "Not recognised"],
    ["aicte.status", "recognition-aicte", "Approval withdrawn for 2025-26"],
    ["affiliation.status", "recognition-affiliation", "Affiliation lapsed"],
  ])("flags %s when the text indicates no current recognition", (key, id, text) => {
    const fact = mkFact(key, "current", text, { sourceType: "REGULATOR" });
    const flags = run([fact]);
    expect(get(flags, id)?.band).toBe("CRITICAL");
    expect(get(flags, id)!.evidence).toEqual([fact]);
    expect(flags.some((f) => f.band === "VERIFIED")).toBe(false);
  });

  it.each<LegalStage>(["CONVICTION", "PROSECUTION", "REGULATORY_ACTION", "INSOLVENCY"])(
    "flags an open %s record as critical, naming the stage without implying guilt",
    (stage) => {
      const f = get(run([], [mkLegal(stage)]), `legal-l-${stage}`)!;
      expect(f.band).toBe("CRITICAL");
      expect(f.module).toBe("promoter");
      expect(f.evidence).toEqual([]);
      expect(f.title.toLowerCase()).toContain("requires review");
      expect(f.detail).toContain("Sample Forum, 2024");
      expect(f.detail).toContain("Sample citation 1/2024");
      expect(f.detail).toContain("Sample Trust");
      expect(`${f.title} ${f.detail}`).not.toMatch(/guilty|fraud|wrongdoer|offender/i);
    },
  );

  it("names the exact stage in each legal flag", () => {
    const flags = run([], [mkLegal("REGULATORY_ACTION"), mkLegal("PROSECUTION")]);
    expect(get(flags, "legal-l-REGULATORY_ACTION")!.title).toMatch(/^Regulatory action/);
    expect(get(flags, "legal-l-PROSECUTION")!.title).toMatch(/^Prosecution/);
  });

  it("ignores closed records and acquittals", () => {
    const flags = run([], [mkLegal("REGULATORY_ACTION", "Closed; notice withdrawn"), mkLegal("CIVIL_DISPUTE", "Disposed in 2025"), mkLegal("ACQUITTAL", "Final")]);
    expect(flags).toEqual([]);
  });
});

describe("deriveFlags: attention rules", () => {
  it("flags admission variance between 5% and 10% as attention", () => {
    const facts = [...admissions(1000, [800]), claim("admissions.total", "2021-22", 860)];
    const flags = run(facts);
    expect(get(flags, "admissions-variance")?.band).toBe("ATTENTION");
    expect(get(flags, "admissions-variance-critical")).toBeUndefined();
  });

  it("does not flag admission variance under 5%", () => {
    const flags = run([...admissions(1000, [800]), claim("admissions.total", "2021-22", 820)]);
    expect(ids(flags)).not.toContain("admissions-variance");
    expect(ids(flags)).not.toContain("admissions-variance-critical");
  });

  it("flags utilisation that fell in each of the last two steps", () => {
    const f = get(run(admissions(1000, [700, 780, 720, 650])), "utilisation-falling")!;
    expect(f.band).toBe("ATTENTION");
    // Three years, each with admissions and intake as basis
    expect(f.evidence).toHaveLength(6);
    expect(ids(run(admissions(1000, [700, 650, 720, 700])))).not.toContain("utilisation-falling");
    expect(ids(run(admissions(1000, [700, 650])))).not.toContain("utilisation-falling");
  });

  it("flags latest utilisation below the threshold", () => {
    const f = get(run(admissions(1000, [700, 590])), "utilisation-low")!;
    expect(f.band).toBe("ATTENTION");
    expect(f.evidence.map((e) => e.valueNum)).toEqual([590, 1000]);
    expect(ids(run(admissions(1000, [590, 600])))).not.toContain("utilisation-low");
  });

  it("flags a placement rate that fell two steps running", () => {
    const f = get(run(rates([58, 54, 49])), "placement-falling")!;
    expect(f.band).toBe("ATTENTION");
    expect(f.evidence.map((e) => e.valueNum)).toEqual([58, 54, 49]);
    expect(ids(run(rates([58, 60, 55])))).not.toContain("placement-falling");
  });

  it("flags a placement claim more than 10 points above the independent source", () => {
    const facts = [mkFact("placement.rate", "2025", 71), claim("placement.rate", "2025", 92)];
    const f = get(run(facts), "placement-claim-gap")!;
    expect(f.band).toBe("ATTENTION");
    expect(f.title).toContain("21 points");
    expect(f.evidence.map((e) => e.valueNum)).toEqual([92, 71]);
    expect(ids(run([mkFact("placement.rate", "2025", 83), claim("placement.rate", "2025", 84)]))).not.toContain("placement-claim-gap");
  });

  it.each(["SELF_REPORTED", "NEEDS_VALIDATION"] as const)("flags a latest placement rate that is only %s", (status) => {
    const facts = [mkFact("placement.rate", "2024", 44), claim("placement.rate", "2025", 38, status)];
    const f = get(run(facts), "placement-self-reported")!;
    expect(f.band).toBe("ATTENTION");
    expect(f.evidence).toHaveLength(1);
    expect(f.evidence[0].valueNum).toBe(38);
    expect(ids(run(rates([70, 71])))).not.toContain("placement-self-reported");
  });

  it("flags expired NAAC as attention, not critical", () => {
    const facts = [
      mkFact("naac.validUntil", "current", "2025-03-31", { sourceType: "REGULATOR" }),
      mkFact("naac.grade", "current", "B+", { sourceType: "REGULATOR" }),
    ];
    const flags = run(facts);
    expect(get(flags, "naac-expired")?.band).toBe("ATTENTION");
    expect(get(flags, "naac-expired")!.evidence).toHaveLength(2);
    expect(flags.some((f) => f.band === "CRITICAL")).toBe(false);
    expect(ids(flags)).not.toContain("verified-naac");
  });

  it("flags hostel occupancy under half of capacity", () => {
    const hostel = (occ: number) => [mkFact("hostel.capacity", "current", 600), mkFact("hostel.occupancy", "current", occ)];
    expect(get(run(hostel(210)), "hostel-occupancy-low")?.band).toBe("ATTENTION");
    expect(get(run(hostel(210)), "hostel-occupancy-low")!.evidence.map((e) => e.valueNum)).toEqual([210, 600]);
    expect(ids(run(hostel(300)))).not.toContain("hostel-occupancy-low");
    expect(ids(run([mkFact("hostel.capacity", "current", 600)]))).not.toContain("hostel-occupancy-low");
  });

  it("flags collection efficiency under 85% in the latest year", () => {
    const eff = (a: number, b: number) => [mkFact("fee.collectionEfficiency", "2024-25", a), mkFact("fee.collectionEfficiency", "2025-26", b)];
    const f = get(run(eff(90, 78)), "collection-efficiency-low")!;
    expect(f.band).toBe("ATTENTION");
    expect(f.evidence[0].valueNum).toBe(78);
    expect(ids(run(eff(78, 90)))).not.toContain("collection-efficiency-low");
  });

  it("flags a student to faculty ratio worse than 1:25", () => {
    const ratio = (students: number, faculty: number) => [mkFact("students.total", "2025-26", students), mkFact("faculty.total", "2025-26", faculty)];
    const f = get(run(ratio(3350, 118)), "student-faculty-ratio")!;
    expect(f.band).toBe("ATTENTION");
    expect(f.detail).toContain("1:28");
    expect(f.evidence.map((e) => e.valueNum)).toEqual([3350, 118]);
    expect(ids(run(ratio(2500, 100)))).not.toContain("student-faculty-ratio");
  });

  it.each<LegalStage>(["CIVIL_DISPUTE", "COMPLAINT", "FIR", "CHARGE"])("flags an open %s record as attention, requires review", (stage) => {
    const f = get(run([], [mkLegal(stage, "Complaint on file; no further stage recorded")]), `legal-l-${stage}`)!;
    expect(f.band).toBe("ATTENTION");
    expect(f.evidence).toEqual([]);
    expect(f.title.toLowerCase()).toContain("requires review");
    expect(f.detail).toContain("Sample Forum, 2024");
  });

  it("raises one flag per legal record and never a combined count", () => {
    const flags = run([], [mkLegal("CIVIL_DISPUTE"), mkLegal("COMPLAINT"), mkLegal("REGULATORY_ACTION")]);
    expect(flags).toHaveLength(3);
    expect(new Set(flags.map((f) => f.title)).size).toBe(3);
  });
});

describe("deriveFlags: verified rules", () => {
  it.each([
    ["ugc.status", "verified-ugc", "Recognised under Section 2(f) and 12(B)"],
    ["aicte.status", "verified-aicte", "Approved (EOA 2025-26)"],
    ["affiliation.status", "verified-affiliation", "Affiliated (permanent)"],
  ])("marks %s as verified", (key, id, text) => {
    const fact = mkFact(key, "current", text, { sourceType: "REGULATOR" });
    const f = get(run([fact]), id)!;
    expect(f.band).toBe("VERIFIED");
    expect(f.evidence).toEqual([fact]);
    const selfReported = mkFact(key, "current", text, { sourceType: "INSTITUTION", status: "SELF_REPORTED" });
    expect(run([selfReported])).toEqual([]);
  });

  it("marks NAAC as verified when valid and both facts are verified", () => {
    const facts = (status: FactT["status"]) => [
      mkFact("naac.validUntil", "current", "2029-06-30", { sourceType: "REGULATOR", status }),
      mkFact("naac.grade", "current", "A", { sourceType: "REGULATOR" }),
    ];
    const f = get(run(facts("VERIFIED")), "verified-naac")!;
    expect(f.band).toBe("VERIFIED");
    expect(f.title).toContain("A");
    expect(run(facts("NEEDS_VALIDATION"))).toEqual([]);
  });

  it("marks admissions stable or rising on verified data only", () => {
    expect(get(run(admissions(1000, [700, 720, 760])), "verified-admissions")?.band).toBe("VERIFIED");
    expect(get(run(admissions(1000, [700, 705, 700])), "verified-admissions")?.band).toBe("VERIFIED");
    expect(ids(run(admissions(1000, [700, 650, 600])))).not.toContain("verified-admissions");
    const selfReported = [claim("admissions.total", "2023-24", 700), claim("admissions.total", "2024-25", 800)];
    expect(ids(run(selfReported))).not.toContain("verified-admissions");
  });

  it("marks placement stable or rising on verified data only", () => {
    const f = get(run(rates([73, 76, 79, 81, 83])), "verified-placement")!;
    expect(f.band).toBe("VERIFIED");
    expect(f.evidence).toHaveLength(5);
    expect(ids(run(rates([58, 54, 49])))).not.toContain("verified-placement");
    expect(ids(run([claim("placement.rate", "2024", 80), claim("placement.rate", "2025", 85)]))).not.toContain("verified-placement");
  });
});

describe("deriveFlags: output shape", () => {
  const facts = [
    mkFact("ugc.status", "current", "Recognised", { sourceType: "REGULATOR" }),
    mkFact("hostel.capacity", "current", 600),
    mkFact("hostel.occupancy", "current", 100),
    ...admissions(1200, [812]),
    claim("admissions.total", "2021-22", 950),
  ];

  it("sorts CRITICAL, then ATTENTION, then VERIFIED", () => {
    const bands = run(facts, [mkLegal("COMPLAINT")]).map((f) => f.band);
    expect(bands).toEqual([...bands].sort((a, b) => ["CRITICAL", "ATTENTION", "VERIFIED"].indexOf(a) - ["CRITICAL", "ATTENTION", "VERIFIED"].indexOf(b)));
    expect(new Set(bands)).toEqual(new Set(["CRITICAL", "ATTENTION", "VERIFIED"]));
  });

  it("gives every flag a unique, stable id", () => {
    const a = run(facts, [mkLegal("COMPLAINT")]);
    const b = run(facts, [mkLegal("COMPLAINT")]);
    expect(ids(a)).toEqual(ids(b));
    expect(new Set(ids(a)).size).toBe(a.length);
  });

  it("returns nothing for an empty profile and exposes thresholds", () => {
    expect(run([])).toEqual([]);
    expect(THRESHOLDS.admissionVarianceCritical).toBe(10);
    expect(THRESHOLDS.studentFacultyMax).toBe(25);
  });
});
