import Link from "next/link";
import { useState } from "react";
import { fmtDay, fmtRange, fmtShort } from "@/lib/format";
import { formatDuration, formatUsd } from "@/lib/geo";
import type { DocCity, DocDay, DocTransport, ItineraryDoc } from "@/lib/itineraryDoc";
import { newId, type Trip } from "@/lib/trip";
import type { TripAction } from "@/lib/tripReducer";
import { MODE_ICON, MODE_LABEL } from "../icons";
import { styles } from "./styles";

export type SectionId = "cover" | "glance" | "days" | "costs" | "stays" | "activities" | "places" | "before";
export type Layout = "compact" | "detailed";

/** Passed on the itinerary page so the traveller can edit; left out for a read-only view (shared trips). */
export interface EditApi {
  /** The trip as stored (raw values for the inputs). */
  trip: Trip;
  dispatch: (a: TripAction) => void;
}

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "cover", label: "Cover" },
  { id: "glance", label: "At a glance" },
  { id: "days", label: "Day by day" },
  { id: "costs", label: "Flights & costs" },
  { id: "stays", label: "Stays" },
  { id: "activities", label: "Activities & bookings" },
  { id: "places", label: "Saved places" },
  { id: "before", label: "Before you go" },
];

const KIND_LABEL: Record<string, string> = { see: "See", do: "Do", eat: "Eat", drink: "Drink", stay: "Stay", travel: "Travel", free: "Free" };

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

interface Props {
  doc: ItineraryDoc;
  sections: Record<SectionId, boolean>;
  layout: Layout;
  edit?: EditApi;
}

/** The document itself: a stack of sheets that become printed pages. */
export function ItineraryDocument({ doc, sections, layout, edit }: Props) {
  const detailed = layout === "detailed";
  return (
    <main className={styles.paperStack} aria-label={`${doc.title} itinerary`}>
      {sections.cover && <Cover doc={doc} edit={edit} />}
      {sections.glance && <Glance doc={doc} detailed={detailed} />}
      {sections.days &&
        (detailed ? (
          doc.cities.map((c, i) => <CitySheet key={c.stopId} doc={doc} city={c} first={i === 0} detailed edit={edit} />)
        ) : (
          <section className={styles.sheet} aria-labelledby="days-h">
            <SheetHead id="days-h" eyebrow="Day by day" title="Every day, in order" />
            <PlanNotice doc={doc} />
            {doc.cities.map((c) => <CityBlock key={c.stopId} city={c} detailed={false} edit={edit} />)}
          </section>
        ))}
      {sections.costs && <Costs doc={doc} edit={edit} />}
      {sections.stays && <Stays doc={doc} edit={edit} />}
      {sections.activities && <Activities doc={doc} edit={edit} />}
      {sections.places && <Places doc={doc} />}
      {sections.before && <Before doc={doc} />}
    </main>
  );
}

function SheetHead({ id, eyebrow, title, aside }: { id: string; eyebrow: string; title: string; aside?: React.ReactNode }) {
  return (
    <header className={styles.sheetHead}>
      <div>
        <p className={styles.eyebrow}>{eyebrow}</p>
        <h2 id={id} className={styles.h2}>{title}</h2>
      </div>
      {aside && <div className={styles.sheetAside}>{aside}</div>}
    </header>
  );
}

// ---------- Editing helpers ----------

/**
 * A value that is typed on screen and printed as plain text. In a read-only view
 * only the text shows. In edit mode the input shows on screen and the text takes
 * its place on paper.
 */
function Editable({ edit, text, children }: { edit?: EditApi; text: React.ReactNode; children: React.ReactNode }) {
  if (!edit) return <>{text}</>;
  return (
    <>
      <span className={styles.printOnly}>{text}</span>
      <span className={styles.noPrint}>{children}</span>
    </>
  );
}

