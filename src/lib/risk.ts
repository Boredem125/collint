import type { FactT, Flag, FlagBand, LegalRecordT, LegalStage, Profile } from "./types";
import { LEGAL_STAGE_LABEL } from "./metrics";
import { fmtDate, fmtNum, periods, pick, series, trend, utilisationSeries, variance } from "./facts";

export const THRESHOLDS = {
  // Share of the college's admission claim not supported by the independent source, percent
  admissionVarianceCritical: 10,
  admissionVarianceAttention: 5,
  // Admissions / approved intake, percent
  utilisationLow: 60,
  // Placement rate claim minus independent figure, percentage points
  placementGapPoints: 10,
  // Hostel occupancy / capacity, percent
  hostelOccupancyMin: 50,
  collectionEfficiencyMin: 85,
  // Students per faculty member
  studentFacultyMax: 25,
  // Year-on-year steps that must all fall before a decline is flagged
  decliningSteps: 2,
  // Percent change treated as flat when judging "stable or rising"
  stableTolerance: 3,
} as const;

const BAND_ORDER: FlagBand[] = ["CRITICAL", "ATTENTION", "VERIFIED"];

const NOT_RECOGNISED = /\b(not\s+(recogni[sz]ed|approved|affiliated|valid)|withdrawn|lapsed|expired|revoked|cancelled|suspended|de-?recogni[sz]ed|disaffiliated)\b/i;

const CLOSED = /\b(closed|disposed|dismissed|withdrawn|settled|quashed|resolved|set aside|dropped)\b/i;

// Stages that need leadership review before any partnership step. Listed, never ranked against each other.
const CRITICAL_STAGES: LegalStage[] = ["CONVICTION", "PROSECUTION", "REGULATORY_ACTION", "INSOLVENCY"];
const ATTENTION_STAGES: LegalStage[] = ["CIVIL_DISPUTE", "COMPLAINT", "FIR", "CHARGE"];

const RECOGNITION = [
  { key: "ugc.status", id: "ugc", label: "UGC recognition" },
  { key: "aicte.status", id: "aicte", label: "AICTE approval" },
  { key: "affiliation.status", id: "affiliation", label: "University affiliation" },
];

const weak = (f: FactT) => f.status === "SELF_REPORTED" || f.status === "NEEDS_VALIDATION";

const pct = (n: number) => `${n.toFixed(1)}%`;

/** True when the last `steps` year-on-year changes are all falls. */
function fellRunning(values: number[], steps: number): boolean {
  if (values.length < steps + 1) return false;
  const tail = values.slice(-(steps + 1));
  return tail.every((v, i) => i === 0 || v < tail[i - 1]);
}

function legalDetail(r: LegalRecordT, promoterName: string | undefined): string {
  const who = promoterName ? ` Linked to: ${promoterName}.` : "";
  return (
    `${r.title}. Recorded stage: ${LEGAL_STAGE_LABEL[r.stage]}. Forum: ${r.forum}, ${r.year}. ` +
    `Current status: ${r.currentStatus}.${who} Source: ${r.sourceName} (as of ${fmtDate(r.asOfDate)}). ` +
    `This flag reports the recorded stage only and draws no conclusion about the outcome; requires review.`
  );
}

