import type { ReactNode } from "react";
import type { FactT } from "@/lib/types";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { coverage, latest, periods, pick, series, trend } from "@/lib/facts";
import { Empty, Kicker, Section, Stat, StatRow, Td, Th } from "@/components/ui";
import { Derived, Num } from "@/components/evidence/Evidence";
import { TrendLine } from "@/components/charts/TrendLine";

const defined = (xs: (FactT | undefined)[]) => xs.filter((f): f is FactT => f !== undefined);

const ACADEMIC: { label: string; key: string }[] = [
  { label: "Average attendance", key: "attendance.avg" },
  { label: "Pass percentage", key: "pass.rate" },
  { label: "Students with backlogs", key: "backlog.rate" },
  { label: "Dropout rate", key: "dropout.rate" },
  { label: "Graduation rate", key: "graduation.rate" },
  { label: "Progression to higher study", key: "progression.rate" },
];

const INFRA: { label: string; key: string }[] = [
  { label: "Land", key: "land.acres" },
  { label: "Built-up area", key: "builtup.sqft" },
  { label: "Classrooms", key: "classrooms.count" },
  { label: "Laboratories", key: "labs.count" },
  { label: "Library volumes", key: "library.books" },
  { label: "Buses", key: "transport.buses" },
  { label: "Sports facilities", key: "sports.facilities" },
];

function Meter({ pct }: { pct: number | null }) {
  if (pct === null) return <div className="mt-4 h-[3px] bg-sunken" aria-hidden />;
  return (
    <div className="mt-4 h-[3px] bg-sunken" aria-hidden>
      <div className="h-full bg-ink" style={{ width: `${Math.min(100, Math.max(0, pct))}%` }} />
    </div>
  );
}

function Occupancy({
  title,
  pct,
  basis,
  part,
  whole,
  partLabel,
  wholeLabel,
}: {
  title: string;
  pct: number | null;
  basis: FactT[];
  part: FactT | undefined;
  whole: FactT | undefined;
  partLabel: string;
  wholeLabel: string;
}) {
  return (
    <div>
      <Stat label={title} size="lg">
        <Derived value={pct} unit="percent" basis={basis} />
      </Stat>
      <Meter pct={pct} />
      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px]">
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">{partLabel}</dt>
          <dd className="text-ink">
            <Num fact={part} />
          </dd>
        </div>
        <div className="flex items-baseline gap-2">
          <dt className="text-muted">{wholeLabel}</dt>
          <dd className="text-ink">
            <Num fact={whole} />
          </dd>
        </div>
      </dl>
    </div>
  );
}

