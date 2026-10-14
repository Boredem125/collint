import Link from "next/link";
import { listProfiles } from "@/lib/data";
import { all, coverage, latest, periods, utilisation } from "@/lib/facts";
import { deriveFlags } from "@/lib/risk";
import { DEAL_STAGES } from "@/lib/metrics";
import type { FactT, Profile } from "@/lib/types";
import { Derived, Num } from "@/components/evidence/Evidence";
import { Empty, SampleBadge, Section, Stat, StatRow, Td, Th } from "@/components/ui";

export const dynamic = "force-dynamic";

const DAY = 86_400_000;

function row(p: Profile, now: number) {
  const ay = periods(p.facts, "intake.approved").at(-1);
  const util = ay ? utilisation(p.facts, ay) : null;
  const flags = deriveFlags(p);
  return {
    p,
    ay,
    util,
    placement: latest(p.facts, "placement.rate"),
    critical: flags.filter((f) => f.band === "CRITICAL").length,
    attention: flags.filter((f) => f.band === "ATTENTION").length,
    cov: coverage(p.facts).pct,
    days: Math.max(0, Math.floor((now - new Date(p.inst.stageUpdatedAt).getTime()) / DAY)),
  };
}

type Row = ReturnType<typeof row>;

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

function Marks({ critical, attention }: { critical: number; attention: number }) {
  if (!critical && !attention) return <span className="text-faint">No open flags</span>;
  return (
    <span className="flex gap-3">
      {critical ? (
        <span className="inline-flex items-center gap-1.5 text-critical">
          <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-critical" />
          <span className="tnum">{critical}</span> critical
        </span>
      ) : null}
      {attention ? (
        <span className="inline-flex items-center gap-1.5 text-attention">
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-attention" />
          <span className="tnum">{attention}</span> attention
        </span>
      ) : null}
    </span>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  return (
    <span className="flex items-center gap-2" title="Share of expected metrics backed by verified evidence">
      <span className="h-[3px] w-full overflow-hidden rounded-full bg-sunken">
        <span className="block h-full bg-verified" style={{ width: `${pct}%` }} />
      </span>
      <span className="tnum w-8 shrink-0 text-right text-[11px] text-muted">{Math.round(pct)}%</span>
    </span>
  );
}

function BoardCard({ r }: { r: Row }) {
  const { p } = r;
  return (
    <article className="rounded-md border border-line bg-surface p-3.5 transition-colors hover:border-line-strong">
      <div className="flex items-start justify-between gap-2">
        <Link
          href={`/institutions/${p.inst.id}`}
          className="display text-[16px] font-medium leading-snug text-ink hover:text-brand"
        >
          {p.inst.name}
        </Link>
        {p.inst.isSample && <SampleBadge />}
      </div>
      <div className="mt-0.5 text-[12px] text-muted">
        {p.inst.city}, {p.inst.state}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-x-3 text-[13px]">
        <div>
          <dt className="text-[11px] text-faint">Utilisation{r.ay ? ` ${r.ay}` : ""}</dt>
          <dd className="mt-0.5 text-ink">
            <Derived value={r.util?.value} unit="percent" basis={r.util?.basis ?? []} />
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-faint">Placement{r.placement ? ` ${r.placement.period}` : ""}</dt>
          <dd className="mt-0.5 text-ink [&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
            <Num fact={r.placement} />
          </dd>
        </div>
      </dl>
      <div className="mt-3 text-[12px]">
        <Marks critical={r.critical} attention={r.attention} />
      </div>
      <div className="mt-3 border-t border-line pt-2.5">
        <CoverageBar pct={r.cov} />
        <div className="mt-1.5 font-mono text-[10.5px] text-faint">{plural(r.days, "day")} in stage</div>
      </div>
    </article>
  );
}

export default async function Pipeline() {
  const profiles = await listProfiles();
  const now = Date.now();
  const rows = profiles.map((p) => row(p, now));

  const count = (stage: string) => rows.filter((r) => r.p.inst.stage === stage).length;
  const withCritical = rows.filter((r) => r.critical > 0).length;
  const openCritical = rows.reduce((a, r) => a + r.critical, 0);

  const capacity = profiles.map((p) => all(p.facts, "capacity.total").find((f) => f.valueNum !== null && f.status !== "UNAVAILABLE"));
  const capacityBasis = capacity.filter((f): f is FactT => !!f);
  const capacityTotal = capacityBasis.length ? capacityBasis.reduce((a, f) => a + f.valueNum!, 0) : null;

  // Only university-portal or other VERIFIED counts; a college's own claim never enters the total.
  const lastAy = profiles.flatMap((p) => periods(p.facts, "admissions.total")).sort().at(-1);
  const admBasis = lastAy
    ? profiles
        .map((p) => all(p.facts, "admissions.total", lastAy).find((f) => f.status === "VERIFIED" && f.valueNum !== null))
        .filter((f): f is FactT => !!f)
    : [];
  const admTotal = admBasis.length ? admBasis.reduce((a, f) => a + f.valueNum!, 0) : null;

  const summary = [
    plural(rows.length, "institution"),
    ...(["DILIGENCE", "NEGOTIATION", "PARTNERED"] as const)
      .filter((s) => count(s))
      .map((s) => `${count(s)} in ${DEAL_STAGES.find((d) => d.key === s)!.label.toLowerCase()}`),
    withCritical ? `${withCritical} with a critical flag` : "no critical flags",
  ].join(" · ");

  return (
    <div className="space-y-14">
      <header>
        <h1 className="display text-[34px] font-medium sm:text-[44px] leading-none text-ink">Pipeline</h1>
        <p className="mt-3 text-[15px] text-muted">{summary}</p>
      </header>

      {rows.length === 0 ? (
        <Empty>
          No institutions yet.{" "}
          <Link href="/import" className="text-brand hover:underline">
            Import a workbook
          </Link>{" "}
          to add one.
        </Empty>
      ) : (
        <>
          <StatRow className="border-y border-line py-5">
            <Stat label="Institutions">
              <span className="tnum">{rows.length}</span>
            </Stat>
            <Stat label="Total sanctioned capacity" sub={`${capacityBasis.length} of ${rows.length} on record`}>
              <Derived value={capacityTotal} unit="count" basis={capacityBasis} />
            </Stat>
            <Stat
              label={`Verified admissions${lastAy ? ` ${lastAy}` : ""}`}
              sub={`${admBasis.length} of ${rows.length} institutions have a verified count`}
            >
              <Derived value={admTotal} unit="count" basis={admBasis} />
            </Stat>
            <Stat label="Open critical flags" sub={withCritical ? `Across ${plural(withCritical, "institution")}` : undefined}>
              <span className={`tnum ${openCritical ? "text-critical" : ""}`}>{openCritical}</span>
            </Stat>
          </StatRow>

          <Section index="01" title="Board" aside="By deal stage">
            <div className="-mx-4 snap-x snap-mandatory scroll-px-4 overflow-x-auto px-4 pb-2 sm:-mx-5 sm:snap-none sm:scroll-px-5 sm:px-5">
              <div className="flex gap-4 sm:grid sm:min-w-[1080px] sm:grid-cols-5">
                {DEAL_STAGES.map((s) => {
                  const items = rows.filter((r) => r.p.inst.stage === s.key);
                  return (
                    <div key={s.key} className="w-[85%] min-w-0 shrink-0 snap-start sm:w-auto">
                      <div className="mb-3 flex items-baseline justify-between border-b border-line-strong pb-1.5">
                        <span className="text-[13px] font-medium text-ink">{s.label}</span>
                        <span className="font-mono text-[11px] text-faint">{items.length}</span>
                      </div>
                      <div className="space-y-3">
                        {items.length ? (
                          items.map((r) => <BoardCard key={r.p.inst.id} r={r} />)
                        ) : (
                          <div className="rounded-md border border-dashed border-line py-6 text-center text-[12px] text-faint">
                            None
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Section>

          <Section index="02" title="All institutions" aside="Evidence verified rates the diligence, not the college">
            <ul className="divide-y divide-line border-y border-line sm:hidden">
              {rows.map((r) => (
                <li key={r.p.inst.id} className="py-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Link
                          href={`/institutions/${r.p.inst.id}`}
                          className="display inline-flex min-h-[40px] items-center text-[16px] font-medium leading-snug text-ink hover:text-brand"
                        >
                          {r.p.inst.name}
                        </Link>
                        {r.p.inst.isSample && <SampleBadge />}
                      </div>
                      <div className="text-[12px] text-muted">
                        {r.p.inst.city} · {DEAL_STAGES.find((s) => s.key === r.p.inst.stage)?.label ?? r.p.inst.stage} ·{" "}
                        <span className="font-mono text-[11px]">{r.days}d</span>
                      </div>
                    </div>
                    <div className="shrink-0 text-right text-[14px] text-ink [&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
                      <Derived value={r.util?.value} unit="percent" basis={r.util?.basis ?? []} />
                      <div className="font-mono text-[10.5px] text-faint">Util.{r.ay ? ` ${r.ay}` : ""}</div>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 text-[12.5px]">
                    <span className="text-muted">
                      Placement <span className="text-ink"><Num fact={r.placement} /></span>
                      {r.placement && <span className="font-mono text-[10.5px] text-faint"> {r.placement.period}</span>}
                    </span>
                    <Link href={`/institutions/${r.p.inst.id}/risks`} className="inline-flex min-h-[40px] items-center hover:underline">
                      <Marks critical={r.critical} attention={r.attention} />
                    </Link>
                  </div>
                  <div className="mt-1">
                    <CoverageBar pct={r.cov} />
                  </div>
                </li>
              ))}
            </ul>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full min-w-[880px]">
                <thead>
                  <tr>
                    <Th>Institution</Th>
                    <Th>Stage</Th>
                    <Th num>Utilisation</Th>
                    <Th num>Placement rate</Th>
                    <Th>Open flags</Th>
                    <Th className="w-40">Evidence verified</Th>
                    <Th num>In stage</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.p.inst.id} className="align-baseline">
                      <Td>
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/institutions/${r.p.inst.id}`}
                            className="display text-[15px] font-medium text-ink hover:text-brand"
                          >
                            {r.p.inst.name}
                          </Link>
                          {r.p.inst.isSample && <SampleBadge />}
                        </div>
                        <div className="text-[12px] text-muted">
                          {r.p.inst.city} · <span className="font-mono text-[11px]">AISHE {r.p.inst.aisheCode}</span>
                        </div>
                      </Td>
                      <Td className="text-muted">{DEAL_STAGES.find((s) => s.key === r.p.inst.stage)?.label ?? r.p.inst.stage}</Td>
                      <Td num>
                        <Derived value={r.util?.value} unit="percent" basis={r.util?.basis ?? []} />
                        {r.ay && <div className="font-mono text-[10.5px] text-faint">{r.ay}</div>}
                      </Td>
                      <Td num>
                        <Num fact={r.placement} />
                        {r.placement && <div className="font-mono text-[10.5px] text-faint">{r.placement.period}</div>}
                      </Td>
                      <Td className="text-[12.5px]">
                        <Link href={`/institutions/${r.p.inst.id}/risks`} className="hover:underline">
                          <Marks critical={r.critical} attention={r.attention} />
                        </Link>
                      </Td>
                      <Td>
                        <CoverageBar pct={r.cov} />
                      </Td>
                      <Td num className="font-mono text-[12px] text-muted">
                        {r.days}d
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Section>
        </>
      )}
    </div>
  );
}
