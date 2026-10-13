import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { METRICS } from "../metrics";
import { parseWorkbook, type Known } from "./parse";
import { NO_SOURCE_REASON, SHEETS, type SheetName } from "./schemas";
import { buildTemplate } from "./template";

const TODAY = new Date("2026-10-13T00:00:00Z");
const CODE = "C-TEST-1";

type Rows = Record<string, unknown>[];

function workbook(sheets: Partial<Record<SheetName, Rows>>): Buffer {
  const wb = XLSX.utils.book_new();
  for (const def of SHEETS) {
    const rows = sheets[def.name];
    if (!rows) continue;
    const header = def.columns.map((c) => c.key);
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows.map((r) => header.map((k) => r[k] ?? null))]);
    XLSX.utils.book_append_sheet(wb, ws, def.name);
  }
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

const inst = (over: Record<string, unknown> = {}) => ({
  aisheCode: CODE,
  name: "Test College",
  city: "Testpur",
  state: "Test State",
  ownership: "Private",
  university: "Test University",
  ...over,
});

const fact = (over: Record<string, unknown> = {}) => ({
  aisheCode: CODE,
  metricKey: "admissions.total",
  period: "2024-25",
  value: 400,
  sourceType: "UNIVERSITY_PORTAL",
  sourceName: "Portal",
  asOfDate: "2025-08-01",
  status: "VERIFIED",
  ...over,
});

const parse = (sheets: Partial<Record<SheetName, Rows>>, known?: Known) =>
  parseWorkbook(workbook(sheets), "test.xlsx", known, { today: TODAY });

/** Parse one Fact row next to a valid institution and return its rejection reason, if any. */
function factReason(over: Record<string, unknown>, extra: Partial<Record<SheetName, Rows>> = {}): string | undefined {
  const r = parse({ Institution: [inst()], Facts: [fact(over)], ...extra });
  return r.rejected.find((x) => x.sheet === "Facts")?.reason;
}

describe("template", () => {
  it("round-trips through the parser with every example row accepted", () => {
    const r = parseWorkbook(buildTemplate(), "iip-import-template.xlsx", undefined, { today: TODAY });
    expect(r.errors).toEqual([]);
    expect(r.rejected).toEqual([]);
    expect(r.institutions).toHaveLength(1);
    expect(r.facts.length).toBeGreaterThanOrEqual(2);
    expect(r.programmes.length + r.promoters.length + r.legal.length + r.recruiters.length).toBeGreaterThan(3);
  });

  it("lists every metric key in the README", () => {
    const wb = XLSX.read(buildTemplate(), { type: "buffer" });
    const text = XLSX.utils.sheet_to_csv(wb.Sheets.README);
    for (const d of METRICS) expect(text).toContain(d.key);
    expect(wb.SheetNames).toEqual(["README", ...SHEETS.map((s) => s.name)]);
  });
});

describe("fact source rules", () => {
  it.each(["sourceType", "sourceName", "asOfDate"])("rejects a fact without %s", (col) => {
    expect(factReason({ [col]: null })).toBe(NO_SOURCE_REASON);
  });

  it("rejects INSTITUTION + VERIFIED", () => {
    expect(factReason({ sourceType: "INSTITUTION", status: "VERIFIED" })).toMatch(/INSTITUTION cannot have status VERIFIED/);
    expect(factReason({ sourceType: "INSTITUTION", status: "SELF_REPORTED" })).toBeUndefined();
  });

  it("trims and upper-cases enum cells", () => {
    const r = parse({ Institution: [inst()], Facts: [fact({ sourceType: "  government ", status: "verified" })] });
    expect(r.rejected).toEqual([]);
    expect(r.facts[0]).toMatchObject({ sourceType: "GOVERNMENT", status: "VERIFIED" });
  });

  it("rejects unknown enum values with the allowed list", () => {
    expect(factReason({ status: "CONFIRMED" })).toMatch(/status must be one of VERIFIED, SELF_REPORTED/);
    expect(factReason({ status: null })).toBe("status is required");
  });
});

