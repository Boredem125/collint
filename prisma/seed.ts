// Seeds four FICTIONAL sample institutions. Every name, code, person, trust, recruiter and case reference
// below is invented for demonstration and does not describe any real party.
import { PrismaClient, type FactStatus, type LegalStage, type Prisma, type SourceType } from "@prisma/client";

const prisma = new PrismaClient();

const AYS = ["2021-22", "2022-23", "2023-24", "2024-25", "2025-26"];
const AY_START = [2021, 2022, 2023, 2024, 2025];
const PLACEMENT_YEARS = [2021, 2022, 2023, 2024, 2025];
const NIRF_YEARS = [2022, 2023, 2024, 2025, 2026];
const LAST = AYS.length - 1;

type Five<T = number> = [T, T, T, T, T];
type Opt = number | null;

interface Src {
  sourceType: SourceType;
  sourceName: string;
  status: FactStatus;
  asOfDate: string;
  note?: string;
}

const src = (sourceType: SourceType, sourceName: string, status: FactStatus, asOfDate: string, note?: string): Src => ({
  sourceType,
  sourceName,
  status,
  asOfDate,
  note,
});

const DISCLOSURE = "Mandatory disclosure (college website)";
const BROCHURE = "Placement brochure (college website)";
const VISIT = "Campus visit, internal team";

interface ProgrammeCfg {
  name: string;
  level: string;
  started?: number;
  discontinued?: number;
  // null = programme not running that year
  intake: Five<Opt>;
  adm: Five<Opt>;
  fee0: number;
}

interface PromoterCfg {
  name: string;
  kind: "PERSON" | "TRUST" | "SOCIETY" | "COMPANY";
  role: string;
  established?: number;
  sourceName: string;
  entities: [name: string, kind: "INSTITUTION" | "BUSINESS", relationship: string][];
}

interface LegalCfg {
  promoter: number;
  stage: LegalStage;
  title: string;
  forum: string;
  year: number;
  summary: string;
  currentStatus: string;
  sourceName: string;
  asOfDate: string;
}

interface Cfg {
  inst: Prisma.InstitutionCreateInput & { id: string };
  portal: string;
  intakeSource: (ay: string) => [SourceType, string];
  capacity: number;
  programmes: ProgrammeCfg[];
  feeGrowth: number;
  feeVerified: boolean;
  finVerified: boolean;
  // College's own admission claim per year
  claims: Five<Opt>;
  // Year indexes where no university-portal count exists and admissions rest on the college claim alone
  claimOnly?: number[];
  students: Five;
  faculty: Five;
  campus: Record<"attendance" | "pass" | "backlog" | "dropout" | "graduation" | "progression", Five>;
  placement: {
    eligible: Five;
    rate: Five;
    claimRate: Five<Opt>;
    highest: Five;
    average: Five;
    median: Five;
    recruiters: Five;
    international: Five<Opt>;
    // Year indexes with no NIRF submission: figures come from the college only
    instOnly?: number[];
  };
  nirf: Record<string, Five<Opt>>;
  current: {
    naacGrade: string;
    naacUntil: string;
    nba: [text: string, verified: boolean];
    aicte: string;
    ugc: string;
    autonomous: string;
    affiliation: string;
    land: number;
    builtup: number;
    classrooms: number;
    labs: number;
    books: number;
    hostelCap: number;
    hostelOcc: number;
    buses: number;
    sports: string;
  };
  commercial: { collection: Five; scholarship: Five; discount: Five; refunds: Five };
  // "metricKey" or "metricKey|period" left out on purpose so "Not available" paths render
  omit: string[];
  unavailable: { key: string; period: string; sourceType: SourceType; sourceName: string; note: string }[];
  recruiters: [name: string, sector: string, years: number[], confirmed?: boolean][];
  promoters: PromoterCfg[];
  legal: LegalCfg[];
}

const sum = (xs: Opt[]) => xs.reduce<number>((a, x) => a + (x ?? 0), 0);
const d = (s: string) => new Date(`${s}T00:00:00.000Z`);

