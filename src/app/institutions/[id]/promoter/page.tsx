import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { fmtDate } from "@/lib/facts";
import { CRIMINAL_LADDER, OTHER_TRACKS } from "@/lib/metrics";
import type { LegalRecordT, LegalStage, PromoterEntityT, PromoterT } from "@/lib/types";
import { Empty, Kicker, Section, Td, Th } from "@/components/ui";
import { LegalLadder } from "@/components/charts/LegalLadder";

const KIND_LABEL: Record<string, string> = {
  PERSON: "Individual",
  TRUST: "Trust",
  SOCIETY: "Society",
  COMPANY: "Company",
};

// Singular and plural phrasing per stage, so the summary names each stage on its own terms.
const STAGE_PHRASE: Record<LegalStage, [string, string]> = {
  COMPLAINT: ["a complaint", "complaints"],
  FIR: ["an FIR", "FIRs"],
  CHARGE: ["a charge", "charges"],
  PROSECUTION: ["a prosecution", "prosecutions"],
  CONVICTION: ["a conviction", "convictions"],
  ACQUITTAL: ["an acquittal", "acquittals"],
  CIVIL_DISPUTE: ["a civil dispute", "civil disputes"],
  REGULATORY_ACTION: ["a regulatory action", "regulatory actions"],
  INSOLVENCY: ["an insolvency proceeding", "insolvency proceedings"],
};

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine"];

function stageList(legal: LegalRecordT[]): string | null {
  const parts = [...CRIMINAL_LADDER, ...OTHER_TRACKS].flatMap((stage) => {
    const n = legal.filter((r) => r.stage === stage).length;
    if (!n) return [];
    const [one, many] = STAGE_PHRASE[stage];
    return [n === 1 ? one : `${WORDS[n] ?? n} ${many}`];
  });
  if (!parts.length) return null;
  return parts.length === 1 ? parts[0] : `${parts.slice(0, -1).join(", ")} and ${parts.at(-1)}`;
}

function SourceLine({ name, url, date }: { name: string; url?: string | null; date: string }) {
  return (
    <span className="text-[12px] text-faint">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-brand hover:underline">
          {name}
        </a>
      ) : (
        name
      )}
      {" · as of "}
      <span className="tnum">{fmtDate(date)}</span>
    </span>
  );
}

function EntityTable({ rows, empty }: { rows: { entity: PromoterEntityT; owner: PromoterT }[]; empty: string }) {
  if (!rows.length) return <Empty>{empty}</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr>
            <Th>Entity</Th>
            <Th className="hidden sm:table-cell">Linked to</Th>
            <Th>Relationship</Th>
            <Th className="hidden md:table-cell">Source</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entity, owner }) => (
            <tr key={entity.id}>
              <Td>
                {entity.name}
                <span className="mt-0.5 block text-[12px] text-muted sm:hidden">via {owner.name}</span>
              </Td>
              <Td className="hidden text-muted sm:table-cell">{owner.name}</Td>
              <Td className="text-muted">
                {entity.relationship}
                <span className="mt-0.5 block md:hidden">
                  <SourceLine name={entity.sourceName} date={entity.asOfDate} />
                </span>
              </Td>
              <Td className="hidden md:table-cell">
                <SourceLine name={entity.sourceName} date={entity.asOfDate} />
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PromoterPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();

  const { promoters, legal } = profile;
  const bodies = promoters.filter((p) => p.kind !== "PERSON");
  const people = promoters.filter((p) => p.kind === "PERSON");
  const entities = promoters.flatMap((owner) => owner.entities.map((entity) => ({ entity, owner })));
  const institutions = entities.filter((e) => e.entity.kind === "INSTITUTION");
  const businesses = entities.filter((e) => e.entity.kind !== "INSTITUTION");

  const controller = bodies[0]?.name ?? people[0]?.name;
  const stages = stageList(legal);

  return (
    <div className="space-y-14">
      <header>
        <Kicker>Owner and promoter</Kicker>
        <p className="display mt-3 max-w-3xl text-[21px] leading-[1.3] text-ink sm:text-[30px] sm:leading-[1.25]">
          {controller ? `${controller} controls the college` : "No controlling body is on record"}
          {stages ? (
            <>
              ; public records show {stages}
              {legal.length > 1 ? <span className="text-muted">, each at its own stage</span> : null}.
            </>
          ) : (
            <span className="text-muted">; no legal records were found in the sources checked.</span>
          )}
        </p>
        <p className="mt-3 text-[12.5px] text-muted">Reported separately. Nothing here feeds a college metric.</p>
      </header>

      <Section index="01" title="Controlling body">
        {bodies.length ? (
          <div className="grid gap-x-10 gap-y-8 md:grid-cols-2">
            {bodies.map((b) => (
              <div key={b.id}>
                <div className="display text-[22px] leading-snug text-ink">{b.name}</div>
                <div className="mt-1.5 text-[13.5px] text-muted">
                  {KIND_LABEL[b.kind] ?? b.kind}
                  <span className="text-faint"> · </span>
                  {b.established ? (
                    <span className="tnum">Est. {b.established}</span>
                  ) : (
                    <span>Established: not available</span>
                  )}
                </div>
                <p className="mt-2 text-[14px] leading-relaxed text-ink">{b.role}</p>
                <div className="mt-2">
                  <SourceLine name={b.sourceName} url={b.sourceUrl} date={b.asOfDate} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Not available: no trust or society record in the sources checked</Empty>
        )}
      </Section>

      <Section index="02" title="People">
        {people.length ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th className="hidden md:table-cell">Source</Th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id}>
                    <Td className="font-medium">
                      {p.name}
                      <span className="mt-0.5 block font-normal md:hidden">
                        <SourceLine name={p.sourceName} url={p.sourceUrl} date={p.asOfDate} />
                      </span>
                    </Td>
                    <Td className="text-muted">{p.role}</Td>
                    <Td className="hidden md:table-cell">
                      <SourceLine name={p.sourceName} url={p.sourceUrl} date={p.asOfDate} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Not available: no individuals recorded in the sources checked</Empty>
        )}
      </Section>

      <Section index="03" title="Linked entities">
        <div className="space-y-10">
          <div>
            <h3 className="mb-2 text-[12px] text-muted">Other educational institutions</h3>
            <EntityTable rows={institutions} empty="No related institutions found in the sources checked" />
          </div>
          <div>
            <h3 className="mb-2 text-[12px] text-muted">Other businesses</h3>
            <EntityTable rows={businesses} empty="No related businesses found in the sources checked" />
          </div>
        </div>
      </Section>

      <Section index="04" title="Legal and regulatory record">
        <LegalLadder records={legal} promoters={promoters} />
      </Section>
    </div>
  );
}
