import type { FactT } from "@/lib/types";
import { metric } from "@/lib/metrics";
import { Num } from "@/components/evidence/Evidence";

export function NirfTimeline({
  rows,
}: {
  rows: { category: string; points: { year: string; fact: FactT | undefined }[] }[];
}) {
  const years = [...new Set(rows.flatMap((r) => r.points.map((p) => p.year)))].sort();
  if (rows.length === 0 || years.length === 0) {
    return <div className="py-6 text-center text-sm text-muted">Not available</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-sm" aria-label="NIRF rank by category and year">
        <thead>
          <tr>
            <th
              scope="col"
              className="border-b border-line px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wide text-muted"
            >
              Category
            </th>
            {years.map((y) => (
              <th
                key={y}
                scope="col"
                className="tnum border-b border-line px-3 py-2 text-center text-[11px] font-medium uppercase tracking-wide text-muted"
              >
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category}>
              <th scope="row" className="whitespace-nowrap border-b border-line px-3 py-2 text-left font-medium text-ink">
                {(metric(r.category)?.label ?? r.category).replace(/^NIRF\s+/, "")}
              </th>
              {years.map((y, yi) => {
                const fact = r.points.find((p) => p.year === y)?.fact;
                // Popovers in the right half of the table open leftwards.
                const flip = yi >= years.length / 2 ? "[&_[data-pop]]:left-auto [&_[data-pop]]:right-0" : "";
                return (
                  <td key={y} className={`border-b border-line px-3 py-2 text-center ${flip}`}>
                    {!fact ? (
                      <span className="text-xs text-muted">Not ranked</span>
                    ) : fact.status === "UNAVAILABLE" || (fact.valueNum === null && fact.valueText === null) ? (
                      <Num fact={fact} className="text-xs" />
                    ) : (
                      <span className="inline-flex rounded-full border border-brand/25 bg-brand/5 px-2 py-0.5">
                        <Num fact={fact} unit={fact.valueNum !== null ? "rank" : "text"} className="font-semibold text-brand" />
                      </span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
