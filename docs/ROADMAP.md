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

### Phase 2: destination guides and maps
- Street-level city maps when zoomed in (OpenFreeMap).
- Stay / See / Do / Eat tabs per city with map pins, ratings where licensed, price level and credited sources.
- Live transit routing between and within cities where open data covers it.

### Phase 3: AI planner and "Before you go"
- Chat-style trip request that produces a full day-by-day itinerary, with follow-up questions for vague requests.
- Drag places into days; auto-fill empty days.
- Before-you-go panel: visas (e.g. China's visa-free transit rules and the Hong Kong border), advisories, season, money, plugs, apps that work in China.

### Phase 4: accounts, saving and sharing
- Sign-in, My trips, view-only share links, Shared trips with live editing together.
- Flight cache and live-search counter move to the database.
- Installable app with offline access to saved trips.

### Phase 5: polish and launch
- Performance, accessibility pass, design refinements from review, deployment to Vercel.

### Later
- Native mobile app (Expo / React Native) reusing the same backend.
- Business model, as a separate plan.
