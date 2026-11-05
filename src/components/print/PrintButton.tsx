import Link from "next/link";

export const ITINERARY_PATH = "/itinerary";

/**
 * Opens the printable itinerary. Drop it into the top bar, trip builder or
 * concierge: `<PrintButton />`, or `<PrintButton className="btn btn-ghost" label="Print" />`.
 * The planner saves the trip to this browser on every change, so the
 * itinerary page always shows the latest version.
 */
export function PrintButton({ className = "btn", label = "Itinerary" }: { className?: string; label?: string }) {
  return (
    <Link href={ITINERARY_PATH} className={className} title="Printable itinerary and PDF">
      <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M7 9V3.5h10V9M7 17H5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2h-2" />
        <path d="M7 14h10v6.5H7z" />
      </svg>
      {label}
    </Link>
  );
}
