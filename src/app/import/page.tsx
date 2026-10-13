import { prisma } from "@/lib/db";
import { PageHeader } from "@/components/ui";
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
    <>
      <PageHeader
        title="Import data"
        subtitle="Excel or CSV. Every row is checked for source, date and status before anything is written."
      />
      <ImportClient batches={batches} />
    </>
  );
}
