import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { latest, periods, pick, variance } from "@/lib/facts";
import { SOURCE_LABEL } from "@/lib/metrics";
import type { FactT, RecruiterT } from "@/lib/types";
import { Num, Derived, ClaimVsVerified, CoverageMeter, StatusBadge } from "@/components/evidence/Evidence";
import { Card, Label, Empty, Th, Td } from "@/components/ui";
import { TrendLine } from "@/components/charts/TrendLine";
import { GroupedBars } from "@/components/charts/GroupedBars";
import { SectorSplit } from "@/components/charts/SectorSplit";

const KEYS = [
  "placement.eligible",
  "placement.placed",
  "placement.rate",
  "placement.highest",
  "placement.average",
  "placement.median",
];

export default async function PlacementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst, facts, recruiters } = profile;

  const years = [...new Set(KEYS.flatMap((k) => periods(facts, k)))].sort();
  const newestFirst = [...years].reverse();

  const variances = newestFirst
    .map((period) => ({ period, v: variance(facts, "placement.rate", period) }))
    .filter((x) => x.v !== null);

  const recYear = recruiters.length ? Math.max(...recruiters.flatMap((r) => r.years)) : null;
  const current = recYear === null ? [] : recruiters.filter((r) => r.years.includes(recYear));
  const repeat = current.filter((r) => r.years.includes(recYear! - 1));
  const fresh = current.filter((r) => r.years.every((y) => y === recYear));
  const top = [...recruiters].sort((a, b) => b.years.length - a.years.length || a.name.localeCompare(b.name));

  // Recruiter rows carry their own source and status, so counts over them cite those rows as evidence.
  const asFact = (r: RecruiterT): FactT => ({
    id: `recruiter-${r.id}`,
    institutionId: inst.id,
    metricKey: "placement.recruiters",
    period: String(recYear),
    programmeId: null,
    valueNum: null,
    valueText: r.name,
    sourceType: r.sourceType,
    sourceName: r.sourceName,
    sourceUrl: null,
    asOfDate: r.asOfDate,
    status: r.status,
    note: `Recruiter record: ${r.name}`,
  });
  const count = (list: RecruiterT[]) =>
    list.length ? (
      <Derived value={list.length} unit="count" basis={list.map(asFact)} />
    ) : (
      <span className="text-base font-normal text-muted">None identified</span>
    );

  const sectors = new Map<string, number>();
  for (const r of current) sectors.set(r.sector, (sectors.get(r.sector) ?? 0) + 1);
  const sectorItems = [...sectors].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-5">
      <Card title="Placement record, by graduating year">
        {years.length === 0 ? (
          <Empty>Not available. No placement facts recorded.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th>Eligible</Th>
                  <Th>Placed</Th>
                  <Th>Placement %</Th>
                  <Th>Highest</Th>
                  <Th>Average</Th>
                  <Th>Median</Th>
                </tr>
              </thead>
              <tbody>
                {newestFirst.map((y) => (
                  <tr key={y} className="border-t border-line">
                    <Td>{y}</Td>
                    {KEYS.map((k) => (
                      <Td key={k} num>
                        <Num fact={pick(facts, k, y)} />
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Placement rate trend">
          <TrendLine
            points={years.map((y) => {
              const f = pick(facts, "placement.rate", y);
              return { label: y, value: f?.valueNum ?? null, status: f?.status };
            })}
            unit="percent"
          />
        </Card>
        <Card title="Batch size vs placed">
          <GroupedBars
            groups={years.map((y) => {
              const e = pick(facts, "placement.eligible", y);
              const p = pick(facts, "placement.placed", y);
              return {
                label: y,
                bars: [
                  { name: "Eligible", value: e?.valueNum ?? null, status: e?.status },
                  { name: "Placed", value: p?.valueNum ?? null, status: p?.status },
                ],
              };
            })}
            unit="count"
          />
          <div className="mt-3 grid grid-cols-2 gap-3 border-t border-line pt-3">
            <div>
              <Label>Eligible, latest year</Label>
              <div className="mt-1 text-lg font-semibold tnum">
                <Num fact={latest(facts, "placement.eligible")} />
              </div>
            </div>
            <div>
              <Label>Placed, latest year</Label>
              <div className="mt-1 text-lg font-semibold tnum">
                <Num fact={latest(facts, "placement.placed")} />
              </div>
            </div>
          </div>
        </Card>
      </div>

      <Card title="Red flags: claimed vs disclosed placement rate">
        {variances.length === 0 ? (
          <Empty>
            No competing sources. A comparison needs both an institution claim and an independent disclosure for the
            same year.
          </Empty>
        ) : (
          <div className="space-y-5">
            {variances.map((x) => (
              <ClaimVsVerified key={x.period} variance={x.v} label={`Placement rate ${x.period}`} unit="percent" />
            ))}
          </div>
        )}
      </Card>

      <Card title="Employer intelligence">
        {recruiters.length === 0 ? (
          <Empty>Not available. No recruiter records in the sources checked.</Empty>
        ) : (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
              <div>
                <Label>Recruiters, {recYear}</Label>
                <div className="mt-1 text-xl font-semibold tnum">{count(current)}</div>
                <div className="text-xs text-muted">From recruiter records</div>
              </div>
              <div>
                <Label>Recruiters visited (reported)</Label>
                <div className="mt-1 text-xl font-semibold tnum">
                  <Num fact={latest(facts, "placement.recruiters")} />
                </div>
              </div>
              <div>
                <Label>Repeat recruiters</Label>
                <div className="mt-1 text-xl font-semibold tnum">{count(repeat)}</div>
                <div className="text-xs text-muted">
                  Present in {recYear! - 1} and {recYear}
                </div>
              </div>
              <div>
                <Label>New recruiters</Label>
                <div className="mt-1 text-xl font-semibold tnum">{count(fresh)}</div>
                <div className="text-xs text-muted">{recYear} only</div>
              </div>
              <div>
                <Label>International placements</Label>
                <div className="mt-1 text-xl font-semibold tnum">
                  <Num fact={latest(facts, "placement.international")} />
                </div>
              </div>
            </div>

            <div>
              <Label>Sector split, {recYear}</Label>
              <div className="mt-2">
                {sectorItems.length ? <SectorSplit items={sectorItems} /> : <Empty>Not available</Empty>}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr>
                    <Th>Recruiter</Th>
                    <Th>Sector</Th>
                    <Th>Years on campus</Th>
                    <Th>Status</Th>
                    <Th>Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={r.id} className="border-t border-line" data-evidence={r.status}>
                      <Td>{r.name}</Td>
                      <Td>{r.sector}</Td>
                      <Td>{[...r.years].sort().join(", ") || "Not available"}</Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td>
                        <span className="text-xs text-muted">
                          {SOURCE_LABEL[r.sourceType]} · {r.sourceName}
                        </span>
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Card>

      <Card>
        <CoverageMeter facts={facts} module="placements" label="Placements evidence coverage" />
      </Card>
    </div>
  );
}
