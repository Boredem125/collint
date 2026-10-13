"use client";

import type { ReactNode } from "react";
import type { FactT, FactStatus, SourceType } from "@/lib/types";
import { SOURCE_LABEL, STATUS_LABEL, metric, type ModuleKey, type Unit } from "@/lib/metrics";
import { coverage, fmtDate, fmtFact, fmtNum, weakestStatus, type Variance } from "@/lib/facts";

const STATUS_TEXT: Record<FactStatus, string> = {
  VERIFIED: "text-verified",
  SELF_REPORTED: "text-selfreported",
  NEEDS_VALIDATION: "text-validate",
  UNAVAILABLE: "text-unavailable",
};

const STATUS_BG: Record<FactStatus, string> = {
  VERIFIED: "bg-verified",
  SELF_REPORTED: "bg-selfreported",
  NEEDS_VALIDATION: "bg-validate",
  UNAVAILABLE: "bg-unavailable",
};

const STATUS_PILL: Record<FactStatus, string> = {
  VERIFIED: "border-verified/30 bg-verified/10 text-verified",
  SELF_REPORTED: "border-selfreported/30 bg-selfreported/10 text-selfreported",
  NEEDS_VALIDATION: "border-validate/30 bg-validate/10 text-validate",
  UNAVAILABLE: "border-line bg-canvas text-muted",
};

// Hovering or focusing a faded number restores it, so its evidence stays readable under the Trust lens.
const REVEAL = "hover:opacity-100! focus-within:opacity-100!";

// Shape varies with status as well as colour, so the dot does not rely on colour alone.
function Dot({ status }: { status: FactStatus }) {
  const base = "inline-block h-2 w-2 shrink-0";
  if (status === "VERIFIED") return <span aria-hidden className={`${base} rounded-full bg-verified`} />;
  if (status === "SELF_REPORTED")
    return <span aria-hidden className={`${base} rounded-full border-2 border-selfreported`} />;
  if (status === "NEEDS_VALIDATION") return <span aria-hidden className={`${base} rotate-45 bg-validate`} />;
  return <span aria-hidden className={`${base} rounded-full border border-dashed border-muted`} />;
}

