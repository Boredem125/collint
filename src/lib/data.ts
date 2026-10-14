import { cache } from "react";
import { prisma } from "./db";
import type { DealStage, FactT, InstitutionT, NoteT, Profile } from "./types";

const iso = (d: Date) => d.toISOString();

type FactRow = Awaited<ReturnType<typeof prisma.fact.findMany>>[number];

export const toFactT = (f: FactRow): FactT => ({
  id: f.id,
  institutionId: f.institutionId,
  metricKey: f.metricKey,
  period: f.period,
  programmeId: f.programmeId,
  valueNum: f.valueNum,
  valueText: f.valueText,
  sourceType: f.sourceType,
  sourceName: f.sourceName,
  sourceUrl: f.sourceUrl,
  asOfDate: iso(f.asOfDate),
  status: f.status,
  note: f.note,
});

type InstRow = NonNullable<Awaited<ReturnType<typeof prisma.institution.findUnique>>>;

const toInstT = (i: InstRow): InstitutionT => ({
  id: i.id,
  name: i.name,
  aisheCode: i.aisheCode,
  city: i.city,
  state: i.state,
  established: i.established,
  ownership: i.ownership,
  university: i.university,
  campusStatus: i.campusStatus,
  isSample: i.isSample,
  overallRisk: i.overallRisk,
  overallRiskNote: i.overallRiskNote,
  opportunity: i.opportunity,
  opportunityNote: i.opportunityNote,
  stage: i.stage as DealStage,
  stageUpdatedAt: iso(i.stageUpdatedAt),
});

/** Everything known about one institution, serialisable for client components. Null if not found. */
export const getProfile = cache(async (id: string): Promise<Profile | null> => {
  const i = await prisma.institution.findUnique({
    where: { id },
    include: {
      facts: true,
      programmes: { orderBy: { name: "asc" } },
      promoters: { include: { entities: true } },
      legal: { orderBy: { year: "desc" } },
      recruiters: { orderBy: { name: "asc" } },
      notes: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!i) return null;
  return {
    inst: toInstT(i),
    facts: i.facts.map(toFactT),
    programmes: i.programmes.map((p) => ({
      id: p.id,
      name: p.name,
      level: p.level,
      startedYear: p.startedYear,
      discontinuedYear: p.discontinuedYear,
    })),
    promoters: i.promoters.map((p) => ({
      id: p.id,
      name: p.name,
      kind: p.kind,
      role: p.role,
      established: p.established,
      sourceName: p.sourceName,
      sourceUrl: p.sourceUrl,
      asOfDate: iso(p.asOfDate),
      entities: p.entities.map((e) => ({
        id: e.id,
        name: e.name,
        kind: e.kind,
        relationship: e.relationship,
        sourceName: e.sourceName,
        asOfDate: iso(e.asOfDate),
      })),
    })),
    legal: i.legal.map((l) => ({
      id: l.id,
      promoterId: l.promoterId,
      stage: l.stage,
      title: l.title,
      forum: l.forum,
      year: l.year,
      summary: l.summary,
      currentStatus: l.currentStatus,
      sourceName: l.sourceName,
      sourceUrl: l.sourceUrl,
      asOfDate: iso(l.asOfDate),
    })),
    recruiters: i.recruiters.map((r) => ({
      id: r.id,
      name: r.name,
      sector: r.sector,
      years: r.years,
      sourceType: r.sourceType,
      sourceName: r.sourceName,
      asOfDate: iso(r.asOfDate),
      status: r.status,
    })),
    notes: i.notes.map((n) => ({
      id: n.id,
      kind: n.kind as NoteT["kind"],
      body: n.body,
      createdAt: iso(n.createdAt),
    })),
  };
});

/** All profiles, for the portfolio table and compare. Fine at prototype scale. */
export async function listProfiles(): Promise<Profile[]> {
  const ids = await prisma.institution.findMany({ select: { id: true }, orderBy: { name: "asc" } });
  const out = await Promise.all(ids.map((x) => getProfile(x.id)));
  return out.filter((p): p is Profile => p !== null);
}

export interface SearchHit {
  id: string;
  name: string;
  aisheCode: string;
  city: string;
  university: string;
  // Why this row matched, e.g. "Promoter: XYZ Trust"
  match: string;
}

/** One box over name, AISHE code, university, city and promoter. */
export async function searchInstitutions(q: string): Promise<SearchHit[]> {
  const term = q.trim();
  if (!term) return [];
  const c = { contains: term, mode: "insensitive" as const };
  const rows = await prisma.institution.findMany({
    where: {
      OR: [
        { name: c },
        { aisheCode: c },
        { university: c },
        { city: c },
        { state: c },
        { promoters: { some: { name: c } } },
      ],
    },
    include: { promoters: { select: { name: true } } },
    take: 12,
    orderBy: { name: "asc" },
  });
  const has = (s: string) => s.toLowerCase().includes(term.toLowerCase());
  return rows.map((r) => {
    const promoter = r.promoters.find((p) => has(p.name));
    const match = has(r.name)
      ? "Name"
      : has(r.aisheCode)
        ? `AISHE: ${r.aisheCode}`
        : has(r.university)
          ? `University: ${r.university}`
          : has(r.city) || has(r.state)
            ? `Location: ${r.city}, ${r.state}`
            : promoter
              ? `Promoter: ${promoter.name}`
              : "";
    return { id: r.id, name: r.name, aisheCode: r.aisheCode, city: r.city, university: r.university, match };
  });
}
