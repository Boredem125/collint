import * as XLSX from "xlsx";
import type { ZodTypeAny } from "zod";
import {
  NO_SOURCE_REASON,
  SHEETS,
  makeSchemas,
  type FactRow,
  type InstitutionRow,
  type LegalRow,
  type ProgrammeRow,
  type PromoterRow,
  type RecruiterRow,
  type SheetName,
} from "./schemas";

/** What already exists in the database. Keys are aisheCode, or "aisheCode|name". */
export interface Known {
  institutions: Set<string>;
  programmes: Set<string>;
  promoters?: Set<string>;
}

export interface Rejection {
  sheet: string;
  // 1-based spreadsheet row; the header is row 1
  row: number;
  reason: string;
}

export interface ParseResult {
  filename: string;
  institutions: InstitutionRow[];
  programmes: ProgrammeRow[];
  facts: FactRow[];
  promoters: PromoterRow[];
  legal: LegalRow[];
  recruiters: RecruiterRow[];
  rejected: Rejection[];
  counts: Record<SheetName, { accepted: number; rejected: number }>;
  // Problems with the file as a whole (unreadable, no recognised sheets)
  errors: string[];
  warnings: string[];
}

export interface ParseOptions {
  today?: Date;
}

type Cell = string | number | boolean | Date | null;
type RawRow = { row: number; cells: Record<string, Cell> };

const key = (aisheCode: string, name: string) => `${aisheCode}|${name}`;
const blank = (v: Cell | undefined) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

function emptyResult(filename: string): ParseResult {
  const counts = Object.fromEntries(SHEETS.map((s) => [s.name, { accepted: 0, rejected: 0 }])) as ParseResult["counts"];
  return {
    filename,
    institutions: [],
    programmes: [],
    facts: [],
    promoters: [],
    legal: [],
    recruiters: [],
    rejected: [],
    counts,
    errors: [],
    warnings: [],
  };
}

function toBytes(buf: ArrayBuffer | Uint8Array): Uint8Array {
  return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
}

function readWorkbook(buf: ArrayBuffer | Uint8Array, isCsv: boolean): XLSX.WorkBook {
  const bytes = toBytes(buf);
  if (!isCsv) return XLSX.read(bytes, { type: "array" });
  // raw keeps CSV cells as typed, so "2024" stays a period and dates stay ISO text
  const text = new TextDecoder("utf-8").decode(bytes).replace(/^﻿/, "");
  return XLSX.read(text, { type: "string", raw: true });
}

/** Rows of a sheet keyed by canonical column name, with their spreadsheet row numbers. */
function readSheet(ws: XLSX.WorkSheet, sheet: SheetName): { rows: RawRow[]; missing: string[] } {
  const def = SHEETS.find((s) => s.name === sheet)!;
  const required = def.columns.filter((c) => c.required).map((c) => c.key);
  if (!ws["!ref"]) return { rows: [], missing: required };
  const first = XLSX.utils.decode_range(ws["!ref"]).s.r;
  const grid = XLSX.utils.sheet_to_json<Cell[]>(ws, { header: 1, raw: true, defval: null, blankrows: true });
  const header = (grid[0] ?? []).map((h) => String(h ?? "").trim().replace(/\s*\*+$/, "").toLowerCase());
  const index = new Map<string, number>();
  for (const col of def.columns) {
    const i = header.indexOf(col.key.toLowerCase());
    if (i >= 0) index.set(col.key, i);
  }
  const missing = required.filter((k) => !index.has(k));
  const rows: RawRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const line = grid[i] ?? [];
    if (line.every((v) => blank(v))) continue;
    const cells: Record<string, Cell> = {};
    for (const col of def.columns) {
      const at = index.get(col.key);
      cells[col.key] = at === undefined ? null : (line[at] ?? null);
    }
    rows.push({ row: first + i + 1, cells });
  }
  return { rows, missing };
}

function reasons(schema: ZodTypeAny, cells: Record<string, Cell>): { ok: true; data: unknown } | { ok: false; reason: string } {
  const r = schema.safeParse(cells);
  if (r.success) return { ok: true, data: r.data };
  return { ok: false, reason: [...new Set(r.error.issues.map((i) => i.message))].join("; ") };
}

