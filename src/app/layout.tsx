import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { TrustLensProvider, TrustLensToggle } from "@/components/evidence/TrustLens";
import CommandSearch from "@/components/CommandSearch";

export const metadata: Metadata = {
  title: "Institution Intelligence Platform",
  description: "One Search. One Profile. One Executive View.",
};

const NAV = [
  { href: "/", label: "Portfolio" },
  { href: "/compare", label: "Compare" },
  { href: "/import", label: "Import" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <TrustLensProvider>
          <header className="no-print sticky top-0 z-40 border-b border-line bg-surface">
            <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
              <Link href="/" className="flex items-baseline gap-3">
                <span className="text-lg font-semibold tracking-tight text-brand">IIP</span>
                <span className="hidden text-xs text-muted lg:inline">
                  One Search. One Profile. One Executive View.
                </span>
              </Link>
              <div className="min-w-56 flex-1">
                <CommandSearch />
              </div>
              <nav className="flex items-center gap-4 text-sm">
                {NAV.map((n) => (
                  <Link key={n.href} href={n.href} className="text-muted hover:text-ink">
                    {n.label}
                  </Link>
                ))}
              </nav>
              <TrustLensToggle />
            </div>
          </header>
          <main className="mx-auto max-w-7xl px-4 py-6">{children}</main>
        </TrustLensProvider>
      </body>
    </html>
  );
}
