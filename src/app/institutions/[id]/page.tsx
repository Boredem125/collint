import Link from "next/link";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { latest, periods, pick, series, trend, utilisationSeries, type TrendDir } from "@/lib/facts";
import { MODULES, NIRF_CATEGORIES, metric } from "@/lib/metrics";
import { deriveFlags } from "@/lib/risk";
import type { FactT } from "@/lib/types";
import { Num, Derived, CoverageMeter } from "@/components/evidence/Evidence";
import { Card, Label, TrendArrow, FlagCard, Empty } from "@/components/ui";
import { TrendLine } from "@/components/charts/TrendLine";

function Tile({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <Label>{label}</Label>
      <div className="mt-1 text-xl font-semibold text-ink tnum">{children}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export default async function ExecutivePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst, facts } = profile;
  const base = `/institutions/${inst.id}`;

  const capacity = pick(facts, "capacity.total");
  const students = latest(facts, "students.total");
  const admissions = latest(facts, "admissions.total");
  const admSeries = series(facts, "admissions.total");
  const utilSeries = utilisationSeries(facts);
  const utilLatest = utilSeries.filter((u) => u.derived).at(-1);
  const placementSeries = series(facts, "placement.rate");
  const placement = latest(facts, "placement.rate");
  const fee = latest(facts, "fee.average");

  // Most recent NIRF year across categories; best rank within that year.
  const nirf = NIRF_CATEGORIES.map((k) => latest(facts, k))
    .filter((f): f is FactT => !!f && f.valueNum !== null)
    .sort((a, b) => b.period.localeCompare(a.period) || a.valueNum! - b.valueNum!)[0];

  const ugc = pick(facts, "ugc.status");
  const aicte = pick(facts, "aicte.status");
  const naac = pick(facts, "naac.grade");
  const affiliation = pick(facts, "affiliation.status");

  const available =
    capacity?.valueNum != null && students?.valueNum != null ? capacity.valueNum - students.valueNum : null;
  const availableBasis = [capacity, students].filter((f): f is FactT => !!f);

  const flags = deriveFlags(profile);
  const openFlags = flags.filter((f) => f.band !== "VERIFIED");

  // Hostel occupancy as a share of capacity, per period recorded.
  const hostelShares = periods(facts, "hostel.occupancy").map((p) => {
    const occ = pick(facts, "hostel.occupancy", p)?.valueNum;
    const cap = pick(facts, "hostel.capacity", p)?.valueNum;
    return occ != null && cap ? (occ / cap) * 100 : null;
  });
  const infraDir = trend(hostelShares);

  const regulatoryVerified = [ugc, aicte, affiliation].every((f) => f?.status === "VERIFIED");

  const ceo: { label: string; href: string; dir?: TrendDir; text?: string; basis: string }[] = [
    {
      label: "Admissions",
      href: `${base}/admissions`,
      dir: trend(utilSeries.map((u) => u.derived?.value ?? null)),
      basis: "Capacity utilisation, first to latest year",
    },
    {
      label: "Placements",
      href: `${base}/placements`,
      dir: trend(placementSeries.map((p) => p.value)),
      basis: "Placement rate, first to latest year",
    },
    {
      label: "Infrastructure",
      href: `${base}/campus`,
      dir: infraDir,
      basis: "Hostel occupancy as a share of hostel capacity",
    },
    {
      label: "Regulatory",
      href: `${base}/accreditation`,
      text: regulatoryVerified ? "Verified" : "Review",
      basis: "UGC, AICTE and affiliation each backed by a verified source",
    },
    {
      label: "Commercial Opportunity",
      href: `${base}/commercial`,
      text: inst.opportunity ?? "Requires diligence",
      basis: inst.opportunity ? "Manual assessment" : "No manual assessment recorded",
    },
  ];

  const identity: [string, string][] = [
    ["Institution", inst.name],
    ["Location", `${inst.city}, ${inst.state}`],
    ["Established", inst.established ? String(inst.established) : "Not available"],
    ["Ownership", inst.ownership || "Not available"],
    ["Affiliated University", inst.university || "Not available"],
    ["AISHE Code", inst.aisheCode || "Not available"],
    ["Campus Status", inst.campusStatus || "Not available"],
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Identity">
          <table className="w-full text-sm">
            <tbody>
              {identity.map(([k, v]) => (
                <tr key={k} className="border-t border-line first:border-t-0">
                  <th scope="row" className="py-1.5 pr-3 text-left text-xs font-normal uppercase tracking-wide text-muted">
                    {k}
                  </th>
                  <td className={`py-1.5 ${v === "Not available" ? "text-muted" : "text-ink"}`}>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card title="Business Snapshot" className="lg:col-span-2">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Capacity">
              <Num fact={capacity} />
            </Tile>
            <Tile label="Current Students" sub={students?.period}>
              <Num fact={students} />
            </Tile>
            <Tile label="Last-year New Admissions" sub={admissions?.period}>
              <Num fact={admissions} />
            </Tile>
            <Tile label="Capacity Utilisation" sub={utilLatest?.period}>
              <Derived value={utilLatest?.derived?.value} unit="percent" basis={utilLatest?.derived?.basis ?? []} />
            </Tile>
            <div className="col-span-2 rounded-lg border border-line bg-surface p-3">
              <div className="flex items-center justify-between">
                <Label>5-Year Admission Trend</Label>
                <TrendArrow dir={trend(admSeries.map((p) => p.value))} />
              </div>
              <TrendLine
                points={admSeries.map((p) => ({ label: p.period, value: p.value, status: p.fact?.status }))}
                unit="count"
                height={72}
              />
            </div>
            <Tile label="Placement" sub={placement?.period}>
              <Num fact={placement} />
            </Tile>
            <Tile label="Average Fee" sub={fee?.period}>
              <Num fact={fee} />
            </Tile>
          </div>
        </Card>
      </div>

      <Card title="Regulatory">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
          <Tile label="UGC">
            <Num fact={ugc} className="text-sm font-medium" />
          </Tile>
          <Tile label="AICTE">
            <Num fact={aicte} className="text-sm font-medium" />
          </Tile>
          <Tile label="NAAC Grade">
            <Num fact={naac} className="text-sm font-medium" />
          </Tile>
          <Tile label="NIRF" sub={nirf ? `${metric(nirf.metricKey)?.label ?? nirf.metricKey}, ${nirf.period}` : undefined}>
            {nirf ? <Num fact={nirf} /> : <span className="text-base font-normal text-muted">Not ranked</span>}
          </Tile>
          <Tile label="University Affiliation">
            <Num fact={affiliation} className="text-sm font-medium" />
          </Tile>
        </div>
      </Card>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Commercial Opportunity">
          <Label>Available capacity</Label>
          <div className="mt-1 text-xl font-semibold tnum">
            <Derived value={available} unit="count" basis={availableBasis} />
          </div>
          <p className="mt-0.5 text-xs text-muted">Sanctioned capacity minus current students</p>
          <div className="mt-4 border-t border-line pt-3">
            <Label>Manual assessment</Label>
            <p className={`mt-1 text-sm font-medium ${inst.opportunity ? "text-ink" : "text-muted"}`}>
              {inst.opportunity ?? "Not available"}
            </p>
            {inst.opportunityNote && <p className="mt-1 text-sm text-muted">{inst.opportunityNote}</p>}
          </div>
        </Card>

        <Card title="CEO View">
          <ul className="divide-y divide-line">
            {ceo.map((row) => (
              <li key={row.label} className="flex items-center justify-between gap-3 py-2">
                <div>
                  <Link href={row.href} className="text-sm font-medium text-ink hover:text-brand">
                    {row.label}
                  </Link>
                  <div className="text-xs text-muted">{row.basis}</div>
                </div>
                {row.text ? (
                  <span
                    className={`shrink-0 text-sm font-medium ${
                      row.text === "Verified"
                        ? "text-verified"
                        : row.text === "Review" || row.text === "Requires diligence"
                          ? "text-attention"
                          : "text-ink"
                    }`}
                  >
                    {row.text}
                  </span>
                ) : (
                  <TrendArrow dir={row.dir ?? "unknown"} />
                )}
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Overall Risk">
          <Label>Manual judgement — not computed</Label>
          <p className={`mt-1 text-xl font-semibold ${inst.overallRisk ? "text-ink" : "text-muted"}`}>
            {inst.overallRisk ?? "Not available"}
          </p>
          <p className="mt-1 text-sm text-muted">{inst.overallRiskNote ?? "No note recorded."}</p>
          <p className="mt-3 border-t border-line pt-3 text-xs text-muted">
            Entered by the diligence team. The platform does not calculate an overall score.
          </p>
        </Card>
      </div>

      <Card
        title="Key Risks"
        action={
          <Link href={`${base}/risks`} className="text-xs text-brand hover:underline">
            All flags in Risks
          </Link>
        }
      >
        {openFlags.length === 0 ? (
          <Empty>No flags raised by the rules on the evidence held. This is not a clearance.</Empty>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {openFlags.slice(0, 5).map((f) => (
              <FlagCard key={f.id} flag={f} />
            ))}
          </div>
        )}
      </Card>

      <Card title="Evidence Coverage">
        <CoverageMeter facts={facts} label="Overall" />
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {MODULES.map((m) => (
            <CoverageMeter key={m.key} facts={facts} module={m.key} label={m.label} />
          ))}
        </div>
        <p className="mt-3 text-xs text-muted">
          Coverage rates how complete the diligence is. It is not a rating of the institution.
        </p>
      </Card>
    </div>
  );
}
