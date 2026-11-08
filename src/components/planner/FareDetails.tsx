import { offerAlliance } from "@/lib/flights/alliances";
import { bagsKnown, fareTypeOf } from "@/lib/flights/bags";
import type { Cabin, FlightOffer } from "@/lib/flights/types";
import { BagBadge } from "./BagIcons";

/** Fare type, alliance and bags for one fare row. Anything the provider did not say is labelled, never guessed. */
export function FareDetails({ offer, cabin }: { offer: FlightOffer; cabin: Cabin }) {
  const alliance = offerAlliance(offer.airlines);
  const fare = fareTypeOf(cabin, offer.fareText);
  const known = bagsKnown(offer.bags);
  return (
    <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1.5" data-testid="fare-details">
      <span className="chip chip-muted" title={offer.fareText?.some((s) => /basic/i.test(s)) ? "Google Flights marks this as a basic fare" : "From the cabin you searched"}>
        {fare}
      </span>
      {alliance && <span className="text-[11.5px] text-ink-2">{alliance}</span>}
      {known ? (
        <span className="ml-auto flex items-center gap-2">
          <BagBadge kind="carryOn" count={offer.bags?.carryOn} />
          <BagBadge kind="checked" count={offer.bags?.checked} />
        </span>
      ) : (
        <span className="ml-auto text-[11.5px] text-ink-3">Bags: check with airline</span>
      )}
    </div>
  );
}
