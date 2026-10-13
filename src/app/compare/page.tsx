import type { ReactNode } from "react";
import Link from "next/link";
import { listProfiles } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import { coverage, latest, periods, pick, trend, utilisation, utilisationSeries } from "@/lib/facts";
import { NIRF_CATEGORIES, metric } from "@/lib/metrics";
import type { FactT, Profile } from "@/lib/types";
import { Card, Empty, PageHeader, SampleBadge, Td, Th, TrendArrow } from "@/components/ui";
import { Derived, Num } from "@/components/evidence/Evidence";

export const dynamic = "force-dynamic";

const MAX = 3;

// Facts behind the coverage figure: every usable fact on an expected metric.
const coverageBasis = (facts: FactT[]) =>
  facts.filter((f) => metric(f.metricKey)?.expected && f.status !== "UNAVAILABLE");

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

  const rows: { label: string; cell: (p: Profile) => ReactNode }[] = [
    { label: "Location", cell: (p) => `${p.inst.city}, ${p.inst.state}` },
    { label: "University", cell: (p) => p.inst.university },
    { label: "Sanctioned capacity", cell: (p) => <Num fact={pick(p.facts, "capacity.total")} /> },
    { label: "Total students", cell: (p) => <Num fact={latest(p.facts, "students.total")} /> },
    { label: "Latest admissions", cell: (p) => <Num fact={latest(p.facts, "admissions.total")} /> },
    {
      label: "Seat utilisation",
      cell: (p) => {
        const year = periods(p.facts, "intake.approved").at(-1);
        const u = year ? utilisation(p.facts, year) : null;
        return <Derived value={u?.value} unit="percent" basis={u?.basis ?? []} />;
      },
    },
    {
      label: "5-year utilisation trend",
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
    { label: "Placement rate", cell: (p) => <Num fact={latest(p.facts, "placement.rate")} /> },
    { label: "Average fee", cell: (p) => <Num fact={latest(p.facts, "fee.average")} /> },
    { label: "NAAC grade", cell: (p) => <Num fact={pick(p.facts, "naac.grade")} /> },
    {
      label: "NIRF rank",
      cell: (p) => {
        const ranked = NIRF_CATEGORIES.map((k) => latest(p.facts, k)).filter((f): f is FactT => f !== undefined);
        if (!ranked.length) return <Num fact={undefined} />;
        return (
          <div className="space-y-1">
            {ranked.map((f) => (
              <div key={f.id}>
                <Num fact={f} />{" "}
                <span className="text-xs text-muted">
                  {(metric(f.metricKey)?.label ?? f.metricKey).replace("NIRF ", "")} {f.period}
                </span>
              </div>
            ))}
          </div>
        );
      },
    },
    {
      label: "Evidence coverage",
      cell: (p) => <Derived value={coverage(p.facts).pct} unit="percent" basis={coverageBasis(p.facts)} />,
    },
    ...(["CRITICAL", "ATTENTION"] as const).map((band) => ({
      label: band === "CRITICAL" ? "Critical flags" : "Attention flags",
      cell: (p: Profile) => {
        const flags = deriveFlags(p).filter((f) => f.band === band);
        return <Derived value={flags.length} unit="count" basis={flags.flatMap((f) => f.evidence)} />;
      },
    })),
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Compare institutions"
        subtitle="Two or three institutions side by side on the snapshot measures. No ranking and no score."
      />

      <Card title="Choose institutions">
        {all.length ? (
          <form method="get" action="/compare" className="flex flex-wrap items-center gap-x-5 gap-y-2">
            {all.map((p) => (
              <label key={p.inst.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="ids"
                  value={p.inst.id}
                  defaultChecked={selected.has(p.inst.id)}
                  className="accent-brand"
                />
                {p.inst.name}
              </label>
            ))}
            <button type="submit" className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white">
              Compare
            </button>
            <span className="text-xs text-muted">Select two or three. The first three selected are shown.</span>
          </form>
        ) : (
          <Empty>No institutions recorded yet</Empty>
        )}
        {dropped ? (
          <p className="mt-2 text-xs text-attention">More than three were selected; only the first three are shown.</p>
        ) : null}
        {asked.length > found.length ? (
          <p className="mt-2 text-xs text-attention">Some requested institutions were not found and are omitted.</p>
        ) : null}
      </Card>

      {chosen.length < 2 ? (
        <Empty>Select at least two institutions to compare</Empty>
      ) : (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Measure</Th>
                  {chosen.map((p) => (
                    <Th key={p.inst.id}>
                      <Link href={`/institutions/${p.inst.id}`} className="text-brand hover:underline">
                        {p.inst.name}
                      </Link>
                      {p.inst.isSample ? (
                        <span className="ml-2 align-middle">
                          <SampleBadge />
                        </span>
                      ) : null}
                    </Th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label} className="border-t border-line align-top">
                    <Td>
                      <span className="text-muted">{r.label}</span>
                    </Td>
                    {chosen.map((p) => (
                      <Td key={p.inst.id}>
                        <span className="tnum">{r.cell(p)}</span>
                      </Td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-xs text-muted">
            Evidence coverage rates how much of the expected data is verified; it does not rate the institution. Flag
            counts are shown per band and are never combined. Years may differ between institutions: hover a figure for
            its period, source and status.
          </p>
        </Card>
      )}
    </div>
  );
}
