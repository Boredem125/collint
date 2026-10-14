import type { SourceType, FactStatus, LegalStage, DealStage } from "./types";

export type ModuleKey = "admissions" | "placements" | "accreditation" | "campus" | "commercial";

export type Unit = "count" | "percent" | "inr" | "rank" | "text" | "ratio" | "acre" | "sqft" | "date";

export interface MetricDef {
  key: string;
  label: string;
  module: ModuleKey;
  unit: Unit;
  // Period kind: AY = academic year "2024-25", YEAR = "2025", CURRENT = "current"
  period: "AY" | "YEAR" | "CURRENT";
  // May also be recorded per programme (Fact.programmeId set)
  perProgramme?: boolean;
  // Counts towards the module's evidence coverage meter
  expected?: boolean;
}

const m = (
  key: string,
  label: string,
  module: ModuleKey,
  unit: Unit,
  period: MetricDef["period"],
  extra: Partial<MetricDef> = {},
): MetricDef => ({ key, label, module, unit, period, ...extra });

export const METRICS: MetricDef[] = [
  // Admissions. A college claim and a university-portal count are two Facts on the same key.
  m("intake.approved", "Approved intake", "admissions", "count", "AY", { perProgramme: true, expected: true }),
  m("admissions.total", "Admissions", "admissions", "count", "AY", { perProgramme: true, expected: true }),
  m("students.total", "Total students", "admissions", "count", "AY", { expected: true }),
  m("capacity.total", "Total sanctioned capacity", "admissions", "count", "CURRENT", { expected: true }),

  // Placements, by graduating year
  m("placement.eligible", "Eligible students", "placements", "count", "YEAR", { expected: true }),
  m("placement.placed", "Students placed", "placements", "count", "YEAR", { expected: true }),
  m("placement.rate", "Placement rate", "placements", "percent", "YEAR", { expected: true }),
  m("placement.highest", "Highest package", "placements", "inr", "YEAR"),
  m("placement.average", "Average package", "placements", "inr", "YEAR", { expected: true }),
  m("placement.median", "Median package", "placements", "inr", "YEAR", { expected: true }),
  m("placement.recruiters", "Recruiters visited", "placements", "count", "YEAR"),
  m("placement.international", "International placements", "placements", "count", "YEAR"),

  // Ranking and accreditation
  m("nirf.overall", "NIRF Overall", "accreditation", "rank", "YEAR"),
  m("nirf.university", "NIRF University", "accreditation", "rank", "YEAR"),
  m("nirf.college", "NIRF College", "accreditation", "rank", "YEAR"),
  m("nirf.engineering", "NIRF Engineering", "accreditation", "rank", "YEAR"),
  m("nirf.management", "NIRF Management", "accreditation", "rank", "YEAR"),
  m("nirf.pharmacy", "NIRF Pharmacy", "accreditation", "rank", "YEAR"),
  m("naac.grade", "NAAC grade", "accreditation", "text", "CURRENT", { expected: true }),
  m("naac.validUntil", "NAAC valid until", "accreditation", "date", "CURRENT", { expected: true }),
  m("nba.programmes", "NBA accredited programmes", "accreditation", "text", "CURRENT"),
  m("aicte.status", "AICTE approval", "accreditation", "text", "CURRENT", { expected: true }),
  m("ugc.status", "UGC recognition", "accreditation", "text", "CURRENT", { expected: true }),
  m("autonomous.status", "Autonomous status", "accreditation", "text", "CURRENT"),
  m("affiliation.status", "University affiliation", "accreditation", "text", "CURRENT", { expected: true }),

  // Campus performance
  m("faculty.total", "Faculty strength", "campus", "count", "AY", { expected: true }),
  m("attendance.avg", "Average attendance", "campus", "percent", "AY"),
  m("pass.rate", "Pass percentage", "campus", "percent", "AY", { expected: true }),
  m("backlog.rate", "Students with backlogs", "campus", "percent", "AY"),
  m("dropout.rate", "Dropout rate", "campus", "percent", "AY", { expected: true }),
  m("graduation.rate", "Graduation rate", "campus", "percent", "AY"),
  m("progression.rate", "Progression to higher study", "campus", "percent", "AY"),
  m("land.acres", "Land", "campus", "acre", "CURRENT", { expected: true }),
  m("builtup.sqft", "Built-up area", "campus", "sqft", "CURRENT", { expected: true }),
  m("classrooms.count", "Classrooms", "campus", "count", "CURRENT"),
  m("labs.count", "Laboratories", "campus", "count", "CURRENT"),
  m("library.books", "Library volumes", "campus", "count", "CURRENT"),
  m("hostel.capacity", "Hostel capacity", "campus", "count", "CURRENT", { expected: true }),
  m("hostel.occupancy", "Hostel occupancy", "campus", "count", "CURRENT", { expected: true }),
  m("transport.buses", "Buses", "campus", "count", "CURRENT"),
  m("sports.facilities", "Sports facilities", "campus", "text", "CURRENT"),

  // Commercial. Mostly INTERNAL or INSTITUTION sourced.
  m("fee.annual", "Annual fee", "commercial", "inr", "AY", { perProgramme: true, expected: true }),
  m("fee.average", "Average annual fee", "commercial", "inr", "AY", { expected: true }),
  m("fee.collectionEfficiency", "Collection efficiency", "commercial", "percent", "AY", { expected: true }),
  m("fee.outstanding", "Outstanding fees", "commercial", "inr", "AY"),
  m("scholarship.rate", "Scholarship share", "commercial", "percent", "AY"),
  m("discount.rate", "Discount share", "commercial", "percent", "AY"),
  m("refunds.total", "Refunds", "commercial", "inr", "AY"),
  m("revenue.total", "Fee revenue", "commercial", "inr", "AY", { expected: true }),
];

