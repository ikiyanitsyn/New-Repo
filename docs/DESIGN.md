# Intercontinental Nomad: design reference

This is the project's design direction: what we took from four reference sites, what we turned down, and the rules every screen follows. It goes with the tokens at the top of `src/app/globals.css`.

> **About the sources.** The four Refero pages (styles.refero.design) could not be opened from the build sandbox because the host is blocked. The notes below come from the owner's comments and from well-known public knowledge of each live site. **No hex codes, sizes or font names are quoted from those pages.** Every value in this document is ours. To check the analysis against the exact specs, allow `styles.refero.design` in the session's network settings and re-run the comparison.

## 1. Who we design for

A US traveller planning a first multi-city trip to China (Hong Kong included), new to the tools, with a $0 budget. The app should feel **calm and luxurious**, like the seat-back card on a night flight. It should be easy to read at a glance, kind to beginners, and just as good on a phone.

## 2. The four references

### dope.security: motion with a purpose
- **Strengths:** a confident, mostly monochrome page that carries one or two signature animations. The owner's favourites are **letters that flip like an old airport departure board** and **a plane crossing the sky**. The motion is the brand: it is there on purpose and never just decoration.
- **Signature elements:** split-flap type and a plane on a path.
- **What it means for us:** both motifs fit a travel product better than a security product. The departure board suits **airport and route codes** (JFK → PEK). It already sits in IBM Plex Mono in our app and is being built by another engineer. The plane suits **moments of waiting or arriving**: the opening page and loading states.

### Hopper: an opening page that is all destination
- **Strengths:** a full-bleed destination photo, a short centred headline, and **one search composer in segments (Where · Dates · Guests)** with a single strong button. That makes one question per segment and one obvious next step. Friendly, rounded, high-contrast controls.
- **Signature elements:** the centred segmented search card on a photo, and a bold primary button.
- **What it means for us:** our app opened straight into a dense planner, with no welcome and no first question. Hopper's pattern is the right first screen for a beginner.

### Airbnb: familiar cards, list beside a map
- **Strengths:** photo-first listing cards (rounded image, then title, a short meta line and the price), **ratings shown as a star and a number** with the review count, a list and map side by side where hovering a card highlights its pin, and a floating "Show map / Show list" toggle on phones. Generous white space and one warm accent colour.
- **Signature elements:** photo-first cards with large rounded corners, the price pin on the map, and the floating map toggle.
- **What it means for us:** our city guide already does list + map + floating toggle (Phase 2). What it lacks is the **photo-first card rhythm and the at-a-glance rating and price line**. Another engineer is building stay cards on this pattern.

### pampam.city: friendly map-based curation
- **Strengths:** user-made city maps and lists. Places are grouped in **friendly, human collections** with emoji or icon category markers, soft pastel chips and plenty of rounding. The tone is personal ("my favourite coffee spots"). Saving and sharing a list is a first-class action.
- **Signature elements:** collection chips, category icons on pins, and shareable lists.
- **What it means for us:** our Saved tab and category pins are part of the way there. The friendliness comes from **plain-language labels, icons next to words, empty states that tell you what to do, and sharing**.

## 3. Current app compared with the references

