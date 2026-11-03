# Intercontinental Nomad

Plan multi-city trips on one screen: fly into one city and home from another, add stops and how you'll travel between them, and compare fares by cheapest, fastest or the best balance of both, all on an interactive globe.

**Status:** Phase 1 of 5. See [docs/ROADMAP.md](docs/ROADMAP.md).

## Quick start

```bash
npm install
```

```bash
npm run dev
```

Open <http://localhost:3000>. Without API keys the app shows clearly labelled sample fares. To get real prices, follow [docs/SETUP_GUIDE.md](docs/SETUP_GUIDE.md); every service it uses has a free tier.

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run locally with live reload |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests (ranking, trip dates, rail estimates) |
| `npm run lint` / `npm run typecheck` | Code checks |

## How it's organised

```
src/
  app/
    page.tsx              the planner page
    api/flights/route.ts  flight search endpoint (validates input, picks a provider)
  components/
    Planner.tsx           page state; saves the trip in the browser
    Globe.tsx             MapLibre globe, arcs and stop markers
    TripBuilder.tsx       itinerary panel: travellers, stops, legs, totals
    LegPanel.tsx          detail for the selected leg (fares or ground options)
    FlightResults.tsx     Best / Cheapest / Fastest, nonstop filter, slider
  lib/
    cities.ts             launch city list with airport codes
    trip.ts, tripReducer  trip model: legs, dates, edits
    ground.ts             rail schedules on file and bus/car/ferry estimates
    flights/              providers (Travelpayouts, SerpApi, sample), ranking, booking links
docs/                     setup guide and roadmap
```

## Data and credits

Country shapes: Natural Earth via `world-atlas`. Fares: Travelpayouts (Aviasales) and SerpApi (Google Flights). Rail times and fares are typical figures for planning; always confirm with the operator before you travel.
