# Intercontinental Nomad: setup guide

This guide is for someone new to web development. It explains what each service does, how to create the account, where the key goes, and how to stay on the free tier. Every step costs $0.

The app runs without any of these accounts: it shows **sample fares**, clearly labelled, until you add keys. Add them one at a time, in the order below.

| # | Service | What it gives the app | Needed for | Cost |
|---|---|---|---|---|
| 1 | Node.js + GitHub | Running the app on your computer | Now | Free |
| 2 | Travelpayouts | Recent flight prices (Aviasales data) | Phase 1 | Free |
| 3 | SerpApi | Live Google Flights prices, on demand | Phase 1 | Free plan, about 250 searches a month |
| 4 | Google AI Studio (Gemini) | The AI trip planner | Phase 3 | Free tier |
| 5 | Supabase | Accounts, saved and shared trips | Phase 4 | Free plan |
| 6 | Vercel | Hosting the website on the internet | Any time | Free Hobby plan |

> Free-tier limits change. Each section links the provider's own pricing or limits page. Check it when you sign up.

---

## Key ideas first

- **API**: a way for one program to ask another for data. The app asks Travelpayouts "what does New York → Beijing cost on April 8?" and gets an answer back as data.
- **API key / token**: a password that identifies *your* account to a service. Anyone holding it can use your quota, so treat it like a password.
- **Environment variable**: a named setting the app reads when it starts, such as `SERPAPI_KEY=abc123`. Keys live in environment variables, never in the code.
- **`.env.local`**: a file on your computer that holds your environment variables. Git is set up to **ignore** it, so it never reaches GitHub.
- **Free tier / quota**: the amount you can use each month without paying. If you hit it, the service refuses further requests until the month resets. It doesn't charge you unless you added a payment method and upgraded.
- **Cache**: the app remembers answers for a few hours, so asking the same question twice doesn't use up your quota.

---

## 1. Run the app on your computer

1. Install **Node.js 22 LTS** from <https://nodejs.org> (choose "LTS"). It includes `npm`, the tool that installs the app's building blocks.
2. Install **Git** from <https://git-scm.com/downloads>, and an editor such as **VS Code** from <https://code.visualstudio.com>.
3. Open a terminal (macOS: Terminal; Windows: PowerShell) and run these, one at a time:

```bash
git clone https://github.com/ikiyanitsyn/New-Repo.git
```

```bash
cd New-Repo
```

```bash
npm install
```

```bash
npm run dev
```

4. Open <http://localhost:3000>. You should see the globe and the example China trip with **Sample fares**.
5. Make your settings file by copying the template:

```bash
cp .env.example .env.local
```

On Windows PowerShell use `copy .env.example .env.local`. Open `.env.local` in your editor. You'll paste keys into it in the next steps. After changing it, stop the app (Ctrl+C) and run `npm run dev` again.

---

## 2. Travelpayouts: recent flight prices

**What it is.** Travelpayouts is an affiliate network. Its *Aviasales Data API* is free for members and returns prices that Aviasales users found in recent searches. That makes the prices **recent, not live**: usually hours to a few days old, and economy only. That suits browsing and comparing.

**Sign up**

1. Go to <https://www.travelpayouts.com> and create a free account.
2. When it asks about your project, describe the site honestly: a personal travel-planning website in development. You can add the site's URL later, once it's on Vercel.
3. Join the **Aviasales** program (search for it among the programs/brands).
4. Find your **API token**. It's in your profile settings under a section named *API token* (the menu name may change; look for "API" in your profile).

**Add it**

```
TRAVELPAYOUTS_TOKEN=paste-your-token-here
```

**Check it worked.** Restart the app and click the outbound flight. The badge at the top of the fares should change from *Sample fares* to *Recent fares · Aviasales*.

**Staying free.** There's nothing to pay. If a route and date has no recent searches, the app says so and you can try live prices or a nearby date.

Docs: <https://support.travelpayouts.com/hc/en-us/articles/203956163>

---

## 3. SerpApi: live Google Flights prices

