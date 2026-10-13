import type { ReactNode } from "react";
import type { FactT } from "@/lib/types";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { latest, periods, pick, series } from "@/lib/facts";
import { Card, Label, PageHeader, Td, Th } from "@/components/ui";
import { CoverageMeter, Derived, Num } from "@/components/evidence/Evidence";
import { TrendLine } from "@/components/charts/TrendLine";

function Stat({ label, period, children }: { label: string; period?: string; children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <Label>{label}</Label>
      <div className="mt-1 text-lg font-semibold tnum">{children}</div>
      {period && period !== "current" ? <div className="text-xs text-muted">{period}</div> : null}
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

  const ay = (key: string) => latest(facts, key);
  const academic: { label: string; key: string }[] = [
    { label: "Average attendance", key: "attendance.avg" },
    { label: "Pass percentage", key: "pass.rate" },
    { label: "Students with backlogs", key: "backlog.rate" },
    { label: "Dropout rate", key: "dropout.rate" },
    { label: "Graduation rate", key: "graduation.rate" },
    { label: "Progression to higher study", key: "progression.rate" },
  ];

  const years = [
    ...new Set(["faculty.total", "pass.rate", "dropout.rate"].flatMap((k) => periods(facts, k))),
  ]
    .sort()
    .slice(-5);

  const passSeries = series(facts, "pass.rate").slice(-5);

  const infra: { label: string; key: string }[] = [
    { label: "Land", key: "land.acres" },
    { label: "Built-up area", key: "builtup.sqft" },
    { label: "Classrooms", key: "classrooms.count" },
    { label: "Laboratories", key: "labs.count" },
    { label: "Library volumes", key: "library.books" },
    { label: "Buses", key: "transport.buses" },
    { label: "Sports facilities", key: "sports.facilities" },
  ];

  const hostelCap = pick(facts, "hostel.capacity");
  const hostelOcc = pick(facts, "hostel.occupancy");
  const hostelPct =
    hostelCap?.valueNum && hostelOcc?.valueNum != null ? (hostelOcc.valueNum / hostelCap.valueNum) * 100 : null;

  const capacity = pick(facts, "capacity.total");
  const latestStudents = latest(facts, "students.total");
  const campusUtil =
    capacity?.valueNum && latestStudents?.valueNum != null ? (latestStudents.valueNum / capacity.valueNum) * 100 : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Campus Health Dashboard" subtitle="Academic performance and physical infrastructure">
        <CoverageMeter facts={facts} module="campus" label="Campus evidence coverage" />
      </PageHeader>

      <Card title="Academic health">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-5">
          <Stat label="Student strength" period={latestStudents?.period}>
            <Num fact={latestStudents} />
          </Stat>
          <Stat label="Faculty strength" period={faculty?.period}>
            <Num fact={faculty} />
          </Stat>
          <Stat label="Faculty : student ratio" period={faculty?.period}>
            <Derived value={ratio} unit="ratio" basis={[students, faculty].filter((f): f is FactT => f !== undefined)} />
          </Stat>
          {academic.map((a) => {
            const f = ay(a.key);
            return (
              <Stat key={a.key} label={a.label} period={f?.period}>
                <Num fact={f} />
              </Stat>
            );
          })}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Five-year academic record">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Academic year</Th>
                  <Th>Faculty</Th>
                  <Th>Pass rate</Th>
                  <Th>Dropout rate</Th>
                </tr>
              </thead>
              <tbody>
                {years.length ? (
                  years.map((y) => (
                    <tr key={y} className="border-t border-line">
                      <Td>{y}</Td>
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
                  <tr className="border-t border-line">
                    <Td>
                      <span className="text-muted">Not available</span>
                    </Td>
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
        </Card>

        <Card title="Pass rate trend">
          {passSeries.some((p) => p.value !== null) ? (
            <TrendLine
              unit="percent"
              points={passSeries.map((p) => ({ label: p.period, value: p.value, status: p.fact?.status }))}
            />
          ) : (
            <p className="text-sm text-muted">Not available</p>
          )}
        </Card>
      </div>

      <Card title="Infrastructure">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {infra.map((i) => (
            <Stat key={i.key} label={i.label}>
              <Num fact={pick(facts, i.key)} />
            </Stat>
          ))}
        </div>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Hostel capacity vs occupancy">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Capacity">
              <Num fact={hostelCap} />
            </Stat>
            <Stat label="Occupied">
              <Num fact={hostelOcc} />
            </Stat>
            <Stat label="Occupancy share">
              <Derived
                value={hostelPct}
                unit="percent"
                basis={[hostelOcc, hostelCap].filter((f): f is FactT => f !== undefined)}
              />
            </Stat>
          </div>
          {hostelPct !== null ? (
            <div className="mt-4">
              <div
                className="h-3 w-full overflow-hidden rounded-full bg-canvas ring-1 ring-line"
                role="img"
                aria-label="Hostel beds occupied as a share of capacity"
              >
                <div className="h-full bg-brand" style={{ width: `${Math.min(100, Math.max(0, hostelPct))}%` }} />
              </div>
              <div className="mt-1 flex justify-between text-xs text-muted">
                <span>Occupied</span>
                <span>Capacity</span>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-muted">Occupancy bar not available: capacity or occupancy is missing.</p>
          )}
        </Card>

        <Card title="Campus utilisation">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Students" period={latestStudents?.period}>
              <Num fact={latestStudents} />
            </Stat>
            <Stat label="Sanctioned capacity">
              <Num fact={capacity} />
            </Stat>
            <Stat label="Utilisation">
              <Derived
                value={campusUtil}
                unit="percent"
                basis={[latestStudents, capacity].filter((f): f is FactT => f !== undefined)}
              />
            </Stat>
          </div>
          <p className="mt-3 text-xs text-muted">Utilisation = total students ÷ total sanctioned capacity.</p>
        </Card>
      </div>
    </div>
  );
}
