import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { coverage } from "@/lib/facts";
import { STATUS_LABEL } from "@/lib/metrics";
import type { FactStatus } from "@/lib/types";
import { Kicker } from "@/components/ui";
import { FactLedger, StatusMark } from "@/components/FactLedger";

const STATUSES: FactStatus[] = ["VERIFIED", "SELF_REPORTED", "NEEDS_VALIDATION", "UNAVAILABLE"];

const BAR: Record<FactStatus, string> = {
  VERIFIED: "bg-verified",
  SELF_REPORTED: "bg-selfreported",
  NEEDS_VALIDATION: "bg-validate",
  UNAVAILABLE: "bg-unavailable/60",
};

export default async function SourcesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { facts } = profile;

  const total = facts.length;
  const count = (s: FactStatus) => facts.filter((f) => f.status === s).length;
  const n = Object.fromEntries(STATUSES.map((s) => [s, count(s)])) as Record<FactStatus, number>;
  const share = (k: number) => (total ? (k / total) * 100 : 0);
  const sources = new Set(facts.map((f) => f.sourceName)).size;
  const cov = coverage(facts);

  const headline = total
    ? `${total} facts from ${sources} source${sources === 1 ? "" : "s"}; ${Math.round(share(n.VERIFIED))}% are independently verified${
        n.SELF_REPORTED ? `, ${n.SELF_REPORTED} rest on the college's own claim` : ""
      }.`
    : "No facts are recorded for this institution yet.";

  return (
    <div>
      <Kicker>Source ledger</Kicker>
      <h2 className="display mt-2 max-w-3xl text-[26px] font-medium leading-[1.2] text-ink">{headline}</h2>

      {total ? (
        <div className="mt-6">
          <div
            role="img"
            aria-label={STATUSES.map((s) => `${STATUS_LABEL[s]} ${n[s]}`).join(", ")}
            className="flex h-2.5 w-full gap-px overflow-hidden rounded-[2px] bg-sunken"
          >
            {STATUSES.filter((s) => n[s]).map((s) => (
              <span key={s} data-evidence={s} className={BAR[s]} style={{ width: `${share(n[s])}%` }} />
            ))}
          </div>
          <div className="mt-2.5 flex flex-wrap items-baseline gap-x-6 gap-y-1.5 text-[12.5px]">
            {STATUSES.map((s) => (
              <span key={s} className="inline-flex items-center gap-1.5 text-muted">
                <StatusMark status={s} />
                <span className="text-ink">{STATUS_LABEL[s]}</span>
                <span className="tnum font-mono text-[11.5px]">
                  {n[s]} · {Math.round(share(n[s]))}%
                </span>
              </span>
            ))}
            <span className="tnum ml-auto text-[12px] text-faint">
              {cov.verified} of {cov.expected} expected metrics verified
            </span>
          </div>
        </div>
      ) : null}

      <div className="mt-8">
        <FactLedger facts={facts} programmes={profile.programmes} />
      </div>
    </div>
  );
}
