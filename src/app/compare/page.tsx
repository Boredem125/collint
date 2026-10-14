import type { ReactNode } from "react";
import Link from "next/link";
import { listProfiles } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import { coverage, latest, periods, pick, trend, utilisation, utilisationSeries, weakestStatus } from "@/lib/facts";
import { NIRF_CATEGORIES, metric } from "@/lib/metrics";
import type { FactStatus, FactT, Profile } from "@/lib/types";
import { Empty, Kicker, SampleBadge, TrendArrow } from "@/components/ui";
import { Derived, Num } from "@/components/evidence/Evidence";

export const dynamic = "force-dynamic";

const MAX = 3;

// Facts behind the coverage figure: every usable fact on an expected metric.
const coverageBasis = (facts: FactT[]) =>
  facts.filter((f) => metric(f.metricKey)?.expected && f.status !== "UNAVAILABLE");

interface Magnitude {
  v: number | null;
  status: FactStatus;
}

interface RowDef {
  label: string;
  cell: (p: Profile) => ReactNode;
  // Period shown under the figure, since years can differ between institutions.
  period?: (p: Profile) => string | undefined;
  // For the relative bar: raw value and the evidence status it inherits.
  size?: (p: Profile) => Magnitude;
  // Percent rows are drawn against 100, counts against the largest value in the row.
  scale?: "pct" | "max";
}

const ofFact = (f: FactT | undefined): Magnitude => ({ v: f?.valueNum ?? null, status: f?.status ?? "UNAVAILABLE" });

const latestUtil = (p: Profile) => {
  const year = periods(p.facts, "intake.approved").at(-1);
  return { year, u: year ? utilisation(p.facts, year) : null };
};

const GROUPS: { name: string; rows: RowDef[] }[] = [
  {
    name: "Scale",
    rows: [
      {
        label: "Sanctioned capacity",
        cell: (p) => <Num fact={pick(p.facts, "capacity.total")} />,
        size: (p) => ofFact(pick(p.facts, "capacity.total")),
        scale: "max",
      },
      {
        label: "Total students",
        cell: (p) => <Num fact={latest(p.facts, "students.total")} />,
        period: (p) => latest(p.facts, "students.total")?.period,
        size: (p) => ofFact(latest(p.facts, "students.total")),
        scale: "max",
      },
      {
        label: "Average annual fee",
        cell: (p) => <Num fact={latest(p.facts, "fee.average")} />,
        period: (p) => latest(p.facts, "fee.average")?.period,
        size: (p) => ofFact(latest(p.facts, "fee.average")),
        scale: "max",
      },
    ],
  },
  {
    name: "Demand",
    rows: [
      {
        label: "Latest admissions",
        cell: (p) => <Num fact={latest(p.facts, "admissions.total")} />,
        period: (p) => latest(p.facts, "admissions.total")?.period,
        size: (p) => ofFact(latest(p.facts, "admissions.total")),
        scale: "max",
      },
      {
        label: "Seat utilisation",
        cell: (p) => {
          const { u } = latestUtil(p);
          return <Derived value={u?.value} unit="percent" basis={u?.basis ?? []} />;
        },
        period: (p) => latestUtil(p).year,
        size: (p) => {
          const { u } = latestUtil(p);
          return { v: u?.value ?? null, status: u ? weakestStatus(u.basis) : "UNAVAILABLE" };
        },
        scale: "pct",
      },
      {
        label: "Utilisation, five-year direction",
        cell: (p) => (
          <TrendArrow
            dir={trend(
              utilisationSeries(p.facts)
                .slice(-5)
                .map((x) => x.derived?.value ?? null),
            )}
          />
        ),
      },
    ],
  },
  {
    name: "Outcomes",
    rows: [
      {
        label: "Placement rate",
        cell: (p) => <Num fact={latest(p.facts, "placement.rate")} />,
        period: (p) => latest(p.facts, "placement.rate")?.period,
        size: (p) => ofFact(latest(p.facts, "placement.rate")),
        scale: "pct",
      },
      {
        label: "Average package",
        cell: (p) => <Num fact={latest(p.facts, "placement.average")} />,
        period: (p) => latest(p.facts, "placement.average")?.period,
        size: (p) => ofFact(latest(p.facts, "placement.average")),
        scale: "max",
      },
    ],
  },
  {
    name: "Standing",
    rows: [
      { label: "NAAC grade", cell: (p) => <Num fact={pick(p.facts, "naac.grade")} /> },
      {
        label: "NIRF rank",
        cell: (p) => {
          const ranked = NIRF_CATEGORIES.map((k) => latest(p.facts, k)).filter((f): f is FactT => f !== undefined);
          if (!ranked.length) return <Num fact={undefined} />;
          return (
            <div className="space-y-1">
              {ranked.map((f) => (
                <div key={f.id} className="flex items-baseline gap-2">
                  <Num fact={f} />
                  <span className="text-[12px] text-muted">
                    {(metric(f.metricKey)?.label ?? f.metricKey).replace("NIRF ", "")}
                  </span>
                  <span className="font-mono text-[11px] text-faint">{f.period}</span>
                </div>
              ))}
            </div>
          );
        },
      },
    ],
  },
  {
    name: "Evidence",
    rows: [
      {
        label: "Expected metrics verified",
        cell: (p) => <Derived value={coverage(p.facts).pct} unit="percent" basis={coverageBasis(p.facts)} />,
        size: (p) => {
          const basis = coverageBasis(p.facts);
          return { v: coverage(p.facts).pct, status: basis.length ? weakestStatus(basis) : "NEEDS_VALIDATION" };
        },
        scale: "pct",
      },
    ],
  },
  {
    name: "Risk",
    // Bands are separate rows and never added together.
    rows: (["CRITICAL", "ATTENTION"] as const).map((band) => {
      const of = (p: Profile) => deriveFlags(p).filter((f) => f.band === band);
      return {
        label: band === "CRITICAL" ? "Critical flags" : "Attention flags",
        cell: (p: Profile) => {
          const flags = of(p);
          return <Derived value={flags.length} unit="count" basis={flags.flatMap((f) => f.evidence)} />;
        },
        size: (p: Profile) => {
          const ev = of(p).flatMap((f) => f.evidence);
          return { v: of(p).length, status: ev.length ? weakestStatus(ev) : "NEEDS_VALIDATION" };
        },
        scale: "max" as const,
      };
    }),
  },
];

