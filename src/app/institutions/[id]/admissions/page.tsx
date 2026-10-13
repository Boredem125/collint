import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { cagr, fmtNum, periods, pick, utilisation, variance, weakestStatus } from "@/lib/facts";
import type { FactT } from "@/lib/types";
import { Num, Derived, ClaimVsVerified, CoverageMeter } from "@/components/evidence/Evidence";
import { Card, Label, Empty, Th, Td } from "@/components/ui";
import { TrendLine } from "@/components/charts/TrendLine";

export default async function AdmissionsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts, programmes } = profile;

  const years = [...new Set([...periods(facts, "intake.approved"), ...periods(facts, "admissions.total")])].sort();
  const rows = years.map((period) => ({
    period,
    intake: pick(facts, "intake.approved", period),
    adm: pick(facts, "admissions.total", period),
    util: utilisation(facts, period),
  }));

  const utils = rows.filter((r) => r.util);
  const avgUtil = utils.length ? utils.reduce((s, r) => s + r.util!.value, 0) / utils.length : null;
  const avgBasis = utils.flatMap((r) => r.util!.basis);
  const trendString = utils.map((r) => fmtNum(r.util!.value, "percent")).join(" → ");

  const withAdm = rows.filter((r) => r.adm?.valueNum != null);
  const first = withAdm[0];
  const last = withAdm.at(-1);
  const growth =
    first && last && first !== last ? cagr(first.adm!.valueNum!, last.adm!.valueNum!, withAdm.length - 1) : null;
  const growthBasis = first && last && first !== last ? [first.adm!, last.adm!] : [];

  const variances = [...years]
    .reverse()
    .map((period) => ({ period, v: variance(facts, "admissions.total", period) }))
    .filter((x) => x.v !== null);

  const latestYear = years.at(-1);
  const windowStart = years[0] ? parseInt(years[0].slice(0, 4), 10) : null;
  const added = programmes.filter((p) => p.startedYear !== null && windowStart !== null && p.startedYear >= windowStart);
  const discontinued = programmes.filter((p) => p.discontinuedYear !== null);
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

  return (
    <div className="space-y-5">
      <Card title="Approved intake and admissions, by academic year">
        {rows.length === 0 ? (
          <Empty>Not available. No intake or admission facts recorded.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Academic Year</Th>
                  <Th>Approved Intake</Th>
                  <Th>Admissions</Th>
                  <Th>Utilisation</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.period} className="border-t border-line">
                    <Td>{r.period}</Td>
                    <Td num>
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
        <p className="mt-3 text-xs text-muted">
          Admissions shows the headline figure: the highest-precedence source available (university portal, then
          government, regulator, public record, internal diligence, institution).
        </p>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Utilisation trend" className="lg:col-span-2">
          <TrendLine
            points={rows.map((r) => ({
              label: r.period,
              value: r.util?.value ?? null,
              status: r.util ? weakestStatus(r.util.basis) : undefined,
            }))}
            unit="percent"
          />
          <p className="mt-2 text-sm text-ink tnum">{trendString || <span className="text-muted">Not available</span>}</p>
        </Card>
        <Card title="Summary">
          <Label>5-year average utilisation</Label>
          <div className="mt-1 text-xl font-semibold tnum">
            <Derived value={avgUtil} unit="percent" basis={avgBasis} />
          </div>
          <div className="mt-4">
            <Label>Admissions growth / decline (CAGR)</Label>
            <div className="mt-1 text-xl font-semibold tnum">
              <Derived value={growth} unit="percent" basis={growthBasis} />
            </div>
            {first && last && first !== last && (
              <p className="mt-0.5 text-xs text-muted">
                {first.period} to {last.period}
                {growth !== null && (growth < 0 ? " · declining" : growth > 0 ? " · growing" : " · flat")}
              </p>
            )}
          </div>
        </Card>
      </div>

      <Card title="Claim vs University-Verified">
        {variances.length === 0 ? (
          <Empty>
            No competing sources. A comparison needs both an institution claim and an independent figure for the same
            year.
          </Empty>
        ) : (
          <div className="space-y-5">
            {variances.map((x) => (
              <ClaimVsVerified key={x.period} variance={x.v} label={`Admissions ${x.period}`} unit="count" />
            ))}
          </div>
        )}
      </Card>

      <Card title={latestYear ? `Course-wise, ${latestYear}` : "Course-wise"}>
        {courseRows.length === 0 ? (
          <Empty>Not available. No programme-level facts recorded for the latest year.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Programme</Th>
                  <Th>Level</Th>
                  <Th>Intake</Th>
                  <Th>Admissions</Th>
                  <Th>Utilisation</Th>
                </tr>
              </thead>
              <tbody>
                {courseRows.map((r) => (
                  <tr key={r.p.id} className="border-t border-line">
                    <Td>{r.p.name}</Td>
                    <Td>{r.p.level}</Td>
                    <Td num>
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
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        <Card title="New courses added">
          {added.length === 0 ? (
            <Empty>None recorded in the period covered.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {added.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {p.name} <span className="text-muted">· {p.level}</span>
                  </span>
                  <span className="text-muted">Started {p.startedYear}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Discontinued courses">
          {discontinued.length === 0 ? (
            <Empty>None recorded.</Empty>
          ) : (
            <ul className="divide-y divide-line text-sm">
              {discontinued.map((p) => (
                <li key={p.id} className="flex justify-between gap-3 py-1.5">
                  <span>
                    {p.name} <span className="text-muted">· {p.level}</span>
                  </span>
                  <span className="text-muted">Discontinued {p.discontinuedYear}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <Card title="How to read this page">
        <p className="text-sm text-muted">
          <span className="font-medium text-verified">Officially verified</span> figures come from the university
          portal, government data or a regulator.{" "}
          <span className="font-medium text-selfreported">College-submitted</span> figures are the institution&apos;s
          own claim and stay marked self-reported until an independent source confirms them. Where both exist the
          independent figure is the headline and the gap is shown above. Hover the dot beside any number for its source,
          date and status.
        </p>
        <div className="mt-4">
          <CoverageMeter facts={facts} module="admissions" label="Admissions evidence coverage" />
        </div>
      </Card>
    </div>
  );
}
