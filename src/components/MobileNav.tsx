"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

const ITEMS: { href: string; label: string; icon: ReactNode }[] = [
  {
    href: "/",
    label: "Pipeline",
    icon: <path d="M2.5 3.5h3v9h-3zM6.5 3.5h3v6h-3zM10.5 3.5h3v4h-3z" />,
  },
  {
    href: "/compare",
    label: "Compare",
    icon: <path d="M2.5 13.5v-5M6.5 13.5v-9M10.5 13.5v-7M14 13.5H2" />,
  },
  {
    href: "/import",
    label: "Import",
    icon: <path d="M8 2.5v8M5 7.5l3 3 3-3M3 13.5h10" />,
  },
];

// Opens the command palette, which listens for Ctrl/Cmd+K on window.
const openPalette = () =>
  window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true, metaKey: true, bubbles: true }));

/** Bottom tab bar for phones; the header nav takes over from the sm breakpoint. */
export default function MobileNav() {
  const path = usePathname();
  const cls = (active: boolean) =>
    `flex flex-1 flex-col items-center gap-1 py-2 text-[11px] ${active ? "text-ink" : "text-muted"}`;

  return (
    <nav
      aria-label="Main"
      className="no-print fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-canvas/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
    >
      {ITEMS.map((it) => {
        const active = it.href === "/" ? path === "/" : path.startsWith(it.href);
        return (
          <Link key={it.href} href={it.href} aria-current={active ? "page" : undefined} className={cls(active)}>
            <svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {it.icon}
            </svg>
            {it.label}
          </Link>
        );
      })}
      <button type="button" onClick={openPalette} className={cls(false)}>
        <svg viewBox="0 0 16 16" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" aria-hidden>
          <circle cx="7" cy="7" r="4.5" />
          <path d="M10.5 10.5l3 3" />
        </svg>
        Search
      </button>
    </nav>
  );
}
