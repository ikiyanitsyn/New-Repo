"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { applyPrefs, currentPrefs, FONTS, PALETTES, type HeadingFont, type Palette } from "@/lib/themePrefs";
import { PlaneLoader } from "../PlaneLoader";
import { SplitFlap } from "../SplitFlap";
import { ArrowIcon } from "../icons";
import s from "./StyleBoard.module.css";

const SWATCH_KEYS = ["--bg", "--ink", "--accent", "--ground", "--surface-sunk"];
const PHOTO_CITIES = [
  { code: "BJS", name: "Beijing" },
  { code: "SHA", name: "Shanghai" },
  { code: "UKY", name: "Kyoto" },
  { code: "PAR", name: "Paris" },
];

/** City banners from the free travel guide (Wikivoyage / Wikimedia Commons), for the photo previews. */
function useBanners() {
  const [banners, setBanners] = useState<Record<string, string>>({});
  useEffect(() => {
    let alive = true;
    PHOTO_CITIES.forEach((c) =>
      fetch(`/api/places?city=${c.code}`)
        .then((r) => r.json())
        .then((j) => { if (alive && j.banner) setBanners((b) => ({ ...b, [c.code]: j.banner })); })
        .catch(() => {}),
    );
    return () => { alive = false; };
  }, []);
  return banners;
}

function Swatches({ palette }: { palette: Palette }) {
  // Read the colours from a hidden preview element so they always match the CSS.
  const [colours, setColours] = useState<string[]>([]);
  const measure = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    const cs = getComputedStyle(el);
    setColours(SWATCH_KEYS.map((k) => cs.getPropertyValue(k).trim()));
  }, []);
  return (
    <>
      <div ref={measure} className="pv" data-palette={palette} hidden />
      <div className={s.swatches} aria-hidden>
        {colours.map((c, i) => <span key={i} className={s.swatch} style={{ background: c }} />)}
      </div>
    </>
  );
}

function Mock({ palette, mode, font, photo }: { palette: Palette; mode: "light" | "dark"; font: HeadingFont; photo?: string }) {
  return (
    <div className={`pv ${s.mock}`} data-palette={palette} data-mode={mode} data-font={font}>
      <div className={s.mockLabel}>{mode === "light" ? "Light" : "Dark"}</div>
      <div className={`${s.mockHero} display`}>Where to <em>next</em>?</div>
      <div className={s.pills}>
        <span className={s.pill}>One way</span>
        <span className={`${s.pill} ${s.pillOn}`}>Round trip</span>
        <span className={s.pill}>Multi-city</span>
      </div>
      <div className={s.search}>
        <div className={s.field}><div className={s.fieldLabel}>From</div><div className={s.fieldValue}>New York</div></div>
        <div className={s.field}><div className={s.fieldLabel}>To</div><div className={s.fieldValue}>Beijing</div></div>
        <div className={s.field}><div className={s.fieldLabel}>Dates</div><div className={`${s.fieldValue} data`}>Apr 8 → 24</div></div>
        <button type="button" className={s.cta} tabIndex={-1}>Start planning</button>
      </div>
      <svg className={s.route} viewBox="0 0 300 44" aria-hidden>
        <path d="M10 34 C 80 4, 160 4, 210 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeDasharray="5 4" />
        <path d="M210 24 L 290 30" fill="none" stroke="var(--ground)" strokeWidth="3" strokeLinecap="round" />
        {[[10, 34], [210, 24], [290, 30]].map(([x, y]) => <circle key={x} cx={x} cy={y} r="4.5" fill="var(--surface-solid)" stroke="var(--accent)" strokeWidth="2" />)}
      </svg>
      <div className={s.flight}>
        <div>
          <SplitFlap value="NYC" size="sm" tone="brass" /> <span className="text-ink-3">→</span> <SplitFlap value="PEK" size="sm" tone="brass" />
          <div className={s.flightMeta}>Air China · Nonstop · 13h 55m</div>
        </div>
        <div className={s.price}>$1,114</div>
      </div>
      <div className={s.city}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {photo && <img src={photo} alt="" />}
        <div className={s.cityScrim} />
        <span className={s.cityChip}>★ 4.7</span>
        <span className={s.cityName}>Beijing</span>
      </div>
    </div>
  );
}

