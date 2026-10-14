import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import type { Flag, FlagBand } from "@/lib/types";
import type { TrendDir } from "@/lib/facts";
import { metric } from "@/lib/metrics";
import { Num } from "@/components/evidence/Evidence";

/*
 * Design language: a printed diligence dossier. Paper canvas, hairline rules,
 * serif display type for titles and headline figures, sans for everything else.
 * Boxes are used sparingly; most structure comes from rules and whitespace.
 */

export function Card({
  title,
  action,
  className = "",
  children,
}: {
  title?: ReactNode;
  action?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`rounded-md border border-line bg-surface ${className}`}>
      {title || action ? (
        <header className="flex items-baseline justify-between gap-3 px-5 pt-4">
          <h2 className="display text-[17px] font-medium leading-tight text-ink">{title}</h2>
          {action ? <div className="text-xs text-muted">{action}</div> : null}
        </header>
      ) : null}
      <div className="px-5 pb-5 pt-3">{children}</div>
    </section>
  );
}

/** Unboxed section with a numbered kicker and a heavy top rule. */
export function Section({
  index,
  title,
  aside,
  className = "",
  children,
}: {
  index?: string;
  title: ReactNode;
  aside?: ReactNode;
  className?: string;
  children?: ReactNode;
}) {
  return (
    <section className={`border-t-2 border-ink pt-3 ${className}`}>
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 className="flex items-baseline gap-3">
          {index ? <span className="font-mono text-[11px] text-faint">{index}</span> : null}
          <span className="display text-xl font-medium text-ink">{title}</span>
        </h2>
        {aside ? <div className="text-sm text-muted">{aside}</div> : null}
      </header>
      {children}
    </section>
  );
}

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="display text-[28px] font-medium leading-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[12px] text-muted">{children}</div>;
}

/** Small mono kicker, e.g. "AISHE C-90002". */
export function Kicker({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`font-mono text-[11px] uppercase tracking-[0.08em] text-faint ${className}`}>{children}</div>;
}

/** Headline figure: label above, large serif value, optional note below. */
export function Stat({
  label,
  children,
  sub,
  size = "md",
  className = "",
}: {
  label: ReactNode;
  children: ReactNode;
  sub?: ReactNode;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const v = size === "lg" ? "text-[44px] leading-none" : size === "sm" ? "text-xl leading-tight" : "text-[30px] leading-none";
  return (
    <div className={`min-w-0 ${className}`}>
      <div className="text-[12px] text-muted">{label}</div>
      <div className={`display mt-2 text-ink ${v}`}>{children}</div>
      {sub ? <div className="mt-1.5 text-xs text-muted">{sub}</div> : null}
    </div>
  );
}

/**
 * Row of stats separated by vertical hairlines. Every item carries a left rule; the row is pulled
 * left and clipped so whichever item starts a wrapped line loses its rule and sits flush.
 */
export function StatRow({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`overflow-x-clip ${className}`}>
      <div className="-ml-5 grid grid-cols-2 gap-y-6 sm:grid-cols-3 lg:grid-cols-[repeat(auto-fit,minmax(150px,1fr))] [&>*]:-ml-px [&>*]:border-l [&>*]:border-line [&>*]:px-5">
        {children}
      </div>
    </div>
  );
}

export function Button({
  children,
  variant = "secondary",
  className = "",
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" }) {
  const v =
    variant === "primary"
      ? "bg-ink text-canvas hover:opacity-90"
      : variant === "ghost"
        ? "text-muted hover:text-ink hover:bg-sunken"
        : "border border-line-strong bg-surface text-ink hover:bg-sunken";
  return (
    <button
      {...rest}
      className={`inline-flex items-center justify-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${v} ${className}`}
    >
      {children}
    </button>
  );
}

export function TrendArrow({ dir }: { dir: TrendDir }) {
  if (dir === "unknown") return <span className="text-xs text-faint">n/a</span>;
  const tone = dir === "up" ? "text-verified" : dir === "down" ? "text-critical" : "text-muted";
  const rotate = dir === "up" ? -45 : dir === "down" ? 45 : 0;
  const name = dir === "up" ? "Rising" : dir === "down" ? "Falling" : "Flat";
  return (
    <svg
      viewBox="0 0 16 16"
      width="16"
      height="16"
      role="img"
      aria-label={name}
      className={`inline-block align-middle ${tone}`}
    >
      <title>{name}</title>
      <g
        transform={`rotate(${rotate} 8 8)`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M3 8h10M9 4l4 4-4 4" />
      </g>
    </svg>
  );
}

const BAND: Record<FlagBand, { label: string; rule: string; text: string }> = {
  CRITICAL: { label: "Critical", rule: "bg-critical", text: "text-critical" },
  ATTENTION: { label: "Attention", rule: "bg-attention", text: "text-attention" },
  VERIFIED: { label: "Verified", rule: "bg-verified", text: "text-verified" },
};

export function FlagCard({ flag }: { flag: Flag }) {
  const b = BAND[flag.band];
  return (
    <article className="relative border-b border-line py-3.5 pl-4 last:border-b-0">
      <span aria-hidden className={`absolute bottom-3.5 left-0 top-3.5 w-[3px] rounded-full ${b.rule}`} />
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[14px] font-medium leading-snug text-ink">{flag.title}</h3>
        <span className={`shrink-0 font-mono text-[10px] uppercase tracking-[0.08em] ${b.text}`}>{b.label}</span>
      </div>
      <p className="mt-1 text-[13px] leading-relaxed text-muted">{flag.detail}</p>
      {flag.evidence.length ? (
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-xs">
          {flag.evidence.map((f) => (
            <li key={f.id} className="flex items-center gap-2">
              <span className="text-faint">
                {metric(f.metricKey)?.label ?? f.metricKey}
                {f.period !== "current" ? ` ${f.period}` : ""}
              </span>
              <Num fact={f} className="font-medium text-ink" />
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="border-y border-dashed border-line py-6 text-center text-sm text-muted">{children}</div>;
}

export function SampleBadge() {
  return (
    <span
      title="Fictional sample data, not a real institution"
      className="inline-flex items-center whitespace-nowrap rounded-sm border border-dashed border-selfreported px-1.5 py-px font-mono text-[10px] uppercase tracking-[0.1em] text-selfreported"
    >
      Sample
    </span>
  );
}

export function Th({
  num,
  className = "",
  children,
  ...rest
}: ThHTMLAttributes<HTMLTableCellElement> & { num?: boolean }) {
  return (
    <th
      scope="col"
      {...rest}
      className={`border-b border-line-strong px-3 py-2 text-[12px] font-normal text-muted first:pl-0 last:pr-0 ${num ? "text-right" : "text-left"} ${className}`}
    >
      {children}
    </th>
  );
}

// Right-aligned cells open their evidence popover leftwards so it stays inside the table.
export function Td({
  num,
  className = "",
  children,
  ...rest
}: TdHTMLAttributes<HTMLTableCellElement> & { num?: boolean }) {
  return (
    <td
      {...rest}
      className={`border-b border-line px-3 py-2.5 text-[13.5px] text-ink first:pl-0 last:pr-0 ${num ? "tnum text-right [&_[data-pop]]:left-auto [&_[data-pop]]:right-0" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
