import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { fmtDate } from "@/lib/facts";
import { DEAL_STAGES } from "@/lib/metrics";
import type { NoteT } from "@/lib/types";
import { Kicker, Section } from "@/components/ui";
import { NoteForm, StageControl } from "@/components/NotesPanel";

export const dynamic = "force-dynamic";

const KIND: Record<NoteT["kind"], { label: string; mark: string; text: string }> = {
  NOTE: { label: "Note", mark: "h-1.5 w-1.5 rounded-full border border-muted", text: "text-muted" },
  STAGE_CHANGE: { label: "Stage", mark: "h-1.5 w-1.5 rotate-45 bg-muted", text: "text-muted" },
  DECISION: { label: "Decision", mark: "h-1.5 w-1.5 bg-ink", text: "font-medium text-ink" },
};

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export default async function NotesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst, notes } = profile;

  const stage = DEAL_STAGES.find((s) => s.key === inst.stage)?.label ?? inst.stage;
  const days = Math.max(0, Math.floor((Date.now() - new Date(inst.stageUpdatedAt).getTime()) / 86_400_000));
  const decision = notes.find((n) => n.kind === "DECISION");
  const headline =
    `In ${stage} for ${plural(days, "day")}` +
    (notes.length ? `; ${plural(notes.length, "entry", "entries")} on record, the latest on ${fmtDate(notes[0].createdAt)}.` : "; nothing recorded yet.");

  return (
    <div className="space-y-12">
      <header>
        <Kicker>Notes &amp; stage</Kicker>
        <h2 className="display mt-2 max-w-3xl text-[26px] font-medium leading-snug text-ink">
          {headline}
        </h2>
        {decision ? (
          <p className="mt-2 max-w-3xl text-[14px] text-muted">
            Last decision, {fmtDate(decision.createdAt)}: {decision.body}
          </p>
        ) : null}
      </header>

      <Section index="01" title="Deal stage" aside={`Since ${fmtDate(inst.stageUpdatedAt)}`}>
        <StageControl id={inst.id} current={inst.stage} />
      </Section>

      <Section index="02" title="Add to the record">
        <NoteForm id={inst.id} />
      </Section>

      <Section index="03" title="Timeline" aside={notes.length ? "Newest first" : undefined}>
        {notes.length === 0 ? (
          <p className="text-[14px] text-muted">No notes yet.</p>
        ) : (
          <ol>
            {notes.map((n) => {
              const k = KIND[n.kind] ?? KIND.NOTE;
              return (
                <li
                  key={n.id}
                  className="grid grid-cols-[96px_minmax(0,1fr)] gap-x-5 border-b border-line py-3.5 last:border-b-0 sm:grid-cols-[110px_88px_minmax(0,1fr)]"
                >
                  <time dateTime={n.createdAt} className="font-mono text-[11.5px] leading-6 text-muted">
                    {fmtDate(n.createdAt)}
                  </time>
                  <span className={`inline-flex items-center gap-2 text-[12.5px] leading-6 ${k.text}`}>
                    <span aria-hidden className={`inline-block shrink-0 ${k.mark}`} />
                    {k.label}
                  </span>
                  <p
                    className={`col-span-2 whitespace-pre-line text-[14px] leading-relaxed sm:col-span-1 ${
                      n.kind === "STAGE_CHANGE" ? "text-muted" : "text-ink"
                    }`}
                  >
                    {n.body}
                  </p>
                </li>
              );
            })}
          </ol>
        )}
      </Section>
    </div>
  );
}
