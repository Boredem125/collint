import type { CSSProperties, ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import {
  fmtDate,
  fmtFact,
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
import { DEAL_STAGES, MODULES, NIRF_CATEGORIES, SOURCE_LABEL, STATUS_LABEL, metric, type Unit } from "@/lib/metrics";
import type { FactStatus, FactT, Flag } from "@/lib/types";
import { TrendArrow } from "@/components/ui";
import { Derived, Num } from "@/components/evidence/Evidence";
import { PrintButton } from "@/components/PrintButton";

// The memo is paper whatever the app theme, on screen and in print.
const PAPER = {
  "--canvas": "#ffffff",
  "--surface": "#ffffff",
  "--sunken": "#f3f1ec",
  "--ink": "#141310",
  "--muted": "#5c574e",
  "--faint": "#8d877b",
  "--line": "#e2ddd2",
  "--line-strong": "#c4bba8",
  "--brand": "#2c40b8",
  "--verified": "#2d6a3e",
  "--selfreported": "#9a660c",
  "--validate": "#b44a1f",
  "--unavailable": "#9d978b",
  "--critical": "#a3202e",
  "--attention": "#b4540f",
  colorScheme: "light",
} as CSSProperties;

// A4 page, and only the memo survives printing: every sibling on the path up from it is hidden.
const PRINT_CSS = `
@page { size: A4; margin: 13mm 14mm 15mm; }
@media print {
  html, body { background: #fff !important; }
  main:has(#brief) { padding: 0 !important; max-width: none !important; }
  main *:has(#brief) { display: block !important; padding: 0 !important; margin: 0 !important; max-width: none !important; position: static !important; }
  main *:has(#brief) > :not(:has(#brief)):not(#brief) { display: none !important; }
  #brief { box-shadow: none !important; outline: 0 !important; border: 0 !important; padding: 0 !important; margin: 0 !important; max-width: none !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  #brief [data-evidence] { opacity: 1 !important; filter: none !important; }
  #brief .avoid-break { break-inside: avoid; }
}`;

const TONE: Record<FactStatus, string> = {
  VERIFIED: "text-verified",
  SELF_REPORTED: "text-selfreported",
  NEEDS_VALIDATION: "text-validate",
  UNAVAILABLE: "text-unavailable",
};

const TREND_WORD: Record<TrendDir, string> = {
  up: "Rising",
  flat: "Stable",
  down: "Falling",
  unknown: "Not available",
};

/** Print cannot hover, so every figure carries its evidence in plain text. */
function Evidence({ f }: { f: FactT }) {
  return (
    <span className="font-mono text-[9.5px] leading-tight text-faint">
      {SOURCE_LABEL[f.sourceType]}
      {f.period !== "current" ? ` · ${f.period}` : ""} · {fmtDate(f.asOfDate)} ·{" "}
      <span className={TONE[f.status]}>{STATUS_LABEL[f.status]}</span>
    </span>
  );
}

function DerivedEvidence({ basis }: { basis: FactT[] }) {
  const status = weakestStatus(basis);
  return (
    <span className="font-mono text-[9.5px] leading-tight text-faint">
      Derived from {basis.length} figures · weakest <span className={TONE[status]}>{STATUS_LABEL[status]}</span>
    </span>
  );
}

function Head({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <h3 className="flex items-baseline justify-between gap-3 border-b border-ink pb-1">
      <span className="display text-[15.5px] font-medium text-ink">{children}</span>
      {aside ? <span className="font-mono text-[10px] text-faint">{aside}</span> : null}
    </h3>
  );
}

function Row({
  label,
  value,
  evidence,
  note,
}: {
  label: ReactNode;
  value: ReactNode;
  evidence?: ReactNode;
  note?: ReactNode;
}) {
  return (
    <div className="avoid-break grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 border-b border-line py-[5px]">
      <dt className="text-[12px] leading-snug text-muted">{label}</dt>
      <dd className="text-right text-[13px] font-medium text-ink">{value}</dd>
      {evidence ? <dd className="col-span-2 text-right">{evidence}</dd> : null}
      {note ? <dd className="col-span-2 pt-1 text-[12px] font-normal leading-snug text-muted">{note}</dd> : null}
    </div>
  );
}

function FlagList({ flags, tone, empty }: { flags: Flag[]; tone: string; empty: string }) {
  if (!flags.length) return <p className="py-1 text-[12px] text-muted">{empty}</p>;
  return (
    <ul>
      {flags.map((f) => (
        <li key={f.id} className="avoid-break relative border-b border-line py-1.5 pl-3 text-[12.5px] leading-snug text-ink">
          <span aria-hidden className={`absolute bottom-2 left-0 top-2 w-[2px] ${tone}`} />
          {f.title}
        </li>
      ))}
    </ul>
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

  const factRow = (label: string, f: FactT | undefined, extra?: ReactNode) => {
    track(f);
    return (
      <Row
        key={label}
        label={label}
        value={
          <>
            <Num fact={f} />
            {extra}
          </>
        }
        evidence={f ? <Evidence f={f} /> : null}
      />
    );
  };

  const derivedRow = (label: string, value: number | null, unit: Unit, basis: (FactT | undefined)[]) => {
    const b = basis.filter((f): f is FactT => f !== undefined);
    const ok = value !== null && b.length === basis.length;
    if (ok) track(...b);
    return (
      <Row
        label={label}
        value={<Derived value={ok ? value : null} unit={unit} basis={b} />}
        evidence={ok ? <DerivedEvidence basis={b} /> : null}
      />
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

  const stage = DEAL_STAGES.find((s) => s.key === inst.stage)?.label ?? inst.stage;
  const decision = profile.notes.find((n) => n.kind === "DECISION");

  // Hero figures are tracked before the appendix is built.
  const heroes: { label: string; value: ReactNode; evidence: ReactNode }[] = [
    {
      label: `Students${students ? `, ${students.period}` : ""}`,
      value: <Num fact={students} />,
      evidence: students ? <Evidence f={students} /> : null,
    },
    {
      label: `Admissions${admissions ? `, ${admissions.period}` : ""}`,
      value: <Num fact={admissions} />,
      evidence: admissions ? <Evidence f={admissions} /> : null,
    },
    {
      label: `Seat utilisation${intakeYear ? `, ${intakeYear}` : ""}`,
      value: <Derived value={util?.value} unit="percent" basis={util?.basis ?? []} />,
      evidence: util ? <DerivedEvidence basis={util.basis} /> : null,
    },
    {
      label: `Placement rate${placement ? `, ${placement.period}` : ""}`,
      value: <Num fact={placement} />,
      evidence: placement ? <Evidence f={placement} /> : null,
    },
  ];
  track(students, admissions, placement, ...(util?.basis ?? []));

  const snapshot = [
    factRow("Sanctioned capacity", capacity),
    factRow(`Average package${avgPackage ? ` (${avgPackage.period})` : ""}`, avgPackage),
    factRow(`Average annual fee${avgFee ? ` (${avgFee.period})` : ""}`, avgFee),
  ];
  const regulatory = [
    factRow("NAAC grade", pick(facts, "naac.grade")),
    factRow(
      "NAAC valid until",
      naacUntil,
      naacExpired ? <span className="ml-1.5 text-[11px] font-semibold text-critical">Expired</span> : null,
    ),
    factRow("AICTE approval", pick(facts, "aicte.status")),
    factRow("UGC recognition", pick(facts, "ugc.status")),
    factRow("University affiliation", pick(facts, "affiliation.status")),
    ...(nirf.length
      ? nirf.map((f) => factRow(`${metric(f.metricKey)?.label ?? f.metricKey} (${f.period})`, f))
      : [<Row key="nirf" label="NIRF rank" value={<Num fact={undefined} />} />]),
  ];

  const appendix = [...used.values()].sort(
    (a, b) =>
      MODULES.findIndex((m) => m.key === metric(a.metricKey)?.module) -
        MODULES.findIndex((m) => m.key === metric(b.metricKey)?.module) ||
      a.metricKey.localeCompare(b.metricKey) ||
      b.period.localeCompare(a.period),
  );
  const generated = fmtDate(new Date().toISOString());

  return (
    <div>
      <style dangerouslySetInnerHTML={{ __html: PRINT_CSS }} />

      <div className="no-print mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">One-page memo. Prints on A4 in light colours with the source of every figure.</p>
        <PrintButton />
      </div>

      <article
        id="brief"
        style={PAPER}
        className="mx-auto max-w-[210mm] bg-canvas px-5 py-7 text-ink shadow-sm outline outline-1 outline-line sm:px-[13mm] sm:py-[12mm]"
      >
        <header className="flex items-end justify-between gap-4 border-b-2 border-ink pb-2">
          <span className="display text-[26px] font-semibold italic leading-none tracking-tight">Collint</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            Executive brief · {generated}
          </span>
        </header>
        <div className="mt-1 flex justify-between font-mono text-[9.5px] uppercase tracking-[0.12em] text-faint">
          <span>Partnership diligence · confidential</span>
          <span>AISHE {inst.aisheCode}</span>
        </div>

        {inst.isSample ? (
          <p className="mt-4 border-y border-dashed border-selfreported py-1 text-center font-mono text-[10px] uppercase tracking-[0.12em] text-selfreported">
            Sample · fictional institution and figures, for demonstration only
          </p>
        ) : null}

        <div className="mt-6">
          <div className="font-mono text-[10px] uppercase tracking-[0.12em] text-faint">Stage · {stage}</div>
          <h1 className="display mt-1.5 text-[34px] font-medium leading-[1.05] sm:text-[40px]">{inst.name}</h1>
          <p className="mt-2 text-[12.5px] text-muted">
            {inst.city}, {inst.state} · {inst.ownership} · {inst.university} ·{" "}
            {inst.established ? `Est. ${inst.established}` : "Establishment year not available"} · {inst.campusStatus}
          </p>
        </div>

        <section className="mt-6 grid grid-cols-2 border-y border-line-strong sm:grid-cols-4 print:grid-cols-4">
          {heroes.map((h, i) => (
            <div
              key={h.label}
              className={`avoid-break border-line py-3.5 pr-3 ${i % 2 ? "border-l pl-3" : "pl-0"} ${i ? "sm:border-l sm:pl-3 print:border-l print:pl-3" : ""}`}
            >
              <div className="text-[11.5px] text-muted">{h.label}</div>
              <div className="display mt-1.5 text-[30px] leading-none">{h.value}</div>
              <div className="mt-1.5 min-h-[12px]">{h.evidence}</div>
            </div>
          ))}
        </section>

        <div className="mt-7 grid gap-x-9 gap-y-7 md:grid-cols-2 print:grid-cols-2">
          <div className="space-y-7">
            <section>
              <Head aside={`${critical.length} critical · ${attention.length} attention`}>Key risks</Head>
              <div className="mt-2">
                <div className="text-[11.5px] font-medium text-critical">Critical</div>
                <FlagList flags={critical} tone="bg-critical" empty="No critical flags raised by the current rules" />
                <div className="mt-3 text-[11.5px] font-medium text-attention">Attention</div>
                <FlagList flags={attention} tone="bg-attention" empty="No attention flags raised by the current rules" />
              </div>
            </section>

            <section>
              <Head aside="first to last recorded year">CEO view</Head>
              <dl className="mt-1">
                {ceo.map((c) => (
                  <Row
                    key={c.label}
                    label={
                      <>
                        <span className="text-ink">{c.label}</span>
                        <span className="text-faint"> · {c.basis}</span>
                      </>
                    }
                    value={
                      <span className="inline-flex items-center gap-1.5">
                        <TrendArrow dir={c.dir} />
                        {c.dir === "unknown" ? null : TREND_WORD[c.dir]}
                      </span>
                    }
                  />
                ))}
              </dl>
              <p className="mt-1.5 text-[10.5px] text-faint">Direction only, over up to five years. No overall score.</p>
            </section>

            <section>
              <Head>Manual judgement</Head>
              <dl className="mt-1">
                <Row
                  label="Overall risk"
                  value={inst.overallRisk ?? <span className="font-normal text-muted">Not available</span>}
                  note={inst.overallRiskNote}
                />
                <Row
                  label="Opportunity"
                  value={inst.opportunity ?? <span className="font-normal text-muted">Not available</span>}
                  note={inst.opportunityNote}
                />
              </dl>
            </section>

            <section>
              <Head aside={`since ${fmtDate(inst.stageUpdatedAt)}`}>Deal stage</Head>
              <div className="mt-2 flex items-baseline gap-2">
                <span className="display text-[20px] leading-none">{stage}</span>
              </div>
              {decision ? (
                <blockquote className="mt-2 border-l-2 border-line-strong pl-3 text-[12px] leading-snug text-muted">
                  {decision.body}
                  <span className="mt-0.5 block font-mono text-[9.5px] text-faint">Decision · {fmtDate(decision.createdAt)}</span>
                </blockquote>
              ) : (
                <p className="mt-1.5 text-[12px] text-muted">No decision recorded</p>
              )}
            </section>
          </div>

          <div className="space-y-7">
            <section>
              <Head>Snapshot</Head>
              <dl className="mt-1">
                {snapshot}
                {derivedRow("Capacity available (capacity − students)", available, "count", [capacity, students])}
              </dl>
            </section>

            <section>
              <Head aside="admissions × average fee">Commercial</Head>
              <dl className="mt-1">
                {derivedRow("Potential gross revenue", potential, "inr", [admissions, avgFee])}
              </dl>
            </section>

            <section>
              <Head>Regulatory standing</Head>
              <dl className="mt-1">{regulatory}</dl>
            </section>
          </div>
        </div>

        <section className="mt-9">
          <Head aside={`${appendix.length} facts`}>Source appendix</Head>
          {appendix.length ? (
            <table className="mt-1 w-full border-collapse text-[10px] leading-snug">
              <thead>
                <tr className="text-left text-faint">
                  {["Metric", "Period", "Value", "Source", "As of", "Status"].map((h, i) => (
                    <th
                      key={h}
                      scope="col"
                      className={`border-b border-line-strong py-1 pr-2 font-normal last:pr-0 ${i > 3 ? "hidden sm:table-cell print:table-cell" : ""}`}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {appendix.map((f) => (
                  <tr key={f.id} className="avoid-break align-baseline">
                    <td className="border-b border-line py-[3px] pr-2 text-ink">{metric(f.metricKey)?.label ?? f.metricKey}</td>
                    <td className="whitespace-nowrap border-b border-line py-[3px] pr-2 font-mono text-muted">{f.period}</td>
                    <td className="tnum whitespace-nowrap border-b border-line py-[3px] pr-2 text-ink">{fmtFact(f)}</td>
                    <td className="border-b border-line py-[3px] pr-2 text-muted">
                      <span className="break-words">
                        {SOURCE_LABEL[f.sourceType]}: {f.sourceName}
                      </span>
                      <span className={`block sm:hidden print:hidden ${TONE[f.status]}`}>
                        {STATUS_LABEL[f.status]} · <span className="font-mono text-muted">{fmtDate(f.asOfDate)}</span>
                      </span>
                    </td>
                    <td className="hidden whitespace-nowrap border-b border-line py-[3px] pr-2 font-mono text-muted sm:table-cell print:table-cell">
                      {fmtDate(f.asOfDate)}
                    </td>
                    <td className={`hidden whitespace-nowrap border-b border-line py-[3px] sm:table-cell print:table-cell ${TONE[f.status]}`}>
                      {STATUS_LABEL[f.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="mt-2 text-[12px] text-muted">Not available: no facts recorded for this institution</p>
          )}
        </section>

        <footer className="mt-6 flex justify-between border-t border-ink pt-1.5 font-mono text-[9px] uppercase tracking-[0.12em] text-faint">
          <span>Collint · {inst.name}</span>
          <span>Generated {generated}</span>
        </footer>
      </article>
    </div>
  );
}
