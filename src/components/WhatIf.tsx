"use client";

import { useState } from "react";
import { fmtNum } from "@/lib/facts";

interface Props {
  intake: number | null;
  currentAdmissions: number | null;
  averageFee: number | null;
}

export function WhatIf({ intake, currentAdmissions, averageFee }: Props) {
  const ready = !!intake && intake > 0 && currentAdmissions != null && !!averageFee && averageFee > 0;
  const currentFill = ready ? Math.min(100, Math.floor((currentAdmissions! / intake!) * 100)) : 0;

  const [fill, setFill] = useState(currentFill);
  const [feeShift, setFeeShift] = useState(0);

  return (
    <section className="rounded-lg border-2 border-dashed border-attention/50 bg-attention/5 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-attention">Scenario — not data</h3>
        <p className="text-xs text-muted">
          Figures below are arithmetic on the slider positions. They are not sourced, dated or verified.
        </p>
      </div>

      {!ready ? (
        <p className="mt-3 text-sm text-muted">
          Not available. The scenario needs approved intake, admissions and average fee for the latest year; add those
          facts through an import to enable it.
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
  const full = p.currentFill >= 100;

  return (
    <div className="mt-4 grid gap-6 md:grid-cols-2">
      <div className="space-y-5">
        <div>
          <label htmlFor="whatif-fill" className="flex justify-between text-sm">
            <span>Fill rate</span>
            <span className="tnum font-semibold">{fmtNum(p.fill, "percent")}</span>
          </label>
          <input
            id="whatif-fill"
            type="range"
            min={p.currentFill}
            max={100}
            step={1}
            value={p.fill}
            disabled={full}
            onChange={(e) => p.setFill(Number(e.target.value))}
            className="mt-2 w-full accent-attention"
          />
          <div className="flex justify-between text-xs text-muted tnum">
            <span>Current {fmtNum(p.currentFill, "percent")}</span>
            <span>{fmtNum(100, "percent")}</span>
          </div>
          {full ? <p className="mt-1 text-xs text-muted">Approved intake is already fully subscribed.</p> : null}
        </div>

        <div>
          <label htmlFor="whatif-fee" className="flex justify-between text-sm">
            <span>Average fee</span>
            <span className="tnum font-semibold">
              {fmtNum(fee, "inr")} ({p.feeShift > 0 ? "+" : ""}
              {p.feeShift}%)
            </span>
          </label>
          <input
            id="whatif-fee"
            type="range"
            min={-40}
            max={40}
            step={1}
            value={p.feeShift}
            onChange={(e) => p.setFeeShift(Number(e.target.value))}
            className="mt-2 w-full accent-attention"
          />
          <div className="flex justify-between text-xs text-muted tnum">
            <span>{fmtNum(p.averageFee * 0.6, "inr")}</span>
            <span>Current {fmtNum(p.averageFee, "inr")}</span>
            <span>{fmtNum(p.averageFee * 1.4, "inr")}</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            p.setFill(p.currentFill);
            p.setFeeShift(0);
          }}
          className="rounded border border-line bg-surface px-3 py-1 text-xs text-muted hover:text-ink"
        >
          Reset to current
        </button>
      </div>

      <dl className="grid grid-cols-1 gap-3 self-start" aria-live="polite">
        <Out label="Scenario admissions" value={fmtNum(admissions, "count")} hint={`of ${fmtNum(p.intake, "count")} approved seats`} />
        <Out label="Incremental admissions" value={`+${fmtNum(incremental, "count")}`} hint="over the latest recorded year" />
        <Out
          label="Potential gross revenue (scenario)"
          value={fmtNum(gross, "inr")}
          hint={`${fmtNum(admissions, "count")} × ${fmtNum(fee, "inr")}`}
        />
      </dl>
    </div>
  );
}

function Out({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-lg border border-line bg-surface p-3">
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-xl font-semibold tnum">{value}</dd>
      <div className="text-xs text-muted tnum">{hint}</div>
    </div>
  );
}
