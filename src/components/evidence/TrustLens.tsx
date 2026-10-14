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
      className={`no-print inline-flex h-8 shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-2 text-[12.5px] transition-colors hover:bg-sunken ${on ? "text-ink" : "text-muted hover:text-ink"}`}
    >
      <span
        aria-hidden
        className={`relative inline-block h-[14px] w-[24px] rounded-full border bg-sunken transition-colors ${on ? "border-ink" : "border-line-strong"}`}
      >
        <span
          className={`absolute top-1/2 h-[8px] w-[8px] -translate-y-1/2 rounded-full transition-all ${on ? "left-[12px] bg-ink" : "left-[2px] bg-faint"}`}
        />
      </span>
      Verified only
    </button>
  );
}