describe("metric, period and programme", () => {
  it("rejects an unknown metricKey", () => {
    expect(factReason({ metricKey: "admissions.totl" })).toBe("Unknown metricKey 'admissions.totl'");
  });

  it("checks period against the metric's period kind", () => {
    expect(factReason({ period: "2024" })).toMatch(/period '2024' is not valid for admissions.total/);
    expect(factReason({ period: "2024-26" })).toMatch(/academic year/);
    expect(factReason({ metricKey: "placement.placed", period: "2024-25" })).toMatch(/a year such as 2025/);
    expect(factReason({ metricKey: "capacity.total", period: "2025" })).toMatch(/'current'/);
  });

  it("accepts a numeric year cell and any casing of current", () => {
    const r = parse({
      Institution: [inst()],
      Facts: [fact({ metricKey: "placement.placed", period: 2025 }), fact({ metricKey: "capacity.total", period: "Current" })],
    });
    expect(r.rejected).toEqual([]);
    expect(r.facts.map((f) => f.period)).toEqual(["2025", "current"]);
  });

  it("allows programme only on per-programme metrics", () => {
    const Programmes = [{ aisheCode: CODE, name: "MBA", level: "pg" }];
    expect(factReason({ metricKey: "students.total", programme: "MBA" }, { Programmes })).toMatch(/programme is not allowed/);
    expect(factReason({ programme: "MBA" }, { Programmes })).toBeUndefined();
  });

  it("requires programme to match a Programmes row or a known programme", () => {
    expect(factReason({ programme: "MBA" })).toMatch(/programme 'MBA' does not match/);
    const known: Known = { institutions: new Set([CODE]), programmes: new Set([`${CODE}|MBA`]) };
    const r = parse({ Facts: [fact({ programme: "MBA" })] }, known);
    expect(r.rejected).toEqual([]);
    expect(r.facts[0].programme).toBe("MBA");
  });
});

describe("values", () => {
  it("stores numbers, text and dates in the right column", () => {
    const r = parse({
      Institution: [inst()],
      Facts: [
        fact({ value: "412" }),
        fact({ metricKey: "naac.grade", period: "current", value: "A+" }),
        fact({ metricKey: "naac.validUntil", period: "current", value: "2028-03-31" }),
      ],
    });
    expect(r.rejected).toEqual([]);
    expect(r.facts.map((f) => [f.valueNum, f.valueText])).toEqual([
      [412, null],
      [null, "A+"],
      [null, "2028-03-31"],
    ]);
  });

  it("rejects non-numeric values for numeric units", () => {
    expect(factReason({ value: "about 400" })).toMatch(/must be a plain number/);
    expect(factReason({ value: "4,00,000" })).toMatch(/must be a plain number/);
    expect(factReason({ value: 400.5 })).toMatch(/whole number/);
    expect(factReason({ value: -1 })).toMatch(/cannot be negative/);
  });

  it("keeps percent within 0-100", () => {
    expect(factReason({ metricKey: "pass.rate", value: 101 })).toMatch(/between 0 and 100/);
    expect(factReason({ metricKey: "pass.rate", value: 87.5 })).toBeUndefined();
  });

  it("rejects a bad date value", () => {
    expect(factReason({ metricKey: "naac.validUntil", period: "current", value: "March 2028" })).toMatch(/must be a date/);
  });

  it("requires a value unless status is UNAVAILABLE", () => {
    expect(factReason({ value: null })).toBe("value is required unless status is UNAVAILABLE");
    const r = parse({ Institution: [inst()], Facts: [fact({ value: null, status: "UNAVAILABLE" })] });
    expect(r.rejected).toEqual([]);
    expect(r.facts[0]).toMatchObject({ valueNum: null, valueText: null, status: "UNAVAILABLE" });
  });
});

describe("asOfDate", () => {
  it("accepts ISO strings and Excel serials", () => {
    // 45870 is 2025-08-01 in the 1900 date system
    const r = parse({ Institution: [inst()], Facts: [fact(), fact({ asOfDate: 45870 })] });
    expect(r.rejected).toEqual([]);
    expect(r.facts.map((f) => f.asOfDate)).toEqual(["2025-08-01T00:00:00.000Z", "2025-08-01T00:00:00.000Z"]);
  });

  it("rejects unparseable and future dates", () => {
    expect(factReason({ asOfDate: "01/08/2025" })).toMatch(/not a valid date/);
    expect(factReason({ asOfDate: "2025-02-30" })).toMatch(/not a valid date/);
    expect(factReason({ asOfDate: "2026-10-14" })).toBe("asOfDate 2026-10-14 is in the future");
    expect(factReason({ asOfDate: "2026-10-13" })).toBeUndefined();
  });
});

