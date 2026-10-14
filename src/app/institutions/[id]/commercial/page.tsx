import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { THRESHOLDS } from "@/lib/risk";
import { cagr, coverage, latest, periods, pick, series } from "@/lib/facts";
import type { FactT } from "@/lib/types";
import { Empty, Kicker, Section, Stat, StatRow, Td, Th } from "@/components/ui";
import { Derived, Num } from "@/components/evidence/Evidence";
import { SeatMap } from "@/components/charts/SeatMap";
import { WhatIf } from "@/components/WhatIf";

const defined = (xs: (FactT | undefined)[]) => xs.filter((f): f is FactT => f !== undefined);

const SECONDARY: { label: string; key: string }[] = [
  { label: "Collection efficiency", key: "fee.collectionEfficiency" },
  { label: "Outstanding fees", key: "fee.outstanding" },
  { label: "Scholarship share", key: "scholarship.rate" },
  { label: "Discount share", key: "discount.rate" },
  { label: "Refunds", key: "refunds.total" },
];

const LEVEL: Record<string, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low" };

export default async function CommercialPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts, programmes, inst } = profile;

  const students = latest(facts, "students.total");
  const admissions = latest(facts, "admissions.total");
  const avgFee = latest(facts, "fee.average");
  const capacity = pick(facts, "capacity.total");

  const revenue = latest(facts, "revenue.total");
  const revStudents = (revenue && pick(facts, "students.total", revenue.period)) ?? undefined;
  const revPerStudent =
    revenue?.valueNum != null && revStudents?.valueNum ? revenue.valueNum / revStudents.valueNum : null;

  const admSeries = series(facts, "admissions.total")
    .slice(-5)
    .filter((p) => p.fact && p.value !== null);
  const first = admSeries[0];
  const last = admSeries[admSeries.length - 1];
  const admCagr =
    first && last && first !== last
      ? cagr(first.value!, last.value!, Number(last.period.slice(0, 4)) - Number(first.period.slice(0, 4)))
      : null;

  const feeYear = programmes
    .flatMap((p) => periods(facts, "fee.annual", p.id))
    .sort()
    .at(-1);

  const potential =
    admissions?.valueNum != null && avgFee?.valueNum != null ? admissions.valueNum * avgFee.valueNum : null;
  const occupancy =
    students?.valueNum != null && capacity?.valueNum ? (students.valueNum / capacity.valueNum) * 100 : null;
  const available =
    students?.valueNum != null && capacity?.valueNum != null ? capacity.valueNum - students.valueNum : null;

  const seatYear = programmes
    .flatMap((p) => periods(facts, "intake.approved", p.id))
    .sort()
    .at(-1);
  const seatRows = seatYear
    ? programmes.flatMap((p) => {
        const cap = pick(facts, "intake.approved", seatYear, p.id)?.valueNum;
        const filled = pick(facts, "admissions.total", seatYear, p.id)?.valueNum;
        return cap && filled != null ? [{ label: p.name, capacity: cap, filled }] : [];
      })
    : [];

  // What-if runs on institution-level intake and admissions for the same year.
  const intakeYear = periods(facts, "intake.approved").at(-1);
  const wiIntake = intakeYear ? pick(facts, "intake.approved", intakeYear) : undefined;
  const wiAdm = intakeYear ? pick(facts, "admissions.total", intakeYear) : undefined;

  const collection = latest(facts, "fee.collectionEfficiency");
  const cov = coverage(facts, "commercial");

  const clauses: ReactNode[] = [];
  if (revenue)
    clauses.push(
      <>
        Fee revenue of <Num fact={revenue} /> in {revenue.period}
      </>,
    );
  if (available !== null && available > 0)
    clauses.push(
      <>
        {clauses.length ? "with" : "There are"}{" "}
        <Derived value={available} unit="count" basis={defined([capacity, students])} /> sanctioned seats unfilled
      </>,
    );
  else if (occupancy !== null)
    clauses.push(
      <>
        {clauses.length ? "with" : "With"} sanctioned capacity{" "}
        <Derived value={occupancy} unit="percent" basis={defined([students, capacity])} /> used
      </>,
    );
  if (collection?.valueNum != null && collection.valueNum < THRESHOLDS.collectionEfficiencyMin)
    clauses.push(
      <>
        {clauses.length ? "but only" : "Only"} <Num fact={collection} /> of billed fees collected
      </>,
    );

  return (
    <div className="space-y-14">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Kicker>Commercial</Kicker>
          <span className="tnum text-[12px] text-muted">
            {cov.verified} of {cov.expected} commercial metrics verified
          </span>
        </div>
        <p className="display mt-3 max-w-3xl text-[21px] leading-[1.3] text-ink sm:text-[30px] sm:leading-[1.25]">
          {clauses.length ? (
            <>
              {clauses.map((c, i) => (
                <span key={i}>
                  {i > 0 ? ", " : null}
                  {c}
                </span>
              ))}
              .
            </>
          ) : (
            "Commercial figures are not available from the sources checked."
          )}
        </p>
      </header>

      <Section index="01" title="Revenue base">
        <StatRow>
          <Stat label="Students" size="lg" sub={students?.period}>
            <Num fact={students} />
          </Stat>
          <Stat label="New admissions" size="lg" sub={admissions?.period}>
            <Num fact={admissions} />
          </Stat>
          <Stat label="Average fee" size="lg" sub={avgFee?.period}>
            <Num fact={avgFee} />
          </Stat>
        </StatRow>
        <StatRow className="mt-8 border-t border-line pt-6">
          <Stat label="Revenue per student" size="sm" sub={revenue?.period}>
            <Derived value={revPerStudent} unit="inr" basis={defined([revenue, revStudents])} />
          </Stat>
          <Stat
            label="Admissions CAGR"
            size="sm"
            sub={admCagr !== null && first && last ? `${first.period} to ${last.period}` : undefined}
          >
            <Derived value={admCagr} unit="percent" basis={admCagr !== null ? defined([first?.fact, last?.fact]) : []} />
          </Stat>
          {SECONDARY.map((s) => {
            const f = latest(facts, s.key);
            return (
              <Stat key={s.key} label={s.label} size="sm" sub={f?.period}>
                <Num fact={f} />
              </Stat>
            );
          })}
        </StatRow>
      </Section>

      <Section index="02" title="Partnership opportunity">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Measure</Th>
                <Th num>Value</Th>
                <Th className="hidden sm:table-cell">Basis</Th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <Td>Addressable students</Td>
                <Td num>
                  <Num fact={students} />
                </Td>
                <Td className="hidden text-muted sm:table-cell">Total students{students ? `, ${students.period}` : ""}</Td>
              </tr>
              <tr>
                <Td>Annual new admissions</Td>
                <Td num>
                  <Num fact={admissions} />
                </Td>
                <Td className="hidden text-muted sm:table-cell">Admissions{admissions ? `, ${admissions.period}` : ""}</Td>
              </tr>
              <tr>
                <Td>Average fee</Td>
                <Td num>
                  <Num fact={avgFee} />
                </Td>
                <Td className="hidden text-muted sm:table-cell">Average annual fee{avgFee ? `, ${avgFee.period}` : ""}</Td>
              </tr>
              <tr>
                <Td className="font-medium">Potential gross revenue</Td>
                <Td num className="font-medium">
                  <Derived value={potential} unit="inr" basis={defined([admissions, avgFee])} />
                </Td>
                <Td className="hidden font-mono text-[12px] text-muted sm:table-cell">admissions × average fee</Td>
              </tr>
              <tr>
                <Td>Current occupancy</Td>
                <Td num>
                  <Derived value={occupancy} unit="percent" basis={defined([students, capacity])} />
                </Td>
                <Td className="hidden font-mono text-[12px] text-muted sm:table-cell">students ÷ sanctioned capacity</Td>
              </tr>
              <tr>
                <Td>Capacity available</Td>
                <Td num>
                  <Derived value={available} unit="count" basis={defined([capacity, students])} />
                </Td>
                <Td className="hidden font-mono text-[12px] text-muted sm:table-cell">sanctioned capacity − students</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Section>

      <Section index="03" title="Seat headroom by programme" aside={seatYear}>
        {seatRows.length ? (
          <SeatMap rows={seatRows} />
        ) : (
          <Empty>Not available: programme-wise intake and admissions are missing</Empty>
        )}
      </Section>

      <Section index="04" title="What if more seats filled">
        <WhatIf
          intake={wiIntake?.valueNum ?? null}
          currentAdmissions={wiAdm?.valueNum ?? null}
          averageFee={avgFee?.valueNum ?? null}
        />
      </Section>

      <Section index="05" title="Annual fee by programme" aside={feeYear}>
        {programmes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Programme</Th>
                  <Th>Level</Th>
                  <Th num>Annual fee</Th>
                </tr>
              </thead>
              <tbody>
                {programmes.map((p) => (
                  <tr key={p.id}>
                    <Td>{p.name}</Td>
                    <Td className="text-muted">{p.level}</Td>
                    <Td num>
                      <Num fact={feeYear ? pick(facts, "fee.annual", feeYear, p.id) : undefined} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Not available: no programmes recorded</Empty>
        )}
      </Section>

      <Section index="06" title="Opportunity assessment" aside="Team judgement, not computed">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-baseline">
          <div className="display text-[44px] leading-none text-ink">
            {inst.opportunity ? (
              (LEVEL[inst.opportunity] ?? inst.opportunity)
            ) : (
              <span className="text-[20px] text-muted">Not available</span>
            )}
          </div>
          <p className="max-w-xl text-[14.5px] leading-relaxed text-muted">
            {inst.opportunityNote ?? "No assessment note recorded."}
          </p>
        </div>
      </Section>
    </div>
  );
}
