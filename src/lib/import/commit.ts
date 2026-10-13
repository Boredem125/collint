import { prisma } from "../db";
import { acceptedTotal, type ParseResult } from "./parse";

export interface CommitResult {
  batchId: string;
  accepted: number;
  rejected: number;
  counts: { institutions: number; programmes: number; facts: number; promoters: number; legal: number; recruiters: number };
  // Every institution the batch touched; `created` is false for ones that already existed
  institutions: { id: string; name: string; aisheCode: string; created: boolean }[];
}

const key = (aisheCode: string, name: string) => `${aisheCode}|${name}`;

/**
 * Write a parsed workbook in one transaction. New institutions and all Facts carry the batch id,
 * so deleting the ImportBatch removes them (and, by cascade, everything under a new institution).
 */
export async function commitImport(parsed: ParseResult, filename: string): Promise<CommitResult> {
  const accepted = acceptedTotal(parsed);
  if (accepted === 0) throw new Error("Nothing to import: no rows were accepted.");

  return prisma.$transaction(
    async (tx) => {
      const codes = new Set<string>();
      for (const list of [parsed.institutions, parsed.programmes, parsed.facts, parsed.promoters, parsed.legal, parsed.recruiters])
        for (const r of list) codes.add(r.aisheCode);

      const existing = await tx.institution.findMany({
        where: { aisheCode: { in: [...codes] } },
        select: { id: true, name: true, aisheCode: true },
      });
      const inst = new Map(existing.map((i) => [i.aisheCode, { ...i, created: false }]));

      const batch = await tx.importBatch.create({ data: { filename, accepted, rejected: parsed.rejected.length } });

      const fresh = parsed.institutions.filter((r) => !inst.has(r.aisheCode));
      for (const { row: _row, campusStatus, ...r } of fresh) {
        const made = await tx.institution.create({
          data: { ...r, ...(campusStatus ? { campusStatus } : {}), isSample: false, importBatchId: batch.id },
          select: { id: true, name: true, aisheCode: true },
        });
        inst.set(made.aisheCode, { ...made, created: true });
      }

      // The preview has already checked references; a miss here means the database changed in between.
      const instId = (code: string): string => {
        const hit = inst.get(code);
        if (!hit) throw new Error(`Institution ${code} no longer exists. Preview the file again.`);
        return hit.id;
      };
      const ids = [...inst.values()].map((i) => i.id);
      const codeOf = new Map([...inst.values()].map((i) => [i.id, i.aisheCode]));

      const programmes = await tx.programme.createManyAndReturn({
        data: parsed.programmes.map(({ row: _row, aisheCode, ...r }) => ({ ...r, institutionId: instId(aisheCode) })),
        select: { id: true },
      });
      const promoters = await tx.promoter.createManyAndReturn({
        data: parsed.promoters.map(({ row: _row, aisheCode, ...r }) => ({ ...r, institutionId: instId(aisheCode) })),
        select: { id: true },
      });

      const progId = new Map<string, string>();
      for (const p of await tx.programme.findMany({ where: { institutionId: { in: ids } }, select: { id: true, name: true, institutionId: true } }))
        progId.set(key(codeOf.get(p.institutionId)!, p.name), p.id);
      const promId = new Map<string, string>();
      for (const p of await tx.promoter.findMany({ where: { institutionId: { in: ids } }, select: { id: true, name: true, institutionId: true } }))
        promId.set(key(codeOf.get(p.institutionId)!, p.name), p.id);

      const facts = await tx.fact.createMany({
        data: parsed.facts.map(({ row, aisheCode, programme, ...r }) => {
          const programmeId = programme ? progId.get(key(aisheCode, programme)) : null;
          if (programme && !programmeId) throw new Error(`Facts row ${row}: programme '${programme}' no longer exists. Preview the file again.`);
          return { ...r, institutionId: instId(aisheCode), programmeId: programmeId ?? null, importBatchId: batch.id };
        }),
      });

      const legal = await tx.legalRecord.createMany({
        data: parsed.legal.map(({ row, aisheCode, promoterName, ...r }) => {
          const promoterId = promoterName ? promId.get(key(aisheCode, promoterName)) : null;
          if (promoterName && !promoterId) throw new Error(`LegalRecords row ${row}: promoter '${promoterName}' no longer exists. Preview the file again.`);
          return { ...r, institutionId: instId(aisheCode), promoterId: promoterId ?? null };
        }),
      });

      const recruiters = await tx.recruiter.createMany({
        data: parsed.recruiters.map(({ row: _row, aisheCode, ...r }) => ({ ...r, institutionId: instId(aisheCode) })),
      });

      return {
        batchId: batch.id,
        accepted,
        rejected: parsed.rejected.length,
        counts: {
          institutions: fresh.length,
          programmes: programmes.length,
          facts: facts.count,
          promoters: promoters.length,
          legal: legal.count,
          recruiters: recruiters.count,
        },
        institutions: [...inst.values()],
      };
    },
    { timeout: 60000 },
  );
}
