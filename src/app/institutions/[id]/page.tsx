import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import {
  coverage,
  fmtDate,
  latest,
  periods,
  pick,
  series,
  trend,
  utilisationSeries,
  weakestStatus,
  type TrendDir,
} from "@/lib/facts";
import { DEAL_STAGES, MODULES, NIRF_CATEGORIES, metric } from "@/lib/metrics";
import { deriveFlags } from "@/lib/risk";
import type { FactStatus, FactT } from "@/lib/types";
import { Num, Derived } from "@/components/evidence/Evidence";
import { Kicker, Section, Stat, StatRow, TrendArrow, FlagCard, Empty, Th, Td } from "@/components/ui";

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];
const say = (n: number) => WORDS[n] ?? String(n);

const DOT: Record<FactStatus, string> = {
  VERIFIED: "var(--color-verified)",
  SELF_REPORTED: "var(--color-selfreported)",
  NEEDS_VALIDATION: "var(--color-validate)",
  UNAVAILABLE: "var(--color-unavailable)",
};

const JUDGEMENT_TONE: Record<string, string> = {
  GREEN: "text-verified",
  AMBER: "text-attention",
  RED: "text-critical",
  HIGH: "text-ink",
  MEDIUM: "text-ink",
  LOW: "text-ink",
};

const sentence = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();

/** Shape-only sparkline. The figures beside it carry the evidence. */
function Spark({ points }: { points: { value: number | null; status?: FactStatus }[] }) {
  const W = 104;
  const H = 26;
  const P = 3;
  const pts = points.map((p, i) => ({ ...p, i })).filter((p) => p.value !== null) as {
    value: number;
    status?: FactStatus;
    i: number;
  }[];
  if (pts.length < 2) return <span className="text-xs text-faint">{pts.length ? "Single year" : "Not available"}</span>;
  const vals = pts.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1);
  const y = (v: number) => H - P - ((v - lo) / span) * (H - 2 * P);
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden className="block text-muted">
      <polyline
        points={pts.map((p) => `${x(p.i)},${y(p.value)}`).join(" ")}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <circle cx={x(last.i)} cy={y(last.value)} r="2.75" fill={last.status ? DOT[last.status] : "currentColor"} />
    </svg>
  );
}

interface Direction {
  label: string;
  href: string;
  range: string;
  points: { value: number | null; status?: FactStatus }[];
  from: ReactNode;
  to: ReactNode;
  dir: TrendDir;
}

function factRow(facts: FactT[], key: string, label: string, href: string): Direction {
  const s = series(facts, key).filter((p) => p.fact);
  const first = s[0];
  const last = s.at(-1);
  return {
    label,
    href,
    range: first && last && first !== last ? `${first.period} → ${last.period}` : (last?.period ?? ""),
    points: s.map((p) => ({ value: p.value, status: p.fact?.status })),
    from: first && first !== last ? <Num fact={first.fact} /> : <span className="text-faint">Not available</span>,
    to: <Num fact={last?.fact} />,
    dir: trend(s.map((p) => p.value)),
  };
}