/** A text box that saves when you leave it or press Enter (so a trailing space isn't lost mid-typing). */
function Draft({ value, onCommit, label, multiline, className, placeholder, maxLength, type, inputMode }: {
  value: string;
  onCommit: (v: string) => void;
  label: string;
  multiline?: boolean;
  className?: string;
  placeholder?: string;
  maxLength?: number;
  type?: "text" | "number";
  inputMode?: "decimal" | "text";
}) {
  const commit = (v: string) => { if (v !== value) onCommit(v); };
  if (multiline) {
    return (
      <textarea
        key={value}
        className={`${styles.field} ${className ?? ""}`}
        aria-label={label}
        defaultValue={value}
        rows={2}
        placeholder={placeholder}
        maxLength={maxLength}
        onBlur={(e) => commit(e.target.value)}
      />
    );
  }
  return (
    <input
      key={value}
      className={`${styles.field} ${className ?? ""}`}
      aria-label={label}
      defaultValue={value}
      placeholder={placeholder}
      maxLength={maxLength}
      type={type}
      step={type === "number" ? "any" : undefined}
      inputMode={inputMode}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); }}
    />
  );
}

/** The confirmation-number field for a leg, a hotel or a cost. Printed in mono. */
function Confirm({ id, edit, value, label }: { id: string; edit?: EditApi; value?: string; label: string }) {
  const stored = edit?.trip.confirmations?.[id] ?? "";
  return (
    <Editable edit={edit} text={value ? <span className={styles.conf}>{value}</span> : <span className={styles.muted}>—</span>}>
      <Draft
        label={`Confirmation number, ${label}`}
        value={stored}
        placeholder="Confirmation #"
        maxLength={60}
        className={styles.confInput}
        onCommit={(v) => edit?.dispatch({ type: "confirmation", key: id, value: v })}
      />
    </Editable>
  );
}

// ---------- Cover ----------

function Travellers({ doc, edit }: { doc: ItineraryDoc; edit?: EditApi }) {
  const [name, setName] = useState("");
  const names = edit?.trip.travellers ?? [];
  const text = doc.travellerNames.length ? doc.travellerNames.join(" · ") : plural(doc.travellers, "traveller");
  return (
    <Editable edit={edit} text={text}>
      {names.length > 0 && (
        <ul className={styles.chips}>
          {names.map((n, i) => (
            <li key={`${n}-${i}`} className={styles.chip}>
              {n}
              <button type="button" aria-label={`Remove ${n}`} onClick={() => edit?.dispatch({ type: "travellers", names: names.filter((_, j) => j !== i) })}>×</button>
            </li>
          ))}
        </ul>
      )}
      <form
        className={styles.addRow}
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          edit?.dispatch({ type: "travellers", names: [...names, name] });
          setName("");
        }}
      >
        <input className={styles.field} aria-label="Traveller name" placeholder="Name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn !h-8 !text-[12.5px]" disabled={!name.trim() || names.length >= 9}>Add traveller</button>
      </form>
    </Editable>
  );
}

