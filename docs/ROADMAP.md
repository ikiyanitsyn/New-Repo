# Intercontinental Nomad: roadmap

## Product decisions (from the planning interview)

- **Stage:** personal project, $0 budget, free tiers only. A business-model plan is a separate piece of work.
- **Audience:** US travellers going to Asia and Europe. First real trip: **China**, including Hong Kong.
- **Trip shape:** the traveller defines everything. They fly into one city and home from another (cities can be in different countries), and choose train, bus, car, ferry or a short flight between each pair of stops.
- **Travellers:** solo is the default, two is one tap away, groups up to 9 are supported.
- **Flights:** live prices from the start, with a nonstop filter and three orders: Cheapest, Fastest, and Best. Best ranks by a price-vs-time slider and marks fares that nothing else beats on both.
- **AI:** writes full itineraries from the request. Vague requests get more suggestions and follow-up questions that narrow things down. It always adds visa and practical travel notes. The provider can be swapped; Gemini's free tier comes first.
- **Sharing:** view-only links by default (email, text, anything). Account holders can edit together through a **Shared trips** tab.
- **Look:** high-end, elegant, easy to read, light and dark modes.
- **Mobile:** works on the web first, with offline access to saved trips. A native app follows in the coming weeks.

## Data sources (all free)

| Need | Source | Notes |
|---|---|---|
| Recent fares | Travelpayouts / Aviasales Data API | Hours to days old, economy |
| Live fares | SerpApi Google Flights | About 250 searches a month, only on request, cached 12h |
| Globe | MapLibre GL (globe view) + Natural Earth | Self-hosted, needs no tile service |
| Street maps (Phase 2) | OpenFreeMap | Free, no key |
| Rail and transit (Phase 2) | Typical schedules on file + Transitous, OpenRouteService | Live timetables where coverage exists |
| Places (Phase 2) | OpenTripMap, Wikivoyage, Foursquare or Geoapify free tiers | Sources credited; links out to TripAdvisor, Booking.com, Google Maps |
| Visas and advisories (Phase 3) | Passport Index dataset, US State Department advisories | Plus AI-written notes with sources |
| AI (Phase 3) | Gemini free tier, behind a swappable provider interface | |
| Accounts and storage (Phase 4) | Supabase free plan | Pauses after a week idle |
| Hosting | Vercel Hobby | Personal, non-commercial use |

## Phases

### Phase 1: foundation, globe, trip builder, flights ✅ ready for review
- Next.js + TypeScript + Tailwind app; design system with light, dark and system themes.
- Interactive 3D globe: flight arcs (brass, dashed), ground legs (jade), numbered stops. Click a route to open it.
- Trip builder: home city, departure date, fly-in city, stops with nights, fly-out city, optional return flight. Reorder and remove stops; dates calculated automatically.
- Travellers (solo, two, group) and cabin class.
- Flight search per leg: Best / Cheapest / Fastest, price-vs-time slider, nonstop filter, choose a fare. Links to Google Flights, Skyscanner and Kiwi.com.
- Providers: Travelpayouts (recent fares), SerpApi (live, on request, monthly safety limit), labelled sample fares as fallback.
- Ground legs: typical high-speed rail times and fares for China, Hong Kong and Europe; estimates for bus, car and ferry; border and driving notes; booking links (Trip.com, 12306, Trainline, Omio, 12Go).
- Running transport total. The trip is saved in the browser.
- Launch cities: 6 US departure cities; Beijing, Shanghai, Guangzhou, Shenzhen, Chengdu, Chongqing, Xi'an, Hangzhou, Guilin, Hong Kong; Tokyo, Seoul, Bangkok, Singapore; London, Paris, Rome, Barcelona, Amsterdam, Istanbul.

### Phase 1 review feedback ✅ built in Phase 2
- Add a small airplane marker riding each dotted flight line, so flights are distinct from train routes at a glance.
- A separate swipe/slide-to screen per city: the local city map with recommended hotels and attractions pinned. Plan: a free map (OpenFreeMap street map) with pins, plus "open in Google Maps" links. Inside mainland China, Google Maps is blocked and its streets are offset, so also offer Amap/Apple Maps links there.

