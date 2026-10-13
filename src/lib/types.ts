// Serialisable shapes shared by server and client code. Dates are ISO strings.

export type SourceType =
  | "GOVERNMENT"
  | "UNIVERSITY_PORTAL"
  | "REGULATOR"
  | "INSTITUTION"
  | "PUBLIC_RECORD"
  | "INTERNAL";

export type FactStatus = "VERIFIED" | "SELF_REPORTED" | "NEEDS_VALIDATION" | "UNAVAILABLE";

export type LegalStage =
  | "COMPLAINT"
  | "FIR"
  | "CHARGE"
  | "PROSECUTION"
  | "CONVICTION"
  | "ACQUITTAL"
  | "CIVIL_DISPUTE"
  | "REGULATORY_ACTION"
  | "INSOLVENCY";

export interface FactT {
  id: string;
  institutionId: string;
  metricKey: string;
  period: string;
  programmeId: string | null;
  valueNum: number | null;
  valueText: string | null;
  sourceType: SourceType;
  sourceName: string;
  sourceUrl: string | null;
  asOfDate: string;
  status: FactStatus;
  note: string | null;
}

export interface InstitutionT {
  id: string;
  name: string;
  aisheCode: string;
  city: string;
  state: string;
  established: number | null;
  ownership: string;
  university: string;
  campusStatus: string;
  isSample: boolean;
  overallRisk: string | null;
  overallRiskNote: string | null;
  opportunity: string | null;
  opportunityNote: string | null;
}

export interface ProgrammeT {
  id: string;
  name: string;
  level: string;
  startedYear: number | null;
  discontinuedYear: number | null;
}

export interface PromoterEntityT {
  id: string;
  name: string;
  kind: string;
  relationship: string;
  sourceName: string;
  asOfDate: string;
}

export interface PromoterT {
  id: string;
  name: string;
  kind: string;
  role: string;
  established: number | null;
  sourceName: string;
  sourceUrl: string | null;
  asOfDate: string;
  entities: PromoterEntityT[];
}

export interface LegalRecordT {
  id: string;
  promoterId: string | null;
  stage: LegalStage;
  title: string;
  forum: string;
  year: number;
  summary: string;
  currentStatus: string;
  sourceName: string;
  sourceUrl: string | null;
  asOfDate: string;
}

export interface RecruiterT {
  id: string;
  name: string;
  sector: string;
  years: number[];
  sourceType: SourceType;
  sourceName: string;
  asOfDate: string;
  status: FactStatus;
}

export interface Profile {
  inst: InstitutionT;
  facts: FactT[];
  programmes: ProgrammeT[];
  promoters: PromoterT[];
  legal: LegalRecordT[];
  recruiters: RecruiterT[];
}

export type FlagBand = "CRITICAL" | "ATTENTION" | "VERIFIED";

export interface Flag {
  id: string;
  band: FlagBand;
  title: string;
  detail: string;
  module: string;
  // Facts that triggered the flag, shown as evidence
  evidence: FactT[];
}