/**
 * Validate an uploaded workbook. Pure: no database access. Pass `known` so rows may refer to
 * institutions, programmes and promoters that already exist.
 */
export function parseWorkbook(
  buf: ArrayBuffer | Uint8Array,
  filename: string,
  known?: Known,
  options: ParseOptions = {},
): ParseResult {
  const out = emptyResult(filename);
  const schemas = makeSchemas(options.today ?? new Date());
  const isCsv = /\.csv$/i.test(filename);
  if (!isCsv && !/\.xlsx$/i.test(filename)) {
    out.errors.push("Unsupported file type. Upload the .xlsx template or a .csv of Facts.");
    return out;
  }

  let wb: XLSX.WorkBook;
  try {
    wb = readWorkbook(buf, isCsv);
  } catch {
    out.errors.push("The file could not be read. Save it again as .xlsx or .csv and retry.");
    return out;
  }

  // A CSV is one Facts sheet whatever SheetJS names it.
  const sheets = new Map<SheetName, XLSX.WorkSheet>();
  if (isCsv) {
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (ws) sheets.set("Facts", ws);
  } else {
    for (const name of wb.SheetNames) {
      const def = SHEETS.find((s) => s.name.toLowerCase() === name.trim().toLowerCase());
      if (def) sheets.set(def.name, wb.Sheets[name]);
      else if (name.trim().toLowerCase() !== "readme") out.warnings.push(`Sheet '${name}' is not part of the template and was ignored.`);
    }
  }
  if (!sheets.size) {
    out.errors.push("No recognised sheets. Expected one or more of: " + SHEETS.map((s) => s.name).join(", ") + ".");
    return out;
  }

  const reject = (sheet: SheetName, row: number, reason: string) => {
    out.rejected.push({ sheet, row, reason });
    out.counts[sheet].rejected++;
  };

  const load = (sheet: SheetName): RawRow[] => {
    const ws = sheets.get(sheet);
    if (!ws) return [];
    const { rows, missing } = readSheet(ws, sheet);
    if (missing.length && rows.length) {
      for (const r of rows) reject(sheet, r.row, `Sheet is missing required column(s): ${missing.join(", ")}`);
      return [];
    }
    return rows;
  };

  const institutions = new Set(known?.institutions ?? []);
  const programmes = new Set(known?.programmes ?? []);
  const promoters = new Set(known?.promoters ?? []);
  const unknownInstitution = (code: string) =>
    `aisheCode '${code}' does not match an accepted Institution row in this file or an existing institution`;

  for (const { row, cells } of load("Institution")) {
    const r = reasons(schemas.Institution, cells);
    if (!r.ok) {
      reject("Institution", row, r.reason);
      continue;
    }
    const data = { ...(r.data as Omit<InstitutionRow, "row">), row };
    if (known?.institutions.has(data.aisheCode)) {
      reject(
        "Institution",
        row,
        `Institution ${data.aisheCode} already exists; its details are not changed by import (rows for it on other sheets are still read)`,
      );
    } else if (institutions.has(data.aisheCode)) {
      reject("Institution", row, `Duplicate aisheCode '${data.aisheCode}' in this file`);
    } else {
      institutions.add(data.aisheCode);
      out.institutions.push(data);
    }
  }

  for (const { row, cells } of load("Programmes")) {
    const r = reasons(schemas.Programmes, cells);
    if (!r.ok) {
      reject("Programmes", row, r.reason);
      continue;
    }
    const data = { ...(r.data as Omit<ProgrammeRow, "row">), row };
    const k = key(data.aisheCode, data.name);
    if (!institutions.has(data.aisheCode)) reject("Programmes", row, unknownInstitution(data.aisheCode));
    else if (known?.programmes.has(k)) reject("Programmes", row, `Programme '${data.name}' already exists for this institution`);
    else if (programmes.has(k)) reject("Programmes", row, `Duplicate programme '${data.name}' in this file`);
    else {
      programmes.add(k);
      out.programmes.push(data);
    }
  }

  for (const { row, cells } of load("Facts")) {
    if (blank(cells.sourceType) || blank(cells.sourceName) || blank(cells.asOfDate)) {
      reject("Facts", row, NO_SOURCE_REASON);
      continue;
    }
    const r = reasons(schemas.Facts, cells);
    if (!r.ok) {
      reject("Facts", row, r.reason);
      continue;
    }
    const data = { ...(r.data as Omit<FactRow, "row">), row };
    if (!institutions.has(data.aisheCode)) reject("Facts", row, unknownInstitution(data.aisheCode));
    else if (data.programme && !programmes.has(key(data.aisheCode, data.programme)))
      reject(
        "Facts",
        row,
        `programme '${data.programme}' does not match an accepted Programmes row in this file or an existing programme of ${data.aisheCode}`,
      );
    else out.facts.push(data);
  }

  for (const { row, cells } of load("Promoters")) {
    const r = reasons(schemas.Promoters, cells);
    if (!r.ok) {
      reject("Promoters", row, r.reason);
      continue;
    }
    const data = { ...(r.data as Omit<PromoterRow, "row">), row };
    const k = key(data.aisheCode, data.name);
    if (!institutions.has(data.aisheCode)) reject("Promoters", row, unknownInstitution(data.aisheCode));
    else if (known?.promoters?.has(k)) reject("Promoters", row, `Promoter '${data.name}' already exists for this institution`);
    else if (promoters.has(k)) reject("Promoters", row, `Duplicate promoter '${data.name}' in this file`);
    else {
      promoters.add(k);
      out.promoters.push(data);
    }
  }

  for (const { row, cells } of load("LegalRecords")) {
    const r = reasons(schemas.LegalRecords, cells);
    if (!r.ok) {
      reject("LegalRecords", row, r.reason);
      continue;
    }
    const data = { ...(r.data as Omit<LegalRow, "row">), row };
    if (!institutions.has(data.aisheCode)) reject("LegalRecords", row, unknownInstitution(data.aisheCode));
    else if (data.promoterName && !promoters.has(key(data.aisheCode, data.promoterName)))
      reject(
        "LegalRecords",
        row,
        `promoterName '${data.promoterName}' does not match an accepted Promoters row in this file or an existing promoter of ${data.aisheCode}`,
      );
    else out.legal.push(data);
  }

  for (const { row, cells } of load("Recruiters")) {
    const r = reasons(schemas.Recruiters, cells);
    if (!r.ok) {
      reject("Recruiters", row, r.reason);
      continue;
    }
    const data = { ...(r.data as Omit<RecruiterRow, "row">), row };
    if (!institutions.has(data.aisheCode)) reject("Recruiters", row, unknownInstitution(data.aisheCode));
    else out.recruiters.push(data);
  }

  out.counts.Institution.accepted = out.institutions.length;
  out.counts.Programmes.accepted = out.programmes.length;
  out.counts.Facts.accepted = out.facts.length;
  out.counts.Promoters.accepted = out.promoters.length;
  out.counts.LegalRecords.accepted = out.legal.length;
  out.counts.Recruiters.accepted = out.recruiters.length;
  return out;
}

export const acceptedTotal = (p: ParseResult): number =>
  Object.values(p.counts).reduce((n, c) => n + c.accepted, 0);

/** Trimmed view of a ParseResult for the preview screen. */
export interface ImportPreview {
  filename: string;
  counts: ParseResult["counts"];
  accepted: number;
  rejected: Rejection[];
  rejectedTotal: number;
  factSample: FactRow[];
  newInstitutions: { aisheCode: string; name: string; city: string; state: string }[];
  errors: string[];
  warnings: string[];
}

export function toPreview(p: ParseResult, maxRejected = 500, sample = 20): ImportPreview {
  return {
    filename: p.filename,
    counts: p.counts,
    accepted: acceptedTotal(p),
    rejected: p.rejected.slice(0, maxRejected),
    rejectedTotal: p.rejected.length,
    factSample: p.facts.slice(0, sample),
    newInstitutions: p.institutions.map(({ aisheCode, name, city, state }) => ({ aisheCode, name, city, state })),
    errors: p.errors,
    warnings: p.warnings,
  };
}