function Row({ k, children }: { k: string; children: ReactNode }) {
  return (
    <span className="flex gap-2">
      <span className="w-12 shrink-0 text-muted">{k}</span>
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function FactLines({ fact }: { fact: FactT }) {
  return (
    <>
      <Row k="Source">
        <span className="font-medium">{SOURCE_LABEL[fact.sourceType]}</span>
        <span className="block text-muted">
          {fact.sourceUrl ? (
            <a href={fact.sourceUrl} target="_blank" rel="noreferrer" className="text-brand underline">
              {fact.sourceName}
            </a>
          ) : (
            fact.sourceName
          )}
        </span>
      </Row>
      <Row k="Date">
        <span className="tnum">{fmtDate(fact.asOfDate)}</span>
      </Row>
      <Row k="Status">
        <span className={`font-medium ${STATUS_TEXT[fact.status]}`}>{STATUS_LABEL[fact.status]}</span>
      </Row>
      {fact.note ? <span className="block border-t border-line pt-1 text-muted">{fact.note}</span> : null}
    </>
  );
}

function Chip({ status, label, children }: { status: FactStatus; label: string; children: ReactNode }) {
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className="group/ev relative ml-1 inline-flex cursor-help items-center rounded-sm align-middle outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
    >
      <Dot status={status} />
      {/* Padding rather than margin, so the pointer can travel from dot to popover without leaving the group. */}
      <span
        data-pop
        role="tooltip"
        className="absolute left-0 top-full z-50 hidden w-64 pt-1 group-hover/ev:block group-focus/ev:block group-focus-within/ev:block"
      >
        <span className="flex flex-col gap-1 whitespace-normal rounded-lg border border-line bg-surface p-2.5 text-left text-xs font-normal normal-case leading-snug tracking-normal text-ink shadow-lg">
          {children}
        </span>
      </span>
    </span>
  );
}

export function EvidenceChip({ fact }: { fact: FactT }) {
  return (
    <Chip
      status={fact.status}
      label={`Evidence: ${SOURCE_LABEL[fact.sourceType]}, ${fmtDate(fact.asOfDate)}, ${STATUS_LABEL[fact.status]}`}
    >
      <FactLines fact={fact} />
    </Chip>
  );
}

export function Num({ fact, unit, className = "" }: { fact: FactT | undefined; unit?: Unit; className?: string }) {
  if (!fact) {
    return (
      <span data-evidence="UNAVAILABLE" className={`text-muted ${className}`}>
        Not available
      </span>
    );
  }
  const missing = fact.status === "UNAVAILABLE";
  return (
    <span
      data-evidence={fact.status}
      className={`inline-flex items-center ${fact.valueNum !== null ? "whitespace-nowrap" : "items-start text-left"} ${REVEAL} ${missing ? "text-muted" : ""} ${className}`}
    >
      <span className="tnum">{fmtFact(fact, unit)}</span>
      <EvidenceChip fact={fact} />
    </span>
  );
}

export function Derived({
  value,
  unit,
  basis: rawBasis,
  className = "",
}: {
  value: number | null | undefined;
  unit: Unit;
  basis: FactT[];
  className?: string;
}) {
  // Several flags can cite the same fact; list each once.
  const basis = [...new Map(rawBasis.map((f) => [f.id, f])).values()];
  if (value == null || !Number.isFinite(value)) {
    return (
      <span data-evidence="UNAVAILABLE" className={`text-muted ${className}`}>
        Not available
      </span>
    );
  }
  // A computed number with no inputs on record cannot be called verified.
  const status: FactStatus = basis.length ? weakestStatus(basis) : "NEEDS_VALIDATION";
  return (
    <span data-evidence={status} className={`inline-flex items-center whitespace-nowrap ${REVEAL} ${className}`}>
      <span className="tnum">{fmtNum(value, unit)}</span>
      <Chip status={status} label={`Derived value: ${STATUS_LABEL[status]}, based on ${basis.length} source figures`}>
        <span className="block font-medium">
          Derived · <span className={STATUS_TEXT[status]}>{STATUS_LABEL[status]}</span>
        </span>
        <span className="block text-muted">Only as strong as its weakest input.</span>
        {basis.length === 0 ? <span className="block text-muted">No source figures recorded.</span> : null}
        {basis.map((f) => (
          <span key={f.id} className="flex flex-col gap-1 border-t border-line pt-1">
            <span className="flex justify-between gap-2 font-medium">
              <span>
                {metric(f.metricKey)?.label ?? f.metricKey}
                {f.period !== "current" ? ` · ${f.period}` : ""}
              </span>
              <span className="tnum">{fmtFact(f)}</span>
            </span>
            <FactLines fact={f} />
          </span>
        ))}
      </Chip>
    </span>
  );
}

export function StatusBadge({ status }: { status: FactStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_PILL[status]}`}
    >
      <Dot status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SourceBadge({ type }: { type: SourceType }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full border border-line bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
      {SOURCE_LABEL[type]}
    </span>
  );
}

export function ClaimVsVerified({
  variance,
  label,
  unit,
}: {
  variance: Variance | null;
  label: string;
  unit?: Unit;
}) {
  if (!variance) {
    return (
      <div className="text-sm">
        <div className="font-medium text-ink">{label}</div>
        <div className="mt-1 text-xs text-muted">
          No competing sources: an institution claim and an independent figure are both needed to compare.
        </div>
      </div>
    );
  }
  const { claimed, verified, diff, pct } = variance;
  const u = unit ?? metric(claimed.metricKey)?.unit ?? "count";
  const max = Math.max(Math.abs(claimed.valueNum ?? 0), Math.abs(verified.valueNum ?? 0)) || 1;
  const rows = [
    { name: "Institution claim", fact: claimed },
    { name: SOURCE_LABEL[verified.sourceType], fact: verified },
  ];
  const gap = Math.abs(pct);
  const tone =
    gap > 10
      ? "border-critical/30 bg-critical/10 text-critical"
      : gap > 3
        ? "border-attention/30 bg-attention/10 text-attention"
        : "border-line bg-canvas text-muted";

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium text-ink">{label}</span>
        <span className={`tnum whitespace-nowrap rounded-full border px-2 py-0.5 text-xs font-semibold ${tone}`}>
          Variance: {diff > 0 ? "" : diff < 0 ? "−" : ""}
          {fmtNum(Math.abs(diff), u)} / {gap.toFixed(1)}%
        </span>
      </div>
      <div className="mt-2 flex flex-col gap-1.5">
        {rows.map(({ name, fact }) => (
          <div
            key={fact.id}
            data-evidence={fact.status}
            className={`grid grid-cols-[8.5rem_1fr_auto] items-center gap-2 ${REVEAL}`}
          >
            <span className="truncate text-xs text-muted" title={name}>
              {name}
            </span>
            <span className="h-3 rounded-sm bg-canvas">
              <span
                className={`block h-3 rounded-sm ${STATUS_BG[fact.status]}`}
                style={{ width: `${Math.max(1, (Math.abs(fact.valueNum ?? 0) / max) * 100)}%` }}
              />
            </span>
            <span className="inline-flex min-w-16 items-center justify-end font-medium">
              <span className="tnum">{fmtFact(fact, u)}</span>
              <span className="[&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
                <EvidenceChip fact={fact} />
              </span>
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CoverageMeter({ facts, module, label }: { facts: FactT[]; module?: ModuleKey; label?: string }) {
  const c = coverage(facts, module);
  const presentPct = c.expected ? (c.present / c.expected) * 100 : 0;
  return (
    <div className="text-xs">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-medium uppercase tracking-wide text-muted">{label ?? "Evidence coverage"}</span>
        <span className="tnum font-semibold text-ink">{Math.round(c.pct)}%</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={c.expected}
        aria-valuenow={c.verified}
        aria-label={`${label ?? "Evidence coverage"}: ${c.verified} of ${c.expected} expected metrics verified`}
        className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-line"
      >
        <span className="absolute inset-y-0 left-0 bg-selfreported/40" style={{ width: `${presentPct}%` }} />
        <span className="absolute inset-y-0 left-0 bg-verified" style={{ width: `${c.pct}%` }} />
      </div>
      <div className="tnum mt-1 text-muted">
        {c.verified} of {c.expected} expected metrics verified
        {c.present > c.verified ? ` · ${c.present - c.verified} more reported but unverified` : ""}
      </div>
    </div>
  );
}
