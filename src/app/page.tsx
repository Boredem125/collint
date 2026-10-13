import Link from "next/link";
import { listProfiles, searchInstitutions } from "@/lib/data";
import { latest, periods, utilisation } from "@/lib/facts";
import { deriveFlags } from "@/lib/risk";
import { Num, Derived, CoverageMeter } from "@/components/evidence/Evidence";
import { Card, Empty, SampleBadge, Th, Td } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const term = q.trim();
  const [profiles, hits] = await Promise.all([listProfiles(), term ? searchInstitutions(term) : Promise.resolve([])]);

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-line bg-surface px-6 py-10 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-ink">Institution Intelligence Platform</h1>
        <p className="mt-1 text-sm text-muted">One Search. One Profile. One Executive View.</p>
        <form action="/" method="get" className="mx-auto mt-6 flex max-w-2xl gap-2">
          <input
            type="search"
            name="q"
            defaultValue={term}
            placeholder="College name, AISHE code, university, city or promoter"
            aria-label="Search institutions"
            className="w-full rounded-lg border border-line bg-canvas px-4 py-3 text-base text-ink placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none"
          />
          <button type="submit" className="rounded-lg bg-brand px-5 text-sm font-medium text-white">
            Search
          </button>
        </form>
        <p className="mt-3 text-xs text-muted">Every number carries its source, date and verification status.</p>
      </section>

      {term && (
        <Card title={`Results for "${term}"`}>
          {hits.length === 0 ? (
            <Empty>No institutions match this search.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {hits.map((h) => (
                <li key={h.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2">
                  <div>
                    <Link href={`/institutions/${h.id}`} className="text-sm font-medium text-brand hover:underline">
                      {h.name}
                    </Link>
                    <div className="text-xs text-muted">
                      AISHE {h.aisheCode} · {h.city} · {h.university}
                    </div>
                  </div>
                  {h.match && <span className="text-xs text-muted">Matched on {h.match}</span>}
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      <Card title="Portfolio">
        {profiles.length === 0 ? (
          <Empty>No institutions yet. Import a workbook to add one.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Institution</Th>
                  <Th>Location</Th>
                  <Th>Latest utilisation</Th>
                  <Th>Latest placement rate</Th>
                  <Th>Open flags</Th>
                  <Th>Evidence coverage</Th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => {
                  const ay = periods(p.facts, "intake.approved").at(-1);
                  const util = ay ? utilisation(p.facts, ay) : null;
                  const flags = deriveFlags(p);
                  const critical = flags.filter((f) => f.band === "CRITICAL").length;
                  const attention = flags.filter((f) => f.band === "ATTENTION").length;
                  return (
                    <tr key={p.inst.id} className="border-t border-line align-top">
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link href={`/institutions/${p.inst.id}`} className="font-medium text-brand hover:underline">
                            {p.inst.name}
                          </Link>
                          {p.inst.isSample && <SampleBadge />}
                        </div>
                        <div className="text-xs text-muted">AISHE {p.inst.aisheCode}</div>
                      </Td>
                      <Td>
                        {p.inst.city}, {p.inst.state}
                      </Td>
                      <Td num>
                        <Derived value={util?.value} unit="percent" basis={util?.basis ?? []} />
                        {ay && <div className="text-xs text-muted">{ay}</div>}
                      </Td>
                      <Td num>
                        <Num fact={latest(p.facts, "placement.rate")} />
                      </Td>
                      <Td>
                        <Link href={`/institutions/${p.inst.id}/risks`} className="flex flex-wrap gap-x-3 text-xs">
                          <span className={critical ? "font-medium text-critical" : "text-muted"}>
                            <span className="tnum">{critical}</span> Critical
                          </span>
                          <span className={attention ? "font-medium text-attention" : "text-muted"}>
                            <span className="tnum">{attention}</span> Attention
                          </span>
                        </Link>
                      </Td>
                      <Td>
                        <div className="min-w-44">
                          <CoverageMeter facts={p.facts} />
                        </div>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-3 text-xs text-muted">
          Evidence coverage rates how complete the diligence is. It is not a rating of the institution.
        </p>
      </Card>
    </div>
  );
}
