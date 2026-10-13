"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SearchHit } from "@/lib/data";

export default function CommandSearch() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
        setActive(0);
        setLoading(false);
      } catch {
        // aborted by a newer keystroke
      }
    }, 180);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [q]);

  const go = (hit: SearchHit | undefined) => {
    if (!hit) return;
    setOpen(false);
    setQ("");
    inputRef.current?.blur();
    router.push(`/institutions/${hit.id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActive((i) => (hits.length ? (i + 1) % hits.length : 0));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => (hits.length ? (i - 1 + hits.length) % hits.length : 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(hits[active]);
    } else if (e.key === "Escape") {
      setOpen(false);
      inputRef.current?.blur();
    }
  };

  const show = open && q.trim().length > 0;

  return (
    <div className="relative">
      <input
        ref={inputRef}
        type="search"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        placeholder="College name, AISHE code, university, city or promoter"
        aria-label="Search institutions"
        role="combobox"
        aria-expanded={show}
        aria-controls="command-search-results"
        autoComplete="off"
        className="w-full rounded-lg border border-line bg-canvas py-2 pl-3 pr-16 text-sm text-ink placeholder:text-muted focus:border-brand focus:bg-surface focus:outline-none"
      />
      <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-line bg-surface px-1.5 py-0.5 text-[10px] text-muted">
        Ctrl K
      </kbd>
      {show && (
        <ul
          id="command-search-results"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1 max-h-96 overflow-auto rounded-lg border border-line bg-surface shadow-lg"
        >
          {hits.length === 0 && (
            <li className="px-3 py-3 text-sm text-muted">{loading ? "Searching…" : "No institutions match"}</li>
          )}
          {hits.map((h, i) => (
            <li
              key={h.id}
              role="option"
              aria-selected={i === active}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => {
                e.preventDefault();
                go(h);
              }}
              className={`cursor-pointer border-b border-line px-3 py-2 last:border-b-0 ${i === active ? "bg-canvas" : ""}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm font-medium text-ink">{h.name}</span>
                {h.match && <span className="shrink-0 text-xs text-brand">{h.match}</span>}
              </div>
              <div className="mt-0.5 text-xs text-muted">
                AISHE {h.aisheCode} · {h.city} · {h.university}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