| Area | Current app (before this change) | Best reference | Gap / decision |
|---|---|---|---|
| **Landing** | None. A first visit drops into the full planner with an example trip. | Hopper | **Adopted**: photo opening page with a Where · Dates · Guests composer (built). |
| **Search** | Trip builder fields in a side panel: home, date, stops, nights. | Hopper | Composer for the first question. The planner keeps the detailed builder. |
| **Cards** | Fare cards are clean but text-only. City-guide cards have photos where Wikivoyage has them. | Airbnb | Photo-first stay cards with a rating and price line (other engineer). Same card rhythm for sights and food (follow-up). |
| **Maps** | 3D globe with brass flight arcs and jade ground legs. City map with category pins. | Airbnb, pampam | Already strong. Add icon pins and card ↔ pin hover sync everywhere (follow-up). |
| **Motion** | Panel slide-ins, a shimmer on loading, planes on the globe's flight lines. | dope.security | Split-flap route codes (other engineer). Plane-on-arc on the landing (built). Plane loader for the concierge (other engineer). |
| **Typography** | Bodoni Moda display, Instrument Sans body, IBM Plex Mono data. Refined. | All | **Kept.** This is our signature; none of the references beat it for "luxury". A larger display size for heroes was added. |
| **Colour** | Porcelain/midnight neutrals, one brass accent, jade for ground travel. Light and dark. | Airbnb (one warm accent) | **Kept.** Fixed on-photo tokens added (§5). |
| **Density** | High on the planner: two panels over a globe. | Hopper, Airbnb | Planner stays dense for power use. The landing and the empty states carry the friendliness. |
| **Friendliness** | Precise but expert-looking. There is no "what do I do first?". | pampam, Hopper | Opening page, plain-language labels ("Back about Jan 8"), guided empty states (follow-up). |

## 4. Decisions

### What we adopt
1. **Hopper's opening page** → `src/components/Landing.tsx`. It shows on the first visit (nothing saved), from **New trip** in the top bar, and at `#start`.
   - Full-bleed Wikimedia Commons photo (Great Wall at Jinshanling; Pudong when Shanghai is chosen), credited in a small caption. A dark scrim keeps text readable. A **token-built brass/jade dusk gradient** shows if images are blocked, and the caption then hides.
   - A centred Bodoni headline ("Where to *next*?") with the brass italic, echoing the wordmark.
   - One composer card: **Where** (the existing `CityPicker`), **Dates** (depart date plus a nights stepper, with a plain-English "Back about …"), **Guests** (Solo / Two / Group with a group size of 3–9). The brass **Start planning** button creates the trip through the existing reducer actions (`src/lib/newTrip.ts`, unit-tested) and reveals the planner.
   - Secondary glass buttons: **Continue your trip** (only when a trip is saved; it shows a one-line summary), **Let the concierge plan it** (creates the trip, then opens `#concierge`; with no city chosen the concierge suggests the route) and, on a first visit, **Explore the example trip**.
   - "Flying from" is a quiet inline select under the composer, so the three-part composer stays clean.
2. **dope.security's plane in the sky** → the landing hero: a small porcelain plane rides a faint dotted arc (34 s loop, nose-first, fading at the ends). A radial mask fades the arc out behind the centred text, so it never crosses it. With *reduced motion* the plane is parked, still, on the arc. **Placement rule:** the plane appears where the traveller is *waiting or setting off* (the landing, the concierge loader). It never appears on dense working screens, where it would distract.
3. **dope.security's split-flap letters** → route codes in the itinerary and fares header only (other engineer). **Rule:** use the flip for a short code (≤ 8 characters) when it changes, once per change. Never loop it, and never use it on body text.
4. **Airbnb's card rhythm** → stays first (other engineer), then sights and food: photo with a 4:3 frame and `--radius-lg` corners, a title in display type, one meta line (area · category), one value line (★ rating · price level). The card ↔ pin hover link stays.
5. **pampam's friendliness** → icon + word labels, collections ("Saved for Beijing"), helpful empty states, and share as a first-class action when accounts arrive.

### What we reject
- **Hopper's playful palette and illustrated mascots**: they clash with calm luxury. We keep our neutrals and use brass as the one call to action.
- **Hopper's price-prediction calendar heat-maps**: we have no fare history data, and they add noise.
- **dope.security's dark, all-motion, techno look**: we take the two motifs, not the mood. Motion stays rare.
- **Airbnb's dense infinite grid and pink accent**: our lists stay short and curated ("Our picks" + "Show more"). Brass stays the accent.
- **pampam's pastel chips and emoji**: too casual next to Bodoni. We use our line icons and tinted chips (`--accent-soft`, `--ground-soft`) instead.

## 5. Tokens, spacing and type

