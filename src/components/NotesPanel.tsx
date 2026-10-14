"use client";

import { useActionState, useEffect, useState } from "react";
import { DEAL_STAGES } from "@/lib/metrics";
import type { DealStage } from "@/lib/types";
import { addNote, changeStage, type FormState } from "@/app/institutions/[id]/notes/actions";
import { Button } from "@/components/ui";

const INITIAL: FormState = { ok: false, at: 0 };

function Status({ state, done }: { state: FormState; done: string }) {
  if (!state.at) return null;
  return (
    <span role="status" className={`text-[12.5px] ${state.ok ? "text-verified" : "text-critical"}`}>
      {state.ok ? done : state.error}
    </span>
  );
}

export function StageControl({ id, current }: { id: string; current: DealStage }) {
  const [state, action, pending] = useActionState(changeStage.bind(null, id), INITIAL);
  const [picked, setPicked] = useState<DealStage>(current);

  // Follow the saved stage once the server has revalidated.
  useEffect(() => setPicked(current), [current]);

  const moving = picked !== current;
  return (
    <form action={action}>
      <input type="hidden" name="stage" value={picked} />
      <div
        role="radiogroup"
        aria-label="Deal stage"
        className="flex max-w-full flex-wrap gap-0.5 rounded-md border border-line-strong bg-surface p-0.5 sm:inline-flex sm:flex-nowrap sm:gap-0 sm:overflow-x-auto"
      >
        {DEAL_STAGES.map((s) => {
          const on = s.key === picked;
          return (
            <button
              key={s.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(s.key)}
              className={`min-h-10 whitespace-nowrap rounded-[5px] px-3 py-1.5 text-[13px] sm:min-h-0 sm:px-3.5 transition-colors ${
                on ? "bg-ink text-canvas" : "text-muted hover:bg-sunken hover:text-ink"
              }`}
            >
              {s.label}
              {s.key === current && !on ? <span className="ml-1.5 text-faint">·</span> : null}
            </button>
          );
        })}
      </div>
      {moving ? (
        <div className="mt-4 max-w-2xl">
          <label htmlFor="reason" className="text-[12px] text-muted">
            Reason for moving to {DEAL_STAGES.find((s) => s.key === picked)?.label} (optional)
          </label>
          <input
            id="reason"
            name="reason"
            maxLength={1000}
            defaultValue={state.ok ? "" : state.reason}
            key={state.at}
            className="mt-1 w-full rounded-md border border-line-strong bg-surface px-3 py-2 text-base text-ink sm:text-[14px] placeholder:text-faint focus:border-ink focus:outline-none"
            placeholder="e.g. Approvals verified; ready for commercial terms"
          />
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Button type="submit" variant="primary" disabled={pending} className="min-h-10 sm:min-h-0">
              {pending ? "Saving…" : "Move stage"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setPicked(current)} disabled={pending} className="min-h-10 sm:min-h-0">
              Cancel
            </Button>
            <Status state={state} done="Stage updated." />
          </div>
        </div>
      ) : (
        <div className="mt-2 min-h-5">
          <Status state={state} done="Stage updated." />
        </div>
      )}
    </form>
  );
}

export function NoteForm({ id }: { id: string }) {
  const [state, action, pending] = useActionState(addNote.bind(null, id), INITIAL);
  const [length, setLength] = useState(0);

  useEffect(() => {
    if (state.ok) setLength(0);
  }, [state]);

  return (
    <form action={action} className="max-w-2xl">
      <label htmlFor="note-body" className="sr-only">
        Note
      </label>
      <textarea
        id="note-body"
        name="body"
        rows={4}
        maxLength={4000}
        required
        key={state.at}
        defaultValue={state.ok ? "" : state.body}
        onChange={(e) => setLength(e.target.value.length)}
        placeholder="What did you learn, ask for, or decide?"
        className="w-full resize-y rounded-md border border-line-strong bg-surface px-3 py-2.5 text-base leading-relaxed sm:text-[14px] text-ink placeholder:text-faint focus:border-ink focus:outline-none"
      />
      <div className="mt-2.5 flex flex-wrap items-center gap-x-5 gap-y-2">
        <fieldset className="flex items-center gap-4 text-[13px] text-ink">
          <legend className="sr-only">Kind</legend>
          <label className="inline-flex min-h-10 items-center gap-1.5 sm:min-h-0">
            <input type="radio" name="kind" value="NOTE" defaultChecked className="accent-current" />
            Note
          </label>
          <label className="inline-flex min-h-10 items-center gap-1.5 sm:min-h-0">
            <input type="radio" name="kind" value="DECISION" className="accent-current" />
            Decision
          </label>
        </fieldset>
        <Button type="submit" variant="primary" disabled={pending} className="min-h-10 sm:min-h-0">
          {pending ? "Saving…" : "Add to record"}
        </Button>
        <Status state={state} done="Saved." />
        <span className="tnum ml-auto font-mono text-[11px] text-faint">{length}/4000</span>
      </div>
    </form>
  );
}
