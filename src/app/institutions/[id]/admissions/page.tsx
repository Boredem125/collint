import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { all, cagr, coverage, periods, pick, trend, utilisation, variance, weakestStatus } from "@/lib/facts";
import type { FactT } from "@/lib/types";
import { Num, Derived, ClaimVsVerified } from "@/components/evidence/Evidence";
import { Kicker, Section, Stat, StatRow, Empty, Th, Td } from "@/components/ui";
import { TrendLine } from "@/components/charts/TrendLine";

const independent = (f: FactT) =>
  f.sourceType !== "INSTITUTION" && f.sourceType !== "INTERNAL" && f.status !== "UNAVAILABLE" && f.valueNum !== null;

export default async function AdmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts, programmes } = profile;

  const years = [...new Set([...periods(facts, "intake.approved"), ...periods(facts, "admissions.total")])].sort();
  const rows = years.map((period) => {
    const recorded = all(facts, "admissions.total", period);
    return {
      period,
      intake: pick(facts, "intake.approved", period),
      adm: pick(facts, "admissions.total", period),
      claim: recorded.find((f) => f.sourceType === "INSTITUTION" && f.valueNum !== null),
      indep: recorded.find(independent),
      v: variance(facts, "admissions.total", period),
      util: utilisation(facts, period),
    };
  });

  const utils = rows.filter((r) => r.util);
  const uFirst = utils[0];
  const uLast = utils.at(-1);
  const uDir = trend(utils.map((r) => r.util!.value));
  const avgUtil = utils.length ? utils.reduce((s, r) => s + r.util!.value, 0) / utils.length : null;
  const avgBasis = utils.flatMap((r) => r.util!.basis);

  const withAdm = rows.filter((r) => r.adm?.valueNum != null);
  const first = withAdm[0];
  const last = withAdm.at(-1);
  const spans = first && last && first !== last;
  const growth = spans ? cagr(first.adm!.valueNum!, last.adm!.valueNum!, withAdm.length - 1) : null;
  const growthBasis = spans ? [first.adm!, last.adm!] : [];

  const compared = [...rows].reverse().filter((r) => r.v);
  const claimOnly = rows.filter((r) => r.claim && !r.indep).map((r) => r.period);
  const latestCompared = compared[0];
  const latestRow = rows.at(-1);

  // Verdict, computed from the evidence held.
  const utilClause: ReactNode = !uLast ? (
    <>Seat utilisation cannot be computed from the evidence held.</>
  ) : uFirst !== uLast && uDir !== "flat" ? (
    <>
      Seat utilisation {uDir === "down" ? "fell" : "rose"} from{" "}
      <Derived value={uFirst.util!.value} unit="percent" basis={uFirst.util!.basis} /> to{" "}
      <Derived value={uLast.util!.value} unit="percent" basis={uLast.util!.basis} /> over {utils.length - 1} years.
    </>
  ) : (
    <>
      Seat utilisation holds near <Derived value={uLast.util!.value} unit="percent" basis={uLast.util!.basis} />.
    </>
  );
  const v = latestCompared?.v;
  const claimClause: ReactNode =
    latestRow && claimOnly.includes(latestRow.period) ? (
      <>
        {latestRow.period} rests on the college&apos;s own claim, with no university count yet
        {v && v.pct > 5 ? (
          <>
            ; in {latestCompared.period} the claim exceeded it by{" "}
            <Derived value={v.pct} unit="percent" basis={[v.claimed, v.verified]} />
          </>
        ) : null}
        .
      </>
    ) : v && Math.abs(v.pct) > 5 ? (
      <>
        The college&apos;s {latestCompared.period} claim exceeds the university count by{" "}
        <Derived value={Math.abs(v.pct)} unit="percent" basis={[v.claimed, v.verified]} />.
      </>
    ) : v ? (
      <>College claims match the university count in {latestCompared.period}.</>
    ) : (
      <>No year has both a college claim and an independent count to compare.</>
    );

  const windowStart = years[0] ? parseInt(years[0].slice(0, 4), 10) : null;
  const added = programmes.filter((p) => p.startedYear !== null && windowStart !== null && p.startedYear >= windowStart);
  const discontinued = programmes.filter((p) => p.discontinuedYear !== null);
  const latestYear = years.at(-1);
  const courseRows = latestYear
    ? programmes
        .map((p) => ({
          p,
          intake: pick(facts, "intake.approved", latestYear, p.id),
          adm: pick(facts, "admissions.total", latestYear, p.id),
          util: utilisation(facts, latestYear, p.id),
        }))
        .filter((r) => r.intake || r.adm)
    : [];

  const cov = coverage(facts, "admissions");

  return (
    <div className="space-y-14">
      <header>
        <Kicker>Admissions{years.length ? ` · ${years[0]} to ${years.at(-1)}` : ""}</Kicker>
        <h2 className="display mt-3 max-w-3xl text-[21px] leading-[1.3] text-ink sm:text-[30px] sm:leading-[1.25]">
          {utilClause} <span className="text-muted">{claimClause}</span>
        </h2>

        <StatRow className="mt-10">
          <Stat label="Utilisation" size="lg" sub={uLast?.period}>
            <Derived value={uLast?.util?.value} unit="percent" basis={uLast?.util?.basis ?? []} />
          </Stat>
          <Stat label={`${utils.length}-year average`}>
            <Derived value={avgUtil} unit="percent" basis={avgBasis} />
          </Stat>
          <Stat label="Admissions CAGR" sub={spans ? `${first.period} to ${last.period}` : undefined}>
            <Derived value={growth} unit="percent" basis={growthBasis} />
          </Stat>
          <Stat label="Admissions" sub={last?.period}>
            <Num fact={last?.adm} />
          </Stat>
          <Stat label="Approved intake" sub={latestRow?.period}>
            <Num fact={latestRow?.intake} />
          </Stat>
        </StatRow>
      </header>

      <Section
        index="01"
        title="Claimed against verified"
        aside={`College figure vs university portal, ${compared.length} ${compared.length === 1 ? "year" : "years"}`}
      >
        {compared.length === 0 ? (
          <Empty>No year has both a college claim and an independent count.</Empty>
        ) : (
          <div className="grid gap-x-12 gap-y-7 md:grid-cols-2">
            {compared.map((r) => (
              <ClaimVsVerified key={r.period} variance={r.v} label={r.period} unit="count" />
            ))}
          </div>
        )}
        {claimOnly.length > 0 && (
          <p className="mt-6 border-l-2 border-selfreported pl-3 text-[13px] text-ink">
            College claim only, no independent count: <span className="font-mono">{claimOnly.join(", ")}</span>
          </p>
        )}
      </Section>

      <Section index="02" title="Year by year" aside="Headline is the highest-precedence source">
        {rows.length === 0 ? (
          <Empty>Not available. No intake or admission figures recorded.</Empty>
        ) : (
          <>
            <TrendLine
              points={rows.map((r) => ({
                label: r.period,
                value: r.util?.value ?? null,
                status: r.util ? weakestStatus(r.util.basis) : undefined,
              }))}
              unit="percent"
              height={170}
            />
            <div className="mt-6 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <Th>Year</Th>
                    <Th num className="hidden sm:table-cell">Approved intake</Th>
                    <Th num className="hidden sm:table-cell">College claim</Th>
                    <Th num>Independent count</Th>
                    <Th num>Gap</Th>
                    <Th num>Utilisation</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.period}>
                      <Td className="font-mono text-[12.5px]">{r.period}</Td>
                      <Td num className="hidden sm:table-cell">
                        <Num fact={r.intake} />
                      </Td>
                      <Td num className="hidden sm:table-cell text-muted">
                        <Num fact={r.claim} />
                      </Td>
                      <Td num>
                        <Num fact={r.indep} />
                      </Td>
                      <Td num>
                        {r.v ? (
                          <span className={Math.abs(r.v.pct) > 5 ? "text-critical" : "text-muted"}>
                            <Derived value={r.v.pct} unit="percent" basis={[r.v.claimed, r.v.verified]} />
                          </span>
                        ) : (
                          <span className="text-faint">Not available</span>
                        )}
                      </Td>
                      <Td num>
                        <Derived value={r.util?.value} unit="percent" basis={r.util?.basis ?? []} />
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Section>

      <Section index="03" title={latestYear ? `By programme, ${latestYear}` : "By programme"}>
        {courseRows.length === 0 ? (
          <Empty>Not available. No programme-level figures for the latest year.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Programme</Th>
                  <Th className="hidden sm:table-cell">Level</Th>
                  <Th num className="hidden sm:table-cell">Intake</Th>
                  <Th num>Admissions</Th>
                  <Th num>Utilisation</Th>
                </tr>
              </thead>
              <tbody>
                {courseRows.map((r) => (
                  <tr key={r.p.id}>
                    <Td>{r.p.name}</Td>
                    <Td className="hidden sm:table-cell text-muted">{r.p.level}</Td>
                    <Td num className="hidden sm:table-cell">
                      <Num fact={r.intake} />
                    </Td>
                    <Td num>
                      <Num fact={r.adm} />
                    </Td>
                    <Td num>
                      <Derived value={r.util?.value} unit="percent" basis={r.util?.basis ?? []} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section index="04" title="Programme changes">
        <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
          {[
            { title: "Added", list: added, when: (y: number | null) => `Started ${y}`, key: "startedYear" as const },
            {
              title: "Discontinued",
              list: discontinued,
              when: (y: number | null) => `Ended ${y}`,
              key: "discontinuedYear" as const,
            },
          ].map((g) => (
            <div key={g.title}>
              <h3 className="text-[12px] text-muted">{g.title}</h3>
              {g.list.length === 0 ? (
                <p className="mt-2 border-b border-line pb-2 text-[13px] text-faint">None recorded</p>
              ) : (
                <ul className="mt-1">
                  {g.list.map((p) => (
                    <li key={p.id} className="flex justify-between gap-3 border-b border-line py-2 text-[13.5px]">
                      <span className="text-ink">
                        {p.name} <span className="text-muted">· {p.level}</span>
                      </span>
                      <span className="font-mono text-[12px] text-muted">{g.when(p[g.key])}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </Section>

      <p className="border-t border-line pt-4 text-[12px] text-faint">
        <span className="tnum">
          {cov.verified} of {cov.expected}
        </span>{" "}
        expected admissions metrics verified
        {cov.present > cov.verified ? `; ${cov.present - cov.verified} more reported but unverified` : ""}.
      </p>
    </div>
  );
}
