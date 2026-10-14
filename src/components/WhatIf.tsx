"use client";

import { useState, type CSSProperties } from "react";
import { fmtNum } from "@/lib/facts";

interface Props {
  intake: number | null;
  currentAdmissions: number | null;
  averageFee: number | null;
}

const RANGE_CSS = `
.wi-range{-webkit-appearance:none;appearance:none;display:block;width:100%;height:22px;background:transparent;cursor:pointer;margin:0}
.wi-range:focus{outline:none}
.wi-range::-webkit-slider-runnable-track{height:2px;border-radius:1px;background:linear-gradient(to right,var(--ink) 0 var(--p),var(--line-strong) var(--p) 100%)}
.wi-range::-moz-range-track{height:2px;border-radius:1px;background:var(--line-strong)}
.wi-range::-moz-range-progress{height:2px;border-radius:1px;background:var(--ink)}
.wi-range::-webkit-slider-thumb{-webkit-appearance:none;appearance:none;width:18px;height:18px;margin-top:-8px;border-radius:50%;background:var(--surface);border:2px solid var(--ink);transition:transform .12s}
.wi-range::-moz-range-thumb{width:14px;height:14px;border-radius:50%;background:var(--surface);border:2px solid var(--ink)}
.wi-range:active::-webkit-slider-thumb{transform:scale(1.15)}
.wi-range:focus-visible::-webkit-slider-thumb{box-shadow:0 0 0 4px color-mix(in oklab,var(--brand) 30%,transparent)}
.wi-range:focus-visible::-moz-range-thumb{box-shadow:0 0 0 4px color-mix(in oklab,var(--brand) 30%,transparent)}
.wi-range:disabled{cursor:not-allowed;opacity:.4}
@media (max-width:639px){
.wi-range{height:40px}
.wi-range::-webkit-slider-runnable-track{height:4px;border-radius:2px}
.wi-range::-moz-range-track,.wi-range::-moz-range-progress{height:4px;border-radius:2px}
.wi-range::-webkit-slider-thumb{width:26px;height:26px;margin-top:-11px}
.wi-range::-moz-range-thumb{width:22px;height:22px}
}
`;

export function WhatIf({ intake, currentAdmissions, averageFee }: Props) {
  const ready = !!intake && intake > 0 && currentAdmissions != null && !!averageFee && averageFee > 0;
  const currentFill = ready ? Math.min(100, Math.floor((currentAdmissions! / intake!) * 100)) : 0;

  const [fill, setFill] = useState(currentFill);
  const [feeShift, setFeeShift] = useState(0);

  return (
    <section
      aria-label="Scenario calculator"
      className="relative rounded-md border border-dashed border-line-strong bg-surface"
    >
      <style href="whatif-range" precedence="default">
        {RANGE_CSS}
      </style>
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-dashed border-line-strong px-4 py-2.5 sm:px-6">
        <span className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.08em] text-attention">
          <span aria-hidden className="h-1.5 w-1.5 rotate-45 bg-attention" />
          Scenario — not data
        </span>
        <span className="text-[12px] text-muted">Arithmetic on the slider positions. Not sourced or verified.</span>
      </header>

      {!ready ? (
        <p className="px-4 py-8 text-sm text-muted sm:px-6">
          Not available. Needs approved intake, admissions and average fee for the latest year.
        </p>
      ) : (
        <Body
          intake={intake!}
          currentAdmissions={currentAdmissions!}
          averageFee={averageFee!}
          currentFill={currentFill}
          fill={fill}
          setFill={setFill}
          feeShift={feeShift}
          setFeeShift={setFeeShift}
        />
      )}
    </section>
  );
}

function Slider({
  id,
  label,
  value,
  display,
  min,
  max,
  onChange,
  disabled,
  ticks,
}: {
  id: string;
  label: string;
  value: number;
  display: string;
  min: number;
  max: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  ticks: [string, string, string?];
}) {
  const p = max > min ? ((value - min) / (max - min)) * 100 : 100;
  return (
    <div>
      <label htmlFor={id} className="flex items-baseline justify-between gap-3">
        <span className="text-[13px] text-muted">{label}</span>
        <span className="display tnum text-[22px] leading-none text-ink">{display}</span>
      </label>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={1}
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        className="wi-range mt-1 sm:mt-3"
        style={{ "--p": `${p}%` } as CSSProperties}
      />
      <div className="tnum mt-1.5 flex justify-between font-mono text-[11px] text-faint">
        <span>{ticks[0]}</span>
        {ticks[2] !== undefined ? <span>{ticks[1]}</span> : null}
        <span>{ticks[2] ?? ticks[1]}</span>
      </div>
    </div>
  );
}

