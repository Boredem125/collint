import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { fmtDate } from "@/lib/facts";
import type { PromoterEntityT, PromoterT } from "@/lib/types";
import { Card, Empty, Label, PageHeader, Td, Th } from "@/components/ui";
import { LegalLadder } from "@/components/charts/LegalLadder";

const KIND_LABEL: Record<string, string> = {
  PERSON: "Individual",
  TRUST: "Trust",
  SOCIETY: "Society",
  COMPANY: "Company",
};

function Source({ name, url, date }: { name: string; url?: string | null; date: string }) {
  return (
    <span className="text-xs text-muted">
      {url ? (
        <a href={url} target="_blank" rel="noreferrer" className="text-brand underline">
          {name}
        </a>
      ) : (
        name
      )}
      {" · as of "}
      {fmtDate(date)}
    </span>
  );
}

function EntityTable({ rows }: { rows: { entity: PromoterEntityT; owner: PromoterT }[] }) {
  if (!rows.length) return <Empty>No related entities found in the sources checked</Empty>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr>
            <Th>Entity</Th>
            <Th>Linked to</Th>
            <Th>Relationship</Th>
            <Th>Source</Th>
            <Th>As of</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ entity, owner }) => (
            <tr key={entity.id} className="border-t border-line">
              <Td>{entity.name}</Td>
              <Td>{owner.name}</Td>
              <Td>{entity.relationship}</Td>
              <Td>{entity.sourceName}</Td>
              <Td>{fmtDate(entity.asOfDate)}</Td>
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Owner / Promoter due diligence"
        subtitle="Who controls the institution, what else they run, and what public records say"
      />

      <div className="rounded-lg border border-brand/30 bg-brand/5 px-4 py-3 text-sm text-ink">
        <strong className="font-semibold">Promoter diligence is reported separately and does not feed any college metric.</strong>{" "}
        Nothing on this page changes admissions, placement, accreditation, campus or commercial figures.
      </div>

      <Card title="Trust / society">
        {bodies.length ? (
          <div className="grid gap-4 md:grid-cols-2">
            {bodies.map((b) => (
              <div key={b.id} className="rounded-lg border border-line p-4">
                <div className="text-base font-semibold text-ink">{b.name}</div>
                <dl className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <Label>Kind</Label>
                    <dd>{KIND_LABEL[b.kind] ?? b.kind}</dd>
                  </div>
                  <div>
                    <Label>Established</Label>
                    <dd className="tnum">
                      {b.established ?? <span className="text-muted">Not available</span>}
                    </dd>
                  </div>
                  <div className="col-span-2">
                    <Label>Role</Label>
                    <dd>{b.role}</dd>
                  </div>
                </dl>
                <div className="mt-3 border-t border-line pt-2">
                  <Source name={b.sourceName} url={b.sourceUrl} date={b.asOfDate} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <Empty>Not available — no trust or society record in the sources checked</Empty>
        )}
      </Card>

      <Card title="People">
        {people.length ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr>
                  <Th>Name</Th>
                  <Th>Role</Th>
                  <Th>Source</Th>
                  <Th>As of</Th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.id} className="border-t border-line">
                    <Td>{p.name}</Td>
                    <Td>{p.role}</Td>
                    <Td>
                      {p.sourceUrl ? (
                        <a href={p.sourceUrl} target="_blank" rel="noreferrer" className="text-brand underline">
                          {p.sourceName}
                        </a>
                      ) : (
                        p.sourceName
                      )}
                    </Td>
                    <Td>{fmtDate(p.asOfDate)}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty>Not available — no individuals recorded in the sources checked</Empty>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Other educational institutions">
          <EntityTable rows={institutions} />
        </Card>
        <Card title="Other businesses">
          <EntityTable rows={businesses} />
        </Card>
      </div>

      <Card title="Legal and regulatory records">
        <p className="mb-4 rounded-lg border border-line bg-canvas px-3 py-2 text-xs text-muted">
          Only records from cited public sources are shown; absence of a record here is not a finding of no record.
        </p>
        <LegalLadder records={legal} promoters={promoters} />
      </Card>
    </div>
  );
}
