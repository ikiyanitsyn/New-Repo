import Link from "next/link";
import { fmtDay, fmtRange, fmtShort } from "@/lib/format";
import { formatDuration, formatUsd } from "@/lib/geo";
import type { DocCity, DocDay, DocTransport, ItineraryDoc } from "@/lib/itineraryDoc";
import { MODE_ICON, MODE_LABEL } from "../icons";
import { styles } from "./styles";

export type SectionId = "cover" | "glance" | "days" | "costs" | "places" | "before";
export type Layout = "compact" | "detailed";

export const SECTIONS: { id: SectionId; label: string }[] = [
  { id: "cover", label: "Cover" },
  { id: "glance", label: "At a glance" },
  { id: "days", label: "Day by day" },
  { id: "costs", label: "Flights & costs" },
  { id: "places", label: "Saved places" },
  { id: "before", label: "Before you go" },
];

const KIND_LABEL: Record<string, string> = { see: "See", do: "Do", eat: "Eat", drink: "Drink", stay: "Stay", travel: "Travel", free: "Free" };

const plural = (n: number, one: string, many = one + "s") => `${n} ${n === 1 ? one : many}`;

interface Props {
  doc: ItineraryDoc;
  sections: Record<SectionId, boolean>;
  layout: Layout;
}

/** The document itself: a stack of sheets that become printed pages. */
export function ItineraryDocument({ doc, sections, layout }: Props) {
  const detailed = layout === "detailed";
  return (
    <main className={styles.paperStack} aria-label={`${doc.title} itinerary`}>
      {sections.cover && <Cover doc={doc} />}
      {sections.glance && <Glance doc={doc} detailed={detailed} />}
      {sections.days &&
        (detailed ? (
          doc.cities.map((c, i) => <CitySheet key={c.stopId} doc={doc} city={c} first={i === 0} detailed />)
        ) : (
          <section className={styles.sheet} aria-labelledby="days-h">
            <SheetHead id="days-h" eyebrow="Day by day" title="Every day, in order" />
            <PlanNotice doc={doc} />
            {doc.cities.map((c) => <CityBlock key={c.stopId} city={c} detailed={false} />)}
          </section>
        ))}
      {sections.costs && <Costs doc={doc} />}
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

// ---------- Cover ----------

function Cover({ doc }: { doc: ItineraryDoc }) {
  return (
    <section className={`${styles.sheet} ${styles.cover}`} aria-labelledby="cover-h">
      <div className={styles.coverTop}>
        <p className={styles.eyebrow}>Itinerary</p>
        <h1 id="cover-h" className={styles.coverTitle}>{doc.title}</h1>
        <p className={styles.coverDates}>{fmtRange(doc.startDate, doc.endDate)}</p>
        <p className={styles.coverRoute}>{doc.routeLine}</p>
      </div>

      <dl className={styles.coverFacts}>
        <div><dt>Cities</dt><dd>{doc.cityNames.join(" · ")}</dd></div>
        <div><dt>Length</dt><dd><span className={styles.num}>{plural(doc.nights, "night")}</span> · <span className={styles.num}>{plural(doc.dayCount, "day")}</span></dd></div>
        <div><dt>Travellers</dt><dd>{plural(doc.travellers, "traveller")} · {doc.cabin}</dd></div>
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
                    {!d.title && !highlights.length && <span className={styles.muted}>—</span>}
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

function CitySheet({ doc, city, first, detailed }: { doc: ItineraryDoc; city: DocCity; first: boolean; detailed: boolean }) {
  return (
    <section className={`${styles.sheet} ${styles.citySheet}`} aria-label={`${city.name}, day by day`}>
      {first && <p className={styles.eyebrow}>Day by day</p>}
      {first && <PlanNotice doc={doc} />}
      <CityBlock city={city} detailed={detailed} />
    </section>
  );
}

function CityBlock({ city, detailed }: { city: DocCity; detailed: boolean }) {
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
      {city.days.map((d) => <DayCard key={d.date} day={d} detailed={detailed} />)}
    </div>
  );
}

function DayCard({ day, detailed }: { day: DocDay; detailed: boolean }) {
  return (
    <article className={styles.day} data-kind={day.kind}>
      <div className={styles.dayGutter}>
        <span className={styles.dayDate}>{fmtShort(day.date)}</span>
        <span className={styles.dayWeek}>{day.weekday}</span>
        <span className={styles.dayNum}>Day {day.dayNumber}</span>
      </div>
      <div className={styles.dayBody}>
        <h3 className={styles.dayTitle}>{day.title ?? fallbackTitle(day)}</h3>

        {day.transport.map((t) => <TransportBlock key={t.legId} t={t} detailed={detailed} />)}

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
      </div>
    </article>
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

function TransportBlock({ t, detailed }: { t: DocTransport; detailed: boolean }) {
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
      </dl>
      {detailed && t.notes.length > 0 && <p className={styles.txNotes}>{t.notes.join(" ")}</p>}
      {detailed && t.bookingUrl && <p className={styles.txNotes}><a href={t.bookingUrl} target="_blank" rel="noreferrer">Booking link</a></p>}
    </div>
  );
}

// ---------- Flights and costs ----------

function Costs({ doc }: { doc: ItineraryDoc }) {
  const { flights, ground, total, unpricedFlights } = doc.totals;
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
                <td className={`${styles.num} ${styles.right}`}>{t.costUsd === null ? "—" : `${t.costKind === "estimate" ? "~" : ""}${formatUsd(t.costUsd)}`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <dl className={styles.totals}>
        <div><dt>Flights chosen</dt><dd className={styles.num}>{formatUsd(flights)}</dd></div>
        <div><dt>Ground travel (estimate)</dt><dd className={styles.num}>~{formatUsd(ground)}</dd></div>
        <div className={styles.grand}><dt>Transport total</dt><dd className={styles.num}>{formatUsd(total)}</dd></div>
      </dl>
      <p className={styles.small}>
        {unpricedFlights > 0 && <>{plural(unpricedFlights, "flight")} still to choose {unpricedFlights === 1 ? "is" : "are"} not included. </>}
        Flight fares are the totals you chose for all travellers. Ground costs are typical standard-class fares for {plural(doc.travellers, "traveller")}, not live prices. Lodging, food and activities are not included.
      </p>
    </section>
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
