import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { cagr, latest, periods, pick, series } from "@/lib/facts";
import type { FactT } from "@/lib/types";
import { Card, Empty, Label, PageHeader, Td, Th } from "@/components/ui";
import { CoverageMeter, Derived, Num } from "@/components/evidence/Evidence";
import { SeatMap } from "@/components/charts/SeatMap";
import { WhatIf } from "@/components/WhatIf";

const defined = (xs: (FactT | undefined)[]) => xs.filter((f): f is FactT => f !== undefined);

function Stat({ label, period, children }: { label: string; period?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <Label>{label}</Label>
      <div className="mt-1 text-lg font-semibold tnum">{children}</div>
      {period ? <div className="text-xs text-muted">{period}</div> : null}
    </div>
  );
}

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

  const simple: { label: string; key: string }[] = [
    { label: "Collection efficiency", key: "fee.collectionEfficiency" },
    { label: "Outstanding fees", key: "fee.outstanding" },
    { label: "Scholarship share", key: "scholarship.rate" },
    { label: "Discount share", key: "discount.rate" },
    { label: "Refunds", key: "refunds.total" },
  ];

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

  return (
    <div className="space-y-6">
      <PageHeader title="Commercial" subtitle="Revenue potential and partnership opportunity">
        <CoverageMeter facts={facts} module="commercial" label="Commercial evidence coverage" />
      </PageHeader>

      <Card title="Revenue potential">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Total students" period={students?.period}>
            <Num fact={students} />
          </Stat>
          <Stat label="New admissions" period={admissions?.period}>
            <Num fact={admissions} />
          </Stat>
          <Stat label="Average fee" period={avgFee?.period}>
            <Num fact={avgFee} />
          </Stat>
          {simple.map((s) => {
            const f = latest(facts, s.key);
            return (
              <Stat key={s.key} label={s.label} period={f?.period}>
                <Num fact={f} />
              </Stat>
            );
          })}
          <Stat label="Revenue per student" period={revenue?.period}>
            <Derived value={revPerStudent} unit="inr" basis={defined([revenue, revStudents])} />
          </Stat>
          <Stat
            label="Admission CAGR"
            period={admCagr !== null && first && last ? `${first.period} to ${last.period}` : undefined}
          >
            <Derived value={admCagr} unit="percent" basis={admCagr !== null ? defined([first?.fact, last?.fact]) : []} />
          </Stat>
        </div>
      </Card>

      <Card title={feeYear ? `Course-wise annual fee, ${feeYear}` : "Course-wise annual fee"}>
        {programmes.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Programme</Th>
                  <Th>Level</Th>
                  <Th>Annual fee</Th>
                </tr>
              </thead>
              <tbody>
                {programmes.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <Td>{p.name}</Td>
                    <Td>{p.level}</Td>
                    <Td num>
                      <Num fact={feeYear ? pick(facts, "fee.annual", feeYear, p.id) : undefined} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Not available — no programmes recorded</Empty>
        )}
      </Card>

      <Card title="Partnership opportunity">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <Th>Measure</Th>
                <Th>Value</Th>
                <Th>Basis</Th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-line">
                <Td>Addressable Students</Td>
                <Td num>
                  <Num fact={students} />
                </Td>
                <Td>Total students{students ? `, ${students.period}` : ""}</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Annual New Admissions</Td>
                <Td num>
                  <Num fact={admissions} />
                </Td>
                <Td>Admissions{admissions ? `, ${admissions.period}` : ""}</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Average Fee</Td>
                <Td num>
                  <Num fact={avgFee} />
                </Td>
                <Td>Average annual fee{avgFee ? `, ${avgFee.period}` : ""}</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Potential Gross Revenue</Td>
                <Td num>
                  <Derived value={potential} unit="inr" basis={defined([admissions, avgFee])} />
                </Td>
                <Td>Annual new admissions × average fee</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Current Occupancy</Td>
                <Td num>
                  <Derived value={occupancy} unit="percent" basis={defined([students, capacity])} />
                </Td>
                <Td>Total students ÷ sanctioned capacity</Td>
              </tr>
              <tr className="border-t border-line">
                <Td>Capacity Available</Td>
                <Td num>
                  <Derived value={available} unit="count" basis={defined([capacity, students])} />
                </Td>
                <Td>Sanctioned capacity − total students</Td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={seatYear ? `Seat headroom by programme, ${seatYear}` : "Seat headroom by programme"}>
        {seatRows.length ? (
          <SeatMap rows={seatRows} />
        ) : (
          <Empty>Not available — programme-wise intake and admissions are missing</Empty>
        )}
      </Card>

      <WhatIf
        intake={wiIntake?.valueNum ?? null}
        currentAdmissions={wiAdm?.valueNum ?? null}
        averageFee={avgFee?.valueNum ?? null}
      />

      <Card title="Opportunity assessment">
        <Label>Manual assessment against defined business criteria</Label>
        <div className="mt-1 text-lg font-semibold">
          {inst.opportunity ?? <span className="font-normal text-muted">Not available</span>}
        </div>
        <p className="mt-1 text-sm text-muted">{inst.opportunityNote ?? "No assessment note recorded."}</p>
        <p className="mt-3 text-xs text-muted">
          Entered by the diligence team. It is not computed from the figures on this page.
        </p>
      </Card>
    </div>
  );
}
