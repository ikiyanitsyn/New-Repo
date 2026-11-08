import type { Trip } from "@/lib/trip";
import { summaryParts } from "./summary";

/** One quiet line replacing the old travellers, cabin, leaving-from and date editors. */
export function TripSummary({ trip }: { trip: Trip }) {
  const parts = summaryParts(trip);
  return (
    <div className="flex items-start justify-between gap-3 rounded-md border border-line px-3 py-2" data-testid="trip-summary">
      <p className="flex min-w-0 flex-1 flex-wrap text-[13px] leading-snug text-ink-2">
        {parts.map((p, i) => (
          <span key={i} className="whitespace-nowrap">
            {i > 0 && <span className="px-1 text-ink-3" aria-hidden>&middot;</span>}
            <span className={i === 0 ? "text-ink" : ""}>{p}</span>
          </span>
        ))}
      </p>
      <button type="button" className="btn !h-7 flex-none !px-3 !text-[12.5px]" onClick={() => { window.location.hash = "start"; }} aria-label="Edit trip search">
        Edit
      </button>
    </div>
  );
}
