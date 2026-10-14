"use client";

import { Fragment, useMemo, useState } from "react";
import type { FactStatus, FactT, ProgrammeT, SourceType } from "@/lib/types";
import { MODULES, SOURCE_LABEL, SOURCE_PRECEDENCE, STATUS_LABEL, metric, type ModuleKey } from "@/lib/metrics";
import { fmtDate, fmtFact } from "@/lib/facts";

const STATUSES: FactStatus[] = ["VERIFIED", "SELF_REPORTED", "NEEDS_VALIDATION", "UNAVAILABLE"];

const STATUS_TONE: Record<FactStatus, string> = {
  VERIFIED: "text-verified",
  SELF_REPORTED: "text-selfreported",
  NEEDS_VALIDATION: "text-validate",
  UNAVAILABLE: "text-unavailable",
};

// Same shapes as the evidence chip, so status never relies on colour alone.
export function StatusMark({ status }: { status: FactStatus }) {
  const base = "inline-block h-2 w-2 shrink-0";
  if (status === "VERIFIED") return <span aria-hidden className={`${base} rounded-full bg-verified`} />;
  if (status === "SELF_REPORTED") return <span aria-hidden className={`${base} rounded-full border-2 border-selfreported`} />;
  if (status === "NEEDS_VALIDATION") return <span aria-hidden className={`${base} rotate-45 bg-validate`} />;
  return <span aria-hidden className={`${base} rounded-full border border-dashed border-muted`} />;
}

