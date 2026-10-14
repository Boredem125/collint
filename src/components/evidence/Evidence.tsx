"use client";

import type { CSSProperties, ReactNode } from "react";
import type { FactT, FactStatus, SourceType } from "@/lib/types";
import { SOURCE_LABEL, STATUS_LABEL, metric, type ModuleKey, type Unit } from "@/lib/metrics";
import { coverage, fmtDate, fmtFact, fmtNum, weakestStatus, type Variance } from "@/lib/facts";

const STATUS_TEXT: Record<FactStatus, string> = {
  VERIFIED: "text-verified",
  SELF_REPORTED: "text-selfreported",
  NEEDS_VALIDATION: "text-validate",
  UNAVAILABLE: "text-unavailable",
};

// Hovering or focusing a faded number restores it, so its evidence stays readable under the Trust lens.
const REVEAL = "hover:opacity-100! focus-within:opacity-100!";

/**
 * Status mark. Shape varies with status as well as colour, so it never relies on colour alone:
 * filled disc = verified, ring = self-reported, diamond = needs validation, dashed ring = unavailable.
 * `size` is any CSS length, so the mark can scale with the surrounding type.
 */
function Mark({ status, size = "7px" }: { status: FactStatus; size?: string }) {
  const style: CSSProperties = { width: size, height: size };
  const base = "inline-block shrink-0 box-border";
  if (status === "VERIFIED") return <span aria-hidden style={style} className={`${base} rounded-full bg-verified`} />;
  if (status === "SELF_REPORTED")
    return <span aria-hidden style={style} className={`${base} rounded-full border-[1.5px] border-selfreported`} />;
  if (status === "NEEDS_VALIDATION")
    return <span aria-hidden style={{ width: `calc(${size} * 0.82)`, height: `calc(${size} * 0.82)` }} className={`${base} rotate-45 bg-validate`} />;
  return <span aria-hidden style={style} className={`${base} rounded-full border border-dashed border-unavailable`} />;
}

const POP_KICKER = "font-mono text-[10px] uppercase tracking-[0.09em] text-faint";

function Meta({ k, children }: { k: string; children: ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-3">
      <span className="text-faint">{k}</span>
      <span className="min-w-0 text-right">{children}</span>
    </span>
  );
}

function SourceCard({ fact }: { fact: FactT }) {
  return (
    <span className="flex flex-col gap-2">
      <span className="flex flex-col gap-0.5">
        <span className={POP_KICKER}>{SOURCE_LABEL[fact.sourceType]}</span>
        <span className="break-words text-[12.5px] font-medium leading-snug text-ink">
          {fact.sourceUrl ? (
            <a
              href={fact.sourceUrl}
              target="_blank"
              rel="noreferrer"
              className="underline decoration-line-strong underline-offset-2 hover:text-brand hover:decoration-brand"
            >
              {fact.sourceName}
            </a>
          ) : (
            fact.sourceName
          )}
        </span>
      </span>
      <span className="flex flex-col gap-1 border-t border-line pt-2">
        <Meta k="As of">
          <span className="tnum text-ink">{fmtDate(fact.asOfDate)}</span>
        </Meta>
        <Meta k="Status">
          <span className={`inline-flex items-center gap-1.5 ${STATUS_TEXT[fact.status]}`}>
            <Mark status={fact.status} />
            {STATUS_LABEL[fact.status]}
          </span>
        </Meta>
      </span>
      {fact.note ? <span className="border-t border-line pt-2 text-muted">{fact.note}</span> : null}
    </span>
  );
}

/**
 * The evidence mark beside a figure. It sits like a footnote reference, raised towards cap height,
 * and its size follows the parent font so it reads the same beside 13px table text and 44px serif stats.
 */
