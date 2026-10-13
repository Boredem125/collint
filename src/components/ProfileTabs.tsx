"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { slug: "", label: "Executive" },
  { slug: "admissions", label: "Admissions" },
  { slug: "placements", label: "Placements" },
  { slug: "accreditation", label: "Accreditation" },
  { slug: "promoter", label: "Promoter" },
  { slug: "campus", label: "Campus" },
  { slug: "commercial", label: "Commercial" },
  { slug: "risks", label: "Risks" },
  { slug: "sources", label: "Sources" },
];

export default function ProfileTabs({ id }: { id: string }) {
  const pathname = usePathname();
  const base = `/institutions/${id}`;
  return (
    <nav className="no-print flex items-center gap-1 overflow-x-auto border-b border-line text-sm">
      {TABS.map((t) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        const active = pathname === href;
        return (
          <Link
            key={t.label}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-3 py-2 ${
              active ? "border-brand font-medium text-brand" : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
      <Link
        href={`${base}/brief`}
        className="mb-1 ml-auto whitespace-nowrap rounded-lg border border-line bg-surface px-3 py-1.5 text-ink hover:border-brand"
      >
        Brief
      </Link>
    </nav>
  );
}