function buildFacts(c: Cfg): Prisma.FactCreateManyInput[] {
  const id = c.inst.id;
  const rows: Prisma.FactCreateManyInput[] = [];
  const omitted = (key: string, period: string) => c.omit.includes(key) || c.omit.includes(`${key}|${period}`);

  const fact = (key: string, period: string, value: number | string | null, s: Src, programmeId?: string) => {
    if (value === null || (!programmeId && omitted(key, period))) return;
    if (s.sourceType === "INSTITUTION" && s.status === "VERIFIED") throw new Error(`${id} ${key}: INSTITUTION fact cannot be VERIFIED`);
    rows.push({
      institutionId: id,
      metricKey: key,
      period,
      programmeId: programmeId ?? null,
      valueNum: typeof value === "number" ? value : null,
      valueText: typeof value === "string" ? value : null,
      sourceType: s.sourceType,
      sourceName: s.sourceName,
      asOfDate: d(s.asOfDate),
      status: s.status,
      note: s.note ?? null,
    });
  };

  const fees = c.programmes.map((p) => AYS.map((_, i) => Math.round((p.fee0 * Math.pow(c.feeGrowth, i)) / 1000) * 1000));

  AYS.forEach((ay, i) => {
    const y = AY_START[i];
    const claimOnly = c.claimOnly?.includes(i) ?? false;
    const [intakeType, intakeName] = c.intakeSource(ay);
    const intakeSrc = src(intakeType, intakeName, "VERIFIED", `${y}-06-30`);
    const portalSrc = src("UNIVERSITY_PORTAL", c.portal, "VERIFIED", `${y}-12-15`);
    const claimSrc = src("INSTITUTION", DISCLOSURE, "SELF_REPORTED", `${y}-11-20`);
    const admSrc = claimOnly ? claimSrc : portalSrc;
    // AISHE for the latest academic year is not yet published; the college's own disclosure stands in.
    const aishe =
      i < LAST
        ? src("GOVERNMENT", `AISHE ${ay} DCF`, "VERIFIED", `${y + 1}-12-31`)
        : src("INSTITUTION", DISCLOSURE, "SELF_REPORTED", `${y + 1}-07-31`, "AISHE return for this year not yet published");
    const results = src("UNIVERSITY_PORTAL", c.portal, "VERIFIED", `${y + 1}-07-31`);
    const aqar = src("INSTITUTION", `AQAR ${ay} (institution submission)`, "SELF_REPORTED", `${y + 1}-08-31`);
    const nirfData =
      i < LAST
        ? src("GOVERNMENT", `NIRF ${y + 2} data submission`, "VERIFIED", `${y + 2}-02-20`)
        : aqar;
    const feeSrc = c.feeVerified
      ? src("REGULATOR", `State fee regulatory committee order ${ay}`, "VERIFIED", `${y}-05-31`)
      : src("INSTITUTION", `Fee notification ${ay} (college website)`, "SELF_REPORTED", `${y}-05-31`);
    const finSrc = c.finVerified
      ? src("INTERNAL", `Audited financial statements ${ay}, reviewed by internal team`, "VERIFIED", `${y + 1}-09-30`)
      : src("INSTITUTION", `Management accounts ${ay} shared by institution`, "NEEDS_VALIDATION", `${y + 1}-09-30`);
    const modelSrc = src(
      "INTERNAL",
      "Internal diligence model",
      c.feeVerified && !claimOnly ? "VERIFIED" : "NEEDS_VALIDATION",
      `${y + 1}-09-30`,
      "Admission-weighted average of programme fees",
    );

    c.programmes.forEach((p, pi) => {
      if (p.intake[i] === null) return;
      const pid = `${id}-p${pi + 1}`;
      fact("intake.approved", ay, p.intake[i], intakeSrc, pid);
      fact("admissions.total", ay, p.adm[i], admSrc, pid);
      fact("fee.annual", ay, fees[pi][i], feeSrc, pid);
    });

    const intake = sum(c.programmes.map((p) => p.intake[i]));
    const adm = sum(c.programmes.map((p) => (p.intake[i] === null ? null : p.adm[i])));
    fact("intake.approved", ay, intake, intakeSrc);
    if (claimOnly) {
      fact("admissions.total", ay, adm, claimSrc);
      rows.push({
        institutionId: id,
        metricKey: "admissions.total",
        period: ay,
        sourceType: "UNIVERSITY_PORTAL",
        sourceName: c.portal,
        asOfDate: d("2026-09-30"),
        status: "UNAVAILABLE",
        note: `Enrolment count for ${ay} not published on the portal when checked`,
      });
    } else {
      fact("admissions.total", ay, adm, portalSrc);
      fact("admissions.total", ay, c.claims[i], claimSrc);
    }

    fact("students.total", ay, c.students[i], aishe);
    fact("faculty.total", ay, c.faculty[i], aishe);
    fact("dropout.rate", ay, c.campus.dropout[i], aishe);
    fact("pass.rate", ay, c.campus.pass[i], results);
    fact("backlog.rate", ay, c.campus.backlog[i], results);
    fact("attendance.avg", ay, c.campus.attendance[i], aqar);
    fact("progression.rate", ay, c.campus.progression[i], aqar);
    fact("graduation.rate", ay, c.campus.graduation[i], nirfData);

    const weights = c.programmes.map((p) => (p.intake[i] === null ? 0 : (p.adm[i] ?? 0)));
    const avgFee = Math.round(sum(weights.map((w, pi) => w * fees[pi][i])) / (sum(weights) || 1) / 1000) * 1000;
    const revenue = Math.round((c.students[i] * avgFee) / 1e5) * 1e5;
    fact("fee.average", ay, avgFee, modelSrc);
    fact("revenue.total", ay, revenue, finSrc);
    fact("fee.collectionEfficiency", ay, c.commercial.collection[i], finSrc);
    fact("fee.outstanding", ay, Math.round((revenue * (100 - c.commercial.collection[i])) / 100 / 1e5) * 1e5, finSrc);
    fact("refunds.total", ay, c.commercial.refunds[i], finSrc);
    fact("scholarship.rate", ay, c.commercial.scholarship[i], aqar);
    fact("discount.rate", ay, c.commercial.discount[i], src("INTERNAL", "Fee ledger sample review, internal team", "NEEDS_VALIDATION", `${y + 1}-09-30`));
  });

  PLACEMENT_YEARS.forEach((y, i) => {
    const p = c.placement;
    const period = String(y);
    const brochure = src("INSTITUTION", BROCHURE, "SELF_REPORTED", `${y}-09-15`);
    const instOnly = p.instOnly?.includes(i) ?? false;
    const nirf = instOnly
      ? src("INSTITUTION", BROCHURE, "NEEDS_VALIDATION", `${y}-09-15`, "No NIRF data submission found for this graduating year")
      : src("GOVERNMENT", `NIRF ${y + 1} data submission`, "VERIFIED", `${y + 1}-02-20`);
    fact("placement.eligible", period, p.eligible[i], nirf);
    fact("placement.placed", period, Math.round((p.eligible[i] * p.rate[i]) / 100), nirf);
    fact("placement.rate", period, p.rate[i], nirf);
    fact("placement.median", period, p.median[i], nirf);
    if (!instOnly) fact("placement.rate", period, p.claimRate[i], brochure);
    fact("placement.highest", period, p.highest[i], brochure);
    fact("placement.average", period, p.average[i], brochure);
    fact("placement.recruiters", period, p.recruiters[i], brochure);
    fact("placement.international", period, p.international[i], { ...brochure, status: "NEEDS_VALIDATION", note: "Offer letters not sighted" });
  });

  for (const [key, ranks] of Object.entries(c.nirf)) {
    NIRF_YEARS.forEach((y, i) =>
      fact(key, String(y), ranks[i], src("GOVERNMENT", `NIRF ${y} rankings`, "VERIFIED", `${y}-09-05`)),
    );
  }

  const cur = c.current;
  const [intakeType, intakeName] = c.intakeSource(AYS[LAST]);
  const naac = src("REGULATOR", "NAAC accreditation register", "VERIFIED", "2026-09-01");
  const disclosure = src("INSTITUTION", DISCLOSURE, "SELF_REPORTED", "2026-08-15");
  const visit = src("INTERNAL", VISIT, "VERIFIED", "2026-09-18");
  const now = (key: string, value: number | string, s: Src) => fact(key, "current", value, s);
  now("capacity.total", c.capacity, src(intakeType, intakeName, "VERIFIED", "2025-06-30"));
  now("naac.grade", cur.naacGrade, naac);
  now("naac.validUntil", cur.naacUntil, naac);
  now(
    "nba.programmes",
    cur.nba[0],
    cur.nba[1]
      ? src("REGULATOR", "NBA accredited programmes list", "VERIFIED", "2026-09-01")
      : { ...disclosure, status: "NEEDS_VALIDATION", note: "Not matched against the NBA list" },
  );
  now("aicte.status", cur.aicte, src("REGULATOR", "AICTE EOA 2025-26", "VERIFIED", "2025-06-30"));
  now("ugc.status", cur.ugc, src("REGULATOR", "UGC list of recognised colleges", "VERIFIED", "2026-09-01"));
  now("autonomous.status", cur.autonomous, src("REGULATOR", "UGC list of autonomous colleges", "VERIFIED", "2026-09-01"));
  now("affiliation.status", cur.affiliation, src("UNIVERSITY_PORTAL", `${c.inst.university} list of affiliated colleges`, "VERIFIED", "2026-08-20"));
  now("land.acres", cur.land, src("PUBLIC_RECORD", "Land records extract (sub-registrar office)", "VERIFIED", "2026-07-10"));
  now("builtup.sqft", cur.builtup, src(intakeType, intakeName, "VERIFIED", "2025-06-30"));
  now("classrooms.count", cur.classrooms, visit);
  now("labs.count", cur.labs, visit);
  now("library.books", cur.books, disclosure);
  now("hostel.capacity", cur.hostelCap, visit);
  now("hostel.occupancy", cur.hostelOcc, { ...visit, note: "Head count from warden registers on the day of visit" });
  now("transport.buses", cur.buses, disclosure);
  now("sports.facilities", cur.sports, disclosure);

  for (const u of c.unavailable) {
    rows.push({
      institutionId: id,
      metricKey: u.key,
      period: u.period,
      sourceType: u.sourceType,
      sourceName: u.sourceName,
      asOfDate: d("2026-09-30"),
      status: "UNAVAILABLE",
      note: u.note,
    });
  }
  return rows;
}