function Chip({ status, label, children }: { status: FactStatus; label: string; children: ReactNode }) {
  return (
    <span
      tabIndex={0}
      aria-label={label}
      className="group/ev relative bottom-[0.42em] ml-[0.22em] inline-flex shrink-0 cursor-help items-center rounded-full outline-none before:absolute before:-inset-[5px] before:content-[''] focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
    >
      <Mark status={status} size="max(6px, 0.19em)" />
      {/* Padding rather than margin, so the pointer can travel from mark to card without leaving the group. */}
      <span
        data-pop
        role="tooltip"
        className="absolute left-0 top-full z-50 hidden w-[260px] pt-2 group-hover/ev:block group-focus/ev:block group-focus-within/ev:block"
      >
        <span className="block max-h-[340px] overflow-y-auto whitespace-normal rounded-md border border-line-strong bg-surface p-3 text-left font-sans text-[12px] font-normal not-italic normal-case leading-snug tracking-normal text-ink shadow-[0_14px_36px_-18px_rgb(0_0_0/0.45),0_2px_4px_-2px_rgb(0_0_0/0.08)] [font-variant-numeric:normal]">
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
      <SourceCard fact={fact} />
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
      className={`inline-flex items-baseline ${fact.valueNum !== null ? "whitespace-nowrap" : "text-left"} ${REVEAL} ${missing ? "text-muted" : ""} ${className}`}
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
    <span data-evidence={status} className={`inline-flex items-baseline whitespace-nowrap ${REVEAL} ${className}`}>
      <span className="tnum">{fmtNum(value, unit)}</span>
      <Chip status={status} label={`Derived value: ${STATUS_LABEL[status]}, based on ${basis.length} source figures`}>
        <span className="flex flex-col gap-0.5">
          <span className={POP_KICKER}>Derived figure</span>
          <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-medium ${STATUS_TEXT[status]}`}>
            <Mark status={status} />
            {STATUS_LABEL[status]}
          </span>
          <span className="text-muted">As strong as its weakest input.</span>
        </span>
        {basis.length === 0 ? (
          <span className="mt-2 block border-t border-line pt-2 text-muted">No source figures recorded.</span>
        ) : null}
        {basis.map((f) => (
          <span key={f.id} className="mt-2 flex flex-col gap-1 border-t border-line pt-2">
            <span className="flex items-baseline justify-between gap-2">
              <span className="min-w-0 text-ink">
                {metric(f.metricKey)?.label ?? f.metricKey}
                {f.period !== "current" ? <span className="font-mono text-[11px] text-faint"> {f.period}</span> : null}
              </span>
              <span className="tnum font-medium text-ink">{fmtFact(f)}</span>
            </span>
            <span className="flex items-center justify-between gap-2 text-muted">
              <span className="min-w-0 truncate" title={f.sourceName}>
                <span className="font-mono text-[10px] uppercase tracking-[0.08em] text-faint">
                  {SOURCE_LABEL[f.sourceType]}
                </span>{" "}
                · <span className="tnum">{fmtDate(f.asOfDate)}</span>
              </span>
              <span className={`inline-flex shrink-0 items-center gap-1 ${STATUS_TEXT[f.status]}`}>
                <Mark status={f.status} size="6px" />
                {STATUS_LABEL[f.status]}
              </span>
            </span>
          </span>
        ))}
      </Chip>
    </span>
  );
}

export function StatusBadge({ status }: { status: FactStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[11px] tracking-[-0.01em] ${STATUS_TEXT[status]}`}
    >
      <Mark status={status} />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function SourceBadge({ type }: { type: SourceType }) {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-sm border border-line px-1.5 py-px font-mono text-[10.5px] uppercase tracking-[0.06em] text-muted">
      {SOURCE_LABEL[type]}
    </span>
  );
}

const HATCH_CLAIM: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(-45deg, var(--muted) 0 1px, transparent 1px 4px)",
};
const HATCH_GAP: CSSProperties = {
  backgroundImage:
    "repeating-linear-gradient(-45deg, color-mix(in oklab, var(--critical) 70%, transparent) 0 1px, transparent 1px 3px)",
};
const HATCH_GAP_SOFT: CSSProperties = {
  backgroundImage: "repeating-linear-gradient(-45deg, var(--faint) 0 1px, transparent 1px 3px)",
};

