"use client";

import { useMemo, useState } from "react";
import type { Gap, GapKind } from "@/lib/gaps";
import { fmtDate } from "@/lib/facts";
import { Num } from "@/components/evidence/Evidence";
import { Button } from "@/components/ui";

const KIND: Record<GapKind, { label: string; text: string; mark: string }> = {
  MISSING: { label: "Missing", text: "text-muted", mark: "rounded-full border border-dashed border-muted" },
  UNVERIFIED: { label: "Unverified", text: "text-selfreported", mark: "rounded-full border-2 border-selfreported" },
  DISPUTED: { label: "Disputed", text: "text-critical", mark: "rounded-full bg-critical" },
};

const periodText = (p: string) => (p === "current" ? "current" : p);

function buildLetter(inst: { name: string; aisheCode: string; isSample: boolean }, groups: { source: string; gaps: Gap[] }[]) {
  const lines: string[] = [
    "DATA REQUEST",
    "",
    `To: The Principal and Management, ${inst.name}`,
    `AISHE code: ${inst.aisheCode}`,
    `Date: ${fmtDate(new Date().toISOString())}`,
  ];
  if (inst.isSample) lines.push("Note: sample data, fictional institution");
  lines.push(
    "",
    "Dear Sir or Madam,",
    "",
    "As part of our partnership diligence, please share the documents and figures below. Where a figure is already on our record, we only need the source document to confirm it.",
  );
  groups.forEach((g, i) => {
    lines.push("", `${i + 1}. ${g.source}`);
    g.gaps.forEach((gap, j) => {
      lines.push(`   ${i + 1}.${j + 1} ${gap.label}, ${periodText(gap.period)} (${KIND[gap.kind].label.toLowerCase()})`);
      lines.push(`        ${gap.request}`);
    });
  });
  lines.push(
    "",
    "Scanned copies or spreadsheet extracts are fine. We would be grateful for a response within 14 days.",
    "",
    "Regards,",
    "",
  );
  return lines.join("\n");
}

