"use client";

import { STOPOVER_PROGRAMMES, type StopoverProgramme } from "@/lib/stopovers";
import { ExternalIcon } from "../icons";
import s from "./Home.module.css";

/** Airline stopover programmes, each linking to the airline's own terms. */
export function StopoversSection({ highlight, onPlan }: { highlight: string[]; onPlan: (p: StopoverProgramme) => void }) {
  return (
    <section className={s.section} aria-labelledby="home-stopovers" id="stopovers">
      <div className={s.sectionHead}>
        <h2 id="home-stopovers" className={s.sectionTitle}>Stopover programmes</h2>
        <p className={s.sectionNote}>Two places for one fare: airlines that make a stop on the way easy. Terms change, so always check the airline&apos;s page.</p>
      </div>
      <ul className={s.stopGrid}>
        {STOPOVER_PROGRAMMES.map((p) => (
          <li key={p.id} className={s.stopCard} data-match={highlight.includes(p.id) || undefined}>
            <div className={s.stopTop}>
              <span className={s.stopAirline}>{p.airline}</span>
              {highlight.includes(p.id) && <span className="chip chip-accent">Suits your route</span>}
            </div>
            <h3 className={`display ${s.stopTitle}`}>{p.programme}</h3>
            <p className={s.stopHub}>Hub: {p.hubName}{p.maxNights ? ` · up to ${p.maxNights} nights` : ""}</p>
            <p className={s.stopBenefit}>{p.benefit}</p>
            <p className={s.stopSuits}>{p.suits.join(" · ")}</p>
            <div className={s.stopActions}>
              <a className={s.terms} href={p.termsUrl} target="_blank" rel="noreferrer">
                Check current terms <ExternalIcon size={12} />
              </a>
              {p.hubCity ? (
                <button type="button" className="btn" onClick={() => onPlan(p)}>Plan with this stopover</button>
              ) : (
                <span className={s.quiet}>{p.hubName} isn&apos;t in our city list yet</span>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