function Bar({ m, max }: { m: Magnitude; max: number }) {
  if (m.v === null || !Number.isFinite(m.v) || max <= 0) return null;
  const w = Math.max(0, Math.min(100, (m.v / max) * 100));
  return (
    <span data-evidence={m.status} className="mt-2 block h-[3px] w-full max-w-[180px] bg-sunken" aria-hidden>
      <span className="block h-full bg-muted" style={{ width: `${Math.max(w, m.v > 0 ? 1.5 : 0)}%` }} />
    </span>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string | string[] }>;
}) {
  const { ids } = await searchParams;
  const all = await listProfiles();

  // Accepts ?ids=a,b,c and the repeated ?ids=a&ids=b a checkbox form submits.
  const asked = [...new Set((Array.isArray(ids) ? ids : [ids ?? ""]).flatMap((s) => s.split(",")).filter(Boolean))];
  const found = asked.map((x) => all.find((p) => p.inst.id === x)).filter((p): p is Profile => p !== undefined);
  const chosen = (asked.length ? found : all).slice(0, MAX);
  const dropped = found.length > MAX;
  const selected = new Set(chosen.map((p) => p.inst.id));

  const names = chosen.map((p) => p.inst.name);
  const headline =
    chosen.length < 2
      ? "Choose two or three institutions to read side by side."
      : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}, measure by measure. No ranking, no score.`;

  const cols = chosen.length;

  return (
    <div>
      <Kicker>Compare</Kicker>
      <h1 className="display mt-2 max-w-4xl text-[28px] font-medium leading-[1.15] text-ink sm:text-[32px]">{headline}</h1>

      {all.length ? (
        <form method="get" action="/compare" className="mt-6 flex flex-wrap items-center gap-2">
          {all.map((p) => (
            <label
              key={p.inst.id}
              className="inline-flex cursor-pointer select-none items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-muted transition-colors hover:border-line-strong hover:text-ink has-[:checked]:border-ink has-[:checked]:bg-ink has-[:checked]:text-canvas has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand"
            >
              <input
                type="checkbox"
                name="ids"
                value={p.inst.id}
                defaultChecked={selected.has(p.inst.id)}
                className="peer sr-only"
              />
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden className="shrink-0 peer-checked:hidden">
                <circle cx="6" cy="6" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.2" />
              </svg>
              <svg viewBox="0 0 12 12" width="11" height="11" aria-hidden className="hidden shrink-0 peer-checked:block">
                <path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {p.inst.name}
            </label>
          ))}
          <button
            type="submit"
            className="ml-1 inline-flex h-8 items-center rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-sunken"
          >
            Compare
          </button>
          <span className="text-[12px] text-faint">Up to three.</span>
        </form>
      ) : (
        <div className="mt-6">
          <Empty>No institutions recorded yet</Empty>
        </div>
      )}
      {dropped ? (
        <p className="mt-2 text-[12px] text-attention">More than three were selected; only the first three are shown.</p>
      ) : null}
      {asked.length > found.length ? (
        <p className="mt-2 text-[12px] text-attention">Some requested institutions were not found and are omitted.</p>
      ) : null}

      {cols < 2 ? (
        <div className="mt-10">
          <Empty>Select at least two institutions to compare</Empty>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto">
          <table className="w-full min-w-[640px] table-fixed border-collapse">
            <colgroup>
              <col className="w-[200px]" />
              {chosen.map((p) => (
                <col key={p.inst.id} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th scope="col" className="border-b-2 border-ink pb-3 align-bottom">
                  <span className="sr-only">Measure</span>
                </th>
                {chosen.map((p) => (
                  <th key={p.inst.id} scope="col" className="border-b-2 border-ink px-4 pb-3 text-left align-bottom font-normal last:pr-0">
                    {p.inst.isSample ? (
                      <div className="mb-1.5">
                        <SampleBadge />
                      </div>
                    ) : null}
                    <Link
                      href={`/institutions/${p.inst.id}`}
                      className="display block text-[21px] font-medium leading-[1.15] text-ink hover:text-brand"
                    >
                      {p.inst.name}
                    </Link>
                    <div className="mt-1.5 text-[12px] leading-snug text-muted">
                      {p.inst.city}, {p.inst.state}
                      <span className="text-faint"> · </span>
                      {p.inst.university}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            {GROUPS.map((g) => (
              <tbody key={g.name}>
                <tr>
                  <th scope="rowgroup" colSpan={cols + 1} className="border-b border-line-strong pb-1.5 pt-7 text-left font-normal">
                    <Kicker>{g.name}</Kicker>
                  </th>
                </tr>
                {g.rows.map((r) => {
                  const sizes = r.size ? chosen.map((p) => r.size!(p)) : null;
                  const max =
                    r.scale === "pct" ? 100 : Math.max(0, ...(sizes ?? []).map((m) => (m.v !== null && Number.isFinite(m.v) ? m.v : 0)));
                  return (
                    <tr key={r.label} className="align-top transition-colors hover:bg-sunken">
                      <th scope="row" className="border-b border-line py-3 pr-4 text-left text-[13px] font-normal text-muted">
                        {r.label}
                      </th>
                      {chosen.map((p, i) => {
                        const period = r.period?.(p);
                        return (
                          <td key={p.inst.id} className="border-b border-line px-4 py-3 last:pr-0">
                            <div className="flex items-baseline gap-2">
                              <span className="tnum text-[15px] text-ink">{r.cell(p)}</span>
                              {period ? <span className="font-mono text-[11px] text-faint">{period}</span> : null}
                            </div>
                            {sizes ? <Bar m={sizes[i]} max={max} /> : null}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            ))}
          </table>
          <p className="mt-4 text-[12px] text-faint">
            Bars show size within each row, not quality. Evidence coverage rates the diligence, not the institution.
          </p>
        </div>
      )}
    </div>
  );
}
