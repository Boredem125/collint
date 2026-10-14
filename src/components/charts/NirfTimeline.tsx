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
      <table className="w-full border-collapse" aria-label="NIRF rank by category and year">
        <thead>
          <tr>
            <th scope="col" className="border-b border-line-strong py-2 pr-3 text-left text-[12px] font-normal text-muted">
              Category
            </th>
            {years.map((y, yi) => (
              <th
                key={y}
                scope="col"
                className={`tnum border-b ${yi < years.length - 3 ? "hidden sm:table-cell" : ""} border-line-strong px-2 py-2 text-right font-mono text-[11px] font-normal text-faint last:pr-0 sm:px-3`}
              >
                {y}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.category}>
              <th
                scope="row"
                className="border-b border-line py-2.5 pr-2 text-left text-[13px] sm:whitespace-nowrap sm:pr-3 sm:text-[13.5px] font-normal text-ink"
              >
                {(metric(r.category)?.label ?? r.category).replace(/^NIRF\s+/, "")}
              </th>
              {years.map((y, yi) => {
                const fact = r.points.find((p) => p.year === y)?.fact;
                // Popovers in the right half of the table open leftwards.
                const flip = yi >= years.length / 2 ? "[&_[data-pop]]:left-auto [&_[data-pop]]:right-0" : "";
                return (
                  <td
                    key={y}
                    className={`border-b border-line px-2 py-2.5 text-right last:pr-0 sm:px-3 ${flip} ${yi < years.length - 3 ? "hidden sm:table-cell" : ""}`}
                  >
                    {!fact ? (
                      <span className="text-[12px] text-faint">Not ranked</span>
                    ) : fact.status === "UNAVAILABLE" || (fact.valueNum === null && fact.valueText === null) ? (
                      <Num fact={fact} className="text-[12px]" />
                    ) : (
                      <Num
                        fact={fact}
                        unit={fact.valueNum !== null ? "rank" : "text"}
                        className="display text-[18px] leading-none text-ink"
                      />
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
