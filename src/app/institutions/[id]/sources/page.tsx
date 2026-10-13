import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { PageHeader } from "@/components/ui";
import { CoverageMeter } from "@/components/evidence/Evidence";
import { FactLedger } from "@/components/FactLedger";

export default async function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Source & Verification ledger"
        subtitle="Every fact held for this institution, with its source, date and status. Competing sources for the same metric are listed as separate rows."
      >
        <CoverageMeter facts={profile.facts} label="Overall evidence coverage" />
      </PageHeader>
      <FactLedger facts={profile.facts} programmes={profile.programmes} />
    </div>
  );
}