export default async function OverviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst, facts } = profile;
  const base = `/institutions/${inst.id}`;

  const capacity = pick(facts, "capacity.total");
  const students = latest(facts, "students.total");
  const admissions = latest(facts, "admissions.total");
  const placement = latest(facts, "placement.rate");
  const fee = latest(facts, "fee.average");

  const util = utilisationSeries(facts).filter(
    (u): u is { period: string; derived: NonNullable<typeof u.derived> } => u.derived !== null,
  );
  const uFirst = util[0];
  const uLast = util.at(-1);
  const uDir = trend(util.map((u) => u.derived.value));

  const available =
    capacity?.valueNum != null && students?.valueNum != null ? capacity.valueNum - students.valueNum : null;

  // Most recent NIRF year across categories; best rank within that year.
  const nirf = NIRF_CATEGORIES.map((k) => latest(facts, k))
    .filter((f): f is FactT => !!f && f.valueNum !== null)
    .sort((a, b) => b.period.localeCompare(a.period) || a.valueNum! - b.valueNum!)[0];

  const ugc = pick(facts, "ugc.status");
  const aicte = pick(facts, "aicte.status");
  const naac = pick(facts, "naac.grade");
  const naacUntil = pick(facts, "naac.validUntil");
  const affiliation = pick(facts, "affiliation.status");

  const flags = deriveFlags(profile);
  const open = flags.filter((f) => f.band !== "VERIFIED");
  const critical = open.filter((f) => f.band === "CRITICAL").length;

  // Verdict, computed from the evidence held.
  const latestAdm = uLast ? pick(facts, "admissions.total", uLast.period) : undefined;
  const utilClause: ReactNode = !uLast ? (
    <>Seat utilisation cannot be computed from the evidence held</>
  ) : uFirst && uFirst !== uLast && uDir === "down" ? (
    <>
      Seat utilisation fell from <Derived value={uFirst.derived.value} unit="percent" basis={uFirst.derived.basis} /> to{" "}
      <Derived value={uLast.derived.value} unit="percent" basis={uLast.derived.basis} />
    </>
  ) : uFirst && uFirst !== uLast && uDir === "up" ? (
    <>
      Seat utilisation rose to <Derived value={uLast.derived.value} unit="percent" basis={uLast.derived.basis} />
    </>
  ) : (
    <>
      Seat utilisation holds at <Derived value={uLast.derived.value} unit="percent" basis={uLast.derived.basis} />
    </>
  );
  const proofClause = !latestAdm
    ? ""
    : latestAdm.status === "VERIFIED"
      ? " on verified counts"
      : `, but ${uLast!.period} rests on the ${latestAdm.sourceType === "INSTITUTION" ? "college's own claim" : "unverified figures"}`;
  const flagSentence =
    critical > 0
      ? `${say(critical)} critical ${critical === 1 ? "flag needs" : "flags need"} review before any next step.`
      : open.length > 0
        ? `${say(open.length)} ${open.length === 1 ? "point needs" : "points need"} attention; nothing critical.`
        : "No rule-based flags are open on the evidence held.";

  const hostel = periods(facts, "hostel.occupancy").map((p) => {
    const occ = pick(facts, "hostel.occupancy", p);
    const cap = pick(facts, "hostel.capacity", p);
    return {
      period: p,
      value: occ?.valueNum != null && cap?.valueNum ? (occ.valueNum / cap.valueNum) * 100 : null,
      basis: [occ, cap].filter((f): f is FactT => !!f),
    };
  });
  const hFirst = hostel.find((h) => h.value !== null);
  const hLast = hostel.filter((h) => h.value !== null).at(-1);

  const directions: Direction[] = [
    {
      label: "Seat utilisation",
      href: `${base}/admissions`,
      range: uFirst && uLast && uFirst !== uLast ? `${uFirst.period} → ${uLast.period}` : (uLast?.period ?? ""),
      points: util.map((u) => ({
        value: u.derived.value,
        status: weakestStatus(u.derived.basis),
      })),
      from:
        uFirst && uFirst !== uLast ? (
          <Derived value={uFirst.derived.value} unit="percent" basis={uFirst.derived.basis} />
        ) : (
          <span className="text-faint">Not available</span>
        ),
      to: <Derived value={uLast?.derived.value} unit="percent" basis={uLast?.derived.basis ?? []} />,
      dir: uDir,
    },
    factRow(facts, "admissions.total", "New admissions", `${base}/admissions`),
    factRow(facts, "placement.rate", "Placement rate", `${base}/placements`),
    factRow(facts, "fee.average", "Average fee", `${base}/commercial`),
    {
      label: "Hostel occupancy",
      href: `${base}/campus`,
      range: hFirst && hLast && hFirst !== hLast ? `${hFirst.period} → ${hLast.period}` : (hLast?.period ?? ""),
      points: hostel.map((h) => ({ value: h.value })),
      from:
        hFirst && hFirst !== hLast ? (
          <Derived value={hFirst.value} unit="percent" basis={hFirst.basis} />
        ) : (
          <span className="text-faint">Not available</span>
        ),
      to: <Derived value={hLast?.value} unit="percent" basis={hLast?.basis ?? []} />,
      dir: trend(hostel.map((h) => h.value)),
    },
  ];

  const standing: { label: string; fact: FactT | undefined; extra?: ReactNode }[] = [
    { label: "UGC recognition", fact: ugc },
    { label: "AICTE approval", fact: aicte },
    {
      label: "NAAC grade",
      fact: naac,
      extra: naacUntil ? (
        <span className="text-muted">
          valid until <Num fact={naacUntil} unit="date" />
        </span>
      ) : null,
    },
    { label: "University affiliation", fact: affiliation },
  ];

  const stage = DEAL_STAGES.find((s) => s.key === inst.stage)?.label ?? inst.stage;
  const record: [string, string][] = [
    ["Ownership", inst.ownership],
    ["Affiliating university", inst.university],
    ["Established", inst.established ? String(inst.established) : ""],
    ["AISHE code", inst.aisheCode],
    ["Campus status", inst.campusStatus],
  ];

  return (
    <div className="space-y-14">
      <header>
        <Kicker>Overview{uLast ? ` · AY ${uLast.period}` : ""}</Kicker>
        <h2 className="display mt-3 max-w-3xl text-[26px] leading-[1.25] text-ink sm:text-[30px]">
          {utilClause}
          {proofClause}. <span className="text-muted">{flagSentence}</span>
        </h2>

        <StatRow className="mt-10">
          <Stat label="Seat utilisation" size="lg" sub={uLast?.period}>
            <Derived value={uLast?.derived.value} unit="percent" basis={uLast?.derived.basis ?? []} />
          </Stat>
          <Stat
            label="Capacity"
            sub={
              available !== null ? (
                <>
                  <Derived value={available} unit="count" basis={[capacity, students].filter((f): f is FactT => !!f)} />{" "}
                  seats free
                </>
              ) : undefined
            }
          >
            <Num fact={capacity} />
          </Stat>
          <Stat label="Students" sub={students?.period}>
            <Num fact={students} />
          </Stat>
          <Stat label="New admissions" sub={admissions?.period}>
            <Num fact={admissions} />
          </Stat>
          <Stat label="Placement" sub={placement?.period}>
            <Num fact={placement} />
          </Stat>
          <Stat label="Average fee" sub={fee?.period}>
            <Num fact={fee} />
          </Stat>
        </StatRow>
      </header>

      <Section
        index="01"
        title="Regulatory standing"
        aside={
          <Link href={`${base}/accreditation`} className="hover:text-ink">
            Accreditation →
          </Link>
        }
      >
        <dl className="grid gap-x-12 text-[14px] md:grid-cols-2">
          {standing.map((r) => (
            <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
              <dt className="shrink-0 text-muted">{r.label}</dt>
              <dd className="flex flex-wrap items-baseline justify-end gap-x-2 text-right text-ink">
                <Num fact={r.fact} />
                {r.extra}
              </dd>
            </div>
          ))}
          <div className="flex items-baseline justify-between gap-4 border-b border-line py-2.5">
            <dt className="shrink-0 text-muted">NIRF</dt>
            <dd className="flex flex-wrap items-baseline justify-end gap-x-2 text-right text-ink">
              {nirf ? (
                <>
                  <Num fact={nirf} />
                  <span className="text-muted">
                    {(metric(nirf.metricKey)?.label ?? nirf.metricKey).replace(/^NIRF /, "")}, {nirf.period}
                  </span>
                </>
              ) : (
                <span className="text-muted">Not ranked</span>
              )}
            </dd>
          </div>
        </dl>
      </Section>

      <div className="grid gap-14 xl:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] xl:gap-12">
        <Section
          index="02"
          title="What needs attention"
          aside={
            open.length > 0 ? (
              <Link href={`${base}/risks`} className="hover:text-ink">
                All {open.length} in Risks →
              </Link>
            ) : null
          }
        >
          {open.length === 0 ? (
            <Empty>No rule-based flags on the evidence held. This is not a clearance.</Empty>
          ) : (
            <div>
              {open.slice(0, 4).map((f) => (
                <FlagCard key={f.id} flag={f} />
              ))}
            </div>
          )}
        </Section>

        <Section index="03" title="Direction of travel">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Measure</Th>
                  <Th className="hidden sm:table-cell">Shape</Th>
                  <Th num>From</Th>
                  <Th num>To</Th>
                  <Th num>
                    <span className="sr-only">Direction</span>
                  </Th>
                </tr>
              </thead>
              <tbody>
                {directions.map((d) => (
                  <tr key={d.label}>
                    <Td>
                      <Link href={d.href} className="text-ink hover:text-brand">
                        {d.label}
                      </Link>
                      <div className="font-mono text-[11px] text-faint">{d.range || "No periods recorded"}</div>
                    </Td>
                    <Td className="hidden sm:table-cell">
                      <Spark points={d.points} />
                    </Td>
                    <Td num>
                      <span className="text-muted">{d.from}</span>
                    </Td>
                    <Td num>{d.to}</Td>
                    <Td num>
                      <TrendArrow dir={d.dir} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>
      </div>

      <Section index="04" title="Manual judgement" aside="Entered by the diligence team. Not computed.">
        <div className="grid gap-y-8 sm:grid-cols-3 [&>*]:sm:border-l [&>*]:border-line [&>*]:sm:px-6 [&>*:first-child]:border-l-0 [&>*:first-child]:pl-0">
          <div>
            <div className="text-[12px] text-muted">Overall risk</div>
            <div
              className={`display mt-2 text-[30px] leading-none ${inst.overallRisk ? (JUDGEMENT_TONE[inst.overallRisk] ?? "text-ink") : "text-muted"}`}
            >
              {inst.overallRisk ? sentence(inst.overallRisk) : "Not available"}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{inst.overallRiskNote ?? "No note recorded."}</p>
          </div>
          <div>
            <div className="text-[12px] text-muted">Commercial opportunity</div>
            <div className={`display mt-2 text-[30px] leading-none ${inst.opportunity ? "text-ink" : "text-muted"}`}>
              {inst.opportunity ? sentence(inst.opportunity) : "Not available"}
            </div>
            <p className="mt-3 text-[13px] leading-relaxed text-muted">{inst.opportunityNote ?? "No note recorded."}</p>
          </div>
          <div>
            <div className="text-[12px] text-muted">Deal stage</div>
            <div className="display mt-2 text-[30px] leading-none text-ink">{stage}</div>
            <p className="mt-3 text-[13px] text-muted">
              Since <span className="tnum">{fmtDate(inst.stageUpdatedAt)}</span>
              <span className="mx-1.5 text-faint">·</span>
              <Link href={`${base}/notes`} className="text-brand hover:underline">
                Notes{profile.notes.length ? ` (${profile.notes.length})` : ""}
              </Link>
            </p>
          </div>
        </div>
      </Section>

      <div className="grid gap-x-12 gap-y-10 border-t border-line pt-6 text-[13px] md:grid-cols-2">
        <dl>
          {record.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 py-1">
              <dt className="text-faint">{k}</dt>
              <dd className={`text-right ${v ? "text-muted" : "text-faint"}`}>{v || "Not available"}</dd>
            </div>
          ))}
        </dl>
        <dl>
          {MODULES.map((m) => {
            const c = coverage(facts, m.key);
            return (
              <div key={m.key} className="flex items-center justify-between gap-4 py-1">
                <dt className="text-faint">{m.label}</dt>
                <dd className="flex items-center gap-3 text-muted">
                  <span className="tnum">
                    {c.verified} of {c.expected} verified
                  </span>
                  <span className="hidden h-1 w-16 overflow-hidden rounded-full bg-sunken sm:block">
                    <span className="block h-full bg-verified" style={{ width: `${c.pct}%` }} />
                  </span>
                </dd>
              </div>
            );
          })}
          <div className="pt-1 text-right">
            <Link href={`${base}/gaps`} className="text-faint hover:text-ink">
              Evidence gaps →
            </Link>
          </div>
        </dl>
      </div>
    </div>
  );
}