function Cover({ doc, edit }: { doc: ItineraryDoc; edit?: EditApi }) {
  return (
    <section className={`${styles.sheet} ${styles.cover}`} aria-labelledby="cover-h">
      <div className={styles.band}>
        <p className={styles.bandEyebrow}>Itinerary</p>
        <h1 id="cover-h" className={styles.coverTitle}>{doc.title}</h1>
      </div>

      <dl className={styles.meta}>
        <div><dt>Travelers</dt><dd><Travellers doc={doc} edit={edit} /></dd></div>
        <div><dt>Dates</dt><dd className={styles.num}>{fmtRange(doc.startDate, doc.endDate)}</dd></div>
        <div><dt>Destination</dt><dd>{doc.cityNames.join(" · ")}</dd></div>
      </dl>

      <p className={styles.coverRoute}>{doc.routeLine}</p>

      <dl className={styles.coverFacts}>
        <div><dt>Length</dt><dd><span className={styles.num}>{plural(doc.nights, "night")}</span> · <span className={styles.num}>{plural(doc.dayCount, "day")}</span></dd></div>
        <div><dt>Party</dt><dd>{plural(doc.travellers, "traveller")} · {doc.cabin}</dd></div>
        <div><dt>From</dt><dd>{doc.homeName}</dd></div>
      </dl>

      <table className={styles.stopsTable}>
        <thead>
          <tr><th scope="col">Stop</th><th scope="col">City</th><th scope="col">Dates</th><th scope="col" className={styles.right}>Nights</th></tr>
        </thead>
        <tbody>
          {doc.cities.map((c, i) => (
            <tr key={c.stopId}>
              <td className={styles.num}>{String(i + 1).padStart(2, "0")}</td>
              <td>
                <span className={styles.cityName}>{c.name}</span>
                {c.localName && <span className={styles.local}>{c.localName}</span>}
                <span className={styles.muted}> · {c.countryName}</span>
              </td>
              <td className={styles.num}>{fmtRange(c.arrive, c.depart)}</td>
              <td className={`${styles.num} ${styles.right}`}>{c.nights}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p className={styles.coverFoot}>
        Prepared {fmtShort(new Date().toISOString())} with Intercontinental Nomad. Prices are estimates unless marked as chosen; check times with your booking.
      </p>
    </section>
  );
}

// ---------- At a glance ----------

function TransportCell({ t, detailed }: { t: DocTransport; detailed: boolean }) {
  const Icon = MODE_ICON[t.mode];
  const bits = [t.carrier, t.departTime && `dep ${t.departTime}`, formatDuration(t.durationMin)].filter(Boolean);
  return (
    <div className={styles.tx}>
      <span className={styles.txHead}>
        <Icon size={12} className={styles.txIcon} />
        <span className={styles.code}>{t.from} → {t.to}</span>
      </span>
      <span className={styles.txMeta}>
        {detailed ? bits.join(" · ") : formatDuration(t.durationMin)}
        {t.costKind === "none" && <em className={styles.todo}> · to choose</em>}
        {t.confirmation && <span className={styles.conf}> · {t.confirmation}</span>}
      </span>
    </div>
  );
}

function Glance({ doc, detailed }: { doc: ItineraryDoc; detailed: boolean }) {
  return (
    <section className={`${styles.sheet} ${styles.glanceSheet}`} aria-labelledby="glance-h">
      <SheetHead
        id="glance-h"
        eyebrow="At a glance"
        title={doc.title}
        aside={<span className={styles.code}>{doc.routeLine}</span>}
      />
      <div className={styles.tableScroll}>
        <table className={styles.glance}>
          <colgroup>
            <col className={styles.colDate} /><col className={styles.colDay} /><col className={styles.colCity} />
            <col className={styles.colStay} /><col className={styles.colTx} /><col /><col className={styles.colCost} />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Day</th>
              <th scope="col">City</th>
              <th scope="col">Lodging</th>
              <th scope="col">Transport</th>
              <th scope="col">Plan highlights</th>
              <th scope="col" className={styles.right}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {doc.days.map((d) => {
              const highlights = d.highlights.slice(0, detailed ? 4 : 2);
              return (
                <tr key={d.date} data-kind={d.kind}>
                  <td>
                    <span className={styles.gDate}>{fmtShort(d.date)}</span>
                    <span className={styles.gWeek}>{d.weekday}</span>
                  </td>
                  <td className={styles.num}>{d.dayNumber}</td>
                  <td>
                    <span className={styles.cityName}>{d.cityName}</span>
                    {detailed && d.localName && <span className={styles.local}>{d.localName}</span>}
                  </td>
                  <td>{d.lodging.length ? d.lodging.join(", ") : <span className={styles.muted}>—</span>}</td>
                  <td>{d.transport.length ? d.transport.map((t) => <TransportCell key={t.legId} t={t} detailed={detailed} />) : <span className={styles.muted}>—</span>}</td>
                  <td>
                    {d.title && <span className={styles.gTitle}>{d.title}</span>}
                    {highlights.length > 0 && <span className={styles.gHigh}>{highlights.join(" · ")}</span>}
                    {d.note && <span className={styles.gNote}>{d.note}</span>}
                    {!d.title && !highlights.length && !d.note && <span className={styles.muted}>—</span>}
                  </td>
                  <td className={`${styles.num} ${styles.right}`}>{d.costUsd ? formatUsd(d.costUsd) : <span className={styles.muted}>—</span>}</td>
                </tr>
              );
            })}
            <tr className={styles.totalRow}>
              <td colSpan={6}>
                Transport total
                {doc.totals.unpricedFlights > 0 && <span className={styles.muted}> · {plural(doc.totals.unpricedFlights, "flight")} still to choose, not included</span>}
              </td>
              <td className={`${styles.num} ${styles.right}`}>{formatUsd(doc.totals.total)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}

// ---------- Day by day ----------

function PlanNotice({ doc }: { doc: ItineraryDoc }) {
  if (!doc.plan.present)
    return (
      <p className={styles.callout}>
        No day-by-day plan yet. Ask the <Link href="/#concierge">Concierge</Link> in the planner to write one; it will fill in each day here.
      </p>
    );
  if (doc.plan.outdated)
    return <p className={styles.callout}>Your route changed after this plan was written, so some days may be empty. Update the plan in the Concierge.</p>;
  if (doc.plan.source === "sample")
    return <p className={styles.calloutQuiet}>This is a sample plan built from the city guides.</p>;
  return null;
}

function CitySheet({ doc, city, first, detailed, edit }: { doc: ItineraryDoc; city: DocCity; first: boolean; detailed: boolean; edit?: EditApi }) {
  return (
    <section className={`${styles.sheet} ${styles.citySheet}`} aria-label={`${city.name}, day by day`}>
      {first && <p className={styles.eyebrow}>Day by day</p>}
      {first && <PlanNotice doc={doc} />}
      <CityBlock city={city} detailed={detailed} edit={edit} />
    </section>
  );
}

function CityBlock({ city, detailed, edit }: { city: DocCity; detailed: boolean; edit?: EditApi }) {
  return (
    <div className={styles.cityBlock}>
      <header className={styles.cityHead}>
        <h2 className={styles.cityTitle}>
          {city.name}
          {city.localName && <span className={styles.cityLocal}>{city.localName}</span>}
        </h2>
        <dl className={styles.fields}>
          <div><dt>Check-in</dt><dd className={styles.num}>{fmtDay(city.arrive)}</dd></div>
          <div><dt>Check-out</dt><dd className={styles.num}>{fmtDay(city.depart)}</dd></div>
          <div><dt>Nights</dt><dd className={styles.num}>{city.nights}</dd></div>
          <div className={styles.fieldWide}><dt>Stay</dt><dd>{city.lodging.length ? city.lodging.join(", ") : <span className={styles.muted}>Not chosen yet</span>}</dd></div>
        </dl>
      </header>
      {city.days.map((d) => <DayCard key={d.date} day={d} detailed={detailed} edit={edit} />)}
    </div>
  );
}

function DayCard({ day, detailed, edit }: { day: DocDay; detailed: boolean; edit?: EditApi }) {
  return (
    <article className={styles.day} data-kind={day.kind}>
      <div className={styles.dayGutter}>
        <span className={styles.dayDate}>{fmtShort(day.date)}</span>
        <span className={styles.dayWeek}>{day.weekday}</span>
        <span className={styles.dayNum}>Day {day.dayNumber}</span>
      </div>
      <div className={styles.dayBody}>
        <h3 className={styles.dayTitle}>{day.title ?? fallbackTitle(day)}</h3>

        {day.transport.map((t) => <TransportBlock key={t.legId} t={t} detailed={detailed} edit={edit} />)}

        {day.items.length > 0 ? (
          <ol className={styles.items}>
            {day.items.map((it, i) => (
              <li key={i} className={styles.item}>
                <span className={styles.itemTime}>{it.time}</span>
                <span className={styles.itemKind}>{KIND_LABEL[it.kind]}</span>
                <span className={styles.itemMain}>
                  <span className={styles.itemTitle}>{it.title}</span>
                  {it.placeName && it.placeName !== it.title && <span className={styles.muted}> · {it.placeName}</span>}
                  {detailed && it.note && <span className={styles.itemNote}>{it.note}</span>}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          day.kind !== "travel" && <p className={styles.muted}>Free day. Nothing planned yet.</p>
        )}

        <DayNote day={day} edit={edit} />
      </div>
    </article>
  );
}

/** The traveller's own note for the day: a box on screen, italic "Notes" on paper. */
function DayNote({ day, edit }: { day: DocDay; edit?: EditApi }) {
  if (!edit && !day.note) return null;
  return (
    <div className={`${styles.note} ${day.note ? "" : styles.noteEmpty}`}>
      <span className={styles.noteLabel}>Notes</span>
      <Editable edit={edit} text={<span className={styles.noteText}>{day.note}</span>}>
        <Draft
          multiline
          label={`Notes for ${fmtShort(day.date)}`}
          value={edit?.trip.dayNotes?.[day.date] ?? ""}
          placeholder="Your own notes for the day"
          maxLength={2000}
          onCommit={(v) => edit?.dispatch({ type: "dayNote", date: day.date, text: v })}
        />
      </Editable>
    </div>
  );
}

function fallbackTitle(d: DocDay): string {
  switch (d.kind) {
    case "travel": return `Fly to ${d.cityName.split(" → ").at(-1)}`;
    case "arrive": return `Arrive in ${d.cityName}`;
    case "transfer": return `On to ${d.cityName}`;
    case "depart": return "Departure";
    default: return d.cityName;
  }
}

function TransportBlock({ t, detailed, edit }: { t: DocTransport; detailed: boolean; edit?: EditApi }) {
  const Icon = MODE_ICON[t.mode];
  return (
    <div className={styles.txBlock}>
      <div className={styles.txBlockHead}>
        <Icon size={14} className={styles.txIcon} />
        <span className={styles.code}>{MODE_LABEL[t.mode]} · {t.fromName} → {t.toName}</span>
        {t.carrier && <span className={styles.muted}>{t.carrier}</span>}
      </div>
      <dl className={styles.fields}>
        {t.departTime && <div><dt>Depart</dt><dd className={styles.num}>{t.departTime}</dd></div>}
        <div><dt>{t.costKind === "chosen" ? "Duration" : "Typical time"}</dt><dd className={styles.num}>{formatDuration(t.durationMin)}</dd></div>
        {t.stops !== undefined && <div><dt>Stops</dt><dd className={styles.num}>{t.stops === 0 ? "Nonstop" : t.stops}</dd></div>}
        <div>
          <dt>{t.costKind === "chosen" ? "Fare" : "Cost"}</dt>
          <dd className={styles.num}>{t.costUsd === null ? <em className={styles.todo}>Choose a flight</em> : `${t.costKind === "estimate" ? "~" : ""}${formatUsd(t.costUsd)}`}</dd>
        </div>
        {(edit || t.confirmation) && (
          <div><dt>Confirm</dt><dd><Confirm id={t.legId} edit={edit} value={t.confirmation} label={`${t.from} to ${t.to}`} /></dd></div>
        )}
      </dl>
      {detailed && t.notes.length > 0 && <p className={styles.txNotes}>{t.notes.join(" ")}</p>}
      {detailed && t.bookingUrl && <p className={styles.txNotes}><a href={t.bookingUrl} target="_blank" rel="noreferrer">Booking link</a></p>}
    </div>
  );
}

// ---------- Flights and costs ----------

function Costs({ doc, edit }: { doc: ItineraryDoc; edit?: EditApi }) {
  const { flights, ground, total, unpricedFlights } = doc.totals;
  const { budget } = doc;
  const missingStays = budget.missing.hotels + budget.missing.hotelPrices;
  return (
    <section className={styles.sheet} aria-labelledby="costs-h">
      <SheetHead id="costs-h" eyebrow="Flights & costs" title="Getting around" aside={<span>{plural(doc.travellers, "traveller")}</span>} />
      <div className={styles.tableScroll}>
        <table className={styles.ledger}>
          <thead>
            <tr>
              <th scope="col">Date</th>
              <th scope="col">Route</th>
              <th scope="col">How</th>
              <th scope="col">Depart</th>
              <th scope="col">Time</th>
              <th scope="col">Status</th>
              <th scope="col">Confirm</th>
              <th scope="col" className={styles.right}>Cost</th>
            </tr>
          </thead>
          <tbody>
            {doc.transport.map((t) => (
              <tr key={t.legId}>
                <td className={styles.num}>{fmtDay(t.date)}</td>
                <td><span className={styles.code}>{t.from} → {t.to}</span><span className={styles.sub}>{t.fromName} to {t.toName}</span></td>
                <td>{MODE_LABEL[t.mode]}{t.carrier && <span className={styles.sub}>{t.carrier}</span>}</td>
                <td className={styles.num}>{t.departTime ?? "—"}</td>
                <td className={styles.num}>{formatDuration(t.durationMin)}</td>
                <td>
                  {t.costKind === "chosen" ? "Chosen" : t.costKind === "estimate" ? `Estimate${t.priceBasis === "per vehicle" ? ", per vehicle" : ""}` : <em className={styles.todo}>To choose</em>}
                  {t.bookingUrl && <span className={styles.sub}><a href={t.bookingUrl} target="_blank" rel="noreferrer">Booking link</a></span>}
                </td>
                <td><Confirm id={t.legId} edit={edit} value={t.confirmation} label={`${t.from} to ${t.to}`} /></td>
                <td className={`${styles.num} ${styles.right}`}>{t.costUsd === null ? "—" : `${t.costKind === "estimate" ? "~" : ""}${formatUsd(t.costUsd)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className={styles.totals}>
        <div><dt>Flights chosen</dt><dd className={styles.num}>{formatUsd(flights)}</dd></div>
        <div><dt>Ground travel (estimate)</dt><dd className={styles.num}>~{formatUsd(ground)}</dd></div>
        <div><dt>Transport total</dt><dd className={styles.num}>{formatUsd(total)}</dd></div>
        <div><dt>Stays</dt><dd className={styles.num}>{formatUsd(budget.hotels)}</dd></div>
        <div><dt>Activities & bookings</dt><dd className={styles.num}>{formatUsd(budget.activities)}</dd></div>
        <div className={styles.grand}><dt>Trip total</dt><dd className={styles.num}>{formatUsd(budget.total)}</dd></div>
        {doc.travellers > 1 && <div><dt>Per traveller</dt><dd className={styles.num}>{formatUsd(budget.perPerson)}</dd></div>}
      </dl>
      <p className={styles.small}>
        {unpricedFlights > 0 && <>{plural(unpricedFlights, "flight")} still to choose {unpricedFlights === 1 ? "is" : "are"} not included. </>}
        {missingStays > 0 && <>{plural(missingStays, "city", "cities")} {missingStays === 1 ? "has" : "have"} no priced hotel yet, so stays are not complete. </>}
        Flight fares are the totals you chose for all travellers. Ground costs are typical standard-class fares for {plural(doc.travellers, "traveller")}, not live prices. Food is not included.
      </p>
    </section>
  );
}

// ---------- Stays (the Lodging Confirmations sheet) ----------

function Stays({ doc, edit }: { doc: ItineraryDoc; edit?: EditApi }) {
  const { budget } = doc;
  return (
    <section className={`${styles.sheet} ${styles.ledgerSheet}`} aria-labelledby="stays-h">
      <SheetHead id="stays-h" eyebrow="Lodging confirmations" title="Stays" aside={<span>{plural(doc.nights, "night")}</span>} />
      <div className={styles.tableScroll}>
        <table className={`${styles.ledger} ${styles.stays}`}>
          <thead>
            <tr>
              <th scope="col">City</th>
              <th scope="col">Hotel</th>
              <th scope="col">Check-in</th>
              <th scope="col">Check-out</th>
              <th scope="col" className={styles.right}>Nights</th>
              <th scope="col" className={styles.right}>Rate / night</th>
              <th scope="col">Confirm</th>
              <th scope="col" className={styles.right}>Total</th>
            </tr>
          </thead>
          <tbody>
            {doc.stays.map((s) => (
              <tr key={s.stopId}>
                <td><span className={styles.cityName}>{s.cityName}</span></td>
                <td>
                  {s.hotel ? <span className={styles.event}>{s.hotel}</span> : <em className={styles.todo}>Not chosen yet</em>}
                  {s.bookingUrl && <span className={styles.sub}><a href={s.bookingUrl} target="_blank" rel="noreferrer">Booking link</a></span>}
                </td>
                <td className={styles.num}>{fmtShort(s.checkIn)}</td>
                <td className={styles.num}>{fmtShort(s.checkOut)}</td>
                <td className={`${styles.num} ${styles.right}`}>{s.nights}</td>
                <td className={`${styles.num} ${styles.right}`}>{s.nightly !== undefined ? `${formatUsd(s.nightly)}` : "—"}</td>
                <td><Confirm id={s.confirmationKey} edit={edit} value={s.confirmation} label={`hotel in ${s.cityName}`} /></td>
                <td className={`${styles.num} ${styles.right}`}>{s.total !== undefined ? formatUsd(s.total) : "—"}</td>
              </tr>
            ))}
            <tr className={styles.totalRow}>
              <td colSpan={7}>Stays total</td>
              <td className={`${styles.num} ${styles.right}`}>{formatUsd(budget.hotels)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className={styles.small}>
        Rates are per room per night for the whole party, as found when the hotel was chosen; prices change, so check with your booking.
        {budget.missing.hotels > 0 && <> {plural(budget.missing.hotels, "city", "cities")} still need a hotel.</>}
      </p>
    </section>
  );
}

// ---------- Activities & bookings (the Activity Confirmations sheet) ----------

function Activities({ doc, edit }: { doc: ItineraryDoc; edit?: EditApi }) {
  const cityOptions = doc.cities.filter((c, i, a) => a.findIndex((x) => x.code === c.code) === i);
  const update = (id: string, patch: Partial<{ label: string; amount: number; date: string; city: string }>) => {
    const c = doc.activities.find((a) => a.id === id);
    if (!c || !edit) return;
    const next = { label: c.label, amount: c.amount, date: c.date ?? "", city: c.cityCode ?? "", ...patch };
    edit.dispatch({ type: "addCost", cost: { id, label: next.label, amount: next.amount, date: next.date || undefined, city: next.city || undefined } });
  };
  return (
    <section className={`${styles.sheet} ${styles.ledgerSheet}`} aria-labelledby="acts-h">
      <SheetHead id="acts-h" eyebrow="Activity confirmations" title="Activities & bookings" aside={<span>{plural(doc.activities.length, "item")}</span>} />
      {doc.activities.length === 0 && !edit && <p className={styles.calloutQuiet}>No tours, tickets or other bookings added yet.</p>}
      {(doc.activities.length > 0 || edit) && (
        <div className={styles.tableScroll}>
          <table className={`${styles.ledger} ${styles.activities}`}>
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">City</th>
                <th scope="col">Activity</th>
                <th scope="col">Confirm</th>
                <th scope="col" className={styles.right}>Cost</th>
                {edit && <th scope="col" className={styles.noPrint}><span className="sr-only">Remove</span></th>}
              </tr>
            </thead>
            <tbody>
              {doc.activities.map((a) => (
                <tr key={a.id}>
                  <td className={styles.num}>
                    <Editable edit={edit} text={a.date ? fmtDay(a.date) : "—"}>
                      <input className={styles.field} type="date" aria-label={`Date, ${a.label}`} value={a.date ?? ""} onChange={(e) => update(a.id, { date: e.target.value })} />
                    </Editable>
                  </td>
                  <td>
                    <Editable edit={edit} text={a.cityName ?? "—"}>
                      <select className={styles.field} aria-label={`City, ${a.label}`} value={a.cityCode ?? ""} onChange={(e) => update(a.id, { city: e.target.value })}>
                        <option value="">Any city</option>
                        {cityOptions.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
                      </select>
                    </Editable>
                  </td>
                  <td>
                    <Editable edit={edit} text={<span className={styles.event}>{a.label}</span>}>
                      <Draft label="Activity" value={a.label} maxLength={120} onCommit={(v) => update(a.id, { label: v })} />
                    </Editable>
                  </td>
                  <td><Confirm id={a.id} edit={edit} value={a.confirmation} label={a.label} /></td>
                  <td className={`${styles.num} ${styles.right}`}>
                    <Editable edit={edit} text={formatUsd(a.amount)}>
                      <Draft label={`Cost in US dollars, ${a.label}`} type="number" inputMode="decimal" className={styles.amountInput} value={String(a.amount)} onCommit={(v) => update(a.id, { amount: Number(v) || 0 })} />
                    </Editable>
                  </td>
                  {edit && (
                    <td className={styles.noPrint}>
                      <button type="button" className="btn btn-ghost !h-8 !px-2 !text-[12.5px]" aria-label={`Remove ${a.label}`} onClick={() => edit.dispatch({ type: "removeCost", id: a.id })}>Remove</button>
                    </td>
                  )}
                </tr>
              ))}
              <tr className={styles.totalRow}>
                <td colSpan={4}>Activities total</td>
                <td className={`${styles.num} ${styles.right}`}>{formatUsd(doc.budget.activities)}</td>
                {edit && <td className={styles.noPrint} />}
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {edit && <AddCost edit={edit} cities={cityOptions.map((c) => ({ code: c.code, name: c.name }))} />}
      <p className={styles.small}>Costs are totals in US dollars for the whole party. They count toward the trip total.</p>
    </section>
  );
}

function AddCost({ edit, cities }: { edit: EditApi; cities: { code: string; name: string }[] }) {
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [city, setCity] = useState("");
  const [amount, setAmount] = useState("");
  const [conf, setConf] = useState("");
  const valid = label.trim().length > 0;
  return (
    <form
      className={`${styles.addCost} ${styles.noPrint}`}
      aria-label="Add an activity or booking"
      onSubmit={(e) => {
        e.preventDefault();
        if (!valid) return;
        const id = newId();
        edit.dispatch({ type: "addCost", cost: { id, label, amount: Number(amount) || 0, date: date || undefined, city: city || undefined } });
        if (conf.trim()) edit.dispatch({ type: "confirmation", key: id, value: conf });
        setLabel(""); setDate(""); setCity(""); setAmount(""); setConf("");
      }}
    >
      <label>Activity<input className={styles.field} value={label} maxLength={120} placeholder="Tour, ticket, show…" onChange={(e) => setLabel(e.target.value)} /></label>
      <label>Date<input className={styles.field} type="date" value={date} onChange={(e) => setDate(e.target.value)} /></label>
      <label>City
        <select className={styles.field} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="">Any city</option>
          {cities.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
        </select>
      </label>
      <label>Cost (USD)<input className={`${styles.field} ${styles.amountInput}`} type="number" inputMode="decimal" min="0" step="0.01" value={amount} placeholder="0" onChange={(e) => setAmount(e.target.value)} /></label>
      <label>Confirm<input className={`${styles.field} ${styles.confInput}`} value={conf} maxLength={60} placeholder="Confirmation #" onChange={(e) => setConf(e.target.value)} /></label>
      <button type="submit" className="btn btn-primary" disabled={!valid}>Add</button>
    </form>
  );
}

// ---------- Saved places ----------

function Places({ doc }: { doc: ItineraryDoc }) {
  const withPlaces = doc.cities.filter((c) => c.places.length > 0);
  return (
    <section className={styles.sheet} aria-labelledby="places-h">
      <SheetHead id="places-h" eyebrow="Saved places" title="Your shortlist, city by city" />
      {withPlaces.length === 0 ? (
        <p className={styles.callout}>No saved places yet. Open a city guide in the planner and tap the heart on places you like.</p>
      ) : (
        <div className={styles.placesGrid}>
          {withPlaces.map((c) => (
            <div key={c.stopId} className={styles.placeCity}>
              <h3 className={styles.h3}>{c.name}{c.localName && <span className={styles.local}>{c.localName}</span>}</h3>
              {c.places.map((g) => (
                <div key={g.category} className={styles.placeGroup}>
                  <span className={styles.label}>{g.label}</span>
                  <ul>{g.names.map((n) => <li key={n}>{n}</li>)}</ul>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// ---------- Before you go ----------

function Before({ doc }: { doc: ItineraryDoc }) {
  return (
    <section className={styles.sheet} aria-labelledby="before-h">
      <SheetHead id="before-h" eyebrow="Before you go" title="Sort these out before you fly" />
      {doc.beforeYouGo.length === 0 && (
        <p className={styles.calloutQuiet}>The Concierge adds visa, money and phone tips here once it writes your plan. The official sources below are always worth checking.</p>
      )}
      {doc.beforeYouGo.map((b) => (
        <div key={b.topic} className={styles.tip} data-important={b.important || undefined}>
          <h3 className={styles.h3}>{b.topic}{b.important && <span className={styles.flag}>Important</span>}</h3>
          <p>{b.summary}</p>
          {b.details.length > 0 && <ul className={styles.bullets}>{b.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
        </div>
      ))}
      {doc.official.length > 0 && (
        <div className={styles.official}>
          <h3 className={styles.h3}>Official sources</h3>
          {doc.official.map((o) => (
            <div key={o.country} className={styles.placeGroup}>
              <span className={styles.label}>{o.country}</span>
              <ul>
                {o.links.map((l) => (
                  <li key={l.url}><a href={l.url} target="_blank" rel="noreferrer">{l.label}</a></li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
