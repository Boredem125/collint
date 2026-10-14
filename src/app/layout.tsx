import type { Metadata } from "next";
import Link from "next/link";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";
import { TrustLensProvider, TrustLensToggle } from "@/components/evidence/TrustLens";
import CommandSearch from "@/components/CommandSearch";
import ThemeToggle from "@/components/ThemeToggle";
import NavLink from "@/components/NavLink";

const sans = Geist({ subsets: ["latin"], variable: "--font-geist" });
const mono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });
const serif = Newsreader({ subsets: ["latin"], variable: "--font-newsreader", style: ["normal", "italic"] });

export const metadata: Metadata = {
  title: { default: "Collint", template: "%s · Collint" },
  description: "College intelligence for partnership due diligence. Every number carries its source.",
};

// Sets the stored theme before first paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("iip.theme");if(t)document.documentElement.dataset.theme=t;else if(matchMedia("(prefers-color-scheme: dark)").matches)document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${sans.variable} ${mono.variable} ${serif.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-screen antialiased">
        <TrustLensProvider>
          <header className="no-print sticky top-0 z-40 border-b border-line bg-canvas/85 backdrop-blur">
            <div className="mx-auto flex h-14 max-w-[1320px] items-center gap-3 px-5">
              <Link href="/" className="flex items-baseline gap-2 pr-2">
                <span className="display text-[23px] font-semibold italic leading-none tracking-tight text-ink">
                  Collint
                </span>
                <span className="hidden font-mono text-[10px] uppercase tracking-[0.12em] text-faint md:inline">
                  diligence
                </span>
              </Link>
              <nav className="hidden items-center gap-0.5 sm:flex">
                <NavLink href="/">Pipeline</NavLink>
                <NavLink href="/compare">Compare</NavLink>
                <NavLink href="/import">Import</NavLink>
              </nav>
              <div className="ml-auto w-full max-w-sm">
                <CommandSearch />
              </div>
              <TrustLensToggle />
              <ThemeToggle />
            </div>
          </header>
          <main className="mx-auto max-w-[1320px] px-5 pb-24 pt-8">{children}</main>
        </TrustLensProvider>
      </body>
    </html>
  );
}
