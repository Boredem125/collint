import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { deriveFlags } from "@/lib/risk";
import { coverage } from "@/lib/facts";
import { DEAL_STAGES } from "@/lib/metrics";
import { Kicker, SampleBadge } from "@/components/ui";
import ProfileTabs from "@/components/ProfileTabs";

export default async function InstitutionLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getProfile(id);
  if (!profile) notFound();
  const { inst } = profile;
  const flags = deriveFlags(profile);
  const open = flags.filter((f) => f.band !== "VERIFIED").length;
  const cov = coverage(profile.facts);
  const stage = DEAL_STAGES.find((s) => s.key === inst.stage)?.label ?? inst.stage;

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-x-12 gap-y-5 lg:grid-cols-[200px_minmax(0,1fr)] lg:gap-y-6">
      <header className="lg:col-span-2">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <Kicker>AISHE {inst.aisheCode}</Kicker>
          <span className="text-faint">·</span>
          <Kicker>{stage}</Kicker>
          {inst.isSample && <SampleBadge />}
        </div>
        <h1 className="display mt-2 max-w-4xl text-[28px] font-medium leading-[1.1] text-ink sm:text-[42px] sm:leading-[1.08]">
          {inst.name}
        </h1>
        <p className="mt-2 text-[13px] leading-relaxed text-muted sm:text-[14px]">
          {inst.city}, {inst.state}
          <span className="mx-2 text-faint">/</span>
          {inst.university}
          <span className="mx-2 text-faint">/</span>
          {inst.ownership}
          {inst.established ? (
            <>
              <span className="mx-2 text-faint">/</span>Est. {inst.established}
            </>
          ) : null}
        </p>
      </header>
      <aside className="no-print sticky top-14 z-30 -mx-4 bg-canvas/95 px-4 backdrop-blur sm:-mx-5 sm:px-5 lg:top-20 lg:mx-0 lg:self-start lg:bg-transparent lg:px-0 lg:backdrop-blur-none">
        <ProfileTabs id={inst.id} counts={{ risks: open, notes: profile.notes.length }} />
        <div className="mt-6 hidden border-t border-line pt-4 text-xs text-muted lg:block">
          <div className="flex justify-between">
            <span>Evidence verified</span>
            <span className="tnum text-ink">{Math.round(cov.pct)}%</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-sunken">
            <div className="h-full bg-verified" style={{ width: `${cov.pct}%` }} />
          </div>
          <p className="mt-2 text-faint">
            {cov.verified} of {cov.expected} expected metrics
          </p>
        </div>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
