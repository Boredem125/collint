import { z } from "zod";
import { METRIC_BY_KEY } from "../metrics";
import type { FactStatus, LegalStage, SourceType } from "../types";

export const SOURCE_TYPES = ["GOVERNMENT", "UNIVERSITY_PORTAL", "REGULATOR", "INSTITUTION", "PUBLIC_RECORD", "INTERNAL"] as const;
export const FACT_STATUSES = ["VERIFIED", "SELF_REPORTED", "NEEDS_VALIDATION", "UNAVAILABLE"] as const;
export const LEGAL_STAGES = [
  "COMPLAINT",
  "FIR",
  "CHARGE",
  "PROSECUTION",
  "CONVICTION",
  "ACQUITTAL",
  "CIVIL_DISPUTE",
  "REGULATORY_ACTION",
  "INSOLVENCY",
] as const;
export const RISK_LEVELS = ["GREEN", "AMBER", "RED"] as const;
export const OPPORTUNITY_LEVELS = ["HIGH", "MEDIUM", "LOW"] as const;
export const PROMOTER_KINDS = ["PERSON", "TRUST", "SOCIETY", "COMPANY"] as const;
// Stored in this casing; matched case-insensitively on import.
export const PROGRAMME_LEVELS = ["UG", "PG", "Diploma", "PhD"] as const;
export const RECRUITER_SECTORS = ["IT", "BFSI", "Core", "Services", "Other"] as const;

export const NO_SOURCE_REASON = "No source: every number needs source, date and status";

export type SheetName = "Institution" | "Programmes" | "Facts" | "Promoters" | "LegalRecords" | "Recruiters";

export interface ColumnDef {
  key: string;
  required?: boolean;
  help: string;
}

export interface SheetDef {
  name: SheetName;
  purpose: string;
  columns: ColumnDef[];
}

const c = (key: string, help: string, required = false): ColumnDef => ({ key, help, required });
const list = (v: readonly string[]) => v.join(" | ");

const SOURCE_COLS = {
  sourceName: c("sourceName", "Name of the document, portal or register the row was taken from", true),
  sourceUrl: c("sourceUrl", "Link to the source, if public"),
  asOfDate: c("asOfDate", "Date the source was read or published. YYYY-MM-DD or an Excel date. Not in the future", true),
};

