// Insert Chrome-scraped NCAA champs JSON into the staging tables.
// Used because Cloudflare blocks headless scraping; data was pulled via the
// user's real Chrome, dumped to JSON, and is loaded here. Staging-only writes.
//   node scripts/staging/apply-staging-from-json.mjs <path-to-json>
import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

const envText = fs.readFileSync(new URL("../../.env.local", import.meta.url), "utf8");
for (const line of envText.split("\n")) {
  const i = line.indexOf("=");
  if (i > 0) { const k = line.slice(0, i).trim(); const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, ""); if (!process.env[k]) process.env[k] = v; }
}
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !KEY) { console.error("MISSING_ENV"); process.exit(1); }
const sb = createClient(URL_, KEY);

const data = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
const M = "swim_staging_ncaa_champs_2026_meet";
const R = "swim_staging_ncaa_champs_2026_results";

// Reuse the meet row if present (one was already inserted), else create it.
let { data: meet, error: me } = await sb.from(M).select("id").eq("swimcloud_id", 351190).maybeSingle();
if (me) { console.error("MEET_SELECT_ERR:", me.message); process.exit(2); }
let meetId;
if (meet) { meetId = meet.id; }
else {
  const mi = data.meetInfo;
  const { data: ins, error } = await sb.from(M).insert([{ swimcloud_id: 351190, name: mi.name, location: mi.location, course_type: mi.course, url: "https://www.swimcloud.com/results/351190/", season: "2025-26", raw_payload: { dates: mi.dates, event_count: 21 } }]).select("id").single();
  if (error) { console.error("MEET_INSERT_ERR:", error.message); process.exit(2); }
  meetId = ins.id;
}

const { error: delErr } = await sb.from(R).delete().eq("meet_staging_id", meetId);
if (delErr) { console.error("DELETE_ERR:", delErr.message); process.exit(3); }

const rows = data.collected.map((r) => ({ ...r, meet_staging_id: meetId }));
for (let i = 0; i < rows.length; i += 500) {
  const { error } = await sb.from(R).insert(rows.slice(i, i + 500));
  if (error) { console.error("INSERT_ERR@" + i + ":", error.message); process.exit(4); }
}
const { count } = await sb.from(R).select("*", { count: "exact", head: true }).eq("meet_staging_id", meetId);
console.log("OK meetId=" + meetId + " inserted=" + rows.length + " table_count=" + count);