export function StyleBoard() {
  const [chosen, setChosen] = useState(currentPrefs);
  const [toast, setToast] = useState<string | null>(null);
  const [replay, setReplay] = useState(0);
  const banners = useBanners();

  const choose = (palette: Palette, font: HeadingFont, message: string) => {
    applyPrefs(palette, font);
    setChosen({ palette, font });
    setToast(message);
    setTimeout(() => setToast(null), 2600);
  };

  const pName = PALETTES.find((p) => p.id === chosen.palette)?.name;
  const fName = FONTS.find((f) => f.id === chosen.font)?.name;

  return (
    <div className={s.page}>
      <div className={s.inner}>
        <div className="flex items-center justify-between gap-3">
          <Link href="/#trip" className="btn btn-ghost -ml-3 !px-3"><ArrowIcon size={14} className="rotate-180" /> Back to planning</Link>
        </div>

        <header className={s.head}>
          <div className="eyebrow !text-accent">Step 2 · Theme</div>
          <h1 className={s.title}>Style board</h1>
          <p className={s.lead}>
            Warm and friendly, with colour and motion: three new palettes mixing deep green, darks, brass and light tones, beside the
            original. Try any combination of colours and heading font. Applying one restyles the whole app at once, so you can open the
            planner, guide and concierge and see it for real. You can switch back any time.
          </p>
        </header>

        <div className={s.choice} role="status">
          <p className={s.choiceText}>Applied now: <strong>{pName}</strong> colours with <strong>{fName}</strong> headings.</p>
          <Link href="/" className="btn !h-9">See the home page</Link>
          <Link href="/#trip" className="btn !h-9">See the planner</Link>
          <button type="button" className="btn btn-ghost !h-9" onClick={() => choose("classic", "bodoni", "Back to the original look")}>Reset to original</button>
        </div>

        <section aria-labelledby="pal-h">
          <div className={s.sectionHead}>
            <h2 id="pal-h" className={s.h2}>Colour palettes</h2>
            <p className={s.sub}>Each palette works in light and dark. The previews use your chosen heading font ({fName}).</p>
          </div>
          <div className={s.palettes}>
            {PALETTES.map((p) => (
              <article key={p.id} className={`${s.palette} ${chosen.palette === p.id ? s.paletteActive : ""}`}>
                <div className={s.paletteHead}>
                  <div className="flex flex-col gap-1">
                    <h3 className={s.paletteName}>{p.name}</h3>
                    <p className="text-[14px] text-ink-2">{p.blurb}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Swatches palette={p.id} />
                    <button
                      type="button"
                      className={`btn ${chosen.palette === p.id ? "" : "btn-primary"}`}
                      disabled={chosen.palette === p.id}
                      onClick={() => choose(p.id, chosen.font, `${p.name} applied to the whole app`)}
                    >
                      {chosen.palette === p.id ? "Applied" : `Use ${p.name}`}
                    </button>
                  </div>
                </div>
                <div className={s.pair}>
                  <Mock palette={p.id} mode="light" font={chosen.font} photo={banners.BJS} />
                  <Mock palette={p.id} mode="dark" font={chosen.font} photo={banners.BJS} />
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="font-h">
          <div className={s.sectionHead}>
            <h2 id="font-h" className={s.h2}>Heading fonts</h2>
            <p className={s.sub}>Headings set the personality; body text stays the same easy-to-read sans. Shown in your current colours.</p>
          </div>
          <div className={s.fonts}>
            {FONTS.map((f) => (
              <article key={f.id} className={`pv ${s.font}`} data-palette={chosen.palette} data-font={f.id} style={{ background: "var(--surface-solid)" }}>
                <div className="eyebrow">{f.name}</div>
                <div className={`${s.fontSample} display`}>Where to next?</div>
                <div className={`${s.fontCity} display`}>Beijing <span className="text-ink-3">北京</span></div>
                <p className={s.fontBody}>{f.blurb} Four nights among hutongs, imperial palaces and roast duck, then the bullet train to Xi&apos;an.</p>
                <div>
                  <button
                    type="button"
                    className={`btn ${chosen.font === f.id ? "" : "btn-primary"}`}
                    disabled={chosen.font === f.id}
                    onClick={() => choose(chosen.palette, f.id, `${f.name} headings applied`)}
                  >
                    {chosen.font === f.id ? "Applied" : `Use ${f.name}`}
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section aria-labelledby="motion-h">
          <div className={s.sectionHead}>
            <h2 id="motion-h" className={s.h2}>Motion</h2>
            <p className={s.sub}>
              Ideas for more movement, each shown where it would live. Tell me which to roll out across the app. Everything stays still for
              people who turn on &ldquo;reduce motion&rdquo; on their device.
            </p>
            <div><button type="button" className="btn !h-9" onClick={() => setReplay((n) => n + 1)}>Replay animations</button></div>
          </div>
          <div className={s.motion} key={replay}>
            <article className={s.demo}>
              <div className={s.demoStage}><span><SplitFlap value="BJS" size="lg" tone="brass" /> <SplitFlap value="13:05" size="lg" /></span></div>
              <div className={s.demoTitle}>Departure-board letters</div>
              <p className={s.demoText}>Already on route codes. Could also spell city names on the home hero and the trip summary.</p>
            </article>
            <article className={s.demo}>
              <div className={s.demoStage}>
                <svg className={s.draw} viewBox="0 0 240 90" width="240" height="90" aria-hidden>
                  <path d="M12 74 C 70 6, 150 6, 228 40" fill="none" stroke="var(--accent)" strokeWidth="3" strokeLinecap="round" />
                </svg>
              </div>
              <div className={s.demoTitle}>Routes that draw themselves</div>
              <p className={s.demoText}>Flight arcs and train lines sketch in on the globe when a trip opens or a leg is chosen.</p>
            </article>
            <article className={s.demo}>
              <div className={s.demoStage}><PlaneLoader label="Plane crossing the sky" /></div>
              <div className={s.demoTitle}>Plane across the sky</div>
              <p className={s.demoText}>Today on the concierge and home hero. Could also play while fares and hotel prices load.</p>
            </article>
            <article className={s.demo}>
              <div className={s.demoStage}><div className={s.lift}>Hover me · Kyoto, 3 nights</div></div>
              <div className={s.demoTitle}>Cards that lift</div>
              <p className={s.demoText}>Stay cards, trip cards and ideas rise gently under the pointer, a friendlier feel.</p>
            </article>
            <article className={s.demo}>
              <div className={s.demoStage}><div className={s.stagger}><span /><span /><span /><span /></div></div>
              <div className={s.demoTitle}>Lists that cascade in</div>
              <p className={s.demoText}>Fares, places and plan days appear one after another instead of all at once.</p>
            </article>
            <article className={s.demo}>
              <div className={s.demoStage} style={{ padding: 0 }}>
                {banners.SHA ? <div className={s.kenburns} style={{ backgroundImage: `url("${banners.SHA}")` }} /> : <span className="text-ink-3 text-[13px]">Loading photo…</span>}
              </div>
              <div className={s.demoTitle}>Slow-moving photos</div>
              <p className={s.demoText}>A gentle drift on city hero photos (home and city guide), like a film opening.</p>
            </article>
          </div>
        </section>

        <section aria-labelledby="photo-h">
          <div className={s.sectionHead}>
            <h2 id="photo-h" className={s.h2}>A photo for every city</h2>
            <p className={s.sub}>
              Each destination gets its own wide photo from the free travel guide (Wikivoyage, credited), on the home page when you pick a
              city and at the top of its guide.
            </p>
          </div>
          <div className={s.photos}>
            {PHOTO_CITIES.map((c) => (
              <div key={c.code} className={s.photo}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {banners[c.code] && <img src={banners[c.code]} alt={`${c.name}`} loading="lazy" />}
                <div className={s.cityScrim} />
                <span className={s.cityName}>{c.name}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
      {toast && <div className={s.toast} role="status">{toast}</div>}
    </div>
  );
}