const aicteIntake = (ay: string): [SourceType, string] => ["REGULATOR", `AICTE EOA ${ay}`];

const REGISTRAR = "Registrar of Societies / trust deed extract";
const DIRECTOR_MASTER = "Company master data extract (sample)";

const CONFIGS: Cfg[] = [
  {
    inst: {
      id: "sample-healthy",
      name: "Quillhaven Institute of Engineering & Management",
      aisheCode: "C-90001",
      city: "Hyderabad",
      state: "Telangana",
      established: 2004,
      ownership: "Society",
      university: "Deccan Plateau Technological University",
      campusStatus: "Operational",
      isSample: true,
      overallRisk: "GREEN",
      overallRiskNote:
        "Manual judgement: approvals current, admissions and placements backed by independent sources, no legal records found in the sources checked.",
      opportunity: "MEDIUM",
      opportunityNote: "Manual judgement: strong operator but limited headroom, with utilisation already near 89%.",
    },
    portal: "Deccan Plateau Technological University examination portal",
    intakeSource: aicteIntake,
    capacity: 3120,
    feeGrowth: 1.05,
    feeVerified: true,
    finVerified: true,
    programmes: [
      { name: "B.Tech Computer Science & Engineering", level: "UG", started: 2004, intake: [240, 240, 240, 240, 240], adm: [190, 205, 222, 232, 238], fee0: 165000 },
      { name: "B.Tech Electronics & Communication", level: "UG", started: 2004, intake: [180, 180, 180, 180, 180], adm: [130, 138, 145, 150, 155], fee0: 150000 },
      { name: "B.Tech Information Technology", level: "UG", started: 2008, intake: [120, 120, 120, 120, 120], adm: [85, 92, 100, 106, 110], fee0: 150000 },
      { name: "MBA", level: "PG", started: 2010, intake: [120, 120, 120, 120, 120], adm: [80, 88, 95, 100, 104], fee0: 180000 },
      { name: "B.Tech Electrical & Electronics", level: "UG", started: 2006, intake: [120, 120, 120, 120, 120], adm: [70, 72, 74, 76, 78], fee0: 135000 },
      { name: "B.Tech AI & Machine Learning", level: "UG", started: 2023, intake: [null, null, 60, 60, 60], adm: [null, null, 40, 52, 58], fee0: 185000 },
    ],
    claims: [560, 598, 680, 720, 748],
    students: [2050, 2120, 2260, 2420, 2560],
    faculty: [118, 122, 128, 136, 142],
    campus: {
      attendance: [82, 83, 84, 85, 86],
      pass: [86, 87, 88, 89, 90],
      backlog: [14, 13, 12, 11, 10],
      dropout: [4.2, 3.9, 3.6, 3.2, 3.0],
      graduation: [84, 85, 86, 88, 89],
      progression: [12, 13, 13, 14, 15],
    },
    placement: {
      eligible: [480, 500, 520, 540, 560],
      rate: [73, 76, 79, 81, 83],
      claimRate: [74, 77, 80, 82, 84],
      highest: [1200000, 1400000, 1600000, 1800000, 2100000],
      average: [420000, 450000, 480000, 520000, 560000],
      median: [380000, 400000, 430000, 460000, 500000],
      recruiters: [38, 42, 47, 52, 58],
      international: [null, null, 2, 3, 4],
    },
    nirf: { "nirf.engineering": [162, 151, 139, 124, 108], "nirf.management": [null, null, null, 96, 91] },
    current: {
      naacGrade: "A",
      naacUntil: "2029-06-30",
      nba: ["B.Tech CSE, B.Tech ECE (valid to June 2028)", true],
      aicte: "Approved (EOA 2025-26)",
      ugc: "Recognised under Section 2(f) and 12(B)",
      autonomous: "Autonomous (granted 2022, valid to 2032)",
      affiliation: "Affiliated (permanent)",
      land: 22.5,
      builtup: 412000,
      classrooms: 64,
      labs: 38,
      books: 68500,
      hostelCap: 900,
      hostelOcc: 792,
      buses: 28,
      sports: "Cricket ground, two basketball courts, indoor badminton hall, gymnasium",
    },
    commercial: {
      collection: [94, 95, 95, 96, 96],
      scholarship: [9, 9, 10, 10, 11],
      discount: [3, 3, 2, 2, 2],
      refunds: [1800000, 1900000, 2100000, 2000000, 2200000],
    },
    omit: ["fee.outstanding|2025-26"],
    unavailable: [
      { key: "fee.outstanding", period: "2025-26", sourceType: "INTERNAL", sourceName: "Audited financial statements 2025-26, reviewed by internal team", note: "Year-end receivables schedule not yet finalised" },
      { key: "nirf.overall", period: "2026", sourceType: "GOVERNMENT", sourceName: "NIRF 2026 rankings", note: "Institution did not participate in the Overall category" },
    ],
    recruiters: [
      ["Zentrovia Technologies", "IT", [2021, 2022, 2023, 2024, 2025], true],
      ["Okhara Datalabs", "IT", [2022, 2023, 2024, 2025], true],
      ["Quillonta Software", "IT", [2021, 2023, 2024, 2025]],
      ["Drishvant Analytics", "IT", [2024, 2025]],
      ["Pellumix Finserv", "BFSI", [2021, 2022, 2023, 2024, 2025], true],
      ["Tavishka Capital Services", "BFSI", [2023, 2024, 2025]],
      ["Kordenza Engineering", "Core", [2021, 2022, 2024, 2025]],
      ["Varhelix Automation", "Core", [2022, 2023, 2024, 2025]],
      ["Marulith Infra Projects", "Core", [2025]],
      ["Yelvora Consulting", "Services", [2022, 2023, 2024, 2025]],
      ["Ombrevale Logistics", "Services", [2025]],
      ["Suvarnix Retail", "Other", [2021, 2022]],
    ],
    promoters: [
      {
        name: "Quillhaven Educational Society",
        kind: "SOCIETY",
        role: "Sponsoring society",
        established: 1998,
        sourceName: REGISTRAR,
        entities: [
          ["Quillhaven Junior College (sample)", "INSTITUTION", "Run by the same society"],
          ["Quillhaven School of Pharmacy (sample)", "INSTITUTION", "Run by the same society"],
        ],
      },
      {
        name: "Dr. Anvesh Korrapolu",
        kind: "PERSON",
        role: "Chairman",
        sourceName: DISCLOSURE,
        entities: [["Korrapolu Agro Farms LLP (sample)", "BUSINESS", "Designated partner"]],
      },
      {
        name: "Smt. Haritha Vemulakonda",
        kind: "PERSON",
        role: "Secretary & Correspondent",
        sourceName: DISCLOSURE,
        entities: [["Quillhaven Junior College (sample)", "INSTITUTION", "Correspondent"]],
      },
    ],
    legal: [],
  },
  {
    inst: {
      id: "sample-inflated",
      name: "Zenithvale College of Engineering & Management",
      aisheCode: "C-90002",
      city: "Pune",
      state: "Maharashtra",
      established: 2009,
      ownership: "Private Trust",
      university: "Western Ghats State Technical University",
      campusStatus: "Operational",
      isSample: true,
      overallRisk: "AMBER",
      overallRiskNote:
        "Manual judgement: approvals are current, but the college's admission and placement claims run well ahead of independent sources. Figures need validation before any commercial model is built on them.",
      opportunity: "HIGH",
      opportunityNote: "Manual judgement: about a third of approved intake is unfilled on verified counts, in a strong catchment.",
    },
    portal: "Western Ghats State Technical University examination portal",
    intakeSource: aicteIntake,
    capacity: 4440,
    feeGrowth: 1.06,
    feeVerified: false,
    finVerified: false,
    programmes: [
      { name: "B.Tech Computer Engineering", level: "UG", started: 2009, intake: [300, 300, 360, 360, 360], adm: [280, 290, 330, 338, 390], fee0: 190000 },
      { name: "B.Tech Electronics & Telecommunication", level: "UG", started: 2009, intake: [240, 240, 240, 240, 240], adm: [170, 165, 158, 150, 170], fee0: 165000 },
      { name: "B.Tech Mechanical Engineering", level: "UG", started: 2009, intake: [180, 180, 180, 180, 180], adm: [110, 100, 88, 78, 95], fee0: 150000 },
      { name: "B.Tech Civil Engineering", level: "UG", started: 2011, intake: [120, 120, 120, 120, 120], adm: [70, 60, 50, 42, 55], fee0: 140000 },
      { name: "MBA", level: "PG", started: 2012, intake: [180, 180, 180, 180, 180], adm: [130, 128, 122, 118, 135], fee0: 210000 },
      { name: "B.Tech AI & Data Science", level: "UG", started: 2023, intake: [null, null, 60, 120, 120], adm: [null, null, 52, 86, 120], fee0: 205000 },
    ],
    claims: [798, 810, 890, 950, null],
    claimOnly: [4],
    students: [2900, 2880, 2910, 2950, 3350],
    faculty: [112, 110, 108, 107, 118],
    campus: {
      attendance: [80, 79, 80, 78, 79],
      pass: [78, 77, 76, 77, 75],
      backlog: [24, 25, 27, 26, 28],
      dropout: [5, 5, 5, 5, 5],
      graduation: [74, 73, 72, 72, 71],
      progression: [8, 8, 7, 8, 7],
    },
    placement: {
      eligible: [700, 710, 720, 730, 740],
      rate: [68, 69, 70, 70, 71],
      claimRate: [85, 88, 90, 91, 92],
      highest: [1800000, 2200000, 2800000, 3600000, 4400000],
      average: [450000, 480000, 520000, 560000, 600000],
      median: [320000, 330000, 340000, 350000, 360000],
      recruiters: [60, 68, 75, 82, 90],
      international: [5, 6, 8, 10, 12],
    },
    nirf: { "nirf.engineering": [null, 196, null, null, null] },
    current: {
      naacGrade: "B++",
      naacUntil: "2027-11-30",
      nba: ["3 programmes (as stated by the college)", false],
      aicte: "Approved (EOA 2025-26)",
      ugc: "Recognised under Section 2(f)",
      autonomous: "Not autonomous",
      affiliation: "Affiliated (annual renewal, 2025-26)",
      land: 14,
      builtup: 365000,
      classrooms: 58,
      labs: 41,
      books: 52000,
      hostelCap: 1100,
      hostelOcc: 640,
      buses: 22,
      sports: "Football ground, volleyball courts, gymnasium",
    },
    commercial: {
      collection: [90, 89, 88, 87, 88],
      scholarship: [12, 13, 14, 15, 16],
      discount: [6, 7, 9, 10, 11],
      refunds: [2400000, 2600000, 3100000, 3400000, 3600000],
    },
    omit: ["dropout.rate", "placement.median|2021", "hostel.occupancy"],
    unavailable: [
      { key: "placement.median", period: "2021", sourceType: "GOVERNMENT", sourceName: "NIRF 2022 data submission", note: "Median package field left blank in the submission" },
      { key: "hostel.occupancy", period: "current", sourceType: "INTERNAL", sourceName: VISIT, note: "Hostel registers were not shared during the visit" },
      { key: "dropout.rate", period: "2024-25", sourceType: "GOVERNMENT", sourceName: "AISHE 2024-25 DCF", note: "Dropout figures not reported in the return" },
    ],
    recruiters: [
      ["Zentrovia Technologies", "IT", [2021, 2022, 2023, 2024, 2025], true],
      ["Quillonta Software", "IT", [2022, 2023, 2024, 2025]],
      ["Okhara Datalabs", "IT", [2023, 2025]],
      ["Drishvant Analytics", "IT", [2025]],
      ["Nimbrelle Cloudworks", "IT", [2025]],
      ["Pellumix Finserv", "BFSI", [2021, 2023, 2024]],
      ["Rasmira Insurance Broking", "BFSI", [2022, 2023, 2024, 2025]],
      ["Kordenza Engineering", "Core", [2021, 2022]],
      ["Varhelix Automation", "Core", [2024, 2025]],
      ["Indelune BPO Services", "Services", [2021, 2022, 2023, 2024, 2025]],
      ["Yelvora Consulting", "Services", [2024, 2025]],
      ["Ombrevale Logistics", "Services", [2023, 2024]],
      ["Suvarnix Retail", "Other", [2022, 2023, 2024, 2025]],
      ["Thavron Edu Ventures", "Other", [2025]],
    ],
    promoters: [
      {
        name: "Zenithvale Education Trust",
        kind: "TRUST",
        role: "Sponsoring trust",
        established: 2006,
        sourceName: REGISTRAR,
        entities: [
          ["Zenithvale Polytechnic (sample)", "INSTITUTION", "Run by the same trust"],
          ["Zenithvale International School (sample)", "INSTITUTION", "Run by the same trust"],
        ],
      },
      {
        name: "Shri Omkar Dhavalikar",
        kind: "PERSON",
        role: "Managing Trustee",
        sourceName: DISCLOSURE,
        entities: [
          ["Dhavalikar Buildcon Pvt Ltd (sample)", "BUSINESS", "Director"],
          ["Zenithvale Hostels & Facilities LLP (sample)", "BUSINESS", "Designated partner; runs the campus hostels"],
        ],
      },
      {
        name: "Smt. Rujuta Dhavalikar",
        kind: "PERSON",
        role: "Trustee & Treasurer",
        sourceName: DISCLOSURE,
        entities: [["Zenithvale International School (sample)", "INSTITUTION", "Director"]],
      },
    ],
    legal: [],
  },
  {
    inst: {
      id: "sample-declining",
      name: "Larkmoor College of Arts, Science & Commerce",
      aisheCode: "C-90003",
      city: "Lucknow",
      state: "Uttar Pradesh",
      established: 1996,
      ownership: "Private Trust",
      university: "Awadh Plains State University",
      campusStatus: "Operational",
      isSample: true,
      overallRisk: "RED",
      overallRiskNote:
        "Manual judgement: admissions have fallen every year for five years, NAAC accreditation lapsed in March 2025 and fee collection is weak. Not a guilt finding on anyone; the operating trend itself is the concern.",
      opportunity: "LOW",
      opportunityNote: "Manual judgement: large unused capacity, but demand in the current programme mix is shrinking and one programme has already closed.",
    },
    portal: "Awadh Plains State University examination portal",
    intakeSource: (ay) => ["UNIVERSITY_PORTAL", `Awadh Plains State University affiliation order ${ay}`],
    capacity: 2760,
    feeGrowth: 1.01,
    feeVerified: false,
    finVerified: false,
    programmes: [
      { name: "B.Sc", level: "UG", started: 1996, intake: [240, 240, 240, 240, 240], adm: [190, 172, 150, 130, 112], fee0: 42000 },
      { name: "B.Com", level: "UG", started: 1996, intake: [240, 240, 240, 240, 240], adm: [200, 185, 165, 142, 125], fee0: 38000 },
      { name: "BBA", level: "UG", started: 2005, intake: [120, 120, 120, 120, 120], adm: [95, 86, 78, 66, 58], fee0: 65000 },
      { name: "BCA", level: "UG", started: 2007, intake: [120, 120, 120, 120, 120], adm: [96, 88, 80, 68, 62], fee0: 70000 },
      { name: "B.Ed", level: "UG", started: 2010, intake: [100, 100, 100, 100, 100], adm: [80, 72, 66, 53, 45], fee0: 85000 },
      { name: "M.Com", level: "PG", started: 2012, discontinued: 2024, intake: [60, 60, 60, null, null], adm: [25, 22, 15, null, null], fee0: 48000 },
    ],
    claims: [700, 640, 570, 475, 415],
    students: [2350, 2180, 1960, 1720, 1480],
    faculty: [110, 104, 95, 84, 72],
    campus: {
      attendance: [76, 74, 71, 69, 66],
      pass: [72, 70, 67, 65, 62],
      backlog: [28, 30, 33, 35, 38],
      dropout: [6, 7.5, 9, 11, 13],
      graduation: [70, 67, 64, 61, 58],
      progression: [10, 9, 9, 8, 7],
    },
    placement: {
      eligible: [400, 380, 350, 320, 290],
      rate: [58, 54, 49, 44, 38],
      claimRate: [62, 58, 54, 50, null],
      highest: [600000, 600000, 550000, 500000, 480000],
      average: [260000, 265000, 262000, 258000, 255000],
      median: [240000, 240000, 238000, 235000, 230000],
      recruiters: [24, 21, 18, 15, 12],
      international: [null, null, null, null, null],
      instOnly: [4],
    },
    nirf: { "nirf.college": [138, 149, null, null, null] },
    current: {
      naacGrade: "B+",
      naacUntil: "2025-03-31",
      nba: ["None", true],
      aicte: "Approved for BBA and BCA (EOA 2025-26)",
      ugc: "Recognised under Section 2(f) and 12(B)",
      autonomous: "Not autonomous",
      affiliation: "Affiliated (annual renewal, 2025-26)",
      land: 9.5,
      builtup: 186000,
      classrooms: 46,
      labs: 14,
      books: 41000,
      hostelCap: 600,
      hostelOcc: 210,
      buses: 6,
      sports: "Playground, one volleyball court",
    },
    commercial: {
      collection: [88, 86, 83, 80, 78],
      scholarship: [14, 15, 17, 18, 20],
      discount: [5, 8, 11, 14, 17],
      refunds: [600000, 700000, 900000, 1100000, 1200000],
    },
    omit: ["library.books", "refunds.total", "revenue.total|2025-26"],
    unavailable: [
      { key: "placement.rate", period: "2025", sourceType: "GOVERNMENT", sourceName: "NIRF 2026 data submission", note: "No submission found for this institution" },
      { key: "revenue.total", period: "2025-26", sourceType: "INSTITUTION", sourceName: "Management accounts 2025-26 shared by institution", note: "Requested; not provided" },
      { key: "library.books", period: "current", sourceType: "INSTITUTION", sourceName: DISCLOSURE, note: "Field blank in the published disclosure" },
    ],
    recruiters: [
      ["Indelune BPO Services", "Services", [2021, 2022, 2023, 2024, 2025]],
      ["Suvarnix Retail", "Other", [2021, 2022, 2023, 2024]],
      ["Rasmira Insurance Broking", "BFSI", [2021, 2022, 2023]],
      ["Pellumix Finserv", "BFSI", [2021, 2022]],
      ["Gomukhi Microfinance Services", "BFSI", [2023, 2024, 2025]],
      ["Quillonta Software", "IT", [2021]],
      ["Ombrevale Logistics", "Services", [2022, 2023, 2024, 2025]],
      ["Thavron Edu Ventures", "Other", [2024, 2025]],
      ["Chandrakosh Tutorials", "Other", [2025]],
    ],
    promoters: [
      {
        name: "Larkmoor Shiksha Nyas",
        kind: "TRUST",
        role: "Sponsoring trust",
        established: 1993,
        sourceName: REGISTRAR,
        entities: [["Larkmoor Inter College (sample)", "INSTITUTION", "Run by the same trust"]],
      },
      {
        name: "Shri Devvrat Katiyar",
        kind: "PERSON",
        role: "Chairman & Managing Trustee",
        sourceName: DISCLOSURE,
        entities: [
          ["Katiyar Cold Storage Pvt Ltd (sample)", "BUSINESS", "Director"],
          ["Larkmoor Inter College (sample)", "INSTITUTION", "Manager"],
        ],
      },
      {
        name: "Dr. Meenal Katiyar",
        kind: "PERSON",
        role: "Secretary",
        sourceName: DISCLOSURE,
        entities: [["Katiyar Cold Storage Pvt Ltd (sample)", "BUSINESS", "Director"]],
      },
    ],
    legal: [],
  },
  {
    inst: {
      id: "sample-promoter",
      name: "Tarangini Hills Institute of Technology",
      aisheCode: "C-90004",
      city: "Coimbatore",
      state: "Tamil Nadu",
      established: 2001,
      ownership: "Private Trust",
      university: "Noyyal Valley Technical University",
      campusStatus: "Operational",
      isSample: true,
      overallRisk: "AMBER",
      overallRiskNote:
        "Manual judgement: college metrics are sound and verified. Rated amber only because a regulatory notice and a civil suit linked to the promoter are pending; both require legal review and neither is a finding against any party.",
      opportunity: "MEDIUM",
      opportunityNote: "Manual judgement: stable, well-run campus with about 11% of intake unfilled. Proceed only after the pending matters are reviewed.",
    },
    portal: "Noyyal Valley Technical University examination portal",
    intakeSource: aicteIntake,
    capacity: 2280,
    feeGrowth: 1.04,
    feeVerified: true,
    finVerified: true,
    programmes: [
      { name: "B.E. Computer Science & Engineering", level: "UG", started: 2001, intake: [180, 180, 180, 180, 180], adm: [158, 160, 164, 168, 170], fee0: 155000 },
      { name: "B.E. Mechanical Engineering", level: "UG", started: 2001, intake: [120, 120, 120, 120, 120], adm: [98, 96, 94, 92, 92], fee0: 130000 },
      { name: "B.E. Electronics & Communication", level: "UG", started: 2003, intake: [120, 120, 120, 120, 120], adm: [100, 102, 104, 106, 108], fee0: 140000 },
      { name: "MBA", level: "PG", started: 2008, intake: [120, 120, 120, 120, 120], adm: [104, 106, 108, 108, 110], fee0: 170000 },
      { name: "MCA", level: "PG", started: 2009, intake: [60, 60, 60, 60, 60], adm: [50, 52, 52, 54, 54], fee0: 120000 },
    ],
    claims: [512, 518, 525, 530, 538],
    students: [1880, 1900, 1920, 1940, 1960],
    faculty: [104, 105, 106, 108, 110],
    campus: {
      attendance: [84, 84, 85, 85, 86],
      pass: [88, 88, 89, 89, 90],
      backlog: [12, 12, 11, 11, 10],
      dropout: [3, 3, 2.8, 2.7, 2.5],
      graduation: [86, 87, 87, 88, 88],
      progression: [10, 10, 11, 11, 12],
    },
    placement: {
      eligible: [470, 475, 480, 485, 490],
      rate: [80, 81, 82, 83, 84],
      claimRate: [81, 82, 83, 84, 85],
      highest: [1000000, 1100000, 1250000, 1400000, 1500000],
      average: [400000, 420000, 440000, 465000, 490000],
      median: [370000, 385000, 400000, 420000, 445000],
      recruiters: [35, 36, 38, 40, 42],
      international: [1, 1, 2, 2, 3],
    },
    nirf: { "nirf.engineering": [171, 168, 160, 155, 149] },
    current: {
      naacGrade: "A",
      naacUntil: "2028-09-30",
      nba: ["B.E. CSE, B.E. Mechanical (valid to June 2027)", true],
      aicte: "Approved (EOA 2025-26)",
      ugc: "Recognised under Section 2(f) and 12(B)",
      autonomous: "Autonomous (granted 2019, valid to 2029)",
      affiliation: "Affiliated (permanent)",
      land: 18,
      builtup: 328000,
      classrooms: 52,
      labs: 34,
      books: 59000,
      hostelCap: 800,
      hostelOcc: 664,
      buses: 18,
      sports: "Athletics track, cricket nets, indoor sports complex",
    },
    commercial: {
      collection: [95, 95, 96, 96, 96],
      scholarship: [10, 10, 11, 11, 12],
      discount: [2, 2, 2, 2, 2],
      refunds: [1200000, 1300000, 1300000, 1400000, 1500000],
    },
    omit: ["progression.rate", "placement.international|2025"],
    unavailable: [
      { key: "placement.international", period: "2025", sourceType: "INSTITUTION", sourceName: BROCHURE, note: "Not stated in the 2025 brochure" },
      { key: "progression.rate", period: "2025-26", sourceType: "INSTITUTION", sourceName: "AQAR 2025-26 (institution submission)", note: "Not reported" },
    ],
    recruiters: [
      ["Kordenza Engineering", "Core", [2021, 2022, 2023, 2024, 2025], true],
      ["Varhelix Automation", "Core", [2021, 2022, 2023, 2024, 2025], true],
      ["Marulith Infra Projects", "Core", [2023, 2024, 2025]],
      ["Siruvani Precision Castings", "Core", [2022, 2024, 2025]],
      ["Zentrovia Technologies", "IT", [2021, 2022, 2023, 2024, 2025], true],
      ["Okhara Datalabs", "IT", [2023, 2024, 2025]],
      ["Nimbrelle Cloudworks", "IT", [2025]],
      ["Pellumix Finserv", "BFSI", [2022, 2023, 2024, 2025]],
      ["Tavishka Capital Services", "BFSI", [2021, 2022]],
      ["Yelvora Consulting", "Services", [2024, 2025]],
    ],
    promoters: [
      {
        name: "Tarangini Hills Charitable Trust",
        kind: "TRUST",
        role: "Sponsoring trust",
        established: 1997,
        sourceName: REGISTRAR,
        entities: [
          ["Tarangini Hills College of Nursing (sample)", "INSTITUTION", "Run by the same trust"],
          ["Tarangini Hills Matriculation School (sample)", "INSTITUTION", "Run by the same trust"],
        ],
      },
      {
        name: "Thiru Elangovan Marudhachalam",
        kind: "PERSON",
        role: "Chairman & Managing Trustee",
        sourceName: DISCLOSURE,
        entities: [
          ["Marudhachalam Textiles Pvt Ltd (sample)", "BUSINESS", "Managing Director"],
          ["Noyyal Greens Realty LLP (sample)", "BUSINESS", "Designated partner"],
        ],
      },
      {
        name: "Tmt. Yazhini Elangovan",
        kind: "PERSON",
        role: "Trustee & Correspondent",
        sourceName: DISCLOSURE,
        entities: [["Tarangini Hills Matriculation School (sample)", "INSTITUTION", "Correspondent"]],
      },
      {
        name: "Dr. Kathiresan Pazhanivel",
        kind: "PERSON",
        role: "Trustee",
        sourceName: DIRECTOR_MASTER,
        entities: [["Marudhachalam Textiles Pvt Ltd (sample)", "BUSINESS", "Director"]],
      },
    ],
    legal: [
      {
        promoter: 1,
        stage: "CIVIL_DISPUTE",
        title: "Suit over title to 2.4 acres adjoining the campus",
        forum: "District Court, Coimbatore",
        year: 2023,
        summary:
          "A neighbouring landholder filed a suit for declaration of title and injunction over 2.4 acres on the eastern boundary, naming the Managing Trustee and Noyyal Greens Realty LLP as defendants. The defendants have filed a written statement contesting the claim. No interim order affecting campus operations is recorded.",
        currentStatus: "Pending; listed for plaintiff's evidence",
        sourceName: "District court case status extract, O.S. No. 90417/2023 (sample citation)",
        asOfDate: "2026-09-10",
      },
      {
        promoter: 0,
        stage: "REGULATORY_ACTION",
        title: "Show-cause notice on faculty cadre ratio and delayed compliance report",
        forum: "AICTE regional office",
        year: 2025,
        summary:
          "A show-cause notice was issued to the trust after an inspection recorded a shortfall in professor-cadre faculty in two programmes and a compliance report filed after the due date. The trust has submitted a written reply with appointment records. No order reducing intake or withdrawing approval has been issued.",
        currentStatus: "Pending; reply filed, hearing before the standing committee awaited",
        sourceName: "AICTE notice ref. SCN/SR/90-2025/0412 (sample citation)",
        asOfDate: "2026-08-28",
      },
      {
        promoter: 2,
        stage: "COMPLAINT",
        title: "Complaint by a former contractor alleging unpaid dues for school building works",
        forum: "Police station, Coimbatore Rural (petition register)",
        year: 2024,
        summary:
          "A former civil contractor lodged a written complaint alleging non-payment for works at the matriculation school. The complaint is entered in the petition register. No FIR has been registered and no further stage is recorded in the sources checked.",
        currentStatus: "Complaint on file; no further stage recorded",
        sourceName: "Petition register entry CSR No. 9031/2024 (sample citation)",
        asOfDate: "2026-08-28",
      },
    ],
  },
];

