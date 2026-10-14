import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { countGaps, evidenceGaps, gapVerdict, groupBySource } from "@/lib/gaps";
import { Kicker, Stat, StatRow } from "@/components/ui";
import RequestList from "@/components/RequestList";

export const dynamic = "force-dynamic";

export default async function GapsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst } = profile;

  const gaps = evidenceGaps(profile);
  const c = countGaps(gaps);
  const groups = groupBySource(gaps);

  return (
    <div className="space-y-10">
      <header>
        <Kicker>Evidence gaps</Kicker>
        <h2 className="display mt-2 max-w-3xl text-[21px] font-medium leading-snug text-ink sm:text-[26px]">
          {gapVerdict(gaps)}
          {c.total ? `, across ${groups.length} ${groups.length === 1 ? "source" : "sources"} to request from.` : ""}
        </h2>
        {c.total ? (
          <p className="mt-2 text-[14px] text-muted">
            Each expected metric is checked for its latest period. Select the requests to send and export them as one letter.
          </p>
        ) : null}
      </header>

      {c.total ? (
        <>
          <StatRow>
            <Stat label="Missing" sub="No usable figure on record">
              <span className="tnum">{c.missing}</span>
            </Stat>
            <Stat label="Unverified" sub="Self-reported or needs validation">
              <span className="tnum">{c.unverified}</span>
            </Stat>
            <Stat label="Disputed" sub="Claim differs from source by more than 5%">
              <span className={`tnum ${c.disputed ? "text-critical" : ""}`}>{c.disputed}</span>
            </Stat>
          </StatRow>
          <RequestList inst={{ name: inst.name, aisheCode: inst.aisheCode, isSample: inst.isSample }} groups={groups} />
        </>
      ) : null}
    </div>
  );
}