describe("institution references", () => {
  it("rejects rows whose aisheCode is in neither the file nor the database", () => {
    const r = parse({ Institution: [inst()], Facts: [fact({ aisheCode: "C-OTHER" })] });
    expect(r.rejected).toEqual([{ sheet: "Facts", row: 2, reason: expect.stringMatching(/aisheCode 'C-OTHER' does not match/) }]);
  });

  it("accepts rows for an existing institution and reports the right row numbers", () => {
    const known: Known = { institutions: new Set([CODE]), programmes: new Set() };
    const r = parse({ Facts: [fact(), fact({ sourceName: null }), fact({ value: 380 })] }, known);
    expect(r.facts.map((f) => f.row)).toEqual([2, 4]);
    expect(r.rejected).toEqual([{ sheet: "Facts", row: 3, reason: NO_SOURCE_REASON }]);
    expect(r.counts.Facts).toEqual({ accepted: 2, rejected: 1 });
  });

  it("does not let a rejected Institution row vouch for its facts", () => {
    const r = parse({ Institution: [inst({ city: null })], Facts: [fact()] });
    expect(r.institutions).toEqual([]);
    expect(r.rejected.map((x) => [x.sheet, x.reason])).toEqual([
      ["Institution", "city is required"],
      ["Facts", expect.stringMatching(/does not match/)],
    ]);
  });

  it("rejects duplicate and already-existing institutions", () => {
    expect(parse({ Institution: [inst(), inst()] }).rejected[0].reason).toMatch(/Duplicate aisheCode/);
    const known: Known = { institutions: new Set([CODE]), programmes: new Set() };
    expect(parse({ Institution: [inst()] }, known).rejected[0].reason).toMatch(/already exists/);
  });

  it("requires overallRiskNote when overallRisk is set", () => {
    expect(parse({ Institution: [inst({ overallRisk: "red" })] }).rejected[0].reason).toMatch(/overallRiskNote is required/);
    const ok = parse({ Institution: [inst({ overallRisk: "red", overallRiskNote: "why", opportunity: "high" })] });
    expect(ok.institutions[0]).toMatchObject({ overallRisk: "RED", opportunity: "HIGH", established: null });
    expect(parse({ Institution: [inst({ overallRisk: "ORANGE", overallRiskNote: "x" })] }).rejected[0].reason).toMatch(
      /overallRisk must be one of GREEN, AMBER, RED/,
    );
  });
});

describe("other sheets", () => {
  const legal = (over: Record<string, unknown> = {}) => ({
    aisheCode: CODE,
    stage: "FIR",
    title: "Matter",
    forum: "PS Testpur",
    year: 2023,
    summary: "Summary",
    currentStatus: "Pending",
    sourceName: "Register",
    asOfDate: "2025-01-10",
    ...over,
  });
  const promoter = { aisheCode: CODE, name: "Test Trust", kind: "trust", role: "Sponsor", sourceName: "Deed", asOfDate: "2025-01-10" };

  it("needs sourceName and asOfDate on legal records and an exact stage", () => {
    const r = parse({
      Institution: [inst()],
      LegalRecords: [legal(), legal({ sourceName: null }), legal({ asOfDate: null }), legal({ stage: "Civil dispute" }), legal({ stage: " civil_dispute " })],
    });
    expect(r.legal.map((l) => [l.row, l.stage])).toEqual([
      [2, "FIR"],
      [6, "CIVIL_DISPUTE"],
    ]);
    expect(r.rejected.map((x) => [x.row, x.reason])).toEqual([
      [3, "sourceName is required"],
      [4, "asOfDate is required"],
      [5, expect.stringMatching(/^stage must be one of COMPLAINT, FIR/)],
    ]);
  });

  it("links legal records to promoters by name", () => {
    const r = parse({
      Institution: [inst()],
      Promoters: [promoter],
      LegalRecords: [legal({ promoterName: "Test Trust" }), legal({ promoterName: "Nobody" })],
    });
    expect(r.promoters[0].kind).toBe("TRUST");
    expect(r.legal).toHaveLength(1);
    expect(r.rejected[0].reason).toMatch(/promoterName 'Nobody' does not match/);
  });

  it("parses recruiter years and normalises sector", () => {
    const rec = (over: Record<string, unknown>) => ({
      aisheCode: CODE,
      name: "Acme",
      sector: "it",
      years: "2025, 2023,2024",
      sourceType: "institution",
      sourceName: "Brochure",
      asOfDate: "2025-07-01",
      status: "self_reported",
      ...over,
    });
    const r = parse({ Institution: [inst()], Recruiters: [rec({}), rec({ years: 2025 }), rec({ years: "2023-2025" }), rec({ sector: "Retail" })] });
    expect(r.recruiters.map((x) => [x.sector, x.years])).toEqual([
      ["IT", [2023, 2024, 2025]],
      ["IT", [2025]],
    ]);
    expect(r.rejected.map((x) => x.reason)).toEqual([
      expect.stringMatching(/years must be comma-separated/),
      expect.stringMatching(/sector must be one of/),
    ]);
  });

  it("rejects duplicate programmes and bad levels", () => {
    const r = parse({
      Institution: [inst()],
      Programmes: [
        { aisheCode: CODE, name: "MBA", level: "PG" },
        { aisheCode: CODE, name: "MBA", level: "PG" },
        { aisheCode: CODE, name: "BBA", level: "Bachelor" },
      ],
    });
    expect(r.programmes).toHaveLength(1);
    expect(r.rejected.map((x) => x.reason)).toEqual([expect.stringMatching(/Duplicate programme/), expect.stringMatching(/level must be one of/)]);
  });
});