async function seedOne(c: Cfg) {
  const id = c.inst.id;
  await prisma.institution.create({ data: c.inst });

  await prisma.programme.createMany({
    data: c.programmes.map((p, i) => ({
      id: `${id}-p${i + 1}`,
      institutionId: id,
      name: p.name,
      level: p.level,
      startedYear: p.started ?? null,
      discontinuedYear: p.discontinued ?? null,
    })),
  });

  const facts = buildFacts(c);
  await prisma.fact.createMany({ data: facts });

  await prisma.recruiter.createMany({
    data: c.recruiters.map(([name, sector, years, confirmed]) => ({
      institutionId: id,
      name,
      sector,
      years,
      sourceType: confirmed ? ("INTERNAL" as const) : ("INSTITUTION" as const),
      sourceName: confirmed ? "Recruiter confirmation call, internal team" : BROCHURE,
      asOfDate: d(confirmed ? "2026-09-22" : "2025-09-15"),
      status: confirmed ? ("VERIFIED" as const) : ("SELF_REPORTED" as const),
    })),
  });

  for (const [i, p] of c.promoters.entries()) {
    await prisma.promoter.create({
      data: {
        id: `${id}-pr${i + 1}`,
        institutionId: id,
        name: p.name,
        kind: p.kind,
        role: p.role,
        established: p.established ?? null,
        sourceName: p.sourceName,
        asOfDate: d("2026-08-15"),
        entities: {
          create: p.entities.map(([name, kind, relationship]) => ({
            name,
            kind,
            relationship,
            sourceName: kind === "BUSINESS" ? DIRECTOR_MASTER : REGISTRAR,
            asOfDate: d("2026-08-15"),
          })),
        },
      },
    });
  }

  if (c.legal.length) {
    await prisma.legalRecord.createMany({
      data: c.legal.map((l, i) => ({
        id: `${id}-l${i + 1}`,
        institutionId: id,
        promoterId: `${id}-pr${l.promoter + 1}`,
        stage: l.stage,
        title: l.title,
        forum: l.forum,
        year: l.year,
        summary: l.summary,
        currentStatus: l.currentStatus,
        sourceName: l.sourceName,
        asOfDate: d(l.asOfDate),
      })),
    });
  }

  return facts.length;
}

async function main() {
  await prisma.institution.deleteMany({
    where: { OR: [{ id: { in: CONFIGS.map((c) => c.inst.id) } }, { aisheCode: { in: CONFIGS.map((c) => c.inst.aisheCode) } }] },
  });
  for (const c of CONFIGS) {
    const n = await seedOne(c);
    console.log(`${c.inst.id}: ${n} facts, ${c.programmes.length} programmes, ${c.recruiters.length} recruiters, ${c.legal.length} legal records`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