### Token changes (in `globals.css`)
| Token | Light | Dark | Why |
|---|---|---|---|
| `--radius-lg` | 18px | (same) | Hero composer and photo cards. The existing 10px looks timid at that size, and Airbnb/Hopper-style cards need bigger rounding. |
| `--shadow-lg` | soft 64px lift | deeper 72px lift | For a card floating over a photo. `--shadow` is too faint there. |
| `--midnight` | `#0a0f16` | (fixed) | Scrims and fallback gradients over photos. It equals the dark `--bg`. |
| `--porcelain` | `#fcfcfa` | (fixed) | Text on photos. It equals the light `--surface-solid`. |
| `--brass-light` | `#cfa760` | (fixed) | Accent on photos, where the light-theme brass (`#8a6628`) is too dark. It equals the dark `--accent`. |

The three fixed tokens never change with the theme, because text over a photo always sits on a dark scrim. Use them **only** over imagery.

### Spacing scale (4px base)
`4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 · 96`. Panels use 16–24 padding. Sections use 32–48. Heroes use 48–96. On phones the side gutter is **16px** (12px in the top bar below 420px).

### Type scale
| Role | Font | Size | Notes |
|---|---|---|---|
| Hero | Bodoni Moda 500 | clamp(46px, 7.4vw, 92px), line-height 0.98 | Landing only. Italic brass for one word at most. |
| Screen title | Bodoni Moda | clamp(38px, 5vw, 52px) | City hero, concierge. |
| Section title | Bodoni Moda | 22–28px | Panel headings ("Beijing trip"). |
| Card title | Bodoni Moda | 15–19px | Place and city names. |
| Body | Instrument Sans | 15px (16.5px lede) | Line-height 1.5. |
| Eyebrow | Instrument Sans 600, uppercase, 0.14–0.16em tracking | 10.5–12px | Labels such as WHERE and DATES. |
| Data | IBM Plex Mono, tabular | 11.5–14px | Codes, times, fares, dates. Split-flap uses this. |

### Motion
- Ease `cubic-bezier(0.2, 0.7, 0.2, 1)`. 150ms for hover, 420–500ms for screens entering.
- Signature motion (plane, split-flap) runs **once per change or as a slow ambient loop**, never more than one at a time per screen.
- `prefers-reduced-motion` stops every animation. Ambient motifs park in a meaningful still position instead of disappearing.

## 6. Follow-up UI changes (prioritised, for the lead to schedule)

1. **Planner empty state** (`TripBuilder.tsx`): when a trip has one stop, show a friendly "Add your next city" prompt with suggested next cities (by train from here). The landing creates one-stop trips, so this matters right away.
2. **Fares panel friendliness** (`FlightResults.tsx`, `LegPanel.tsx`): a plain-language summary line at the top ("Nonstop from $1,878 · about 14h") before the list; rounded `--radius-lg` cards; airline logos later.
3. **Sights and food cards** (`CityExplorer.tsx`): use the Airbnb card rhythm from §4.4 for every tab, not only stays. Category icon pins on `CityMap.tsx` to match.
4. **Concierge entry** (`Concierge.tsx`): reuse the landing's photo hero with a scrim (smaller) and the plane loader. Show the composer's choices (dates, guests) as editable chips at the top.
5. **Top bar on phones**: once accounts arrive, move My trips / Shared trips / Reset into a menu sheet. Right now they are hidden on phones and Reset can't be reached there.
6. **Photo per destination**: extend the landing's photo map (now Great Wall + Pudong) to a curated, credited Commons photo per launch city, ideally sharing the city guide's banner source.
7. **Saved collections** (pampam): a "Saved" view across all cities with share links (Phase 4).
8. **Split-flap rollout**: after the route codes, use it for the outbound flight number and departure time in the fares header only.

## 7. Rules of thumb

- One brass call to action per view.
- Bodoni for places, Plex Mono for codes and money, Instrument Sans for everything else.
- Photos always get a dark scrim and a credit. Every photo surface has a gradient fallback built from tokens.
- Every view must work at 390px wide with no sideways scroll, in light and dark themes.
- Say it plainly: "Back about Jan 8", not "Return: 2027-01-08".
