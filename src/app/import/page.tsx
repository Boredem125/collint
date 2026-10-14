import { prisma } from "@/lib/db";
import { Kicker } from "@/components/ui";
import ImportClient, { type BatchT } from "@/components/ImportClient";

export const dynamic = "force-dynamic";

export default async function ImportPage() {
  const rows = await prisma.importBatch.findMany({
    orderBy: { createdAt: "desc" },
    include: { institutions: { select: { id: true, name: true } }, _count: { select: { facts: true } } },
  });
  const batches: BatchT[] = rows.map((b) => ({
    id: b.id,
    filename: b.filename,
    createdAt: b.createdAt.toISOString(),
    accepted: b.accepted,
    rejected: b.rejected,
    facts: b._count.facts,
    institutions: b.institutions,
  }));

  return (
    <div className="max-w-5xl">
      <Kicker>Import</Kicker>
      <h1 className="display mt-2 max-w-3xl text-[28px] font-medium leading-[1.15] text-ink sm:text-[32px]">
        Bring in a spreadsheet. Every row is checked for source, date and status before anything is written.
      </h1>
      <ImportClient batches={batches} />
    </div>
  );
}
