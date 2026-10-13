import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import {
  fmtDate,
  fmtFact,
  fmtNum,
  latest,
  periods,
  pick,
  series,
  trend,
  utilisation,
  utilisationSeries,
  weakestStatus,
  type TrendDir,
} from "@/lib/facts";
import { MODULES, NIRF_CATEGORIES, SOURCE_LABEL, STATUS_LABEL, metric, type Unit } from "@/lib/metrics";
import type { FactT } from "@/lib/types";
import { SampleBadge, TrendArrow } from "@/components/ui";
import { PrintButton } from "@/components/PrintButton";

const NA = <span className="text-muted">Not available</span>;

const TREND_WORD: Record<TrendDir, string> = {
  up: "Rising",
  flat: "Stable",
  down: "Falling",
  unknown: "Not available",
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid">
      <h2 className="border-b border-line pb-1 text-[11px] font-semibold uppercase tracking-wider text-brand">
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b border-dotted border-line py-1 text-[13px]">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right tnum">{children}</dd>
    </div>
  );
}

export default async function BriefPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst, facts } = profile;

  // Every fact printed on the brief is collected here and listed in the appendix.
  const used = new Map<string, FactT>();
  const track = (...fs: (FactT | undefined)[]) => fs.forEach((f) => f && used.set(f.id, f));

  // Print cannot hover, so source and status sit in plain text beside the number.
  const cite = (f: FactT | undefined, unit?: Unit): ReactNode => {
    if (!f) return NA;
    track(f);
    return (
      <span data-evidence={f.status}>
        <span className="font-semibold">{fmtFact(f, unit)}</span>{" "}
        <span className="text-[11px] text-muted">
          ({SOURCE_LABEL[f.sourceType]}, {STATUS_LABEL[f.status].toLowerCase()})
        </span>
      </span>
    );
  };

  const derived = (value: number | null, unit: Unit, basis: (FactT | undefined)[]): ReactNode => {
    const b = basis.filter((f): f is FactT => f !== undefined);
    if (value === null || !b.length) return NA;
    track(...b);
    const status = weakestStatus(b);
    return (
      <span data-evidence={status}>
        <span className="font-semibold">{fmtNum(value, unit)}</span>{" "}
        <span className="text-[11px] text-muted">(derived, {STATUS_LABEL[status].toLowerCase()} inputs)</span>
      </span>
    );
  };

  const capacity = pick(facts, "capacity.total");
  const students = latest(facts, "students.total");
  const admissions = latest(facts, "admissions.total");
  const intakeYear = periods(facts, "intake.approved").at(-1);
  const util = intakeYear ? utilisation(facts, intakeYear) : null;
  const placement = latest(facts, "placement.rate");
  const avgPackage = latest(facts, "placement.average");
  const avgFee = latest(facts, "fee.average");

  const potential =
    admissions?.valueNum != null && avgFee?.valueNum != null ? admissions.valueNum * avgFee.valueNum : null;
  const available =
    students?.valueNum != null && capacity?.valueNum != null ? capacity.valueNum - students.valueNum : null;

  const nirf = NIRF_CATEGORIES.map((k) => latest(facts, k)).filter((f): f is FactT => f !== undefined);

  const flags = deriveFlags(profile);
  const critical = flags.filter((f) => f.band === "CRITICAL");
  const attention = flags.filter((f) => f.band === "ATTENTION");

  const ends = (pts: { fact: FactT | undefined; value: number | null }[]) => {
    const v = pts.filter((p) => p.fact && p.value !== null);
    return v.length >= 2 ? [v[0].fact, v[v.length - 1].fact] : [];
  };
  const utilPts = utilisationSeries(facts).slice(-5);
  const ceo: { label: string; basis: string; dir: TrendDir; facts: (FactT | undefined)[] }[] = [
    {
      label: "Admissions",
      basis: "Seat utilisation",
      dir: trend(utilPts.map((p) => p.derived?.value ?? null)),
      facts: (() => {
        const v = utilPts.filter((p) => p.derived);
        return v.length >= 2 ? [...v[0].derived!.basis, ...v[v.length - 1].derived!.basis] : [];
      })(),
    },
    ...(
      [
        ["Placements", "Placement rate", "placement.rate"],
        ["Campus", "Pass percentage", "pass.rate"],
        ["Commercial", "Fee revenue", "revenue.total"],
      ] as const
    ).map(([label, basis, key]) => {
      const s = series(facts, key).slice(-5);
      return { label, basis, dir: trend(s.map((p) => p.value)), facts: ends(s) };
    }),
  ];
  ceo.forEach((c) => c.dir !== "unknown" && track(...c.facts));

  const naacUntil = pick(facts, "naac.validUntil");
  const naacExpired = naacUntil?.valueText ? new Date(naacUntil.valueText).getTime() < Date.now() : null;

  const appendix = [...used.values()].sort(
    (a, b) =>
      (metric(a.metricKey)?.module ?? "").localeCompare(metric(b.metricKey)?.module ?? "") ||
      a.metricKey.localeCompare(b.metricKey) ||
      b.period.localeCompare(a.period),
  );
  const generated = fmtDate(new Date().toISOString());

  return (
    <article className="mx-auto max-w-4xl rounded-lg border border-line bg-surface p-8 print:max-w-none print:border-0 print:p-0">
      <header className="flex items-start justify-between gap-4 border-b-2 border-brand pb-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">{inst.name.toUpperCase()} — EXECUTIVE PROFILE</h1>
          <p className="mt-1 text-[13px] text-muted">
            {inst.city}, {inst.state} · AISHE {inst.aisheCode} · {inst.ownership} · {inst.university} ·{" "}
            {inst.established ? `Est. ${inst.established}` : "Establishment year not available"} · {inst.campusStatus}
          </p>
          <p className="mt-1 text-[11px] text-muted">Generated on {generated}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-2">
          {inst.isSample ? <SampleBadge /> : null}
          <PrintButton />
        </div>
      </header>

      {inst.isSample ? (
        <p className="mt-2 text-[11px] font-semibold uppercase tracking-wide text-attention">
          SAMPLE — fictional institution and figures, for demonstration only
        </p>
      ) : null}

      <div className="mt-4 grid gap-x-8 gap-y-5 md:grid-cols-2 print:grid-cols-2">
        <Section title="Business snapshot">
          <dl>
            <Row label="Sanctioned capacity">{cite(capacity)}</Row>
            <Row label={`Total students${students ? ` (${students.period})` : ""}`}>{cite(students)}</Row>
            <Row label={`Admissions${admissions ? ` (${admissions.period})` : ""}`}>{cite(admissions)}</Row>
            <Row label={`Seat utilisation${intakeYear ? ` (${intakeYear})` : ""}`}>
              {derived(util?.value ?? null, "percent", util?.basis ?? [])}
            </Row>
            <Row label={`Placement rate${placement ? ` (${placement.period})` : ""}`}>{cite(placement)}</Row>
            <Row label={`Average package${avgPackage ? ` (${avgPackage.period})` : ""}`}>{cite(avgPackage)}</Row>
          </dl>
        </Section>

        <Section title="Regulatory">
          <dl>
            <Row label="NAAC grade">{cite(pick(facts, "naac.grade"))}</Row>
            <Row label="NAAC valid until">
              {cite(naacUntil)}
              {naacExpired ? <span className="ml-1 font-semibold text-critical">Expired</span> : null}
            </Row>
            <Row label="AICTE approval">{cite(pick(facts, "aicte.status"))}</Row>
            <Row label="UGC recognition">{cite(pick(facts, "ugc.status"))}</Row>
            <Row label="University affiliation">{cite(pick(facts, "affiliation.status"))}</Row>
            {nirf.length ? (
              nirf.map((f) => (
                <Row key={f.id} label={`${metric(f.metricKey)?.label ?? f.metricKey} (${f.period})`}>
                  {cite(f)}
                </Row>
              ))
            ) : (
              <Row label="NIRF rank">{NA}</Row>
            )}
          </dl>
        </Section>

        <Section title="Commercial opportunity">
          <dl>
            <Row label={`Average annual fee${avgFee ? ` (${avgFee.period})` : ""}`}>{cite(avgFee)}</Row>
            <Row label="Potential gross revenue (admissions × average fee)">
              {derived(potential, "inr", [admissions, avgFee])}
            </Row>
            <Row label="Capacity available (capacity − students)">
              {derived(available, "count", [capacity, students])}
            </Row>
            <Row label="Opportunity (manual assessment)">
              {inst.opportunity ? <span className="font-semibold">{inst.opportunity}</span> : NA}
            </Row>
          </dl>
          {inst.opportunityNote ? <p className="mt-1 text-[12px] text-muted">{inst.opportunityNote}</p> : null}
        </Section>

        <Section title="Key risks">
          <div className="space-y-2 text-[13px]">
            <div>
              <div className="font-semibold text-critical">Critical ({critical.length})</div>
              {critical.length ? (
                <ul className="list-disc pl-5">
                  {critical.map((f) => (
                    <li key={f.id}>{f.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No critical flags raised by the current rules</p>
              )}
            </div>
            <div>
              <div className="font-semibold text-attention">Attention ({attention.length})</div>
              {attention.length ? (
                <ul className="list-disc pl-5">
                  {attention.map((f) => (
                    <li key={f.id}>{f.title}</li>
                  ))}
                </ul>
              ) : (
                <p className="text-muted">No attention flags raised by the current rules</p>
              )}
            </div>
            <p className="text-[12px] text-muted">
              Overall risk (manual judgement):{" "}
              <span className="font-semibold text-ink">{inst.overallRisk ?? "Not available"}</span>
              {inst.overallRiskNote ? ` — ${inst.overallRiskNote}` : ""}
            </p>
          </div>
        </Section>
      </div>

      <div className="mt-5">
        <Section title="CEO view">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 print:grid-cols-4">
            {ceo.map((c) => (
              <div key={c.label} className="rounded border border-line p-2">
                <div className="text-[11px] uppercase tracking-wide text-muted">{c.label}</div>
                <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold">
                  <TrendArrow dir={c.dir} />
                  {c.dir === "unknown" ? null : TREND_WORD[c.dir]}
                </div>
                <div className="text-[11px] text-muted">{c.basis}, first to last recorded year</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-muted">
            Direction only, from the first and last recorded values over up to five years. No overall score is computed.
          </p>
        </Section>
      </div>

      <div className="mt-5 print:break-before-auto">
        <Section title="Source appendix">
          {appendix.length ? (
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-left text-muted">
                  {["Metric", "Period", "Value", "Source", "Date", "Status"].map((h) => (
                    <th key={h} scope="col" className="border-b border-line py-1 pr-2 font-medium">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appendix.map((f) => (
                  <tr key={f.id} className="border-b border-dotted border-line align-top">
                    <td className="py-1 pr-2">
                      {metric(f.metricKey)?.label ?? f.metricKey}
                      <span className="text-muted">
                        {" · "}
                        {MODULES.find((m) => m.key === metric(f.metricKey)?.module)?.label ?? "Other"}
                      </span>
                    </td>
                    <td className="py-1 pr-2 tnum">{f.period}</td>
                    <td className="py-1 pr-2 tnum">{fmtFact(f)}</td>
                    <td className="py-1 pr-2">
                      {SOURCE_LABEL[f.sourceType]}: {f.sourceName}
                    </td>
                    <td className="whitespace-nowrap py-1 pr-2 tnum">{fmtDate(f.asOfDate)}</td>
                    <td className="py-1">{STATUS_LABEL[f.status]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="text-[13px] text-muted">Not available — no facts recorded for this institution</p>
          )}
        </Section>
      </div>
    </article>
  );
}
