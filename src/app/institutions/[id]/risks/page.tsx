import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import type { FlagBand } from "@/lib/types";
import { Empty, FlagCard, Kicker, Section } from "@/components/ui";

const BANDS: { band: FlagBand; label: string; blurb: string; rule: string; text: string; empty: string }[] = [
  {
    band: "CRITICAL",
    label: "Critical",
    blurb: "Resolve before a decision",
    rule: "border-critical",
    text: "text-critical",
    empty: "No critical rule fired on the data held",
  },
  {
    band: "ATTENTION",
    label: "Attention",
    blurb: "Validate or ask a follow-up",
    rule: "border-attention",
    text: "text-attention",
    empty: "No attention rule fired on the data held",
  },
  {
    band: "VERIFIED",
    label: "Verified",
    blurb: "Confirmed by an independent source",
    rule: "border-verified",
    text: "text-verified",
    empty: "Nothing confirmed independently yet",
  },
];

const RISK: Record<string, { label: string; dot: string }> = {
  RED: { label: "Red", dot: "bg-critical" },
  AMBER: { label: "Amber", dot: "bg-attention" },
  GREEN: { label: "Green", dot: "bg-verified" },
};

const WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve"];
const word = (n: number, lower = false) => {
  const w = WORDS[n] ?? String(n);
  return lower ? w.toLowerCase() : w;
};

function verdict(crit: number, att: number, ver: number): string {
  if (crit > 0) {
    const head = `${word(crit)} critical ${crit === 1 ? "flag needs" : "flags need"} resolution before any decision`;
    return att > 0 ? `${head}; ${word(att, true)} more ${att === 1 ? "needs" : "need"} validation.` : `${head}.`;
  }
  if (att > 0)
    return `No critical flags; ${word(att, true)} ${att === 1 ? "item needs" : "items need"} validation or a follow-up question.`;
  return ver > 0
    ? `No rule raised a concern on the data held; ${word(ver, true)} ${ver === 1 ? "finding is" : "findings are"} independently verified.`
    : "No rule raised a concern on the data held.";
}

export default async function RisksPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();

  const flags = deriveFlags(profile);
  const { inst } = profile;
  const byBand = (b: FlagBand) => flags.filter((f) => f.band === b);
  const risk = inst.overallRisk ? RISK[inst.overallRisk] : undefined;

  return (
    <div className="space-y-14">
      <header>
        <Kicker>Risk and red flags</Kicker>
        <p className="display mt-3 max-w-3xl text-[26px] leading-[1.25] text-ink sm:text-[30px]">
          {verdict(byBand("CRITICAL").length, byBand("ATTENTION").length, byBand("VERIFIED").length)}
        </p>
      </header>

      <Section index="01" title="Flags" aside="Bands are counted separately. No overall score.">
        <div className="grid gap-12 lg:grid-cols-3 lg:gap-8">
          {BANDS.map((b) => {
            const rows = byBand(b.band);
            return (
              <section key={b.band} aria-label={`${b.label} flags`} className="min-w-0">
                <div className={`border-t-2 pt-3 ${b.rule}`}>
                  <div className="flex items-end justify-between gap-3">
                    <div>
                      <h3 className={`text-[14px] font-medium ${b.text}`}>{b.label}</h3>
                      <p className="mt-0.5 text-[12px] text-muted">{b.blurb}</p>
                    </div>
                    {/* A count of derived flags, not a data value; evidence sits on each flag below. */}
                    <div className={`display tnum text-[64px] leading-[0.85] ${rows.length ? "text-ink" : "text-faint"}`}>
                      {rows.length}
                    </div>
                  </div>
                </div>
                <div className="mt-5">
                  {rows.length ? rows.map((f) => <FlagCard key={f.id} flag={f} />) : <Empty>{b.empty}</Empty>}
                </div>
              </section>
            );
          })}
        </div>
      </Section>

      <Section index="02" title="Overall risk" aside="Team judgement, not computed">
        <div className="grid gap-6 sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] sm:items-baseline">
          <div className="display flex items-center gap-3 text-[44px] leading-none text-ink">
            {risk ? (
              <>
                <span aria-hidden className={`h-3 w-3 rounded-full ${risk.dot}`} />
                {risk.label}
              </>
            ) : inst.overallRisk ? (
              inst.overallRisk
            ) : (
              <span className="text-[20px] text-muted">Not available</span>
            )}
          </div>
          <p className="max-w-xl text-[14.5px] leading-relaxed text-muted">
            {inst.overallRiskNote ?? "No supporting note recorded."}
          </p>
        </div>
      </Section>
    </div>
  );
}