export default async function CampusPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts } = profile;

  const faculty = latest(facts, "faculty.total");
  // Ratio uses the student count for the same year as the faculty count where one exists.
  const students = (faculty && pick(facts, "students.total", faculty.period)) ?? latest(facts, "students.total");
  const ratio = students?.valueNum != null && faculty?.valueNum ? students.valueNum / faculty.valueNum : null;
  const ratioBasis = defined([students, faculty]);

  const years = [...new Set(["faculty.total", "pass.rate", "dropout.rate"].flatMap((k) => periods(facts, k)))]
    .sort()
    .slice(-5);
  const passSeries = series(facts, "pass.rate").slice(-5);
  const pass = latest(facts, "pass.rate");
  const passDir = trend(passSeries.map((p) => p.value));

  const hostelCap = pick(facts, "hostel.capacity");
  const hostelOcc = pick(facts, "hostel.occupancy");
  const hostelPct =
    hostelCap?.valueNum && hostelOcc?.valueNum != null ? (hostelOcc.valueNum / hostelCap.valueNum) * 100 : null;

  const capacity = pick(facts, "capacity.total");
  const latestStudents = latest(facts, "students.total");
  const campusUtil =
    capacity?.valueNum && latestStudents?.valueNum != null ? (latestStudents.valueNum / capacity.valueNum) * 100 : null;

  const academic = ACADEMIC.map((a) => ({ ...a, fact: latest(facts, a.key) }));
  const unverified = academic.filter((a) => a.fact && a.fact.status !== "VERIFIED").length;
  const cov = coverage(facts, "campus");

  const clauses: ReactNode[] = [];
  if (ratio !== null)
    clauses.push(
      <>
        One teacher for every <Derived value={ratio} unit="count" basis={ratioBasis} /> students
      </>,
    );
  if (pass)
    clauses.push(
      <>
        {clauses.length ? "a" : "A"} pass rate{" "}
        {passDir === "up" ? "rising to" : passDir === "down" ? "falling to" : passDir === "flat" ? "holding at" : "of"}{" "}
        <Num fact={pass} />
      </>,
    );
  if (hostelPct !== null)
    clauses.push(
      <>
        {clauses.length ? "hostels" : "Hostels"}{" "}
        <Derived value={hostelPct} unit="percent" basis={defined([hostelOcc, hostelCap])} /> full
      </>,
    );

  return (
    <div className="space-y-14">
      <header>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <Kicker>Campus</Kicker>
          <span className="tnum text-[12px] text-muted">
            {cov.verified} of {cov.expected} campus metrics verified
          </span>
        </div>
        <p className="display mt-3 max-w-3xl text-[26px] leading-[1.25] text-ink sm:text-[30px]">
          {clauses.length ? (
            <>
              {clauses.map((c, i) => (
                <span key={i}>
                  {i > 0 ? (i === clauses.length - 1 ? " and " : ", ") : null}
                  {c}
                </span>
              ))}
              {unverified ? (
                <span className="text-muted">

                  ;{" "}
                  {unverified === academic.filter((a) => a.fact).length
                    ? "none of the academic figures is independently verified."
                    : "some academic figures are not independently verified."}
                </span>
              ) : (
                "."
              )}
            </>
          ) : (
            "Campus performance is not available from the sources checked."
          )}
        </p>
      </header>

      <Section index="01" title="Academic health" aside={faculty ? `Latest ${faculty.period}` : undefined}>
        <StatRow>
          <Stat label="Students" size="lg" sub={latestStudents?.period}>
            <Num fact={latestStudents} />
          </Stat>
          <Stat label="Faculty" size="lg" sub={faculty?.period}>
            <Num fact={faculty} />
          </Stat>
          <Stat label="Faculty to students" size="lg" sub={faculty?.period}>
            <Derived value={ratio} unit="ratio" basis={ratioBasis} />
          </Stat>
        </StatRow>
        <StatRow className="mt-8 border-t border-line pt-6">
          {academic.map((a) => (
            <Stat key={a.key} label={a.label} size="sm" sub={a.fact?.period}>
              <Num fact={a.fact} />
            </Stat>
          ))}
        </StatRow>
      </Section>

      <Section
        index="02"
        title="Five-year record"
        aside={years.length ? `${years[0]} to ${years[years.length - 1]}` : undefined}
      >
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Year</Th>
                  <Th num>Faculty</Th>
                  <Th num>Pass rate</Th>
                  <Th num>Dropout</Th>
                </tr>
              </thead>
              <tbody>
                {years.length ? (
                  years.map((y) => (
                    <tr key={y}>
                      <Td className="font-mono text-[12.5px] text-muted">{y}</Td>
                      <Td num>
                        <Num fact={pick(facts, "faculty.total", y)} />
                      </Td>
                      <Td num>
                        <Num fact={pick(facts, "pass.rate", y)} />
                      </Td>
                      <Td num>
                        <Num fact={pick(facts, "dropout.rate", y)} />
                      </Td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <Td className="text-muted">Not available</Td>
                    <Td num>
                      <Num fact={undefined} />
                    </Td>
                    <Td num>
                      <Num fact={undefined} />
                    </Td>
                    <Td num>
                      <Num fact={undefined} />
                    </Td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div>
            <div className="mb-2 text-[12px] text-muted">Pass rate</div>
            {passSeries.some((p) => p.value !== null) ? (
              <TrendLine
                unit="percent"
                points={passSeries.map((p) => ({ label: p.period, value: p.value, status: p.fact?.status }))}
              />
            ) : (
              <Empty>Not available</Empty>
            )}
          </div>
        </div>
      </Section>

      <Section index="03" title="Occupancy">
        <div className="grid gap-12 md:grid-cols-2">
          <Occupancy
            title="Hostel beds occupied"
            pct={hostelPct}
            basis={defined([hostelOcc, hostelCap])}
            part={hostelOcc}
            whole={hostelCap}
            partLabel="Occupied"
            wholeLabel="Capacity"
          />
          <Occupancy
            title="Sanctioned capacity in use"
            pct={campusUtil}
            basis={defined([latestStudents, capacity])}
            part={latestStudents}
            whole={capacity}
            partLabel="Students"
            wholeLabel="Sanctioned"
          />
        </div>
      </Section>

      <Section index="04" title="Infrastructure">
        <dl className="grid gap-x-12 sm:grid-cols-2">
          {INFRA.map((i) => (
            <div key={i.key} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
              <dt className="text-[13.5px] text-muted">{i.label}</dt>
              <dd className="text-right text-[14px] text-ink [&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
                <Num fact={pick(facts, i.key)} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>
    </div>
  );
}