export const METRIC_BY_KEY: Record<string, MetricDef> = Object.fromEntries(METRICS.map((d) => [d.key, d]));

export const metric = (key: string): MetricDef | undefined => METRIC_BY_KEY[key];

export const MODULES: { key: ModuleKey; label: string }[] = [
  { key: "admissions", label: "Admissions" },
  { key: "placements", label: "Placements" },
  { key: "accreditation", label: "Ranking & Accreditation" },
  { key: "campus", label: "Campus" },
  { key: "commercial", label: "Commercial" },
];

// Headline value comes from the highest-precedence source that has a usable Fact.
export const SOURCE_PRECEDENCE: SourceType[] = [
  "UNIVERSITY_PORTAL",
  "GOVERNMENT",
  "REGULATOR",
  "PUBLIC_RECORD",
  "INTERNAL",
  "INSTITUTION",
];

export const SOURCE_LABEL: Record<SourceType, string> = {
  UNIVERSITY_PORTAL: "University portal",
  GOVERNMENT: "Government data",
  REGULATOR: "Regulator",
  PUBLIC_RECORD: "Public record",
  INTERNAL: "Internal diligence",
  INSTITUTION: "Institution",
};

export const STATUS_LABEL: Record<FactStatus, string> = {
  VERIFIED: "Verified",
  SELF_REPORTED: "Self-reported",
  NEEDS_VALIDATION: "Requires validation",
  UNAVAILABLE: "Not available",
};

export const LEGAL_STAGE_LABEL: Record<LegalStage, string> = {
  COMPLAINT: "Complaint",
  FIR: "FIR",
  CHARGE: "Charge",
  PROSECUTION: "Prosecution",
  CONVICTION: "Conviction",
  ACQUITTAL: "Acquittal",
  CIVIL_DISPUTE: "Civil dispute",
  REGULATORY_ACTION: "Regulatory action",
  INSOLVENCY: "Insolvency",
};

// Criminal track runs in this order. Civil, regulatory and insolvency are separate tracks.
export const CRIMINAL_LADDER: LegalStage[] = ["COMPLAINT", "FIR", "CHARGE", "PROSECUTION", "CONVICTION", "ACQUITTAL"];
export const OTHER_TRACKS: LegalStage[] = ["CIVIL_DISPUTE", "REGULATORY_ACTION", "INSOLVENCY"];

export const NIRF_CATEGORIES = [
  "nirf.overall",
  "nirf.university",
  "nirf.college",
  "nirf.engineering",
  "nirf.management",
  "nirf.pharmacy",
];

export const DEAL_STAGES: { key: DealStage; label: string }[] = [
  { key: "SCREENING", label: "Screening" },
  { key: "DILIGENCE", label: "Diligence" },
  { key: "NEGOTIATION", label: "Negotiation" },
  { key: "PARTNERED", label: "Partnered" },
  { key: "PASSED", label: "Passed" },
];