export default function RequestList({
  inst,
  groups,
}: {
  inst: { name: string; aisheCode: string; isSample: boolean };
  groups: { source: string; gaps: Gap[] }[];
}) {
  const allIds = useMemo(() => groups.flatMap((g) => g.gaps.map((x) => x.id)), [groups]);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(allIds));
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");

  const chosen = groups
    .map((g) => ({ source: g.source, gaps: g.gaps.filter((x) => selected.has(x.id)) }))
    .filter((g) => g.gaps.length);
  const n = chosen.reduce((a, g) => a + g.gaps.length, 0);

  const toggle = (ids: string[], on: boolean) =>
    setSelected((prev) => {
      const next = new Set(prev);
      ids.forEach((id) => (on ? next.add(id) : next.delete(id)));
      return next;
    });

  async function copy() {
    const text = buildLetter(inst, chosen);
    try {
      await navigator.clipboard.writeText(text);
      setCopied("done");
    } catch {
      setCopied("failed");
    }
    setTimeout(() => setCopied("idle"), 2200);
  }

  function download() {
    const blob = new Blob([buildLetter(inst, chosen)], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `data-request-${inst.aisheCode}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col">
      <div className="sticky bottom-[calc(60px+env(safe-area-inset-bottom))] z-10 order-last -mx-4 mt-8 flex flex-wrap items-center gap-x-4 gap-y-2 border-y border-line bg-canvas px-4 py-2.5 sm:top-14 sm:bottom-auto sm:order-none sm:-mx-1 sm:mb-8 sm:mt-0 sm:px-1">
        <span className="text-[13px] text-ink">
          <span className="tnum font-medium">{n}</span>
          <span className="text-muted"> of {allIds.length} selected for the request letter</span>
        </span>
        <span className="flex items-center gap-1 text-[12.5px]">
          <button type="button" onClick={() => toggle(allIds, true)} className="min-h-10 px-2 text-muted hover:text-ink sm:min-h-0 sm:px-1">
            All
          </button>
          <span className="text-faint">/</span>
          <button type="button" onClick={() => toggle(allIds, false)} className="min-h-10 px-2 text-muted hover:text-ink sm:min-h-0 sm:px-1">
            None
          </button>
        </span>
        <span className="flex w-full flex-wrap items-center justify-end gap-2 sm:ml-auto sm:w-auto sm:flex-nowrap">
          <span role="status" className="mr-auto text-[12.5px] text-muted sm:mr-0">
            {copied === "done" ? "Letter copied" : copied === "failed" ? "Copy blocked by the browser; use download" : ""}
          </span>
          <Button type="button" onClick={copy} disabled={!n} className="min-h-10 sm:min-h-0">
            Copy letter
          </Button>
          <Button type="button" variant="primary" onClick={download} disabled={!n} className="min-h-10 sm:min-h-0">
            Download .txt
          </Button>
        </span>
      </div>

      <div className="space-y-10">
        {groups.map((g) => {
          const ids = g.gaps.map((x) => x.id);
          const allOn = ids.every((id) => selected.has(id));
          return (
            <section key={g.source}>
              <header className="flex items-baseline justify-between gap-3 border-b-2 border-ink pb-2">
                <label className="flex min-h-10 cursor-pointer items-center gap-3 sm:min-h-0 sm:items-baseline">
                  <input
                    type="checkbox"
                    checked={allOn}
                    onChange={(e) => toggle(ids, e.target.checked)}
                    aria-label={`Select all requests for ${g.source}`}
                    className="h-6 w-6 shrink-0 accent-current sm:h-auto sm:w-auto sm:translate-y-px"
                  />
                  <span className="display text-[19px] font-medium text-ink">{g.source}</span>
                </label>
                <span className="font-mono text-[11px] text-faint">{g.gaps.length}</span>
              </header>
              <ul>
                {g.gaps.map((gap) => {
                  const k = KIND[gap.kind];
                  const on = selected.has(gap.id);
                  return (
                    <li
                      key={gap.id}
                      className={`grid grid-cols-[24px_minmax(0,1fr)] gap-x-3 border-b border-line py-3.5 sm:grid-cols-[20px_minmax(0,1fr)_auto] ${on ? "" : "opacity-55"}`}
                    >
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => toggle([gap.id], e.target.checked)}
                        aria-label={`Include ${gap.label} ${gap.period} in the request`}
                        className="h-6 w-6 accent-current sm:mt-1 sm:h-auto sm:w-auto"
                      />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
                          <span className="text-[14.5px] font-medium text-ink">{gap.label}</span>
                          <span className="font-mono text-[11px] text-muted">{periodText(gap.period)}</span>
                          <span className="text-[12px] text-faint">{gap.moduleLabel}</span>
                          <span className={`inline-flex items-center gap-1.5 text-[12px] ${k.text}`}>
                            <span aria-hidden className={`inline-block h-2 w-2 ${k.mark}`} />
                            {k.label}
                          </span>
                        </div>
                        <p className="mt-1 max-w-2xl text-[13px] leading-relaxed text-muted">{gap.request}</p>
                      </div>
                      <div className="col-start-2 mt-2 text-[13.5px] text-ink sm:col-start-3 sm:mt-0 sm:text-right [&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
                        {gap.kind === "DISPUTED" && gap.variance ? (
                          <span className="flex flex-col items-start gap-0.5 sm:items-end">
                            <span className="text-[11px] text-faint">Claim</span>
                            <Num fact={gap.variance.claimed} />
                            <span className="mt-1 text-[11px] text-faint">Independent</span>
                            <Num fact={gap.variance.verified} />
                          </span>
                        ) : gap.kind === "MISSING" ? (
                          <span className="flex flex-col items-start sm:items-end">
                            <Num fact={undefined} />
                            {gap.lastSeen ? (
                              <span className="font-mono text-[11px] text-faint">last on record {gap.lastSeen}</span>
                            ) : null}
                          </span>
                        ) : (
                          <Num fact={gap.fact} />
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
