import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import type { FlagBand } from "@/lib/types";
import { Card, Empty, FlagCard, Label, PageHeader } from "@/components/ui";

const BANDS: { band: FlagBand; label: string; blurb: string; tone: string; empty: string }[] = [
  {
    band: "CRITICAL",
    label: "Critical",
    blurb: "Needs resolution before a decision",
    tone: "border-critical text-critical",
    empty: "No critical flags raised by the current rules",
  },
  {
    band: "ATTENTION",
    label: "Attention",
    blurb: "Needs validation or a follow-up question",
    tone: "border-attention text-attention",
    empty: "No attention flags raised by the current rules",
  },
  {
    band: "VERIFIED",
    label: "Verified",
    blurb: "Checked against an independent source",
    tone: "border-verified text-verified",
    empty: "Nothing confirmed against an independent source yet",
  },
];

export default async function RisksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();

  const flags = deriveFlags(profile);
  const { inst } = profile;

  return (
    <div className="space-y-6">
      <PageHeader title="Risk & Red-Flag Centre" subtitle="Rule-driven flags, each tied to the facts that raised it" />

      <div className="rounded-lg border border-line bg-surface px-4 py-3 text-sm">
        <strong className="font-semibold">
          No overall score is computed. Flags are derived from the evidence listed under each one.
        </strong>{" "}
        <span className="text-muted">
          Bands are counted separately and are never combined. An empty band means no rule fired on the data held, not
          that the area has been cleared.
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {BANDS.map((b) => {
          const rows = flags.filter((f) => f.band === b.band);
          return (
            <section key={b.band} aria-label={`${b.label} flags`} className="space-y-3">
              <div className={`flex items-end justify-between rounded-lg border-t-4 bg-surface px-4 py-3 ring-1 ring-line ${b.tone}`}>
                <div>
                  <h2 className="text-sm font-semibold uppercase tracking-wide">{b.label}</h2>
                  <p className="text-xs text-muted">{b.blurb}</p>
                </div>
                {/* Count of derived flags, not a data value: the evidence sits on each card below. */}
                <div className="text-3xl font-semibold tnum">{rows.length}</div>
              </div>
              {rows.length ? rows.map((f) => <FlagCard key={f.id} flag={f} />) : <Empty>{b.empty}</Empty>}
            </section>
          );
        })}
      </div>

      <Card title="Overall risk">
        <Label>Manual judgement — entered by the diligence team, not computed</Label>
        <div className="mt-1 text-lg font-semibold">
          {inst.overallRisk ?? <span className="font-normal text-muted">Not available</span>}
        </div>
        <p className="mt-1 text-sm text-muted">{inst.overallRiskNote ?? "No supporting note recorded."}</p>
      </Card>
    </div>
  );
}
