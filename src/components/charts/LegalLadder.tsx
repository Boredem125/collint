import type { LegalRecordT, LegalStage, PromoterT } from "@/lib/types";
import { CRIMINAL_LADDER, LEGAL_STAGE_LABEL, OTHER_TRACKS } from "@/lib/metrics";
import { fmtDate } from "@/lib/facts";

const EMPTY = "No records found in the sources checked";

function Entry({ record, promoter }: { record: LegalRecordT; promoter: PromoterT | undefined }) {
  const concerns = promoter ? promoter.name : record.promoterId ? null : "The institution";
  return (
    <article className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-x-3 border-b border-line py-3 first:pt-0 last:border-b-0 last:pb-0">
      <span className="tnum pt-px font-mono text-[12px] text-muted">{record.year}</span>
      <div className="min-w-0">
        <h4 className="text-[14px] font-medium leading-snug text-ink">{record.title}</h4>
        <div className="mt-0.5 text-[12.5px] text-muted">
          {record.forum}
          {concerns ? <span className="text-faint"> · </span> : null}
          {concerns}
        </div>
        {record.summary ? <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{record.summary}</p> : null}
        <p className="mt-1.5 text-[13px] text-ink">
          <span className="text-muted">Status </span>
          {record.currentStatus}
        </p>
        <p className="mt-1 text-[11.5px] text-faint">
          {record.sourceUrl ? (
            <a href={record.sourceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
              {record.sourceName}
            </a>
          ) : (
            record.sourceName
          )}{" "}
          · as of <span className="tnum">{fmtDate(record.asOfDate)}</span>
        </p>
      </div>
    </article>
  );
}

function Entries({ records, promoters }: { records: LegalRecordT[]; promoters: PromoterT[] }) {
  return (
    <div>
      {records.map((r) => (
        <Entry key={r.id} record={r} promoter={promoters.find((p) => p.id === r.promoterId)} />
      ))}
    </div>
  );
}

function Node({ filled }: { filled: boolean }) {
  return filled ? (
    <span className="relative z-10 mt-[5px] block h-3 w-3 rounded-full border-2 border-ink bg-ink" />
  ) : (
    <span className="relative z-10 mt-[5px] block h-3 w-3 rounded-full border-[1.5px] border-line-strong bg-canvas" />
  );
}

export function LegalLadder({ records, promoters }: { records: LegalRecordT[]; promoters: PromoterT[] }) {
  const at = (stage: LegalStage) => records.filter((r) => r.stage === stage).sort((a, b) => b.year - a.year);

  return (
    <div>
      <p className="text-[12.5px] text-muted">
        Each record sits at the stage its source supports. Stages are not equivalent and are never added together.
      </p>

      {records.length === 0 ? <p className="display mt-4 text-[20px] text-ink">{EMPTY}.</p> : null}

      <div className="mt-8 grid gap-12 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section aria-label="Criminal track">
          <h3 className="mb-4 text-[12px] text-muted">Criminal track</h3>
          <ol>
            {CRIMINAL_LADDER.map((stage, i) => {
              const rows = at(stage);
              const last = i === CRIMINAL_LADDER.length - 1;
              const nextIsOutcome = CRIMINAL_LADDER[i + 1] === "ACQUITTAL";
              return (
                <li key={stage} className="grid grid-cols-[1.25rem_minmax(0,1fr)] gap-x-3 sm:grid-cols-[7rem_1.25rem_minmax(0,1fr)]">
                  <div className="hidden pb-7 pt-0.5 text-right sm:block">
                    <div className={`display text-[16px] leading-tight ${rows.length ? "text-ink" : "text-faint"}`}>
                      {LEGAL_STAGE_LABEL[stage]}
                    </div>
                    {stage === "ACQUITTAL" ? (
                      <div className="mt-0.5 text-[11px] leading-snug text-faint">An outcome, not a step</div>
                    ) : null}
                  </div>
                  <div className="relative flex justify-center" aria-hidden>
                    {last ? null : (
                      <span
                        className={`absolute bottom-0 top-[11px] left-1/2 -translate-x-1/2 ${
                          nextIsOutcome ? "border-l border-dashed border-line-strong" : "w-px bg-line-strong"
                        }`}
                      />
                    )}
                    <Node filled={rows.length > 0} />
                  </div>
                  <div className="min-w-0 pb-7">
                    <div className="mb-2 sm:hidden">
                      <span className={`display text-[16px] leading-tight ${rows.length ? "text-ink" : "text-faint"}`}>
                        {LEGAL_STAGE_LABEL[stage]}
                      </span>
                      {stage === "ACQUITTAL" ? (
                        <span className="ml-2 text-[11px] text-faint">An outcome, not a step</span>
                      ) : null}
                    </div>
                    {rows.length ? (
                      <Entries records={rows} promoters={promoters} />
                    ) : (
                      <span className="block text-[12.5px] text-faint sm:pt-1">None in sources checked</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-label="Separate tracks">
          <h3 className="mb-4 text-[12px] text-muted">Separate tracks, outside the criminal ladder</h3>
          <div className="space-y-8">
            {OTHER_TRACKS.map((stage) => {
              const rows = at(stage);
              return (
                <div key={stage} className="border-t border-line-strong pt-3">
                  <div className="mb-3 flex items-center gap-2.5">
                    <span
                      aria-hidden
                      className={`h-2.5 w-2.5 rounded-full ${
                        rows.length ? "bg-ink" : "border-[1.5px] border-line-strong bg-canvas"
                      }`}
                    />
                    <span className={`display text-[16px] ${rows.length ? "text-ink" : "text-faint"}`}>
                      {LEGAL_STAGE_LABEL[stage]}
                    </span>
                  </div>
                  {rows.length ? (
                    <Entries records={rows} promoters={promoters} />
                  ) : (
                    <span className="block text-[12.5px] text-faint">None in sources checked</span>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}
