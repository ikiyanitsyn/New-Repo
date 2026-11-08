"use client";

import { getCity } from "@/lib/cities";
import s from "./Home.module.css";
import { ideaMatches, ideaNights, SEASONAL_IDEAS, type SeasonalIdea } from "./ideas";

const MONTH = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Compact month span, e.g. [11,12,1,2] → "Nov–Feb", [3,4] → "Mar–Apr", [5,6,9] → "May, Jun, Sep". */
export function monthSpan(months: number[]): string {
  if (months.length === 1) return MONTH[months[0] - 1];
  const contiguous = months.every((m, i) => i === 0 || m === (months[i - 1] % 12) + 1);
  return contiguous ? `${MONTH[months[0] - 1]}–${MONTH[months[months.length - 1] - 1]}` : months.map((m) => MONTH[m - 1]).join(", ");
}

/** Seasonal ideas: tap to fill the search. Ideas in season for the chosen dates come first, highlighted. */
export function IdeasSection({ months, onPick }: { months: number[]; onPick: (idea: SeasonalIdea) => void }) {
  const ideas = [...SEASONAL_IDEAS].sort((a, b) => Number(ideaMatches(b, months)) - Number(ideaMatches(a, months)));
  return (
    <section className={s.section} aria-labelledby="home-ideas">
      <div className={s.sectionHead}>
        <h2 id="home-ideas" className={s.sectionTitle}>Seasonal ideas</h2>
        <p className={s.sectionNote}>Tap one to fill the search. Highlighted ideas are in season for your dates.</p>
      </div>
      <ul className={s.ideaGrid}>
        {ideas.map((idea) => {
          const match = ideaMatches(idea, months);
          return (
            <li key={idea.id}>
              <button type="button" className={s.idea} data-match={match || undefined} onClick={() => onPick(idea)}>
                <span className={s.ideaTop}>
                  <span className={`data ${s.ideaMonths}`}>{monthSpan(idea.months)}</span>
                  {match && <span className="chip chip-accent">In season</span>}
                </span>
                <span className={`display ${s.ideaTitle}`}>{idea.title}</span>
                <span className={s.ideaBlurb}>{idea.blurb}</span>
                <span className={s.ideaRoute}>
                  {idea.stops.map((x) => getCity(x.city).name).join(" → ")} · {ideaNights(idea)} nights
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