// Order matters: later sheets reference rows accepted from earlier ones.
export const SHEETS: SheetDef[] = [
  {
    name: "Institution",
    purpose: "One row per institution. Institutions that already exist are not updated.",
    columns: [
      c("aisheCode", "AISHE code. Unique key that every other sheet refers to", true),
      c("name", "Institution name", true),
      c("city", "City", true),
      c("state", "State", true),
      c("established", "Year established, e.g. 1998"),
      c("ownership", "e.g. Private unaided, Trust, Society, Government aided", true),
      c("university", "Affiliating or parent university", true),
      c("campusStatus", "Defaults to Operational when blank"),
      c("overallRisk", `Manual judgement, never computed: ${list(RISK_LEVELS)}`),
      c("overallRiskNote", "Reason for the judgement. Required when overallRisk is set"),
      c("opportunity", `Manual judgement: ${list(OPPORTUNITY_LEVELS)}`),
      c("opportunityNote", "Reason for the judgement"),
    ],
  },
  {
    name: "Programmes",
    purpose: "Programmes offered. Needed before per-programme Facts can refer to them.",
    columns: [
      c("aisheCode", "Institution the programme belongs to", true),
      c("name", "Programme name, unique within the institution", true),
      c("level", list(PROGRAMME_LEVELS), true),
      c("startedYear", "Year the programme started"),
      c("discontinuedYear", "Year the programme was discontinued, if it was"),
    ],
  },
  {
    name: "Facts",
    purpose: "Long format: one row per number, per period, per source. Two sources for the same number are two rows.",
    columns: [
      c("aisheCode", "Institution the fact belongs to", true),
      c("metricKey", "One of the keys listed under Metric keys below", true),
      c("period", "Academic year 2024-25, year 2025, or current, depending on the metric", true),
      c("programme", "Programme name. Only for metrics marked per-programme; blank for institution level"),
      c("value", "Number, text or date depending on the metric unit. May be blank only when status is UNAVAILABLE", true),
      c("sourceType", list(SOURCE_TYPES), true),
      SOURCE_COLS.sourceName,
      SOURCE_COLS.sourceUrl,
      SOURCE_COLS.asOfDate,
      c("status", list(FACT_STATUSES), true),
      c("note", "Free text shown with the evidence"),
    ],
  },
  {
    name: "Promoters",
    purpose: "People and bodies that own or control the institution.",
    columns: [
      c("aisheCode", "Institution", true),
      c("name", "Promoter name, unique within the institution", true),
      c("kind", list(PROMOTER_KINDS), true),
      c("role", "e.g. Chairman, Managing trustee, Sponsoring body", true),
      c("established", "Year, for trusts, societies and companies"),
      SOURCE_COLS.sourceName,
      SOURCE_COLS.sourceUrl,
      SOURCE_COLS.asOfDate,
    ],
  },
  {
    name: "LegalRecords",
    purpose: "One row per record. Stages are distinct legal positions and are never merged or treated as equivalent.",
    columns: [
      c("aisheCode", "Institution", true),
      c("promoterName", "Promoter the record concerns. Must match a Promoters row. Blank if it concerns the institution"),
      c("stage", list(LEGAL_STAGES), true),
      c("title", "Short title of the matter", true),
      c("forum", "Court, police station, regulator or tribunal", true),
      c("year", "Year of the record", true),
      c("summary", "What the record says, without characterisation", true),
      c("currentStatus", "Position as of the source date, e.g. Pending, Disposed, Under appeal", true),
      SOURCE_COLS.sourceName,
      SOURCE_COLS.sourceUrl,
      SOURCE_COLS.asOfDate,
    ],
  },
  {
    name: "Recruiters",
    purpose: "Companies reported as recruiting from the institution.",
    columns: [
      c("aisheCode", "Institution", true),
      c("name", "Recruiter name", true),
      c("sector", list(RECRUITER_SECTORS), true),
      c("years", "Placement years the recruiter visited, comma separated: 2023, 2024, 2025", true),
      c("sourceType", list(SOURCE_TYPES), true),
      SOURCE_COLS.sourceName,
      SOURCE_COLS.asOfDate,
      c("status", list(FACT_STATUSES), true),
    ],
  },
];

export const VALIDATION_RULES: string[] = [
  "A row that fails any rule is rejected with a reason and skipped. The other rows are still imported.",
  "Every Fact needs sourceType, sourceName and asOfDate. A number without a source is rejected.",
  "sourceType INSTITUTION cannot have status VERIFIED. A college's own claim is SELF_REPORTED until an independent source confirms it.",
  "metricKey must be one of the keys listed in this sheet.",
  "period must match the metric: AY = 2024-25, YEAR = 2025, CURRENT = current.",
  "programme may only be filled for metrics marked per-programme, and must match a Programmes row or an existing programme of that institution.",
  "value: a plain number for numeric units (no commas, symbols or units), text for text, YYYY-MM-DD for date. Percent is 0 to 100. Money is in rupees (2.5 lakh = 250000). Counts and ranks are whole numbers.",
  "value may be blank only when status is UNAVAILABLE. Do not enter 0 for missing data.",
  "aisheCode must match an Institution row in this file or an institution already in the platform.",
  "asOfDate must be a real date and not in the future.",
  "LegalRecords need sourceName and asOfDate, and stage must be exactly one of the listed values.",
  "Enum cells are trimmed and upper-cased before checking, so 'verified' is read as VERIFIED.",
  "A .csv upload is read as a single Facts sheet; the institution must already exist.",
  "Delete the example rows before uploading. They describe a fictional institution.",
];