**What it is.** SerpApi fetches real-time Google Flights results. The free plan allows about **250 searches a month**, no card required (check <https://serpapi.com/pricing>). To make that last, the app **only** calls SerpApi when you press **Check live prices**, and remembers each answer for 12 hours.

**Sign up**

1. Go to <https://serpapi.com> and register (choose the free plan).
2. Verify your email and phone if asked.
3. Open your dashboard and copy your **API key** (the page is called *Api Key* in the account menu).

**Add it**

```
SERPAPI_KEY=paste-your-key-here
SERPAPI_MONTHLY_LIMIT=200
```

`SERPAPI_MONTHLY_LIMIT` is the app's own safety stop, set below the real limit. The button shows how many live searches are left.

**Check it worked.** The **Check live prices** button becomes gold and clickable. After pressing it, the badge reads *Live · Google Flights* and flights show exact arrival times.

**Staying free.** Don't enter a card or pick a paid plan. When the free searches run out, SerpApi refuses requests and the app falls back to recent fares. Nothing is charged.

Docs: <https://serpapi.com/google-flights-api>

---

## 4. Google AI Studio: Gemini API key (used from Phase 3)

**What it is.** Gemini is Google's AI model. The app will use it to write day-by-day itineraries, ask follow-up questions when a request is vague, and summarise visa and travel notes. The app is built so the AI provider can be swapped later (for example to Claude).

**Get a free key**

1. Go to <https://aistudio.google.com> and sign in with a Google account.
2. Accept the terms. Pick **Get API key** (left menu or top right), then **Create API key**. If asked, let it create a new Google Cloud project for you; the default name is fine.
3. Copy the key.

**Add it**

```
GEMINI_API_KEY=paste-your-key-here
GEMINI_MODEL=gemini-3.5-flash
```

**Check the key on its own** (macOS/Linux; replace `YOUR_KEY`):

```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash:generateContent" -H "x-goog-api-key: YOUR_KEY" -H "Content-Type: application/json" -d '{"contents":[{"parts":[{"text":"Say hello in Mandarin"}]}]}'
```

You should get back JSON containing a greeting. If you see "model not found", open <https://ai.google.dev/gemini-api/docs/models>, pick a current **Flash** model and put its name in `GEMINI_MODEL`.

**Staying free: read this part**

- The free tier applies while the Google Cloud project has **no billing account**. **Don't** click *Set up billing*, *Upgrade* or *Activate full account*. Linking billing moves the project to the paid tier.
- Free use has **rate limits**: requests per minute and per day, which differ by model. Check <https://ai.google.dev/gemini-api/docs/rate-limits>. If the planner hits a limit, wait a minute or until the next day.
- On the free tier Google may use prompts to improve its products. Don't type passport numbers or other private details into the planner.
- Pricing: <https://ai.google.dev/gemini-api/docs/pricing>

---

## 5. Supabase: accounts and saved trips (Phase 4)

You don't need this yet. Trips currently save in your own browser. In Phase 4 Supabase adds sign-in, **My trips**, view-only share links and the **Shared trips** tab.

Preview, so nothing surprises you later:

1. Sign up at <https://supabase.com> with your GitHub account and create a project on the **Free** plan.
2. The app needs the **Project URL** and the **anon public key** from *Project Settings → API*.
3. **Free projects pause after about a week with no activity.** Open the Supabase dashboard and press *Restore* to wake it. Your data is kept.

Pricing: <https://supabase.com/pricing>

---

## 6. Vercel: put the site on the internet

1. Go to <https://vercel.com> and **Continue with GitHub**. Choose the **Hobby** plan. It's free for personal, non-commercial projects.
2. **Add New → Project**, pick the `New-Repo` repository, and keep the detected settings (framework: Next.js).
3. Before deploying, open **Environment Variables** and add the same names and values as in your `.env.local`. Never paste keys into code.
4. Press **Deploy**. You get an address like `intercontinental-nomad.vercel.app`.
5. Every time code is pushed to GitHub, Vercel builds a preview automatically.

**Staying free.** Hobby has monthly usage allowances (<https://vercel.com/pricing>) that a personal project won't come near. Don't add a payment method unless you choose to upgrade. If the site later becomes a business, Hobby no longer applies; the separate business plan will cover that.

---

## Staying-free checklist

- [ ] No payment method on Google Cloud / AI Studio, SerpApi, Supabase or Vercel.
- [ ] `SERPAPI_MONTHLY_LIMIT` set below the real SerpApi allowance.
- [ ] Keys only in `.env.local` and Vercel's Environment Variables, never in code or chat.
- [ ] If a key leaks, delete it in that service's dashboard and create a new one.

## When something runs out or breaks

The app never shows an empty screen. If a key is missing, a limit is reached or a service is down, it falls back to sample fares and explains why in a note above the results.

## Glossary

| Term | Meaning |
|---|---|
| IATA code | Three-letter airport or city code: PEK is Beijing Capital airport, BJS is all Beijing airports |
| Open-jaw | Flying into one city and home from another, e.g. into Beijing, out of Hong Kong |
| Nonstop | No landings between departure and arrival |
| Cached fare | A price someone else found recently, stored and reused |
| Rate limit | How many requests a service accepts per minute or per day |