/** Rule-driven flags for the Red-Flag Centre. Pure: no DB, no clock unless `today` is defaulted. */
export function deriveFlags(profile: Profile, today: Date = new Date()): Flag[] {
  const { facts, legal, promoters } = profile;
  const flags: Flag[] = [];
  const add = (id: string, band: FlagBand, module: string, title: string, detail: string, evidence: FactT[] = []) =>
    flags.push({ id, band, module, title, detail, evidence });

  // Admissions: claim vs independent source, latest year where both exist
  const admPeriod = periods(facts, "admissions.total")
    .reverse()
    .find((p) => variance(facts, "admissions.total", p));
  const admVar = admPeriod ? variance(facts, "admissions.total", admPeriod) : null;
  if (admVar && admVar.pct > THRESHOLDS.admissionVarianceAttention) {
    const critical = admVar.pct > THRESHOLDS.admissionVarianceCritical;
    add(
      critical ? "admissions-variance-critical" : "admissions-variance",
      critical ? "CRITICAL" : "ATTENTION",
      "admissions",
      `Admission claim exceeds independent count by ${pct(admVar.pct)} (${admPeriod})`,
      `Institution reports ${fmtNum(admVar.claimed.valueNum!, "count")}; ${admVar.verified.sourceName} shows ` +
        `${fmtNum(admVar.verified.valueNum!, "count")}. Variance: ${fmtNum(admVar.diff, "count")} / ${pct(admVar.pct)}.`,
      [admVar.claimed, admVar.verified],
    );
  }

  // Utilisation
  const util = utilisationSeries(facts).filter(
    (u): u is { period: string; derived: NonNullable<typeof u.derived> } => u.derived !== null,
  );
  if (fellRunning(util.map((u) => u.derived.value), THRESHOLDS.decliningSteps)) {
    const tail = util.slice(-(THRESHOLDS.decliningSteps + 1));
    add(
      "utilisation-falling",
      "ATTENTION",
      "admissions",
      `Seat utilisation has fallen ${THRESHOLDS.decliningSteps} years running`,
      tail.map((u) => `${u.period}: ${pct(u.derived.value)}`).join(" → ") + ".",
      tail.flatMap((u) => u.derived.basis),
    );
  }
  const lastUtil = util[util.length - 1];
  if (lastUtil && lastUtil.derived.value < THRESHOLDS.utilisationLow) {
    add(
      "utilisation-low",
      "ATTENTION",
      "admissions",
      `Seat utilisation below ${THRESHOLDS.utilisationLow}% (${lastUtil.period})`,
      `Admissions are ${pct(lastUtil.derived.value)} of approved intake in ${lastUtil.period}.`,
      lastUtil.derived.basis,
    );
  }

  // Verified admissions trend
  const admVerified = series(facts, "admissions.total").filter((p) => p.fact?.status === "VERIFIED" && p.value !== null);
  if (admVerified.length >= 2 && trend(admVerified.map((p) => p.value), THRESHOLDS.stableTolerance) !== "down") {
    add(
      "verified-admissions",
      "VERIFIED",
      "admissions",
      "Admissions stable or rising on verified data",
      `Verified counts from ${admVerified[0].period} to ${admVerified[admVerified.length - 1].period}: ` +
        `${fmtNum(admVerified[0].value!, "count")} → ${fmtNum(admVerified[admVerified.length - 1].value!, "count")}.`,
      admVerified.map((p) => p.fact!),
    );
  }

  // Placements
  const rate = series(facts, "placement.rate").filter((p) => p.fact && p.value !== null);
  if (fellRunning(rate.map((p) => p.value!), THRESHOLDS.decliningSteps)) {
    const tail = rate.slice(-(THRESHOLDS.decliningSteps + 1));
    add(
      "placement-falling",
      "ATTENTION",
      "placements",
      `Placement rate has fallen ${THRESHOLDS.decliningSteps} years running`,
      tail.map((p) => `${p.period}: ${fmtNum(p.value!, "percent")}`).join(" → ") + ".",
      tail.map((p) => p.fact!),
    );
  }
  const gapPeriod = periods(facts, "placement.rate")
    .reverse()
    .find((p) => variance(facts, "placement.rate", p));
  const gap = gapPeriod ? variance(facts, "placement.rate", gapPeriod) : null;
  if (gap && gap.diff > THRESHOLDS.placementGapPoints) {
    add(
      "placement-claim-gap",
      "ATTENTION",
      "placements",
      `Placement claim is ${Math.round(gap.diff)} points above the independent figure (${gapPeriod})`,
      `Institution reports ${fmtNum(gap.claimed.valueNum!, "percent")}; ${gap.verified.sourceName} shows ` +
        `${fmtNum(gap.verified.valueNum!, "percent")}.`,
      [gap.claimed, gap.verified],
    );
  }
  const lastRate = rate[rate.length - 1];
  if (lastRate && weak(lastRate.fact!)) {
    add(
      "placement-self-reported",
      "ATTENTION",
      "placements",
      `Latest placement rate is not independently verified (${lastRate.period})`,
      `The only figure for ${lastRate.period} comes from ${lastRate.fact!.sourceName}. No independent source has been recorded.`,
      [lastRate.fact!],
    );
  }
  const rateVerified = rate.filter((p) => p.fact!.status === "VERIFIED");
  if (rateVerified.length >= 2 && trend(rateVerified.map((p) => p.value), THRESHOLDS.stableTolerance) !== "down") {
    add(
      "verified-placement",
      "VERIFIED",
      "placements",
      "Placement rate stable or rising on verified data",
      `Verified rate from ${rateVerified[0].period} to ${rateVerified[rateVerified.length - 1].period}: ` +
        `${fmtNum(rateVerified[0].value!, "percent")} → ${fmtNum(rateVerified[rateVerified.length - 1].value!, "percent")}.`,
      rateVerified.map((p) => p.fact!),
    );
  }

  // Recognition and approvals
  for (const r of RECOGNITION) {
    const f = pick(facts, r.key);
    if (!f) continue;
    if (f.valueText && NOT_RECOGNISED.test(f.valueText)) {
      add(
        `recognition-${r.id}`,
        "CRITICAL",
        "accreditation",
        `${r.label}: recorded as "${f.valueText}"`,
        `${f.sourceName} (as of ${fmtDate(f.asOfDate)}) does not show a current ${r.label.toLowerCase()}. Requires review.`,
        [f],
      );
    } else if (f.status === "VERIFIED") {
      add(`verified-${r.id}`, "VERIFIED", "accreditation", `${r.label} verified`, `Confirmed against ${f.sourceName}.`, [f]);
    }
  }

  // NAAC validity
  const naacUntil = pick(facts, "naac.validUntil");
  const naacGrade = pick(facts, "naac.grade");
  const until = naacUntil?.valueText ? new Date(naacUntil.valueText) : null;
  if (naacUntil && until && !Number.isNaN(until.getTime())) {
    const evidence = naacGrade ? [naacUntil, naacGrade] : [naacUntil];
    if (until.getTime() < today.getTime()) {
      add(
        "naac-expired",
        "ATTENTION",
        "accreditation",
        "NAAC accreditation has expired",
        `Validity ended on ${fmtDate(naacUntil.valueText!)}. No renewed cycle is recorded.`,
        evidence,
      );
    } else if (naacUntil.status === "VERIFIED" && naacGrade?.status === "VERIFIED") {
      add(
        "verified-naac",
        "VERIFIED",
        "accreditation",
        `NAAC grade ${naacGrade.valueText ?? ""} valid and verified`.replace(/\s+/g, " "),
        `Valid until ${fmtDate(naacUntil.valueText!)} per ${naacUntil.sourceName}.`,
        evidence,
      );
    }
  }

  // Campus
  const hostelCap = pick(facts, "hostel.capacity");
  const hostelOcc = pick(facts, "hostel.occupancy");
  if (hostelCap?.valueNum && hostelOcc?.valueNum != null) {
    const share = (hostelOcc.valueNum / hostelCap.valueNum) * 100;
    if (share < THRESHOLDS.hostelOccupancyMin) {
      add(
        "hostel-occupancy-low",
        "ATTENTION",
        "campus",
        `Hostel occupancy below ${THRESHOLDS.hostelOccupancyMin}% of capacity`,
        `${fmtNum(hostelOcc.valueNum, "count")} of ${fmtNum(hostelCap.valueNum, "count")} beds occupied (${pct(share)}).`,
        [hostelOcc, hostelCap],
      );
    }
  }
  const ratioPeriod = periods(facts, "students.total")
    .reverse()
    .find((p) => pick(facts, "students.total", p)?.valueNum != null && pick(facts, "faculty.total", p)?.valueNum);
  if (ratioPeriod) {
    const students = pick(facts, "students.total", ratioPeriod)!;
    const faculty = pick(facts, "faculty.total", ratioPeriod)!;
    const ratio = students.valueNum! / faculty.valueNum!;
    if (ratio > THRESHOLDS.studentFacultyMax) {
      add(
        "student-faculty-ratio",
        "ATTENTION",
        "campus",
        `Student to faculty ratio worse than 1:${THRESHOLDS.studentFacultyMax} (${ratioPeriod})`,
        `${fmtNum(students.valueNum!, "count")} students to ${fmtNum(faculty.valueNum!, "count")} faculty, about ${fmtNum(ratio, "ratio")}.`,
        [students, faculty],
      );
    }
  }

  // Commercial
  const collection = series(facts, "fee.collectionEfficiency").filter((p) => p.fact && p.value !== null);
  const lastCollection = collection[collection.length - 1];
  if (lastCollection && lastCollection.value! < THRESHOLDS.collectionEfficiencyMin) {
    add(
      "collection-efficiency-low",
      "ATTENTION",
      "commercial",
      `Fee collection efficiency below ${THRESHOLDS.collectionEfficiencyMin}% (${lastCollection.period})`,
      `${fmtNum(lastCollection.value!, "percent")} of billed fees collected in ${lastCollection.period}.`,
      [lastCollection.fact!],
    );
  }

  // Legal records: one flag per record, each naming its own stage. Never counted together.
  for (const r of legal) {
    if (CLOSED.test(r.currentStatus)) continue;
    const band: FlagBand | null = CRITICAL_STAGES.includes(r.stage)
      ? "CRITICAL"
      : ATTENTION_STAGES.includes(r.stage)
        ? "ATTENTION"
        : null;
    if (!band) continue;
    const promoterName = promoters.find((p) => p.id === r.promoterId)?.name;
    add(`legal-${r.id}`, band, "promoter", `${LEGAL_STAGE_LABEL[r.stage]} on record: requires review`, legalDetail(r, promoterName));
  }

  return flags
    .map((f, i) => ({ f, i }))
    .sort((a, b) => BAND_ORDER.indexOf(a.f.band) - BAND_ORDER.indexOf(b.f.band) || a.i - b.i)
    .map((x) => x.f);
}
