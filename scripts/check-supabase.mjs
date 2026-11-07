// Checks that Supabase is reachable and the schema from supabase/schema.sql is installed.
// Run from the project folder:  npm run check:supabase
// It only reads: it uses the public (publishable/anon) key from .env.local and changes nothing.
import { readFileSync } from "node:fs";

function env() {
  const out = { ...process.env };
  try {
    for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !out[m[1]]) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    console.log("✗ No .env.local file found in this folder. Run this from the project folder.");
    process.exit(1);
  }
  return out;
}

const e = env();
const url = e.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
const key = e.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.log("✗ NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY must both be set in .env.local.");
  process.exit(1);
}
if (/service_role|sb_secret_/.test(key)) {
  console.log("✗ The key in NEXT_PUBLIC_SUPABASE_ANON_KEY looks like the SECRET key. Use the publishable/anon key, and regenerate the secret key in Supabase.");
  process.exit(1);
}
const headers = { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
let ok = true;
const check = async (label, fn) => {
  try {
    const msg = await fn();
    console.log(`✓ ${label}${msg ? ` (${msg})` : ""}`);
  } catch (err) {
    ok = false;
    console.log(`✗ ${label}: ${err.message}`);
  }
};

await check("Supabase project is reachable", async () => {
  const r = await fetch(`${url}/auth/v1/settings`, { headers });
  if (!r.ok) throw new Error(`answered ${r.status}. Check the Project URL and key.`);
  const s = await r.json();
  return s.external?.email ? "email sign-in is on" : "warning: email sign-in looks switched off";
});
for (const table of ["trips", "trip_members", "trip_invites", "share_links"]) {
  await check(`Table "${table}" exists and is protected`, async () => {
    const r = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
    if (r.status === 404) throw new Error("missing. Run supabase/schema.sql in the SQL Editor.");
    if (!r.ok) throw new Error(`answered ${r.status}: ${(await r.text()).slice(0, 120)}`);
    const rows = await r.json();
    if (rows.length) throw new Error("rows are visible without signing in. Row Level Security is not on; re-run supabase/schema.sql.");
  });
}
await check('Function "get_shared_trip" (view-only links) exists', async () => {
  const r = await fetch(`${url}/rest/v1/rpc/get_shared_trip`, { method: "POST", headers, body: JSON.stringify({ share_token: "check" }) });
  if (!r.ok) throw new Error(`answered ${r.status}. Re-run supabase/schema.sql.`);
});
await check('Function "remove_trip_person" exists', async () => {
  const r = await fetch(`${url}/rest/v1/rpc/remove_trip_person`, { method: "POST", headers, body: JSON.stringify({ t: "00000000-0000-0000-0000-000000000000", person_email: "x" }) });
  if (r.status === 404) throw new Error("missing. Re-run the latest supabase/schema.sql (it's safe to run again).");
});
console.log(ok ? "\nAll good. Accounts, saving and sharing are ready." : "\nSomething needs fixing; see the ✗ lines above.");
process.exit(ok ? 0 : 1);
