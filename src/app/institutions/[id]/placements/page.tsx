import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { coverage, latest, periods, pick, series, trend, variance } from "@/lib/facts";
import { SOURCE_LABEL } from "@/lib/metrics";
import type { FactT, RecruiterT } from "@/lib/types";
import { Num, Derived, ClaimVsVerified, StatusBadge } from "@/components/evidence/Evidence";
import { Kicker, Section, Stat, StatRow, Empty, Th, Td } from "@/components/ui";
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

// Contiguous runs print as a range: 2021, 2022, 2023 -> 2021–2023.
function yearSpan(years: number[]): string {
  const y = [...years].sort((a, b) => a - b);
  if (!y.length) return "Not available";
  const contiguous = y.every((v, i) => i === 0 || v === y[i - 1] + 1);
  return contiguous && y.length > 2 ? `${y[0]}–${y.at(-1)}` : y.join(", ");
}

export default async function PlacementsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst, facts, recruiters } = profile;

  const years = [...new Set(KEYS.flatMap((k) => periods(facts, k)))].sort();
  const newestFirst = [...years].reverse();

  const compared = newestFirst
    .map((period) => ({ period, v: variance(facts, "placement.rate", period) }))
    .filter((x) => x.v !== null);

  const rate = series(facts, "placement.rate").filter((p) => p.fact && p.value !== null);
  const rFirst = rate[0];
  const rLast = rate.at(-1);
  const rDir = trend(rate.map((p) => p.value));
  const lastWeak = rLast && rLast.fact!.status !== "VERIFIED";
  const gap = compared[0];

  // Verdict, computed from the evidence held.
  const rateClause: ReactNode = !rLast ? (
    <>No placement rate is on record.</>
  ) : rFirst !== rLast && rDir !== "flat" ? (
    <>
      The placement rate {rDir === "down" ? "fell" : "rose"} from <Num fact={rFirst.fact} /> to{" "}
      <Num fact={rLast.fact} /> between {rFirst.period} and {rLast.period}.
    </>
  ) : (
    <>
      The placement rate holds near <Num fact={rLast.fact} /> ({rLast.period}).
    </>
  );
  const claimClause: ReactNode =
    gap?.v && gap.v.diff > 3 ? (
      <>
        In {gap.period} the college claimed <Num fact={gap.v.claimed} /> against <Num fact={gap.v.verified} />{" "}
        independently disclosed{lastWeak && rLast.period !== gap.period ? `; ${rLast.period} has no independent figure` : ""}.
      </>
    ) : lastWeak ? (
      <>{rLast.period} rests on the college&apos;s own figure, with no independent disclosure.</>
    ) : gap?.v ? (
      <>College claims agree with independent disclosures.</>
    ) : (
      <>No year has both a college claim and an independent disclosure.</>
    );

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
      <span className="text-muted">None identified</span>
    );

  const sectors = new Map<string, number>();
  for (const r of current) sectors.set(r.sector, (sectors.get(r.sector) ?? 0) + 1);
  const sectorItems = [...sectors].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);

  const cov = coverage(facts, "placements");

  return (
    <div className="space-y-14">
      <header>
        <Kicker>Placements{years.length ? ` · ${years[0]} to ${years.at(-1)}` : ""}</Kicker>
        <h2 className="display mt-3 max-w-3xl text-[21px] leading-[1.3] text-ink sm:text-[30px] sm:leading-[1.25]">
          {rateClause} <span className="text-muted">{claimClause}</span>
        </h2>

        <StatRow className="mt-10">
          <Stat label="Placement rate" size="lg" sub={rLast?.period}>
            <Num fact={rLast?.fact} />
          </Stat>
          <Stat label="Placed" sub={latest(facts, "placement.placed")?.period}>
            <Num fact={latest(facts, "placement.placed")} />
          </Stat>
          <Stat label="Eligible" sub={latest(facts, "placement.eligible")?.period}>
            <Num fact={latest(facts, "placement.eligible")} />
          </Stat>
          <Stat label="Median package" sub={latest(facts, "placement.median")?.period}>
            <Num fact={latest(facts, "placement.median")} />
          </Stat>
          <Stat label="Average package" sub={latest(facts, "placement.average")?.period}>
            <Num fact={latest(facts, "placement.average")} />
          </Stat>
          <Stat label="Highest package" sub={latest(facts, "placement.highest")?.period}>
            <Num fact={latest(facts, "placement.highest")} />
          </Stat>
        </StatRow>
      </header>

      <Section
        index="01"
        title="Claimed against disclosed"
        aside={`Placement rate, college vs independent source, ${compared.length} ${compared.length === 1 ? "year" : "years"}`}
      >
        {compared.length === 0 ? (
          <Empty>No year has both a college claim and an independent disclosure.</Empty>
        ) : (
          <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
            {compared.map((x) => (
              <ClaimVsVerified key={x.period} variance={x.v} label={x.period} unit="percent" />
            ))}
          </div>
        )}
        {lastWeak && (
          <p className="mt-6 border-l-2 border-selfreported pl-3 text-[13px] text-ink">
            {rLast.period} rate comes only from {rLast.fact!.sourceName}; no independent figure recorded.
          </p>
        )}
      </Section>

      <Section index="02" title="Record by graduating year">
        {years.length === 0 ? (
          <Empty>Not available. No placement figures recorded.</Empty>
        ) : (
          <>
            <div className="grid gap-x-12 gap-y-8 lg:grid-cols-2">
              <div>
                <h3 className="text-[12px] text-muted">Placement rate</h3>
                <TrendLine
                  points={years.map((y) => {
                    const f = pick(facts, "placement.rate", y);
                    return { label: y, value: f?.valueNum ?? null, status: f?.status };
                  })}
                  unit="percent"
                  height={170}
                />
              </div>
              <div>
                <h3 className="text-[12px] text-muted">Eligible and placed</h3>
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
                  height={170}
                />
              </div>
            </div>
            <ul className="mt-8 border-t border-line-strong sm:hidden">
              {newestFirst.map((y) => (
                <li key={y} className="border-b border-line py-2.5 text-[13.5px]">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="font-mono text-[12.5px] text-ink">{y}</span>
                    <span className="tnum text-ink">
                      <span className="mr-1.5 text-[12px] text-muted">Rate</span>
                      <Num fact={pick(facts, "placement.rate", y)} />
                    </span>
                  </div>
                  <div className="tnum mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted">
                    <span>Placed <Num fact={pick(facts, "placement.placed", y)} /> of <Num fact={pick(facts, "placement.eligible", y)} /></span>
                    <span>Median <Num fact={pick(facts, "placement.median", y)} /></span>
                    <span>Avg <Num fact={pick(facts, "placement.average", y)} /></span>
                    <span>High <Num fact={pick(facts, "placement.highest", y)} /></span>
                  </div>
                </li>
              ))}
            </ul>
            <div className="mt-8 hidden overflow-x-auto sm:block">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Year</Th>
                    <Th num>Eligible</Th>
                    <Th num>Placed</Th>
                    <Th num>Rate</Th>
                    <Th num>Highest</Th>
                    <Th num>Average</Th>
                    <Th num>Median</Th>
                  </tr>
                </thead>
                <tbody>
                  {newestFirst.map((y) => (
                    <tr key={y}>
                      <Td className="font-mono text-[12.5px]">{y}</Td>
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
          </>
        )}
      </Section>

      <Section index="03" title="Employers" aside={recYear ? `Recruiter records, ${recYear}` : undefined}>
        {recruiters.length === 0 ? (
          <Empty>Not available. No recruiter records in the sources checked.</Empty>
        ) : (
          <>
            <StatRow>
              <Stat label={`Recruiters, ${recYear}`} size="sm">
                {count(current)}
              </Stat>
              <Stat label="Repeat" size="sm" sub={`${recYear! - 1} and ${recYear}`}>
                {count(repeat)}
              </Stat>
              <Stat label="New" size="sm" sub={`${recYear} only`}>
                {count(fresh)}
              </Stat>
              <Stat label="Recruiters visited, reported" size="sm">
                <Num fact={latest(facts, "placement.recruiters")} />
              </Stat>
              <Stat label="International placements" size="sm">
                <Num fact={latest(facts, "placement.international")} />
              </Stat>
            </StatRow>

            <div className="mt-8">
              <h3 className="mb-2 text-[12px] text-muted">Sector split, {recYear}</h3>
              {sectorItems.length ? <SectorSplit items={sectorItems} /> : <Empty>Not available</Empty>}
            </div>

            <div className="mt-8 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Recruiter</Th>
                    <Th className="hidden sm:table-cell">Sector</Th>
                    <Th className="hidden sm:table-cell">Years on campus</Th>
                    <Th>Status</Th>
                    <Th className="hidden sm:table-cell">Source</Th>
                  </tr>
                </thead>
                <tbody>
                  {top.map((r) => (
                    <tr key={r.id} data-evidence={r.status}>
                      <Td>
                        {r.name}
                        <div className="mt-0.5 text-[12px] text-muted sm:hidden">
                          {r.sector} · <span className="font-mono">{yearSpan(r.years)}</span>
                        </div>
                      </Td>
                      <Td className="hidden text-muted sm:table-cell">{r.sector}</Td>
                      <Td className="hidden sm:table-cell whitespace-nowrap font-mono text-[12px] text-muted">
                        {yearSpan(r.years)}
                      </Td>
                      <Td>
                        <StatusBadge status={r.status} />
                      </Td>
                      <Td className="hidden text-[12px] text-muted sm:table-cell">
                        {SOURCE_LABEL[r.sourceType]} · {r.sourceName}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <p className="border-t border-line pt-4 text-[12px] text-faint">
        <span className="tnum">
          {cov.verified} of {cov.expected}
        </span>{" "}
        expected placement metrics verified
        {cov.present > cov.verified ? `; ${cov.present - cov.verified} more reported but unverified` : ""}.
      </p>
    </div>
  );
}