/**
 * Claim against the independent figure on one shared scale: the claim is drawn as a hatched outline,
 * the verified figure as solid ink, and the unsupported stretch between them is marked.
 */
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
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-1 text-sm">
        <span className="font-medium text-ink">{label}</span>
        <span className="text-xs text-muted">No competing sources to compare</span>
      </div>
    );
  }
  const { claimed, verified, diff, pct } = variance;
  const u = unit ?? metric(claimed.metricKey)?.unit ?? "count";
  const cv = Math.abs(claimed.valueNum ?? 0);
  const vv = Math.abs(verified.valueNum ?? 0);
  const max = Math.max(cv, vv) || 1;
  const cw = (cv / max) * 100;
  const vw = (vv / max) * 100;
  const gap = Math.abs(pct);
  const over = diff > 0; // claim exceeds the independent figure
  const tone = gap > 10 ? "text-critical" : gap > 3 ? "text-attention" : "text-muted";
  const gapStyle = over && gap > 3 ? HATCH_GAP : HATCH_GAP_SOFT;
  const gapEdge = over && gap > 3 ? (gap > 10 ? "border-critical" : "border-attention") : "border-faint";
  const note = diff === 0 ? "claim matches" : over ? "of the claim unsupported" : "verified above claim";
  const sign = diff > 0 ? "−" : diff < 0 ? "+" : "";

  const rows = [
    { name: "Institution claim", fact: claimed, w: cw, claim: true },
    { name: SOURCE_LABEL[verified.sourceType], fact: verified, w: vw, claim: false },
  ];
  // The gap is drawn on the shorter bar's row, from its end to the longer bar's end.
  const gapRow = over ? 1 : 0;
  const gapFrom = Math.min(cw, vw);
  const gapTo = Math.max(cw, vw);

  return (
    <div className="text-sm">
      <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-1">
        <span className="font-medium text-ink">{label}</span>
        <span className={`flex items-baseline gap-2 ${tone}`}>
          <span className="display text-[22px] leading-none">
            {sign}
            {gap.toFixed(1)}%
          </span>
          <span className="tnum font-mono text-[11px]">
            {sign}
            {fmtNum(Math.abs(diff), u)} {note}
          </span>
        </span>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {rows.map(({ name, fact, w, claim }, i) => (
          <div
            key={fact.id}
            data-evidence={fact.status}
            className={`grid grid-cols-[minmax(6.5rem,8.5rem)_1fr_auto] items-center gap-3 ${REVEAL}`}
          >
            <span className="truncate text-[12px] text-muted" title={name}>
              {name}
            </span>
            <span className="relative h-[7px] border-l border-line-strong">
              {claim ? (
                <span
                  className="absolute inset-y-0 left-0 border border-muted"
                  style={{ ...HATCH_CLAIM, width: `${Math.max(1, w)}%` }}
                />
              ) : (
                <span className="absolute inset-y-0 left-0 bg-ink" style={{ width: `${Math.max(1, w)}%` }} />
              )}
              {i === gapRow && gapTo - gapFrom > 0.2 ? (
                <span
                  aria-hidden
                  className={`absolute inset-y-[-2px] border-r ${gapEdge}`}
                  style={{ ...gapStyle, left: `${gapFrom}%`, width: `${gapTo - gapFrom}%` }}
                />
              ) : null}
            </span>
            <span className="inline-flex min-w-16 items-baseline justify-end font-medium text-ink [&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
              <span className="tnum">{fmtFact(fact, u)}</span>
              <EvidenceChip fact={fact} />
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
  const name = label ?? "Evidence coverage";
  return (
    <div className="min-w-0 text-xs">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-[12px] text-muted">{name}</span>
        <span className="tnum text-[12px] font-medium text-ink">{Math.round(c.pct)}%</span>
      </div>
      <div
        role="meter"
        aria-valuemin={0}
        aria-valuemax={c.expected}
        aria-valuenow={c.verified}
        aria-label={`${name}: ${c.verified} of ${c.expected} expected metrics verified`}
        className="relative mt-1.5 h-[3px] bg-line"
      >
        <span className="absolute inset-y-0 left-0 bg-verified/30" style={{ width: `${presentPct}%` }} />
        <span className="absolute inset-y-0 left-0 bg-verified" style={{ width: `${c.pct}%` }} />
      </div>
      <div className="tnum mt-1.5 text-[11px] text-faint">
        {c.verified} of {c.expected} verified
        {c.present > c.verified ? ` · ${c.present - c.verified} reported, unverified` : ""}
      </div>
    </div>
  );
}
