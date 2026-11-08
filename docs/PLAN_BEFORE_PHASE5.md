# Before Phase 5: three steps

Status: Phases 1–4 are built and Supabase passes `npm run check:supabase`. Before Phase 5 (launch), there are three steps, done in order:

1. **UI walk-through and fixes.** Go screen by screen, find what feels wrong, fix it.
2. **Theme.** Colours, fonts, images, motion and density, made yours.
3. **On your phone.** Put it on your phone, test every screen, plan a trip end to end on mobile.

Each step starts with the questions below, then I build in small batches with screenshots you approve. Answer inline (write under each question, or just reply in chat with the numbers, e.g. "1.3: b"). Skipping a question means "your call".

> Order matters. The theme (step 2) restyles screens, so fix layout and flow first (step 1), then paint. Mobile (step 3) comes last so we test the finished design on a real phone.

---

## Step 1: UI walk-through and fixes

### How we'll work
- For each section: you tell me what bugs you (screenshots help), I propose a fix, then build it and show before/after screenshots at desktop and phone width.
- I keep a running fix list in this file, so nothing gets lost between sessions.

### Already noted from you
- [ ] The departure airport and the return date aren't part of the opening search bar.
- [ ] The search / plan-a-trip page should be the home page.

### Questions

**1. Home page / search** (inspiration: Hopper's centred search over a destination photo)
1.1 Should the home page always open on the search, even when you have a trip in progress? Options: (a) always the search, with "Continue your trip" as a card on it; (b) search for first visits only, otherwise straight to your trip; (c) search, plus your recent trips listed underneath (if signed in).
1.2 Which fields go in the search bar, in what order? Suggested: **From** (airport/city) · **To** (first city) · **Depart → Return** (one date-range picker) · **Travellers & cabin**. Add or remove any?
1.3 Dates: pick both a depart and a return date on a calendar (like Hopper/Airbnb), or a depart date plus a number of nights? Or both, with a toggle?
1.4 Multi-city in the search itself (a "+ Add a stop" right in the bar), or keep the search simple and add stops on the planning screen?
1.5 "Flying home from a different city" (open-jaw): in the search bar as an option, or only on the planning screen?
1.6 Should the search show a few destination ideas below it (e.g. "Spring in China", "Kyoto & Osaka")? If yes, what kinds: seasonal, by interest, or by budget?
1.7 Is the concierge ("Let the concierge plan it") a second button on the search, or its own tab/page?

**2. Planning screen** (globe + itinerary on the left + fares on the right)
2.1 Is the globe worth its space? Options: keep it large; smaller strip at the top; only as a "Map" toggle.
2.2 The left itinerary panel: too dense, about right, or too sparse? Which parts would you remove or move (travellers, cabin, leaving-from, dates)? These may move into the search bar per 1.2.
2.3 Between-city legs (train/bus/car icons): clear enough? Want the times and prices shown bigger?
2.4 The fares panel: keep it always open, or open only when you click a flight?
2.5 "Transport so far" total: keep, expand into a full trip budget (flights + trains + hotels + activities), or remove?

**3. Flights**
3.1 Best / Cheapest / Fastest and the price↔time slider: clear, or confusing?
3.2 Should choosing a fare show a short confirmation ("Added to your trip · $809")?
3.3 Would you like a price calendar (cheapest days around your date)? This uses the free Aviasales data.
3.4 Show baggage or alliance details? (Only available from live Google Flights results.)

**4. City guide** (inspiration: Airbnb listings and the map)
4.1 Look at a real city (e.g. Beijing). Are the tabs, picks and subcategories right? What's missing?
4.2 Should "Stay" let you mark one hotel per city as *your* hotel (it would appear in the itinerary and totals)?
4.3 Do you want the map and list side by side on desktop (as now), or a full-width map with a sliding list?

**5. Concierge**
5.1 After your real Gemini runs: is the plan good? Too long or short? Is the tone right?
5.2 Should the plan be editable (drag items between days, delete, add your own notes)?
5.3 Should it suggest restaurants and hotels by name from the guide more aggressively?

**6. Itinerary / PDF**
6.1 Does the printable itinerary match how you used your spreadsheet? What's missing?
6.2 Add traveller names, confirmation numbers and notes fields?
6.3 Should hotel nightly prices and activity costs go into the totals?

**7. Account, My trips and sharing**
7.1 Should trips save to your account automatically when you're signed in, instead of "Save to my trips"?
7.2 Sign-in: email link only, or add Google sign-in?
7.3 Anything about sharing that felt unclear?

**8. Navigation and top bar**
8.1 The top bar items are New trip · Route · Concierge · My trips · Shared trips · Itinerary · theme · account. Too many? Which matter most?
8.2 On phones, would you prefer a bottom tab bar (Home · Trip · Guide · Concierge · Account)?

---

## Step 2: Theme and visual refinement

### How we'll work
1. You answer the questions below.
2. I build a **style board page** (`/styles`) showing 2–3 complete theme options side by side: colours, fonts, buttons, cards, a flight row, a city card and the search bar, in light and dark.
3. You pick one, or mix and match. I apply it across the whole app via the design tokens (one place: `src/app/globals.css`), then screenshot every screen for approval.
4. `docs/DESIGN.md` is updated as the record of the final look.

### Your references, and what each could contribute
| Reference | What it could bring |
|---|---|
| dope.security | Dark, cinematic, techy; departure-board letters (already on route codes); a plane crossing the sky |
| Hopper | A big destination photo with one centred search; friendly and bold |
| Airbnb | Clean white space, photo-first cards, ratings, map beside the list; very familiar |
| pampam.city | Soft and friendly; collections and lists; approachable labels |
| Your Japan spreadsheet | Charcoal header, magenta accent (#D01556), monospace data, date gutter |

### Questions
**A. Overall mood**
A1. Pick the words that fit (choose up to 3): *quiet luxury · editorial · cinematic · playful · minimal · warm · techy · adventurous · romantic · modern classic*.
A2. Which reference is closest to how it should *feel* overall? And which is closest for *usability*?
A3. Default theme: light, dark, or follow the phone/computer setting (as now)?

**B. Colour**
B1. Keep the midnight + brass (gold) direction, or try a new one? Candidates:
   (a) midnight + brass (current);
   (b) ink + magenta (your spreadsheet's #D01556);
   (c) white + coral (Airbnb-like);
   (d) deep green + sand (expedition);
   (e) black + electric accent (dope.security-like);
   (f) your own.
B2. One accent colour, or two (one for flights, one for trains/ground, as now)?
B3. Any colours you dislike or want to avoid?

**C. Fonts**
C1. Headings: keep the elegant high-contrast serif (Bodoni Moda), or try:
   (a) a softer serif, e.g. Fraunces, Cormorant or DM Serif Display;
   (b) a modern sans, e.g. Inter Display, Manrope or General Sans;
   (c) a geometric or techy sans, like dope.security.
C2. Body text: is the current size comfortable on your screen? Larger?
C3. Keep the monospace "data" font for times, codes and prices (it echoes your spreadsheet)?

**D. Images**
D1. More photography? Options:
   (a) a hero photo per destination on the home page and city screens;
   (b) photos on itinerary days;
   (c) keep it light and typographic.
D2. Photo style: bright and colourful, moody and dark, or black-and-white with colour on hover?
D3. Free sources only (Wikimedia/Unsplash with credits), right?

**E. Shape and motion**
E1. Corners: sharp, slightly rounded (current), or very rounded (pill-like, Airbnb/pampam)?
E2. Motion: minimal, tasteful (current: split-flap, flying plane, slide-ins), or more cinematic (dope.security)?
E3. Density: airy and large (Airbnb/Hopper) or compact and information-rich (spreadsheet-like)?

**F. Brand**
F1. Keep the name "Intercontinental Nomad" and the italic *Nomad* wordmark? Want a logo mark (the app icon is a gold plane over an italic N)?
F2. A tagline? (Currently "Where to next?")

---

## Step 3: On your phone

### Insight: the three ways to get it on a phone
| Option | What it is | Cost | Effort | Notes |
|---|---|---|---|---|
| **1. Installable web app (recommended first)** | The site you have, installed from the browser to your home screen. It opens full-screen like an app and works offline (already built in Phase 4). | Free | Small | Needs the site online over HTTPS, so we deploy to Vercel (free). iPhone: Safari → Share → Add to Home Screen. Android: Chrome → Install app. |
| 2. App-store wrapper (Capacitor) | The same web code inside a native iOS/Android shell, published to the stores. | Apple Developer $99/yr; Google Play $25 once | Medium | iOS builds need a Mac with Xcode (you're on Windows; a cloud Mac service costs money). Android can be built on Windows. |
| 3. Native rewrite (React Native/Expo) | A separate app written for phones. | Store fees as above | Large | Only worth it if the web app can't do something you need. |

**Recommendation:** do option 1 now (free, and it reuses everything). Use it on your phone for real planning. Decide about the app stores later, based on what you miss.

### Plan
1. **Deploy to Vercel** (free Hobby plan): connect GitHub, add the keys as Environment Variables, add the Vercel address to Supabase's Redirect URLs. A tutor session can walk you through it, like the earlier setups.
2. **Install on your phone** and sign in with the email link (open the link on the phone).
3. **Phone test checklist** (I'll also run automated phone-size tests on iPhone and Android screen sizes, in light and dark):
   - [ ] Home search: every field usable with your thumb; the date picker works.
   - [ ] Planning screen: itinerary, legs and fares all readable without zooming.
   - [ ] City guide: list ⇄ map toggle, swipe between cities, open a place, save it.
   - [ ] Concierge: type a request, wait for the plan, scroll days.
   - [ ] Itinerary: open, share as PDF from the phone.
   - [ ] Account: sign in on the phone, see trips saved from the computer, edit, and see the change on the computer.
   - [ ] Offline: turn on airplane mode, reopen the app, open your trip and a city guide you visited.
   - [ ] Share a view-only link by text message and open it on another phone.
4. **Fix everything found**, then repeat the checklist.

### Questions
3.1 Which phone(s): iPhone or Android, and which model? (Screen size matters for testing.)
3.2 Is the installable web app OK to start with, or do you need it in the App Store / Play Store soon?
3.3 What will you mostly do on the phone: plan from scratch, check the itinerary while travelling, or both?
3.4 While travelling in China, Google services are blocked without a VPN or roaming eSIM. Should the phone version prefer non-Google links (Amap, Apple Maps, Trip.com) when you're there?

---

## Fix list (filled in as we go)
| # | Screen | Issue | Status |
|---|---|---|---|
| 1 | Home | From airport and return date aren't in the main search bar | Planned (step 1) |
| 2 | Home | Search/plan page should be the home page | Planned (step 1) |
| 3 | Home | Trip-type switch: one way / round trip / multi-city / stopover | Planned (step 1) |
| 4 | Home | Calendar date range; "+ Add a city" in search | Planned (step 1) |
| 5 | Home | Ideas: seasonal, deals from price data, airline stopover programmes | Planned (step 1) |
| 6 | Fares | Layover controls (max stops, layover length, connection airports) | Planned (step 1) |
| 7 | Home | Floating concierge suggestions while searching | Workshop |