// --- cell helpers ---------------------------------------------------------

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:[T ][\d:.]+(?:Z|[+-]\d{2}:?\d{2})?)?$/;
const EXCEL_EPOCH = Date.UTC(1899, 11, 30);

/** Calendar day from an Excel serial, ISO string or Date. Returns "YYYY-MM-DD" or null. */
export function toIsoDay(v: unknown): string | null {
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
  if (typeof v === "number") {
    // Serials outside 1900-2173 are not dates anyone typed on purpose.
    if (!Number.isFinite(v) || v < 1 || v > 100000) return null;
    return new Date(EXCEL_EPOCH + Math.floor(v) * 86400000).toISOString().slice(0, 10);
  }
  if (typeof v !== "string") return null;
  const mt = ISO_DATE.exec(v.trim());
  if (!mt) return null;
  const [y, mo, d] = [Number(mt[1]), Number(mt[2]), Number(mt[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

const toText = (v: unknown): unknown => {
  if (v === null || v === undefined) return undefined;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (typeof v === "string") return v.trim() === "" ? undefined : v.trim();
  return v;
};

const toUpper = (v: unknown): unknown => {
  const t = toText(v);
  return typeof t === "string" ? t.toUpperCase() : t;
};

const toNumber = (v: unknown): unknown => {
  const t = typeof v === "string" ? v.trim() : v;
  if (t === null || t === undefined || t === "") return undefined;
  if (typeof t === "string" && /^-?\d+(\.\d+)?$/.test(t)) return Number(t);
  return t;
};

const req = (name: string) =>
  z.preprocess(toText, z.string({ required_error: `${name} is required`, invalid_type_error: `${name} is required` }));

const opt = () => z.preprocess(toText, z.string().optional()).transform((v) => v ?? null);

const yearNum = (name: string) =>
  z
    .number({ required_error: `${name} is required`, invalid_type_error: `${name} must be a year such as 2024` })
    .int(`${name} must be a year such as 2024`)
    .min(1800, `${name} must be between 1800 and 2100`)
    .max(2100, `${name} must be between 1800 and 2100`);

const reqYear = (name: string) => z.preprocess(toNumber, yearNum(name));
const optYear = (name: string) => z.preprocess(toNumber, yearNum(name).optional()).transform((v) => v ?? null);

function enumBase<T extends readonly [string, ...string[]]>(name: string, values: T) {
  const message = `${name} must be one of ${values.join(", ")}`;
  return z.enum(values, {
    errorMap: (_issue, ctx) => ({ message: ctx.data === undefined ? `${name} is required` : message }),
  });
}

function enumOf<T extends readonly [string, ...string[]]>(name: string, values: T) {
  return z.preprocess(toUpper, enumBase(name, values));
}

function optEnum<T extends readonly [string, ...string[]]>(name: string, values: T) {
  return z.preprocess(toUpper, enumBase(name, values).optional()).transform((v) => v ?? null);
}

// Fixed-casing vocabularies: matched ignoring case, stored in canonical casing.
function vocab<T extends readonly string[]>(name: string, values: T) {
  return z.preprocess(toText, z.string({ required_error: `${name} is required` })).transform((v, ctx) => {
    const hit = values.find((x) => x.toUpperCase() === v.toUpperCase());
    if (!hit) {
      ctx.addIssue({ code: "custom", message: `${name} must be one of ${values.join(", ")}` });
      return z.NEVER;
    }
    return hit as T[number];
  });
}

const asOfDate = (today: Date) =>
  z.unknown().transform((v, ctx) => {
    if (toText(v) === undefined) {
      ctx.addIssue({ code: "custom", message: "asOfDate is required" });
      return z.NEVER;
    }
    const day = toIsoDay(v);
    if (!day) {
      ctx.addIssue({ code: "custom", message: "asOfDate is not a valid date (use YYYY-MM-DD or an Excel date)" });
      return z.NEVER;
    }
    if (day > today.toISOString().slice(0, 10)) {
      ctx.addIssue({ code: "custom", message: `asOfDate ${day} is in the future` });
      return z.NEVER;
    }
    return `${day}T00:00:00.000Z`;
  });

const PERIOD_FORMAT = { AY: "an academic year such as 2024-25", YEAR: "a year such as 2025", CURRENT: "'current'" };

function checkPeriod(kind: "AY" | "YEAR" | "CURRENT", p: string): boolean {
  if (kind === "CURRENT") return p === "current";
  if (kind === "YEAR") return /^\d{4}$/.test(p);
  const mt = /^(\d{4})-(\d{2})$/.exec(p);
  return !!mt && (Number(mt[1]) + 1) % 100 === Number(mt[2]);
}

// --- row schemas ----------------------------------------------------------

export function makeSchemas(today: Date = new Date()) {
  const Institution = z
    .object({
      aisheCode: req("aisheCode"),
      name: req("name"),
      city: req("city"),
      state: req("state"),
      established: optYear("established"),
      ownership: req("ownership"),
      university: req("university"),
      campusStatus: opt(),
      overallRisk: optEnum("overallRisk", RISK_LEVELS),
      overallRiskNote: opt(),
      opportunity: optEnum("opportunity", OPPORTUNITY_LEVELS),
      opportunityNote: opt(),
    })
    .superRefine((r, ctx) => {
      if (r.overallRisk && !r.overallRiskNote)
        ctx.addIssue({ code: "custom", message: "overallRiskNote is required when overallRisk is set" });
    });

  const Programme = z
    .object({
      aisheCode: req("aisheCode"),
      name: req("name"),
      level: vocab("level", PROGRAMME_LEVELS),
      startedYear: optYear("startedYear"),
      discontinuedYear: optYear("discontinuedYear"),
    })
    .superRefine((r, ctx) => {
      if (r.startedYear && r.discontinuedYear && r.discontinuedYear < r.startedYear)
        ctx.addIssue({ code: "custom", message: "discontinuedYear is before startedYear" });
    });

  const Fact = z
    .object({
      aisheCode: req("aisheCode"),
      metricKey: req("metricKey"),
      period: z.preprocess(
        (v) => {
          const t = toText(v);
          return typeof t === "string" && t.toLowerCase() === "current" ? "current" : t;
        },
        z.string({ required_error: "period is required" }),
      ),
      programme: opt(),
      value: z.unknown(),
      sourceType: enumOf("sourceType", SOURCE_TYPES),
      sourceName: req("sourceName"),
      sourceUrl: opt(),
      asOfDate: asOfDate(today),
      status: enumOf("status", FACT_STATUSES),
      note: opt(),
    })
    .transform((r, ctx) => {
      const issue = (message: string) => ctx.addIssue({ code: "custom", message });
      const { value, ...rest } = r;
      let valueNum: number | null = null;
      let valueText: string | null = null;

      if (r.sourceType === "INSTITUTION" && r.status === "VERIFIED")
        issue("sourceType INSTITUTION cannot have status VERIFIED (use SELF_REPORTED)");

      const def = METRIC_BY_KEY[r.metricKey];
      if (!def) {
        issue(`Unknown metricKey '${r.metricKey}'`);
        return z.NEVER;
      }
      if (!checkPeriod(def.period, r.period))
        issue(`period '${r.period}' is not valid for ${def.key}: expected ${PERIOD_FORMAT[def.period]}`);
      if (r.programme && !def.perProgramme)
        issue(`programme is not allowed for ${def.key}: it is an institution-level metric`);

      const raw = toText(value);
      if (raw === undefined) {
        if (r.status !== "UNAVAILABLE") issue("value is required unless status is UNAVAILABLE");
      } else if (def.unit === "text") {
        valueText = String(raw);
      } else if (def.unit === "date") {
        const day = toIsoDay(value);
        if (!day) issue(`value for ${def.key} must be a date (YYYY-MM-DD)`);
        else valueText = day;
      } else {
        const n = toNumber(value);
        if (typeof n !== "number" || !Number.isFinite(n)) {
          issue(`value for ${def.key} must be a plain number (no commas, symbols or units)`);
        } else if (n < 0) {
          issue(`value for ${def.key} cannot be negative`);
        } else if (def.unit === "percent" && n > 100) {
          issue(`value for ${def.key} is a percentage and must be between 0 and 100`);
        } else if ((def.unit === "count" || def.unit === "rank") && !Number.isInteger(n)) {
          issue(`value for ${def.key} must be a whole number`);
        } else if (def.unit === "rank" && n < 1) {
          issue(`value for ${def.key} is a rank and must be 1 or more`);
        } else {
          valueNum = n;
        }
      }
      return { ...rest, valueNum, valueText };
    });

  const Promoter = z.object({
    aisheCode: req("aisheCode"),
    name: req("name"),
    kind: enumOf("kind", PROMOTER_KINDS),
    role: req("role"),
    established: optYear("established"),
    sourceName: req("sourceName"),
    sourceUrl: opt(),
    asOfDate: asOfDate(today),
  });

  const LegalRecord = z.object({
    aisheCode: req("aisheCode"),
    promoterName: opt(),
    stage: enumOf("stage", LEGAL_STAGES),
    title: req("title"),
    forum: req("forum"),
    year: reqYear("year"),
    summary: req("summary"),
    currentStatus: req("currentStatus"),
    sourceName: req("sourceName"),
    sourceUrl: opt(),
    asOfDate: asOfDate(today),
  });

  const Recruiter = z
    .object({
      aisheCode: req("aisheCode"),
      name: req("name"),
      sector: vocab("sector", RECRUITER_SECTORS),
      years: z.unknown().transform((v, ctx) => {
        const t = toText(v);
        if (typeof t !== "string") {
          ctx.addIssue({ code: "custom", message: "years is required" });
          return z.NEVER;
        }
        const parts = t.split(/[,;]/).map((s) => s.trim()).filter(Boolean);
        const years = parts.map(Number);
        if (!parts.length || parts.some((p) => !/^\d{4}$/.test(p)) || years.some((y) => y < 1900 || y > 2100)) {
          ctx.addIssue({ code: "custom", message: "years must be comma-separated four-digit years, e.g. 2023, 2024" });
          return z.NEVER;
        }
        return [...new Set(years)].sort((a, b) => a - b);
      }),
      sourceType: enumOf("sourceType", SOURCE_TYPES),
      sourceName: req("sourceName"),
      asOfDate: asOfDate(today),
      status: enumOf("status", FACT_STATUSES),
    })
    .superRefine((r, ctx) => {
      if (r.sourceType === "INSTITUTION" && r.status === "VERIFIED")
        ctx.addIssue({ code: "custom", message: "sourceType INSTITUTION cannot have status VERIFIED (use SELF_REPORTED)" });
    });

  return { Institution, Programmes: Programme, Facts: Fact, Promoters: Promoter, LegalRecords: LegalRecord, Recruiters: Recruiter };
}

type Schemas = ReturnType<typeof makeSchemas>;
type WithRow<T> = T & { row: number };

// Normalised rows. Dates are ISO strings so the result can cross the server/client boundary.
export type InstitutionRow = WithRow<z.output<Schemas["Institution"]>>;
export type ProgrammeRow = WithRow<z.output<Schemas["Programmes"]>>;
export type FactRow = WithRow<
  Omit<z.output<Schemas["Facts"]>, "sourceType" | "status"> & { sourceType: SourceType; status: FactStatus }
>;
export type PromoterRow = WithRow<z.output<Schemas["Promoters"]>>;
export type LegalRow = WithRow<Omit<z.output<Schemas["LegalRecords"]>, "stage"> & { stage: LegalStage }>;
export type RecruiterRow = WithRow<
  Omit<z.output<Schemas["Recruiters"]>, "sourceType" | "status"> & { sourceType: SourceType; status: FactStatus }
>;
