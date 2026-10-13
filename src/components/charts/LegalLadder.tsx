import type { LegalRecordT, LegalStage, PromoterT } from "@/lib/types";
import { CRIMINAL_LADDER, LEGAL_STAGE_LABEL, OTHER_TRACKS } from "@/lib/metrics";
import { fmtDate } from "@/lib/facts";

const EMPTY = "No records found in the sources checked";

const STAGE_TONE: Record<LegalStage, string> = {
  COMPLAINT: "border-l-unavailable",
  FIR: "border-l-selfreported",
  CHARGE: "border-l-attention",
  PROSECUTION: "border-l-attention",
  CONVICTION: "border-l-critical",
  ACQUITTAL: "border-l-verified",
  CIVIL_DISPUTE: "border-l-brand",
  REGULATORY_ACTION: "border-l-attention",
  INSOLVENCY: "border-l-critical",
};

function RecordCard({ record, promoter }: { record: LegalRecordT; promoter: PromoterT | undefined }) {
  return (
    <article className={`rounded-md border border-l-4 border-line bg-surface p-2.5 text-sm ${STAGE_TONE[record.stage]}`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3">
        <h4 className="font-semibold text-ink">{record.title}</h4>
        <span className="tnum text-xs text-muted">{record.year}</span>
      </div>
      <div className="mt-0.5 text-xs text-muted">
        {record.forum}
        {promoter ? ` · concerns ${promoter.name}` : record.promoterId ? "" : " · concerns the institution"}
      </div>
      {record.summary ? <p className="mt-1 text-xs text-ink">{record.summary}</p> : null}
      <div className="mt-1.5 text-xs">
        <span className="text-muted">Current status: </span>
        <span className="font-medium text-ink">{record.currentStatus}</span>
      </div>
      <div className="mt-1 border-t border-line pt-1 text-[11px] text-muted">
        Source:{" "}
        {record.sourceUrl ? (
          <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="text-brand underline">
            {record.sourceName}
          </a>
        ) : (
          record.sourceName
        )}{" "}
        · as of <span className="tnum">{fmtDate(record.asOfDate)}</span>
      </div>
    </article>
  );
}

function Slot({ records, promoters }: { records: LegalRecordT[]; promoters: PromoterT[] }) {
  if (records.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-line bg-canvas px-2.5 py-2 text-xs text-muted">{EMPTY}</div>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {records.map((r) => (
        <RecordCard key={r.id} record={r} promoter={promoters.find((p) => p.id === r.promoterId)} />
      ))}
    </div>
  );
}

export function LegalLadder({ records, promoters }: { records: LegalRecordT[]; promoters: PromoterT[] }) {
  const at = (stage: LegalStage) => records.filter((r) => r.stage === stage).sort((a, b) => b.year - a.year);

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-md border border-line bg-canvas px-3 py-2 text-xs text-ink">
        A complaint, FIR, charge, prosecution, conviction, acquittal and civil dispute are different legal positions.
        Each record sits at the stage its cited source supports. Stages are not equivalent and are never added together.
      </p>

      {records.length === 0 ? <p className="text-sm font-medium text-ink">{EMPTY}.</p> : null}

      <section aria-label="Criminal track">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">Criminal track</h3>
        <ol className="mt-2">
          {CRIMINAL_LADDER.map((stage, i) => {
            const rows = at(stage);
            const last = i === CRIMINAL_LADDER.length - 1;
            return (
              <li key={stage} className="grid grid-cols-[1.5rem_7.5rem_1fr] gap-x-2">
                <div className="flex flex-col items-center" aria-hidden>
                  <span
                    className={`mt-1.5 h-3 w-3 shrink-0 rounded-full border-2 ${rows.length ? "border-ink bg-ink" : "border-line bg-surface"}`}
                  />
                  {last ? null : <span className="w-px grow bg-line" />}
                </div>
                <div className="pb-4 pt-0.5 text-sm font-medium text-ink">
                  {LEGAL_STAGE_LABEL[stage]}
                  {stage === "ACQUITTAL" ? (
                    <span className="block text-[11px] font-normal text-muted">An outcome, not a further step</span>
                  ) : null}
                </div>
                <div className="pb-4">
                  <Slot records={rows} promoters={promoters} />
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-label="Other tracks">
        <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted">
          Separate tracks · not part of the criminal ladder
        </h3>
        <div className="mt-2 grid gap-3 md:grid-cols-3">
          {OTHER_TRACKS.map((stage) => (
            <div key={stage} className="rounded-lg border border-line p-2.5">
              <div className="mb-2 text-sm font-medium text-ink">{LEGAL_STAGE_LABEL[stage]}</div>
              <Slot records={at(stage)} promoters={promoters} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
