"use client";

import { fmtDay } from "@/lib/format";
import { outdoorsy, rentalSearchLinks, staySearchLinks } from "@/lib/places/links";
import type { StayIdea } from "@/lib/ai/schema";
import type { StopWithDates, Trip } from "@/lib/trip";
import { ArrowIcon, ExternalIcon, SparkIcon } from "../icons";
import { CollapseButton } from "./CollapseButton";

interface Props {
  trip: Trip;
  stops: StopWithDates[];
  onExplore: (stopId: string) => void;
  onConcierge: () => void;
  collapsed?: boolean;
  onCollapse?: () => void;
  onExpand?: () => void;
}

/**
 * The right-hand panel for a stay with no flights: where and when, the hotel or rental
 * chosen so far, searches on Airbnb, Vrbo, Booking.com (and Hipcamp and Recreation.gov
 * for parks and forests), and the concierge's ideas for where to base yourself.
 */
export function StayPanel({ trip, stops, onExplore, onConcierge, collapsed = false, onCollapse, onExpand }: Props) {
  const ideas = trip.plan?.response.stays ?? [];
  return (
    <>
      <section id="leg-panel" className="panel results scroll-mt-4" aria-label="Your stay" data-collapsed={collapsed}>
        <div className="scroll-y flex min-h-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-2 px-5 pt-4">
            <span className="eyebrow">Your stay · no flights</span>
            {onCollapse && <CollapseButton onClick={onCollapse} />}
          </header>
          {stops.length === 0 && <p className="px-5 py-4 text-[14px] text-ink-2">Add where you&rsquo;re staying to begin.</p>}
          {stops.map((st) => (
            <StopStay key={st.id} trip={trip} stop={st} ideas={ideas.filter((x) => x.city === st.city)} onExplore={() => onExplore(st.id)} />
          ))}
          <div className="mx-5 mb-5 mt-1 flex flex-col gap-2 rounded-xl border px-4 py-3" style={{ borderColor: "var(--accent)", background: "var(--accent-soft)" }}>
            <div className="text-[14px] font-medium">
              {ideas.length ? "Your concierge plan is ready." : "Not sure where to base yourself?"}
            </div>
            <p className="text-[13px] leading-relaxed text-ink-2">
              {ideas.length
                ? "Open it to see the day-by-day plan, or ask again with what matters to you."
                : "Tell the concierge what you like (hiking, a lake view, a hot tub, quiet) and it suggests where to stay, what kind of place to rent and a plan for each day."}
            </p>
            <button type="button" className="btn btn-primary self-start !h-9" onClick={onConcierge}>
              <SparkIcon size={14} /> {trip.plan ? "View my plan" : "Plan my stay with the concierge"}
            </button>
          </div>
        </div>
      </section>
      {collapsed && (
        <button type="button" className="results-tab" onClick={onExpand} aria-label="Show your stay" title="Show your stay">
          <span className="results-tab-label">Stay</span>
        </button>
      )}
    </>
  );
}

function StopStay({ trip, stop, ideas, onExplore }: { trip: Trip; stop: StopWithDates; ideas: StayIdea[]; onExplore: () => void }) {
  const city = stop.cityInfo;
  const hotel = trip.hotels?.[stop.city];
  const links = staySearchLinks(city, stop.arrive, stop.depart, trip.adults);
  const where = city.area ?? city.countryName;
  return (
    <div className="flex flex-col gap-4 border-b border-line px-5 pb-5 pt-3">
      <div>
        <h2 className="display text-[28px] leading-tight">{city.name}</h2>
        <p className="mt-0.5 text-[13px] text-ink-2">
          {[city.kind, where].filter(Boolean).join(" · ")}
        </p>
        <p className="data mt-1.5 text-[12.5px] text-ink-2">
          {fmtDay(stop.arrive)} → {fmtDay(stop.depart)} · {stop.nights} {stop.nights === 1 ? "night" : "nights"} · {trip.adults} {trip.adults === 1 ? "guest" : "guests"}
        </p>
      </div>

      {hotel ? (
        <div className="rounded-lg border border-line px-3.5 py-3">
          <div className="eyebrow !text-[10px]">Staying at</div>
          <div className="mt-0.5 text-[15px] font-medium">{hotel.name}</div>
          {hotel.nightly !== undefined && <div className="data text-[12.5px] text-ink-2">${hotel.nightly.toLocaleString("en-US")} a night</div>}
          <button type="button" className="mt-1.5 text-[12.5px] font-medium text-accent hover:underline" onClick={onExplore}>Change</button>
        </div>
      ) : (
        <button type="button" className="btn btn-primary !h-11 justify-between" onClick={onExplore}>
          <span>Browse places to stay in {city.name}</span> <ArrowIcon size={14} />
        </button>
      )}

      <div className="flex flex-col gap-2">
        <div className="eyebrow !text-[10px]">Search with your dates and {trip.adults === 1 ? "1 guest" : `${trip.adults} guests`}</div>
        <div className="flex flex-wrap gap-2">
          {links.map((l) => (
            <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="btn !h-9 !text-[13px]">
              {l.label} <ExternalIcon size={11} />
            </a>
          ))}
        </div>
        {outdoorsy(city) && city.country === "US" && (
          <p className="text-[12px] leading-relaxed text-ink-3">
            Recreation.gov books campgrounds, cabins and fire lookouts on public land; Hipcamp lists private land, glamping and cabins.
          </p>
        )}
      </div>

      {ideas.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="eyebrow !text-[10px]">Where the concierge suggests</div>
          <ul className="cascade flex flex-col gap-2">
            {ideas.map((x) => <StayIdeaCard key={`${x.area}-${x.kind}`} idea={x} where={where} country={city.country} checkin={stop.arrive} checkout={stop.depart} adults={trip.adults} outdoors={outdoorsy(city)} />)}
          </ul>
        </div>
      )}
    </div>
  );
}

/** One suggested base, with searches for that exact area. Used here and in the concierge. */
export function StayIdeaCard({ idea, where, country, checkin, checkout, adults, outdoors }: {
  idea: StayIdea; where: string; country: string; checkin: string; checkout: string; adults: number; outdoors: boolean;
}) {
  const area = `${idea.area}, ${where}`;
  const links = rentalSearchLinks(area, country, checkin, checkout, adults, outdoors && /camp|cabin|yurt|lookout|glamp/i.test(idea.kind));
  const booking = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(area)}&checkin=${checkin}&checkout=${checkout}&group_adults=${adults}&no_rooms=1`;
  return (
    <li className="lift rounded-lg border border-line px-3.5 py-3" style={{ background: "var(--surface-solid)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
        <span className="text-[14.5px] font-semibold">{idea.area}</span>
        {idea.price && <span className="data text-[12px] text-ink-2">{idea.price}</span>}
      </div>
      {idea.kind && <div className="chip chip-muted mt-1 !h-5 !text-[11px]">{idea.kind}</div>}
      {idea.why && <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">{idea.why}</p>}
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12.5px]">
        {[...links, { label: "Booking.com", url: booking }].map((l) => (
          <a key={l.label} href={l.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
            {l.label} <ExternalIcon size={10} />
          </a>
        ))}
      </div>
    </li>
  );
}
