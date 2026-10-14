"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname, useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/data";
import { useTrustLens } from "@/components/evidence/TrustLens";
import { PROFILE_TABS } from "@/components/ProfileTabs";

type Item = {
  key: string;
  group: string;
  label: string;
  sub?: string;
  hint?: string;
  run: () => void;
};

const GROUP_ORDER = ["Institutions", "This dossier", "Go to", "Actions"];

function SearchIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden className={className}>
      <circle cx="7" cy="7" r="4.5" />
      <path d="M10.5 10.5 14 14" strokeLinecap="round" />
    </svg>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded-[3px] border border-line bg-canvas px-1 py-px font-mono text-[10px] leading-none text-faint">
      {children}
    </kbd>
  );
}

export default function CommandSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const lens = useTrustLens();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState(0);
  const [mac, setMac] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setQ("");
    setHits([]);
    setActive(0);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    if (!term) {
      setHits([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(term)}`, { signal: ctrl.signal });
        const data: SearchHit[] = res.ok ? await res.json() : [];
        setHits(data);
        setLoading(false);
      } catch {
        // aborted by a newer keystroke
      }
    }, 160);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const instId = useMemo(() => {
    const m = pathname?.match(/^\/institutions\/([^/]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  }, [pathname]);

  const items = useMemo<Item[]>(() => {
    const nav = (href: string) => () => router.push(href);
    const commands: Item[] = [];
    if (instId) {
      const base = `/institutions/${encodeURIComponent(instId)}`;
      PROFILE_TABS.forEach((t, i) => {
        const href = t.slug ? `${base}/${t.slug}` : base;
        commands.push({
          key: `tab-${t.slug || "overview"}`,
          group: "This dossier",
          label: `Jump to ${t.label}`,
          hint: String(i + 1).padStart(2, "0"),
          run: nav(href),
        });
      });
      commands.push({
        key: "brief",
        group: "This dossier",
        label: "Open executive brief",
        hint: "brief",
        run: nav(`${base}/brief`),
      });
    }
    commands.push(
      { key: "go-pipeline", group: "Go to", label: "Go to Pipeline", hint: "/", run: nav("/") },
      { key: "go-compare", group: "Go to", label: "Compare institutions", hint: "/compare", run: nav("/compare") },
      { key: "go-import", group: "Go to", label: "Import data", hint: "/import", run: nav("/import") },
      {
        key: "lens",
        group: "Actions",
        label: "Toggle Verified-only lens",
        hint: lens.on ? "on" : "off",
        run: lens.toggle,
      },
      {
        key: "theme",
        group: "Actions",
        label: "Toggle theme",
        run: () => {
          const el = document.documentElement;
          const dark =
            el.dataset.theme === "dark" ||
            (!el.dataset.theme && window.matchMedia("(prefers-color-scheme: dark)").matches);
          const next = dark ? "light" : "dark";
          el.dataset.theme = next;
          try {
            localStorage.setItem("iip.theme", next);
          } catch {}
        },
      },
    );

    const term = q.trim().toLowerCase();
    const matched = term ? commands.filter((c) => c.label.toLowerCase().includes(term)) : commands;
    const insts: Item[] = hits.map((h) => ({
      key: `inst-${h.id}`,
      group: "Institutions",
      label: h.name,
      sub: [h.aisheCode && `AISHE ${h.aisheCode}`, h.city, h.university].filter(Boolean).join(" · "),
      hint: h.match || undefined,
      run: nav(`/institutions/${encodeURIComponent(h.id)}`),
    }));
    const all = [...insts, ...matched];
    return GROUP_ORDER.flatMap((g) => all.filter((i) => i.group === g));
  }, [q, hits, instId, lens.on, lens.toggle, router]);

  useEffect(() => {
    setActive(0);
  }, [q, hits]);

  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const choose = (item: Item | undefined) => {
    if (!item) return;
    close();
    item.run();
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => (items.length ? (i + 1) % items.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(items[active]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    }
  };

  const term = q.trim();
  const shortcut = mac ? "⌘K" : "Ctrl K";

  const palette = (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center bg-ink/30 px-4 pt-[12vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        className="flex max-h-[min(560px,76vh)] w-full max-w-[620px] flex-col overflow-hidden rounded-lg border border-line-strong bg-surface shadow-[0_24px_60px_-24px_rgb(0_0_0/0.5)]"
      >
        <div className="flex items-center gap-3 border-b border-line px-4">
          <SearchIcon className="shrink-0 text-faint" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Search institutions, AISHE code, promoter, or type a command"
            aria-label="Search or run a command"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-palette-list"
            aria-activedescendant={items[active] ? `cp-${items[active].key}` : undefined}
            autoComplete="off"
            spellCheck={false}
            // Inline, because the global :focus-visible ring is unlayered and would win over a utility.
            style={{ outline: "none" }}
            className="h-12 min-w-0 flex-1 bg-transparent text-[15px] text-ink placeholder:text-faint"
          />
          {loading ? <span className="font-mono text-[10px] text-faint">searching</span> : null}
          <Kbd>Esc</Kbd>
        </div>
        <div ref={listRef} id="command-palette-list" role="listbox" className="min-h-0 flex-1 overflow-y-auto py-1.5">
          {items.length === 0 ? (
            <div className="px-4 py-8 text-center text-[13px] text-muted">
              {loading ? "Searching…" : term ? `Nothing matches “${term}”` : "Type to search"}
            </div>
          ) : null}
          {items.map((it, i) => {
            const head = i === 0 || items[i - 1].group !== it.group;
            const on = i === active;
            return (
              <div key={it.key}>
                {head ? (
                  <div
                    role="presentation"
                    className="px-4 pb-1 pt-3 font-mono text-[10px] uppercase tracking-[0.09em] text-faint"
                  >
                    {it.group}
                  </div>
                ) : null}
                <div
                  id={`cp-${it.key}`}
                  data-idx={i}
                  role="option"
                  aria-selected={on}
                  onMouseMove={() => setActive(i)}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    choose(it);
                  }}
                  className={`mx-1.5 flex cursor-pointer items-baseline justify-between gap-4 rounded-md px-2.5 py-2 ${on ? "bg-sunken" : ""}`}
                >
                  <span className="min-w-0">
                    <span className={`block truncate text-[13.5px] ${on ? "text-ink" : "text-ink/90"}`}>{it.label}</span>
                    {it.sub ? <span className="mt-0.5 block truncate text-[12px] text-muted">{it.sub}</span> : null}
                  </span>
                  {it.hint ? (
                    <span className="max-w-[45%] shrink-0 truncate font-mono text-[10.5px] text-faint">{it.hint}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 font-mono text-[10.5px] text-faint">
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd> move
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Kbd>↵</Kbd> open
          </span>
          <span className="ml-auto">{shortcut} to toggle</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label="Search or jump (Ctrl K)"
        className="group flex h-8 w-full min-w-0 items-center gap-2 rounded-md border border-line bg-surface/70 px-2.5 text-left text-[13px] text-faint transition-colors hover:border-line-strong hover:text-muted"
      >
        <SearchIcon className="shrink-0" />
        <span className="min-w-0 flex-1 truncate">Search or jump…</span>
        <span className="hidden sm:inline-flex">
          <Kbd>{shortcut}</Kbd>
        </span>
      </button>
      {open && mounted ? createPortal(palette, document.body) : null}
    </>
  );
}