describe("files", () => {
  const csv = (lines: string[]) => new TextEncoder().encode(lines.join("\n"));
  const header = "aisheCode,metricKey,period,programme,value,sourceType,sourceName,sourceUrl,asOfDate,status,note";

  it("reads a .csv as a single Facts sheet", () => {
    const known: Known = { institutions: new Set([CODE]), programmes: new Set() };
    const r = parseWorkbook(
      csv([
        "﻿" + header,
        `${CODE},placement.placed,2025,,310,UNIVERSITY_PORTAL,Portal,,2025-08-01,VERIFIED,`,
        `${CODE},placement.average,2025,,450000,institution,"Brochure, 2025",,2025-07-01,self_reported,`,
        `${CODE},placement.rate,2025,,82,,,,,VERIFIED,`,
      ]),
      "facts.csv",
      known,
      { today: TODAY },
    );
    expect(r.errors).toEqual([]);
    expect(r.facts.map((f) => [f.period, f.valueNum, f.sourceName])).toEqual([
      ["2025", 310, "Portal"],
      ["2025", 450000, "Brochure, 2025"],
    ]);
    expect(r.rejected).toEqual([{ sheet: "Facts", row: 4, reason: NO_SOURCE_REASON }]);
  });

  it("rejects csv facts when the institution does not exist", () => {
    const r = parseWorkbook(csv([header, `${CODE},placement.placed,2025,,310,GOVERNMENT,Src,,2025-08-01,VERIFIED,`]), "facts.csv", undefined, {
      today: TODAY,
    });
    expect(r.facts).toEqual([]);
    expect(r.rejected[0].reason).toMatch(/does not match/);
  });

  it("rejects every row of a sheet that lacks a required column", () => {
    const r = parseWorkbook(csv(["aisheCode,metricKey,period,value", `${CODE},placement.placed,2025,310`]), "facts.csv", undefined, { today: TODAY });
    expect(r.rejected[0].reason).toMatch(/missing required column\(s\): sourceType, sourceName, asOfDate, status/);
  });

  it("reports unsupported and unrecognised files as file errors", () => {
    expect(parseWorkbook(new Uint8Array([1, 2, 3]), "data.pdf").errors[0]).toMatch(/Unsupported file type/);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["a"], [1]]), "Sheet1");
    const r = parseWorkbook(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, "x.xlsx");
    expect(r.errors[0]).toMatch(/No recognised sheets/);
  });

  it("skips blank rows without losing row numbers", () => {
    const wb = XLSX.utils.book_new();
    const cols = SHEETS.find((s) => s.name === "Institution")!.columns.map((c) => c.key);
    const row = inst();
    const line = (r: Record<string, unknown>) => cols.map((k) => r[k] ?? null);
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([cols, [], line(row), [], line({ ...row, aisheCode: "C-2", name: null })]), "institution");
    const r = parseWorkbook(XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer, "x.xlsx", undefined, { today: TODAY });
    expect(r.institutions.map((i) => i.row)).toEqual([3]);
    expect(r.rejected).toEqual([{ sheet: "Institution", row: 5, reason: "name is required" }]);
  });
});