### Phase 2: destination guides and maps ✅ ready for review
- Planes on flight lines (pointing towards the destination; bigger on the selected flight).
- City screen per stop: open it from "Stays, sights & food" in the itinerary or by clicking a city on the globe. Move between cities with the arrows, ← / → keys or a swipe on phones; Back closes it. Each city has its own shareable address (#explore-…).
- Stay / See / Do / Eat / Drink tabs from Wikivoyage listings (free, no key), with Budget / Mid-range / Splurge filters, descriptions, prices, hours and photos where the guide has them.
- Street map (OpenFreeMap) with coloured pins per category; picking a card flies to its pin and picking a pin highlights its card. Dark mode darkens the map.
- Hotel searches pre-filled with that stop's dates and travellers (Booking.com, Google Hotels, Trip.com for China). Each place links to Google Maps and TripAdvisor, plus Amap and Apple Maps in mainland China.
- Still to come from the original Phase 2 list: live transit routing (Transitous) and richer place data (ratings, opening status) from a places API.
- Stay / See / Do / Eat tabs per city with map pins, ratings where licensed, price level and credited sources.
- Live transit routing between and within cities where open data covers it.

### Phase 2 review feedback ✅ built
- City screen redesigned for a calmer, more luxurious feel (patterns from editorial guides and booking sites): photo hero, six large tabs, friendly subcategories ("Temples & sacred sites", "Boutique & heritage"…), three "Our picks" (one per price level for stays), a short list with "Show more", and a separate detail page with photo, key facts and one main action.
- Save places with a heart; the Saved tab collects them per city and the concierge plans around them.
- Phones: list and map are separate screens with a floating Map / List button.
- Photos: the city's Wikivoyage banner and listing photos from Wikimedia and Wikipedia (free).

### Phase 3: AI planner and "Before you go" ✅ ready for review
- Concierge screen (top bar, or "Plan my days" in the itinerary): describe the trip, tap interests, pace and comfort, then "Write my itinerary".
- Gemini writes a day-by-day plan matched to the route's exact dates and cities, using real places from the guides and your saved places. Vague requests also get 3–4 follow-up questions as tap-to-answer chips; "Update my itinerary" refines it.
- With no stops yet, it suggests a route with nights, applied in one tap.
- Before you go: visa & entry (flagged), money, phone & internet, getting around, health, etiquette, weather & packing, plus fixed links to the US State Department and each country's official entry pages.
- Every AI reply is checked against a strict format (wrong dates and unknown cities are dropped) and retried once if malformed. Without a key, a clearly labelled sample plan is shown.
- The plan is saved with the trip and flagged when the route changes.

### Phase 3 (original notes)
- Chat-style trip request that produces a full day-by-day itinerary, with follow-up questions for vague requests.
- Drag places into days; auto-fill empty days.
- Before-you-go panel: visas (e.g. China's visa-free transit rules and the Hong Kong border), advisories, season, money, plugs, apps that work in China.

### Phase 3 review feedback ✅ built (six parallel workstreams)
- Concierge: busy-model retries with automatic backup models, trimming instead of rejecting long text, parallel day chunks with a 75s budget, live progress, Cancel, plane loader, place names link to the guide.
- Catalog: 96 cities (China, Macau, much of Europe and Asia), airport-less cities fly via the nearest airport, 81 rail pairs plus HK⇄Macau ferry/bus, official entry links per country, grouped city picker.
- City guide: Google Places ratings and reviews (optional key), rating- and comfort-led picks, Airbnb-style stay cards with price pills, Booking.com first plus Trip.com in CN/HK/MO, deep links to a place's page.
- Printable itinerary at /itinerary (PDF via print, CSV download), styled after the owner's spreadsheet.
- Globe: polar band, rings and stacked arcs fixed; split-flap departure-board route codes.
- Design analysis in docs/DESIGN.md and a Hopper-style opening page with Where · Dates · Guests.

### Phase 4: accounts, saving and sharing ✅ ready for review
- Sign in with a one-time email link (no password). Account menu with a live save status (Saved / Saving… / Offline · kept on this device / View only).
- My trips: every saved trip, on any device; open, delete; "Save this trip to my trips". Starting a new trip never overwrites a saved one.
- Share: a view-only link (/share#…, no account needed, can print or make a copy) that can be turned off; invite by email to edit or view.
- Shared trips: invitations become shared trips when that person signs in; edits sync live between everyone on the trip (last save wins if two people save the same moment, with a note).
- Offline: installable app (manifest and icons); a service worker keeps pages, app code, map shapes and visited city guides; trips are kept on the device and edits made offline are sent when you're back online.
- `npm run check:supabase` checks the project, tables, security rules and functions from your own computer.
- Sign-in, My trips, view-only share links, Shared trips with live editing together.
- Flight cache and live-search counter move to the database.
- Installable app with offline access to saved trips.

### Phase 5: polish and launch
- Performance, accessibility pass, design refinements from review, deployment to Vercel.

### Later
- Native mobile app (Expo / React Native) reusing the same backend.
- Business model, as a separate plan.
