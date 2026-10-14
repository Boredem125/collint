import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { coverage, fmtDate, latest, periods, pick } from "@/lib/facts";
import { NIRF_CATEGORIES, SOURCE_LABEL, metric } from "@/lib/metrics";
import { deriveFlags } from "@/lib/risk";
import type { FactT } from "@/lib/types";
import { Num } from "@/components/evidence/Evidence";
import { Kicker, Section, Empty, FlagCard, Th, Td } from "@/components/ui";
import { NirfTimeline } from "@/components/charts/NirfTimeline";

const STANDING = [
  "naac.grade",
  "naac.validUntil",
  "ugc.status",
  "aicte.status",
  "affiliation.status",
  "autonomous.status",
  "nba.programmes",
];

export default async function AccreditationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts } = profile;

  const ranked = NIRF_CATEGORIES.filter((k) => periods(facts, k).length > 0);
  const nirfYears = [...new Set(ranked.flatMap((k) => periods(facts, k)))].sort();
  const nirfRows = ranked.map((k) => ({
    category: metric(k)?.label ?? k,
    points: nirfYears.map((year) => ({ year, fact: pick(facts, k, year) })),
  }));
  const best = NIRF_CATEGORIES.map((k) => latest(facts, k))
    .filter((f): f is FactT => !!f && f.valueNum !== null)
    .sort((a, b) => b.period.localeCompare(a.period) || a.valueNum! - b.valueNum!)[0];

  const naacGrade = pick(facts, "naac.grade");
  const naacUntil = pick(facts, "naac.validUntil");
  const until = naacUntil?.valueText ? new Date(naacUntil.valueText) : null;
  const expired = until !== null && !Number.isNaN(until.getTime()) && until.getTime() < Date.now();

  const flags = deriveFlags(profile).filter((f) => f.module === "accreditation" && f.band !== "VERIFIED");
  const recognition = ["ugc.status", "aicte.status", "affiliation.status"].map((k) => pick(facts, k));
  const notCurrent = flags.filter((f) => f.id.startsWith("recognition-")).length;
  const allVerified = recognition.every((f) => f?.status === "VERIFIED");

  // Verdict, computed from the evidence held.
  const naacClause: ReactNode = !naacGrade ? (
    <>No NAAC grade is on record</>
  ) : expired ? (
    <>
      NAAC <Num fact={naacGrade} /> lapsed on <Num fact={naacUntil} unit="date" />
    </>
  ) : naacUntil ? (
    <>
      NAAC <Num fact={naacGrade} /> runs to <Num fact={naacUntil} unit="date" />
    </>
  ) : (
    <>
      NAAC <Num fact={naacGrade} />, validity not recorded
    </>
  );
  const recognitionClause =
    notCurrent > 0
      ? `${notCurrent === 1 ? "one recognition is" : `${notCurrent} recognitions are`} not current`
      : allVerified
        ? "UGC, AICTE and affiliation are all verified"
        : "recognition rests partly on unverified sources";
  const nirfClause: ReactNode = best ? (
    <>
      Best NIRF placing: <Num fact={best} /> in {(metric(best.metricKey)?.label ?? best.metricKey).replace(/^NIRF /, "")},{" "}
      {best.period}.
    </>
  ) : (
    <>Not ranked by NIRF in the years checked.</>
  );

  const cov = coverage(facts, "accreditation");

  return (
    <div className="space-y-14">
      <header>
        <Kicker>Ranking & accreditation</Kicker>
        <h2 className="display mt-3 max-w-3xl text-[21px] leading-[1.3] text-ink sm:text-[30px] sm:leading-[1.25]">
          {naacClause}; {recognitionClause}. <span className="text-muted">{nirfClause}</span>
        </h2>
      </header>

      <Section index="01" title="Standing" aside={flags.length ? `${flags.length} open` : undefined}>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <Th>Item</Th>
                <Th>Recorded</Th>
                <Th className="hidden sm:table-cell">Source</Th>
                <Th num className="hidden sm:table-cell">
                  As of
                </Th>
              </tr>
            </thead>
            <tbody>
              {STANDING.map((k) => {
                const f = pick(facts, k);
                return (
                  <tr key={k}>
                    <Td className="text-muted">{metric(k)?.label ?? k}</Td>
                    <Td>
                      <Num fact={f} />
                      {k === "naac.validUntil" && expired ? (
                        <span className="ml-2 font-mono text-[10px] uppercase tracking-[0.08em] text-attention">
                          Expired
                        </span>
                      ) : null}
                    </Td>
                    <Td className="hidden text-[12.5px] text-muted sm:table-cell">
                      {f ? `${SOURCE_LABEL[f.sourceType]} · ${f.sourceName}` : <span className="text-faint">Not available</span>}
                    </Td>
                    <Td num className="hidden font-mono text-[12px] text-muted sm:table-cell">
                      {f ? fmtDate(f.asOfDate) : <span className="text-faint">Not available</span>}
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {flags.length > 0 && (
          <div className="mt-6">
            {flags.map((f) => (
              <FlagCard key={f.id} flag={f} />
            ))}
          </div>
        )}
      </Section>

      <Section
        index="02"
        title="NIRF ranking"
        aside={nirfYears.length ? `${nirfYears[0]} to ${nirfYears.at(-1)}, by category` : undefined}
      >
        {nirfRows.length === 0 ? (
          <Empty>Not ranked in any category in the years checked.</Empty>
        ) : (
          <NirfTimeline rows={nirfRows} />
        )}
      </Section>

      <p className="border-t border-line pt-4 text-[12px] text-faint">
        <span className="tnum">
          {cov.verified} of {cov.expected}
        </span>{" "}
        expected accreditation metrics verified
        {cov.present > cov.verified ? `; ${cov.present - cov.verified} more reported but unverified` : ""}.
      </p>
    </div>
  );
}
