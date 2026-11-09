# Supabase setup (accounts, saved trips, sharing)

Supabase is the app's database and sign-in service. It gives Intercontinental Nomad:

- **Accounts**: sign in with a one-time email link (no password to remember), and optionally Google.
- **My trips**: trips saved to the cloud, so they're on every device.
- **View-only share links**: send a link by email or text; anyone can open it without an account.
- **Shared trips**: invite someone by email; once they sign in, you edit the trip together and see each other's changes live.

Everything here is on the **free plan**. No card is needed.

---

## Key ideas

- **Project**: your own private database plus sign-in system, hosted by Supabase.
- **Project URL**: the address of your project, like `https://abcdefgh.supabase.co`.
- **Publishable key** (older projects call it the **anon public key**): a key that is safe to use in the browser. It only allows what the security rules permit.
- **Secret / service_role key**: a master key. **The app never needs it.** Never put it in `.env.local`, never paste it anywhere.
- **SQL**: the language databases understand. You'll paste one ready-made file; you don't need to write any.
- **Row Level Security (RLS)**: rules inside the database saying "people can only read their own trips and trips shared with them". Our schema turns these on for every table.

---

## Steps

1. **Create the account.** Go to <https://supabase.com>, choose **Start your project**, and sign in with GitHub.
2. **Create a project.**
   - **New project**.
   - Name: `intercontinental-nomad`.
   - Database password: press **Generate a password** and save it in a password manager. The app doesn't use it, but you may need it later.
   - Region: **East US (North Virginia)** or the region closest to you.
   - Plan: **Free**.
   - Wait 1–2 minutes while it sets up.
3. **Run the schema.** Open **SQL Editor** (left menu) and choose **New query**. Open `supabase/schema.sql` from this repository in VS Code, copy all of it, paste it in, and press **Run**. You should see "Success. No rows returned". Then open **Table Editor**: you should see `trips`, `trip_members`, `trip_invites` and `share_links`.
4. **Set up sign-in.**
   - **Authentication → Sign In / Providers**: make sure **Email** is enabled.
   - **Authentication → URL Configuration**: set **Site URL** to `http://localhost:3000`. Under **Redirect URLs** add `http://localhost:3000/**`. When the site goes live on Vercel, add `https://<your-site>.vercel.app/**` too.
   - **Authentication → Email Templates → Magic Link**: add the 6-digit code to the email so sign-in works inside the iPhone home-screen app (links open in Safari, which can't sign the app in). Put this line in the message body, for example under the link: `Or enter this code in the app: {{ .Token }}`. Do the same in the **Confirm signup** template, which new accounts get instead. Save each template.
   - Optional, Google sign-in: **Authentication → Sign In / Providers → Google**. This needs a Google Cloud OAuth client; the tutor can walk you through it, or skip it, since email links work fine.
5. **Copy the keys into `.env.local`.** Open **Project Settings → API Keys** (older layout: **Project Settings → API**). Copy the **Project URL** and the **publishable** (or **anon public**) key, then add to `.env.local`:

   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=paste-the-publishable-or-anon-key
   ```

   `NEXT_PUBLIC_` means the value may be used in the browser, which is fine for these two. Restart the app after saving (Ctrl+C, then `npm run dev`).
6. **Check it.** In VS Code's terminal, in the project folder, run `npm run check:supabase`. Every line should start with ✓. It only reads; it changes nothing.
7. **Try it.** Run `npm run dev`, press **Sign in** (top right), enter your email, open the link from the email on the same computer, then use the account menu: **Save this trip to my trips**, **My trips**, **Share this trip**.

> **Updating later:** when the project gains new database features, run the latest `supabase/schema.sql` again in the SQL Editor. It's safe to run any number of times.

---

## Staying free

- The free plan includes a small database, plenty for thousands of trips, and generous monthly sign-ins.
- **Free projects pause after about a week with no activity.** If the app says it can't reach your trips, open the Supabase dashboard and press **Restore project**. Your data is kept.
- Don't upgrade, and don't add a card unless you decide to later.
- Pricing: <https://supabase.com/pricing>

## If something goes wrong

| What you see | What to do |
|---|---|
| SQL Editor shows an error | Copy the whole error message into your tutor chat. Running the file again is safe. |
| Sign-in email never arrives | Check spam. The free plan sends a limited number of emails per hour; wait a few minutes. |
| The email has a link but no 6-digit code | Add `{{ .Token }}` to the **Magic Link** and **Confirm signup** templates (step 4). |
| The link opens a page that says "redirect not allowed" | Add the address you're using to **Authentication → URL Configuration → Redirect URLs**. |
| You pasted the secret / service_role key somewhere | **Project Settings → API Keys** → roll (regenerate) it. The app never needs that key. |
