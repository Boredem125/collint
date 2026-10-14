"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export const PROFILE_TABS = [
  { slug: "", label: "Overview" },
  { slug: "admissions", label: "Admissions" },
  { slug: "placements", label: "Placements" },
  { slug: "accreditation", label: "Accreditation" },
  { slug: "campus", label: "Campus" },
  { slug: "commercial", label: "Commercial" },
  { slug: "promoter", label: "Promoter" },
  { slug: "risks", label: "Risks" },
  { slug: "gaps", label: "Evidence gaps" },
  { slug: "notes", label: "Notes & stage" },
  { slug: "sources", label: "Source ledger" },
];

/** Vertical numbered rail on wide screens, scrolling tab strip on narrow ones. */
export default function ProfileTabs({ id, counts }: { id: string; counts?: Record<string, number> }) {
  const pathname = usePathname();
  const base = `/institutions/${id}`;
  const items = PROFILE_TABS.map((t, i) => {
    const href = t.slug ? `${base}/${t.slug}` : base;
    return { ...t, href, n: String(i + 1).padStart(2, "0"), active: pathname === href, count: counts?.[t.slug] };
  });

  return (
    <nav aria-label="Dossier sections" className="no-print">
      <ol className="hidden flex-col lg:flex">
        {items.map((t) => (
          <li key={t.slug}>
            <Link
              href={t.href}
              aria-current={t.active ? "page" : undefined}
              className={`flex items-baseline gap-3 border-l-2 py-1.5 pl-3 text-[13.5px] transition-colors ${
                t.active ? "border-ink text-ink" : "border-line text-muted hover:border-line-strong hover:text-ink"
              }`}
            >
              <span className="font-mono text-[10px] text-faint">{t.n}</span>
              <span className={t.active ? "font-medium" : ""}>{t.label}</span>
              {t.count ? (
                <span className="ml-auto rounded-sm bg-sunken px-1.5 font-mono text-[10px] text-muted">{t.count}</span>
              ) : null}
            </Link>
          </li>
        ))}
        <li className="mt-5">
          <Link
            href={`${base}/brief`}
            className="flex items-center justify-between rounded-md bg-ink px-3 py-2 text-[13px] font-medium text-canvas hover:opacity-90"
          >
            Executive brief
            <span aria-hidden>→</span>
          </Link>
        </li>
      </ol>
      <div className="-mx-4 flex gap-1 overflow-x-auto border-b border-line px-4 [scrollbar-width:none] sm:-mx-5 sm:px-5 lg:hidden">
        {items.map((t) => (
          <Link
            key={t.slug}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-2.5 py-3 text-[13.5px] ${
              t.active ? "border-ink text-ink" : "border-transparent text-muted"
            }`}
          >
            {t.label}
          </Link>
        ))}
        <Link href={`${base}/brief`} className="whitespace-nowrap px-2.5 py-3 text-[13.5px] text-brand">
          Brief →
        </Link>
      </div>
    </nav>
  );
}
