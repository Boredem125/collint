import { notFound } from "next/navigation";
import { getProfile } from "@/lib/data";
import { SampleBadge } from "@/components/ui";
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

  return (
    <div className="space-y-5">
      <header>
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-xl font-semibold tracking-tight text-ink">{inst.name}</h1>
          {inst.isSample && <SampleBadge />}
        </div>
        <p className="mt-1 text-sm text-muted">
          {inst.city}, {inst.state} · {inst.university} · AISHE {inst.aisheCode}
        </p>
      </header>
      <ProfileTabs id={inst.id} />
      {children}
    </div>
  );
}
