import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { periods, pick } from "@/lib/facts";
import { NIRF_CATEGORIES, metric } from "@/lib/metrics";
import { Num, CoverageMeter } from "@/components/evidence/Evidence";
import { Card, Label, Empty } from "@/components/ui";
import { NirfTimeline } from "@/components/charts/NirfTimeline";

const STATUS_CARDS = [
  { key: "nba.programmes", title: "NBA" },
  { key: "aicte.status", title: "AICTE" },
  { key: "ugc.status", title: "UGC" },
  { key: "autonomous.status", title: "Autonomous" },
  { key: "affiliation.status", title: "Affiliation" },
];

export default async function AccreditationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts } = profile;

  const ranked = NIRF_CATEGORIES.filter((k) => periods(facts, k).length > 0);
  const nirfYears = [...new Set(ranked.flatMap((k) => periods(facts, k)))].sort();
  const nirfRows = ranked.map((k) => ({
    category: metric(k)?.label ?? k,
    points: nirfYears.map((year) => ({ year, fact: pick(facts, k, year) })),
  }));

  const naacGrade = pick(facts, "naac.grade");
  const naacUntil = pick(facts, "naac.validUntil");
  const until = naacUntil?.valueText ? new Date(naacUntil.valueText) : null;
  const expired = until !== null && !Number.isNaN(until.getTime()) && until.getTime() < Date.now();

  return (
    <div className="space-y-5">
      <Card title="NIRF ranking, by category">
        {nirfRows.length === 0 ? (
          <Empty>Not ranked in any category in the years checked</Empty>
        ) : (
          <NirfTimeline rows={nirfRows} />
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        <Card title="NAAC">
          <Label>Grade</Label>
          <div className="mt-1 text-xl font-semibold tnum">
            <Num fact={naacGrade} />
          </div>
          <div className="mt-3">
            <Label>Valid until</Label>
            <div className="mt-1 text-sm tnum">
              <Num fact={naacUntil} unit="date" />
            </div>
            {expired && <p className="mt-1 text-sm font-medium text-attention">Expired</p>}
          </div>
        </Card>
        {STATUS_CARDS.map((c) => (
          <Card key={c.key} title={c.title}>
            <Label>{metric(c.key)?.label ?? c.title}</Label>
            <div className="mt-1 text-base font-semibold">
              <Num fact={pick(facts, c.key)} />
            </div>
          </Card>
        ))}
      </div>

      <Card>
        <CoverageMeter facts={facts} module="accreditation" label="Ranking & accreditation evidence coverage" />
      </Card>
    </div>
  );
}
