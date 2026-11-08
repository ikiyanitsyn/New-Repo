# Put Intercontinental Nomad online and on your phone

This puts the site on the internet (free, on Vercel), then installs it on your phone like an app. You can do every step from your phone's browser.

## Key ideas
- **Vercel:** a hosting service. It copies the code from GitHub, builds the site and gives it a web address like `intercontinental-nomad.vercel.app`. The free **Hobby** plan is for personal, non-commercial projects.
- **Environment variables:** the same keys you put in `.env.local` on your computer. Vercel needs its own copy, because your computer's file never leaves your computer.
- **Installable app (PWA, "progressive web app"):** the website, added to your home screen. It opens full-screen like an app, and saved trips work offline.

## 1. Create the Vercel project
1. Go to <https://vercel.com>, choose **Sign Up**, then **Continue with GitHub**. Pick the **Hobby** plan.
2. Choose **Add New… → Project**, find **New-Repo**, and press **Import**.
3. Framework: **Next.js** (detected automatically). Leave the build settings as they are.
4. Open **Environment Variables** and add each of these, with the same values as your `.env.local`. Skip any you don't have yet.

| Name | What it's for |
|---|---|
| `TRAVELPAYOUTS_TOKEN` | Recent flight prices and deals |
| `SERPAPI_KEY` | Live Google Flights, hotel prices and live deals |
| `SERPAPI_MONTHLY_LIMIT` | Your safety stop, e.g. `200` |
| `GEMINI_API_KEY` | The concierge |
| `GEMINI_MODEL` | e.g. `gemini-3.5-flash` |
| `GOOGLE_PLACES_API_KEY` | Ratings and reviews (optional) |
| `GOOGLE_PLACES_DAILY_LIMIT` | e.g. `30` (optional) |
| `NEXT_PUBLIC_SUPABASE_URL` | Accounts. Use `https://<your-project>.supabase.co`, with nothing after `.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Accounts. The publishable/anon key, **never** the secret key |
| `NEXT_PUBLIC_MAPTILER_KEY` | Sharper satellite map (optional) |

5. Press **Deploy** and wait about 2 minutes. You'll get a web address.

## 2. Use the latest version (the branch)
The newest work lives on the branch `claude/gallant-goldberg-jn8f00`.
- In the Vercel project, open **Settings → Git**.
- Set **Production Branch** to `claude/gallant-goldberg-jn8f00`.
- Then go to **Deployments**, open the menu on the latest deployment, and choose **Redeploy**.

Alternatively, merge that branch into `main` on GitHub, and Vercel deploys `main` automatically.

## 3. Let sign-in work on the new address
In Supabase: **Authentication → URL Configuration**.
- Keep **Site URL** as it is, or set it to your Vercel address.
- Under **Redirect URLs**, add `https://<your-vercel-address>/**`.

Without this step, the email sign-in link won't bring you back to the online site.

## 4. Install on your phone
- **iPhone (Safari):** open your Vercel address, tap **Share**, then **Add to Home Screen**, then **Add**.
- **Android (Chrome):** open the address, tap **⋮**, then **Install app** (or **Add to Home screen**).

Open it from the home screen and sign in. The email link must be opened on the phone itself.

## 5. Phone check
Work through the "Phone test checklist" in `docs/PLAN_BEFORE_PHASE5.md`:
- plan a trip from the home search;
- open a city guide and save places;
- write a plan with the concierge;
- check that the trip appears on your computer when you're signed in there too;
- try airplane mode.

## Staying free
- Vercel Hobby is free for personal use. Don't add a card unless you choose to upgrade.
- Every push to GitHub redeploys automatically. Failed builds show in **Deployments** with a log; copy the error into your chat if one happens.
- If the concierge times out online, check **Settings → Functions** in Vercel. The concierge needs up to about 90 seconds.