// Quote every cell; neutralise leading characters a spreadsheet would run as a formula.
const csvCell = (v: string) => {
  const safe = /^[=+@]|^-(?!\d)/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

const control =
  "h-8 rounded-md border border-line bg-surface px-2 text-[13px] text-ink outline-none hover:border-line-strong focus-visible:border-line-strong";

export function FactLedger({ facts, programmes }: { facts: FactT[]; programmes: ProgrammeT[] }) {
  const [module, setModule] = useState<ModuleKey | "">("");
  const [source, setSource] = useState<SourceType | "">("");
  const [status, setStatus] = useState<FactStatus | "">("");
  const [q, setQ] = useState("");

  const progName = useMemo(() => new Map(programmes.map((p) => [p.id, p.name])), [programmes]);

  const rows = useMemo(
    () =>
      facts
        .map((f) => {
          const def = metric(f.metricKey);
          const modIdx = MODULES.findIndex((m) => m.key === def?.module);
          return {
            f,
            label: def?.label ?? f.metricKey,
            module: def?.module,
            modIdx: modIdx < 0 ? MODULES.length : modIdx,
            moduleLabel: MODULES[modIdx]?.label ?? "Other",
            programme: f.programmeId ? (progName.get(f.programmeId) ?? "Unknown programme") : "Institution",
            value: fmtFact(f),
          };
        })
        .sort(
          (a, b) =>
            a.modIdx - b.modIdx ||
            a.label.localeCompare(b.label) ||
            b.f.period.localeCompare(a.f.period) ||
            a.programme.localeCompare(b.programme) ||
            SOURCE_PRECEDENCE.indexOf(a.f.sourceType) - SOURCE_PRECEDENCE.indexOf(b.f.sourceType),
        ),
    [facts, progName],
  );

  // Everything except the status filter, so the segment counts answer "how many of these are verified".
  const scoped = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!module || r.module === module) &&
        (!source || r.f.sourceType === source) &&
        (!needle ||
          [r.label, r.f.metricKey, r.f.period, r.programme, r.value, r.f.sourceName, r.f.note ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [rows, module, source, q]);

  const shown = useMemo(() => (status ? scoped.filter((r) => r.f.status === status) : scoped), [scoped, status]);

  const groupSize = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of shown) m.set(r.moduleLabel, (m.get(r.moduleLabel) ?? 0) + 1);
    return m;
  }, [shown]);

  const counts = useMemo(() => {
    const c = { VERIFIED: 0, SELF_REPORTED: 0, NEEDS_VALIDATION: 0, UNAVAILABLE: 0 } as Record<FactStatus, number>;
    for (const r of scoped) c[r.f.status]++;
    return c;
  }, [scoped]);

  const exportCsv = () => {
    const head = [
      "Metric",
      "Metric key",
      "Module",
      "Period",
      "Programme",
      "Value",
      "Source type",
      "Source name",
      "Source URL",
      "As-of date",
      "Status",
      "Note",
    ];
    const lines = shown.map((r) =>
      [
        r.label,
        r.f.metricKey,
        r.moduleLabel,
        r.f.period,
        r.programme,
        r.value,
        SOURCE_LABEL[r.f.sourceType],
        r.f.sourceName,
        r.f.sourceUrl ?? "",
        fmtDate(r.f.asOfDate),
        STATUS_LABEL[r.f.status],
        r.f.note ?? "",
      ]
        .map(csvCell)
        .join(","),
    );
    // BOM so Excel reads the rupee sign as UTF-8.
    const blob = new Blob(["﻿" + [head.map(csvCell).join(","), ...lines].join("\r\n")], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "fact-ledger.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const filtered = !!(module || source || status || q.trim());
  const segments: { key: FactStatus | ""; label: string; n: number }[] = [
    { key: "", label: "All", n: scoped.length },
    ...STATUSES.map((s) => ({ key: s, label: STATUS_LABEL[s], n: counts[s] })),
  ];

  return (
    <div>
      <div className="no-print sticky top-14 z-20 -mx-1 border-b border-line bg-canvas/95 px-1 py-3 backdrop-blur">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <div role="group" aria-label="Filter by status" className="flex flex-wrap rounded-md border border-line bg-surface p-0.5">
            {segments.map((s) => {
              const active = status === s.key;
              return (
                <button
                  key={s.key || "all"}
                  type="button"
                  onClick={() => setStatus(s.key)}
                  aria-pressed={active}
                  className={`flex h-7 items-center gap-1.5 rounded-[5px] px-2.5 text-[12.5px] transition-colors ${
                    active ? "bg-ink text-canvas" : "text-muted hover:bg-sunken hover:text-ink"
                  }`}
                >
                  {s.key ? <StatusMark status={s.key} /> : null}
                  {s.label}
                  <span className={`tnum font-mono text-[11px] ${active ? "opacity-70" : "text-faint"}`}>{s.n}</span>
                </button>
              );
            })}
          </div>

          <select
            aria-label="Module"
            className={control}
            value={module}
            onChange={(e) => setModule(e.target.value as ModuleKey | "")}
          >
            <option value="">All modules</option>
            {MODULES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            aria-label="Source type"
            className={control}
            value={source}
            onChange={(e) => setSource(e.target.value as SourceType | "")}
          >
            <option value="">All sources</option>
            {SOURCE_PRECEDENCE.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
          <input
            type="search"
            aria-label="Search facts"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search metric, source, period, note"
            className={`${control} min-w-48 flex-1 placeholder:text-faint`}
          />
          <div className="flex items-center gap-2">
            {filtered ? (
              <button
                type="button"
                onClick={() => {
                  setModule("");
                  setSource("");
                  setStatus("");
                  setQ("");
                }}
                className="h-8 rounded-md px-2.5 text-[13px] text-muted hover:bg-sunken hover:text-ink"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={exportCsv}
              disabled={!shown.length}
              className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line-strong bg-surface px-3 text-[13px] font-medium text-ink hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40"
            >
              <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M8 2.5v8M4.5 7 8 10.5 11.5 7M3 13.5h10" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Export CSV
            </button>
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-baseline justify-between text-[12px] text-muted" aria-live="polite">
        <span className="tnum">
          {shown.length === facts.length ? `${facts.length} facts` : `${shown.length} of ${facts.length} facts`}
        </span>
        <span className="hidden sm:inline">Competing sources for one metric are listed as separate rows, best source first.</span>
      </div>

      <div className="mt-2 overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="text-left text-[12px] text-muted">
              <th scope="col" className="border-b border-line-strong py-2 pr-3 font-normal">Metric</th>
              <th scope="col" className="border-b border-line-strong px-3 py-2 font-normal">Period</th>
              <th scope="col" className="border-b border-line-strong px-3 py-2 text-right font-normal">Value</th>
              <th scope="col" className="border-b border-line-strong px-3 py-2 font-normal">Source</th>
              <th scope="col" className="border-b border-line-strong px-3 py-2 font-normal">As of</th>
              <th scope="col" className="border-b border-line-strong px-3 py-2 font-normal">Status</th>
              <th scope="col" className="border-b border-line-strong py-2 pl-3 font-normal">Note</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => {
              const newGroup = i === 0 || shown[i - 1].moduleLabel !== r.moduleLabel;
              const sameMetric =
                i > 0 && shown[i - 1].f.metricKey === r.f.metricKey && shown[i - 1].f.period === r.f.period && !newGroup;
              return (
                <Fragment key={r.f.id}>
                  {newGroup ? (
                    <tr>
                      <th
                        scope="rowgroup"
                        colSpan={7}
                        className="border-b border-line pb-1.5 pt-6 text-left font-mono text-[11px] font-normal uppercase tracking-[0.08em] text-faint"
                      >
                        {r.moduleLabel}
                        <span className="ml-2 tnum">{groupSize.get(r.moduleLabel)}</span>
                      </th>
                    </tr>
                  ) : null}
                  <tr className="align-baseline transition-colors hover:bg-sunken">
                    <td className="border-b border-line py-2 pr-3">
                      <div className={sameMetric ? "text-muted" : "text-ink"}>{r.label}</div>
                      <div className="font-mono text-[10.5px] text-faint">
                        {r.f.metricKey}
                        {r.f.programmeId ? <span className="font-sans text-[11.5px] text-muted"> · {r.programme}</span> : null}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2 font-mono text-[12px] text-muted">
                      {r.f.period}
                    </td>
                    <td
                      data-evidence={r.f.status}
                      className="tnum whitespace-nowrap border-b border-line px-3 py-2 text-right font-medium"
                    >
                      {r.f.status === "UNAVAILABLE" ? <span className="font-normal text-muted">{r.value}</span> : r.value}
                    </td>
                    <td className="border-b border-line px-3 py-2">
                      <div className="text-ink">{SOURCE_LABEL[r.f.sourceType]}</div>
                      <div className="max-w-[260px] text-[12px] text-muted">
                        {r.f.sourceUrl ? (
                          <a href={r.f.sourceUrl} target="_blank" rel="noreferrer" className="text-brand hover:underline">
                            {r.f.sourceName}
                          </a>
                        ) : (
                          r.f.sourceName
                        )}
                      </div>
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2 font-mono text-[12px] text-muted">
                      {fmtDate(r.f.asOfDate)}
                    </td>
                    <td className="whitespace-nowrap border-b border-line px-3 py-2">
                      <span className={`inline-flex items-center gap-1.5 text-[12.5px] ${STATUS_TONE[r.f.status]}`}>
                        <StatusMark status={r.f.status} />
                        {STATUS_LABEL[r.f.status]}
                      </span>
                    </td>
                    <td className="min-w-[180px] max-w-xs border-b border-line py-2 pl-3 text-[12px] leading-snug text-muted">
                      {r.f.note ?? ""}
                    </td>
                  </tr>
                </Fragment>
              );
            })}
            {!shown.length ? (
              <tr>
                <td colSpan={7} className="border-b border-dashed border-line py-10 text-center text-sm text-muted">
                  {facts.length ? "No facts match these filters" : "No facts recorded for this institution"}
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
