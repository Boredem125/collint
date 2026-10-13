import * as XLSX from "xlsx";
import { METRICS, MODULES } from "../metrics";
import { SHEETS, VALIDATION_RULES, type SheetName } from "./schemas";

export const TEMPLATE_FILENAME = "iip-import-template.xlsx";

const CODE = "C-EXAMPLE-0001";
const SRC_PORTAL = "Example State University admissions portal (fictional)";
const SRC_PROSPECTUS = "Example Institute prospectus 2025 (fictional)";

type Row = Record<string, string | number>;

// An obviously fictional institution. Rows pass validation so the file can be test-uploaded as is.
const EXAMPLES: Record<SheetName, Row[]> = {
  Institution: [
    {
      aisheCode: CODE,
      name: "Example Institute of Technology (FICTIONAL)",
      city: "Sampleville",
      state: "Example State",
      established: 2001,
      ownership: "Private unaided",
      university: "Example State University",
      campusStatus: "Operational",
      overallRisk: "AMBER",
      overallRiskNote: "Example row: admissions claim not yet reconciled with the university portal",
      opportunity: "MEDIUM",
      opportunityNote: "Example row",
    },
  ],
  Programmes: [
    { aisheCode: CODE, name: "B.Tech Computer Science", level: "UG", startedYear: 2001 },
    { aisheCode: CODE, name: "MBA", level: "PG", startedYear: 2008 },
  ],
  Facts: [
    {
      aisheCode: CODE,
      metricKey: "admissions.total",
      period: "2024-25",
      value: 420,
      sourceType: "INSTITUTION",
      sourceName: SRC_PROSPECTUS,
      asOfDate: "2025-06-30",
      status: "SELF_REPORTED",
      note: "College claim",
    },
    {
      aisheCode: CODE,
      metricKey: "admissions.total",
      period: "2024-25",
      value: 388,
      sourceType: "UNIVERSITY_PORTAL",
      sourceName: SRC_PORTAL,
      sourceUrl: "https://example.invalid/admissions",
      asOfDate: "2025-08-15",
      status: "VERIFIED",
      note: "Same number from an independent source: a second row, not an overwrite",
    },
    {
      aisheCode: CODE,
      metricKey: "fee.annual",
      period: "2024-25",
      programme: "B.Tech Computer Science",
      value: 125000,
      sourceType: "INSTITUTION",
      sourceName: SRC_PROSPECTUS,
      asOfDate: "2025-06-30",
      status: "SELF_REPORTED",
      note: "Per-programme metric, in rupees",
    },
  ],
  Promoters: [
    {
      aisheCode: CODE,
      name: "Example Education Trust (FICTIONAL)",
      kind: "TRUST",
      role: "Sponsoring body",
      established: 1998,
      sourceName: "Example trust deed (fictional)",
      asOfDate: "2025-03-01",
    },
    {
      aisheCode: CODE,
      name: "A. N. Example (FICTIONAL)",
      kind: "PERSON",
      role: "Chairman",
      sourceName: "Example Institute mandatory disclosure (fictional)",
      asOfDate: "2025-03-01",
    },
  ],
  LegalRecords: [
    {
      aisheCode: CODE,
      promoterName: "Example Education Trust (FICTIONAL)",
      stage: "CIVIL_DISPUTE",
      title: "Example land boundary suit (fictional)",
      forum: "Example District Court",
      year: 2022,
      summary: "Example row: suit filed by a neighbouring landowner over a boundary",
      currentStatus: "Pending",
      sourceName: "Example court cause list (fictional)",
      asOfDate: "2025-09-10",
    },
  ],
  Recruiters: [
    {
      aisheCode: CODE,
      name: "Example Software Ltd (FICTIONAL)",
      sector: "IT",
      years: "2023, 2024, 2025",
      sourceType: "INSTITUTION",
      sourceName: "Example Institute placement brochure (fictional)",
      asOfDate: "2025-07-01",
      status: "SELF_REPORTED",
    },
    {
      aisheCode: CODE,
      name: "Example Bank (FICTIONAL)",
      sector: "BFSI",
      years: "2025",
      sourceType: "INSTITUTION",
      sourceName: "Example Institute placement brochure (fictional)",
      asOfDate: "2025-07-01",
      status: "SELF_REPORTED",
    },
  ],
};

const PERIOD_EXAMPLE = { AY: "AY, e.g. 2024-25", YEAR: "YEAR, e.g. 2025", CURRENT: "CURRENT: current" };

function readme(): (string | number)[][] {
  const moduleLabel = Object.fromEntries(MODULES.map((m) => [m.key, m.label]));
  const rows: (string | number)[][] = [
    ["Institution Intelligence Platform: import template"],
    ["Fill one sheet per kind of data, then upload this file on the Import page. Columns marked Required must be filled on every row."],
    ["The example rows describe a fictional institution. Delete them before uploading real data."],
    [],
    ["VALIDATION RULES"],
    ...VALIDATION_RULES.map((r, i) => [`${i + 1}. ${r}`]),
    [],
    ["COLUMNS"],
    ["Sheet", "Column", "Required", "What to enter"],
  ];
  for (const s of SHEETS) {
    rows.push([s.name, "", "", s.purpose]);
    for (const col of s.columns) rows.push([s.name, col.key, col.required ? "Required" : "Optional", col.help]);
  }
  rows.push([], ["METRIC KEYS (Facts sheet, metricKey column)"], ["metricKey", "Label", "Unit", "Period", "Per-programme", "Module"]);
  for (const d of METRICS)
    rows.push([d.key, d.label, d.unit, PERIOD_EXAMPLE[d.period], d.perProgramme ? "Yes" : "No", moduleLabel[d.module]]);
  rows.push(
    [],
    ["UNITS"],
    ["count", "Whole number"],
    ["percent", "Number from 0 to 100, without the % sign"],
    ["inr", "Rupees as a plain number: 2.5 lakh = 250000"],
    ["rank", "Whole number, 1 or more. Leave the row out, or use status UNAVAILABLE, when not ranked"],
    ["ratio", "Students per faculty member, e.g. 18 for 1:18"],
    ["acre / sqft", "Plain number"],
    ["text", "Free text, e.g. A+ or Approved"],
    ["date", "YYYY-MM-DD"],
  );
  return rows;
}

/** The blank import workbook: README plus one sheet per shape with example rows. */
export function buildTemplate(): Buffer {
  const wb = XLSX.utils.book_new();

  const info = XLSX.utils.aoa_to_sheet(readme());
  info["!cols"] = [{ wch: 28 }, { wch: 30 }, { wch: 12 }, { wch: 26 }, { wch: 16 }, { wch: 26 }];
  XLSX.utils.book_append_sheet(wb, info, "README");

  for (const s of SHEETS) {
    const header = s.columns.map((col) => col.key);
    const body = EXAMPLES[s.name].map((r) => header.map((k) => r[k] ?? ""));
    const ws = XLSX.utils.aoa_to_sheet([header, ...body]);
    ws["!cols"] = header.map((k) => ({ wch: Math.max(14, k.length + 4) }));
    XLSX.utils.book_append_sheet(wb, ws, s.name);
  }

  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}