function Body(p: {
  intake: number;
  currentAdmissions: number;
  averageFee: number;
  currentFill: number;
  fill: number;
  setFill: (n: number) => void;
  feeShift: number;
  setFeeShift: (n: number) => void;
}) {
  // At the slider's floor the scenario equals today's admissions exactly, not a rounded fill rate.
  const admissions = p.fill <= p.currentFill ? p.currentAdmissions : Math.round((p.intake * p.fill) / 100);
  const incremental = Math.max(0, admissions - p.currentAdmissions);
  const fee = p.averageFee * (1 + p.feeShift / 100);
  const gross = admissions * fee;
  const baseline = p.currentAdmissions * p.averageFee;
  const delta = gross - baseline;
  const full = p.currentFill >= 100;
  const moved = p.fill !== p.currentFill || p.feeShift !== 0;

  return (
    <div className="grid md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-8 px-4 py-6 sm:px-6 md:border-r md:border-dashed md:border-line-strong">
        <div>
          <Slider
            id="whatif-fill"
            label="Seats filled"
            value={p.fill}
            display={fmtNum(p.fill, "percent")}
            min={p.currentFill}
            max={100}
            disabled={full}
            onChange={p.setFill}
            ticks={[`Today ${fmtNum(p.currentFill, "percent")}`, fmtNum(100, "percent")]}
          />
          {full ? <p className="mt-2 text-xs text-muted">Approved intake is already fully subscribed.</p> : null}
        </div>
        <Slider
          id="whatif-fee"
          label="Average fee"
          value={p.feeShift}
          display={`${p.feeShift > 0 ? "+" : p.feeShift < 0 ? "−" : ""}${Math.abs(p.feeShift)}%`}
          min={-40}
          max={40}
          onChange={p.setFeeShift}
          ticks={[fmtNum(p.averageFee * 0.6, "inr"), `Today ${fmtNum(p.averageFee, "inr")}`, fmtNum(p.averageFee * 1.4, "inr")]}
        />
        <button
          type="button"
          disabled={!moved}
          onClick={() => {
            p.setFill(p.currentFill);
            p.setFeeShift(0);
          }}
          className="min-h-10 text-[13px] text-muted underline decoration-line-strong underline-offset-4 hover:text-ink disabled:cursor-default disabled:no-underline disabled:opacity-50"
        >
          Reset to today
        </button>
      </div>

      <div className="flex flex-col justify-between gap-8 border-t border-dashed border-line-strong px-4 py-6 md:border-t-0 sm:px-6" aria-live="polite">
        <div>
          <div className="text-[13px] text-muted">Gross fee revenue, scenario</div>
          <div className="display tnum mt-2 text-[44px] leading-none text-ink sm:text-[64px]">{fmtNum(gross, "inr")}</div>
          <div className="tnum mt-3 font-mono text-[12px] text-muted">
            {fmtNum(admissions, "count")} admissions × {fmtNum(fee, "inr")}
          </div>
        </div>
        <dl className="grid grid-cols-2 border-t border-line pt-4">
          <div className="min-w-0 pr-3 sm:pr-4">
            <dt className="text-[12px] text-muted">Change vs today</dt>
            <dd className="display tnum mt-1 text-[20px] leading-tight sm:text-[24px] text-ink">
              {delta > 0 ? "+" : delta < 0 ? "−" : ""}
              {fmtNum(Math.abs(delta), "inr")}
            </dd>
            <dd className="tnum mt-0.5 text-[12px] text-muted">from {fmtNum(baseline, "inr")} today</dd>
          </div>
          <div className="min-w-0 border-l border-line pl-3 sm:pl-4">
            <dt className="text-[12px] text-muted">Extra admissions</dt>
            <dd className="display tnum mt-1 text-[20px] leading-tight sm:text-[24px] text-ink">
              +{fmtNum(incremental, "count")}
            </dd>
            <dd className="tnum mt-0.5 text-[12px] text-muted">
              {fmtNum(admissions, "count")} of {fmtNum(p.intake, "count")} seats
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
