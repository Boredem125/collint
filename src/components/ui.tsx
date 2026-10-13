import type { ReactNode, TdHTMLAttributes, ThHTMLAttributes } from "react";
import type { Flag, FlagBand } from "@/lib/types";
import type { TrendDir } from "@/lib/facts";
import { metric } from "@/lib/metrics";
import { Num } from "@/components/evidence/Evidence";

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
    <section className={`rounded-lg border border-line bg-surface ${className}`}>
      {title || action ? (
        <header className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">{title}</h2>
          {action ? <div className="text-xs">{action}</div> : null}
        </header>
      ) : null}
      <div className="p-4">{children}</div>
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
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="text-xl font-semibold tracking-tight text-ink">{title}</h1>
        {subtitle ? <p className="mt-0.5 text-sm text-muted">{subtitle}</p> : null}
      </div>
      {children ? <div className="flex flex-wrap items-center gap-2">{children}</div> : null}
    </div>
  );
}

export function Label({ children }: { children: ReactNode }) {
  return <div className="text-[11px] font-medium uppercase tracking-wide text-muted">{children}</div>;
}

export function TrendArrow({ dir }: { dir: TrendDir }) {
  if (dir === "unknown") return <span className="text-xs text-muted">n/a</span>;
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

const BAND: Record<FlagBand, { label: string; edge: string; text: string; dot: string }> = {
  CRITICAL: { label: "Critical", edge: "border-l-critical", text: "text-critical", dot: "bg-critical" },
  ATTENTION: { label: "Attention", edge: "border-l-attention", text: "text-attention", dot: "bg-attention" },
  VERIFIED: { label: "Verified", edge: "border-l-verified", text: "text-verified", dot: "bg-verified" },
};

export function FlagCard({ flag }: { flag: Flag }) {
  const b = BAND[flag.band];
  return (
    <article className={`rounded-lg border border-l-4 border-line bg-surface p-3 ${b.edge}`}>
      <div className="flex items-center justify-between gap-2 text-[11px] font-semibold uppercase tracking-wide">
        <span className={`inline-flex items-center gap-1.5 ${b.text}`}>
          <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${b.dot}`} />
          {b.label}
        </span>
        <span className="font-medium text-muted">{flag.module}</span>
      </div>
      <h3 className="mt-1 text-sm font-semibold text-ink">{flag.title}</h3>
      <p className="mt-0.5 text-sm text-muted">{flag.detail}</p>
      {flag.evidence.length ? (
        <ul className="mt-2 flex flex-col gap-1 border-t border-line pt-2 text-xs">
          {flag.evidence.map((f) => (
            <li key={f.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 truncate text-muted">
                {metric(f.metricKey)?.label ?? f.metricKey}
                {f.period !== "current" ? ` · ${f.period}` : ""}
              </span>
              <span className="[&_[data-pop]]:left-auto [&_[data-pop]]:right-0">
                <Num fact={f} className="font-medium text-ink" />
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </article>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-canvas px-4 py-6 text-center text-sm text-muted">
      {children}
    </div>
  );
}

export function SampleBadge() {
  return (
    <span
      title="Fictional sample data, not a real institution"
      className="inline-flex items-center whitespace-nowrap rounded-full border border-selfreported/40 bg-selfreported/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-selfreported"
    >
      Sample data
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
      className={`border-b border-line px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-muted ${num ? "text-right" : "text-left"} ${className}`}
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
      className={`border-b border-line px-3 py-2 text-sm text-ink ${num ? "tnum text-right [&_[data-pop]]:left-auto [&_[data-pop]]:right-0" : ""} ${className}`}
    >
      {children}
    </td>
  );
}
