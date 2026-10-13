"use client";

import { useMemo, useState } from "react";
import type { FactStatus, FactT, ProgrammeT, SourceType } from "@/lib/types";
import { MODULES, SOURCE_LABEL, SOURCE_PRECEDENCE, STATUS_LABEL, metric, type ModuleKey } from "@/lib/metrics";
import { fmtDate, fmtFact } from "@/lib/facts";
import { SourceBadge, StatusBadge } from "@/components/evidence/Evidence";

const STATUSES: FactStatus[] = ["VERIFIED", "SELF_REPORTED", "NEEDS_VALIDATION", "UNAVAILABLE"];

const STATUS_TONE: Record<FactStatus, string> = {
  VERIFIED: "text-verified",
  SELF_REPORTED: "text-selfreported",
  NEEDS_VALIDATION: "text-validate",
  UNAVAILABLE: "text-unavailable",
};

// Quote every cell; neutralise leading characters a spreadsheet would run as a formula.
const csvCell = (v: string) => {
  const safe = /^[=+@]|^-(?!\d)/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
};

const selectCls = "rounded border border-line bg-surface px-2 py-1.5 text-sm";

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
          return {
            f,
            label: def?.label ?? f.metricKey,
            module: def?.module,
            moduleLabel: MODULES.find((m) => m.key === def?.module)?.label ?? "Other",
            programme: f.programmeId ? (progName.get(f.programmeId) ?? "Unknown programme") : "Institution",
            value: fmtFact(f),
          };
        })
        .sort(
          (a, b) =>
            a.moduleLabel.localeCompare(b.moduleLabel) ||
            a.label.localeCompare(b.label) ||
            b.f.period.localeCompare(a.f.period) ||
            a.programme.localeCompare(b.programme),
        ),
    [facts, progName],
  );

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter(
      (r) =>
        (!module || r.module === module) &&
        (!source || r.f.sourceType === source) &&
        (!status || r.f.status === status) &&
        (!needle ||
          [r.label, r.f.metricKey, r.f.period, r.programme, r.value, r.f.sourceName, r.f.note ?? ""]
            .join(" ")
            .toLowerCase()
            .includes(needle)),
    );
  }, [rows, module, source, status, q]);

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

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {STATUSES.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setStatus(status === s ? "" : s)}
            aria-pressed={status === s}
            className={`rounded-lg border bg-surface p-3 text-left ${status === s ? "border-brand" : "border-line"}`}
          >
            <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{STATUS_LABEL[s]}</div>
            <div className={`mt-1 text-2xl font-semibold tnum ${STATUS_TONE[s]}`}>
              {facts.filter((f) => f.status === s).length}
            </div>
            <div className="text-xs text-muted">facts recorded</div>
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-line bg-surface p-3">
        <label className="flex flex-col gap-1 text-xs text-muted">
          Module
          <select className={selectCls} value={module} onChange={(e) => setModule(e.target.value as ModuleKey | "")}>
            <option value="">All modules</option>
            {MODULES.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Source type
          <select className={selectCls} value={source} onChange={(e) => setSource(e.target.value as SourceType | "")}>
            <option value="">All sources</option>
            {SOURCE_PRECEDENCE.map((s) => (
              <option key={s} value={s}>
                {SOURCE_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted">
          Status
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value as FactStatus | "")}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex min-w-48 flex-1 flex-col gap-1 text-xs text-muted">
          Search
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Metric, source, period, note"
            className={selectCls}
          />
        </label>
        {filtered ? (
          <button
            type="button"
            onClick={() => {
              setModule("");
              setSource("");
              setStatus("");
              setQ("");
            }}
            className="rounded border border-line px-3 py-1.5 text-sm text-muted hover:text-ink"
          >
            Clear
          </button>
        ) : null}
        <button
          type="button"
          onClick={exportCsv}
          disabled={!shown.length}
          className="rounded bg-brand px-3 py-1.5 text-sm font-medium text-white disabled:opacity-40"
        >
          Export CSV
        </button>
      </div>

      <div className="text-sm text-muted tnum" aria-live="polite">
        Showing {shown.length} of {facts.length} facts
      </div>

      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full text-sm">
          <thead className="bg-canvas text-left text-[11px] uppercase tracking-wide text-muted">
            <tr>
              {["Metric", "Module", "Period", "Programme", "Value", "Source type", "Source name", "As-of date", "Status", "Note"].map(
                (h) => (
                  <th key={h} scope="col" className={`whitespace-nowrap px-3 py-2 font-medium ${h === "Value" ? "text-right" : ""}`}>
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.f.id} className="border-t border-line align-top">
                <td className="px-3 py-2">
                  <div>{r.label}</div>
                  <div className="font-mono text-[11px] text-muted">{r.f.metricKey}</div>
                </td>
                <td className="whitespace-nowrap px-3 py-2">{r.moduleLabel}</td>
                <td className="whitespace-nowrap px-3 py-2 tnum">{r.f.period}</td>
                <td className="px-3 py-2">{r.programme}</td>
                <td className="whitespace-nowrap px-3 py-2 text-right font-medium tnum" data-evidence={r.f.status}>
                  {r.f.status === "UNAVAILABLE" ? <span className="font-normal text-muted">{r.value}</span> : r.value}
                </td>
                <td className="whitespace-nowrap px-3 py-2">
                  <SourceBadge type={r.f.sourceType} />
                </td>
                <td className="px-3 py-2">
                  {r.f.sourceUrl ? (
                    <a href={r.f.sourceUrl} target="_blank" rel="noreferrer" className="text-brand underline">
                      {r.f.sourceName}
                    </a>
                  ) : (
                    r.f.sourceName
                  )}
                </td>
                <td className="whitespace-nowrap px-3 py-2 tnum">{fmtDate(r.f.asOfDate)}</td>
                <td className="whitespace-nowrap px-3 py-2">
                  <StatusBadge status={r.f.status} />
                </td>
                <td className="max-w-xs px-3 py-2 text-xs text-muted">{r.f.note ?? ""}</td>
              </tr>
            ))}
            {!shown.length ? (
              <tr>
                <td colSpan={10} className="px-3 py-8 text-center text-muted">
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
