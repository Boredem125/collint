"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

const KEY = "iip.trustLens";

const Ctx = createContext<{ on: boolean; toggle(): void }>({ on: false, toggle: () => {} });

export function TrustLensProvider({ children }: { children: ReactNode }) {
  // Starts off on both server and client; the stored preference is applied after mount.
  const [on, setOn] = useState(false);

  useEffect(() => {
    try {
      if (window.localStorage.getItem(KEY) === "on") setOn(true);
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(KEY, next ? "on" : "off");
      } catch {}
      return next;
    });
  }, []);

  return (
    <Ctx.Provider value={{ on, toggle }}>
      <div data-trust-lens={on ? "on" : "off"}>{children}</div>
    </Ctx.Provider>
  );
}

export function useTrustLens(): { on: boolean; toggle(): void } {
  return useContext(Ctx);
}

export function TrustLensToggle() {
  const { on, toggle } = useTrustLens();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={toggle}
      title="Fade every number that is not backed by a verified source"
      className="no-print inline-flex items-center gap-2 rounded-full border border-line bg-surface px-2.5 py-1 text-xs font-medium text-ink hover:border-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
    >
      <span
        aria-hidden
        className={`relative inline-block h-4 w-7 rounded-full transition-colors ${on ? "bg-verified" : "bg-unavailable"}`}
      >
        <span
          className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${on ? "left-3.5" : "left-0.5"}`}
        />
      </span>
      Verified only
    </button>
  );
}
