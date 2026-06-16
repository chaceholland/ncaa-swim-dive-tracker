/**
 * DEPRECATED — use `import-ncaa-champs-2026.mjs` instead.
 *
 * This file assumed a Swimcloud JSON API (api/v1/meets/...) which does not
 * actually exist as a public endpoint — Cloudflare returns 403 "challenge"
 * to non-browser requests. The working pattern is Playwright-rendered HTML
 * scraping (matches `archive/scripts/scrape-swimcloud-season.js`).
 *
 * Kept in tree only for the staging-write logic comment block. Will be deleted
 * after the .mjs version runs successfully once.
 *
 * Swim Pass 1 / Chunk A — NCAA 2026 D1 Men's Championships staging import.
 *
 * USAGE
 *   tsx scripts/staging/import-ncaa-champs-2026.ts --dry-run
 *   tsx scripts/staging/import-ncaa-champs-2026.ts --apply   # writes to STAGING tables only
 *
 * SAFETY
 *   This script never writes to swim_meets, swim_individual_results, swim_athletes,
 *   athletes, or teams. It only touches:
 *     - swim_staging_ncaa_champs_2026_meet
 *     - swim_staging_ncaa_champs_2026_results
 *   Both are created by scripts/staging/001_create_ncaa_champs_staging.sql.
 *
 * SOURCE
 *   Swimcloud meet listing for D1 Men 2026 NCAA Champs. We probe the public results
 *   index and pick the meet whose name matches /NCAA Division I/i AND
 *   /Championship/i AND has the men's gender flag.
 */

import { createClient } from "@supabase/supabase-js";

const DRY_RUN = !process.argv.includes("--apply");
const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

// Optional override: --meet-id=370135 lets the operator skip the discovery probe.
// Use this when running from a network that Swimcloud's API blocks.
const MEET_ID_ARG = process.argv.find((a) => a.startsWith("--meet-id="));
const FORCED_MEET_ID = MEET_ID_ARG ? Number(MEET_ID_ARG.split("=")[1]) : null;

if (!DRY_RUN && (!SUPABASE_URL || !SUPABASE_KEY)) {
  console.error("Missing SUPABASE_URL / key. Set env first or run with --dry-run.");
  process.exit(1);
}

// ── Event id catalog (matches lib/swimcloud.ts EVENT_NAME_MAP) ──────────────
const SWIM_EVENTS: string[] = [
  "50-free", "100-free", "200-free", "500-free", "1650-free",
  "100-back", "200-back",
  "100-breast", "200-breast",
  "100-fly", "200-fly",
  "200-im", "400-im",
  "200-free-relay", "400-free-relay", "800-free-relay",
  "200-medley-relay", "400-medley-relay",
];
const DIVE_EVENTS: string[] = ["1m-diving", "3m-diving", "platform-diving"];

type RawResult = {
  event_id: string;
  event_type: "swim" | "dive";
  round?: string;
  final_place?: number;
  athlete_name: string;
  team_name?: string;
  team_slug?: string;
  swimcloud_id?: number;
  final_time_ms?: number;
  final_score?: number;
  raw: unknown;
};

type MeetRow = {
  swimcloud_id: number | null;
  name: string;
  date_start: string | null;
  date_end: string | null;
  location: string | null;
  course_type: string;
  url: string | null;
  season: string;
  raw_payload: unknown;
};

// ── Swimcloud probes ───────────────────────────────────────────────────────
async function findMeet(): Promise<{ id: number; name: string; url: string; raw: unknown } | null> {
  // Swimcloud meets index, gender=1 (men), division=1, year=2026
  const url = "https://www.swimcloud.com/api/v1/meets/?gender=1&division=1&year=2026";
  let resp: Response;
  try {
    resp = await fetch(url, { headers: { "User-Agent": "ncaa-swim-dive-tracker/staging" } });
  } catch (e) {
    console.error("Network error probing Swimcloud meets index:", e);
    return null;
  }
  if (!resp.ok) {
    console.error(`Swimcloud meets index HTTP ${resp.status}`);
    return null;
  }
  const payload = (await resp.json()) as { meets?: Array<{ meet_id: number; meet_name: string; meet_url?: string }> };
  const meets = payload.meets ?? [];
  const match = meets.find((m) =>
    /NCAA/i.test(m.meet_name) &&
    /Division\s*I\b/i.test(m.meet_name) &&
    /Championship/i.test(m.meet_name),
  );
  if (!match) {
    console.error("Could not locate D1 Men's NCAA Championship in 2026 Swimcloud index. Sample names:",
      meets.slice(0, 8).map((m) => m.meet_name));
    return null;
  }
  return {
    id: match.meet_id,
    name: match.meet_name,
    url: match.meet_url ?? `https://www.swimcloud.com/results/${match.meet_id}/`,
    raw: match,
  };
}

async function fetchEventResults(meetId: number, eventId: string): Promise<RawResult[]> {
  const url = `https://www.swimcloud.com/api/v1/meets/${meetId}/events/${eventId}/results?round=final`;
  let resp: Response;
  try {
    resp = await fetch(url, { headers: { "User-Agent": "ncaa-swim-dive-tracker/staging" } });
  } catch {
    return [];
  }
  if (!resp.ok) return [];
  const j = (await resp.json()) as { results?: Array<Record<string, unknown>> };
  const rows = j.results ?? [];
  const eventType: "swim" | "dive" = DIVE_EVENTS.includes(eventId) ? "dive" : "swim";
  return rows.map((r) => ({
    event_id: eventId,
    event_type: eventType,
    round: "final",
    final_place: typeof r.place === "number" ? r.place : undefined,
    athlete_name: String(r.athlete_name ?? r.full_name ?? "").trim(),
    team_name: typeof r.team_name === "string" ? r.team_name : undefined,
    team_slug: typeof r.team_slug === "string" ? r.team_slug : undefined,
    swimcloud_id: typeof r.athlete_id === "number" ? r.athlete_id : undefined,
    final_time_ms: eventType === "swim" && typeof r.time_ms === "number" ? r.time_ms : undefined,
    final_score: eventType === "dive" && typeof r.score === "number" ? r.score : undefined,
    raw: r,
  }));
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  console.log(`Mode: ${DRY_RUN ? "DRY-RUN (no writes)" : "APPLY (staging tables only)"}`);

  let meet: { id: number; name: string; url: string; raw: unknown } | null;
  if (FORCED_MEET_ID) {
    meet = {
      id: FORCED_MEET_ID,
      name: `NCAA Division I Men's Championships 2026 (forced id=${FORCED_MEET_ID})`,
      url: `https://www.swimcloud.com/results/${FORCED_MEET_ID}/`,
      raw: { source: "forced" },
    };
    console.log(`Using forced meet id=${FORCED_MEET_ID}`);
  } else {
    meet = await findMeet();
    if (!meet) {
      console.error("Abort: no meet found. Re-run with --meet-id=<swimcloud_meet_id>.");
      process.exit(2);
    }
    console.log(`Found meet: id=${meet.id} name="${meet.name}"`);
  }

  const allEvents = [...SWIM_EVENTS, ...DIVE_EVENTS];
  const all: RawResult[] = [];
  for (const ev of allEvents) {
    const rows = await fetchEventResults(meet.id, ev);
    console.log(`  ${ev.padEnd(20)} → ${rows.length} rows`);
    all.push(...rows);
    // gentle pacing
    await new Promise((r) => setTimeout(r, 250));
  }

  const swimCount = all.filter((r) => r.event_type === "swim").length;
  const diveCount = all.filter((r) => r.event_type === "dive").length;
  console.log(`TOTAL: ${all.length} (${swimCount} swim / ${diveCount} dive) across ${new Set(all.map((r) => r.event_id)).size} events`);

  if (DRY_RUN) {
    console.log("DRY-RUN done. Re-run with --apply to write to staging tables.");
    return;
  }

  const supabase = createClient(SUPABASE_URL!, SUPABASE_KEY!);

  const meetRow: MeetRow = {
    swimcloud_id: meet.id,
    name: meet.name,
    date_start: null,  // populated in a later pass once we scrape session metadata
    date_end: null,
    location: null,
    course_type: "SCY",
    url: meet.url,
    season: "2025-26",
    raw_payload: meet.raw,
  };

  const { data: meetInsert, error: meetErr } = await supabase
    .from("swim_staging_ncaa_champs_2026_meet")
    .upsert([meetRow], { onConflict: "swimcloud_id" })
    .select("id")
    .single();
  if (meetErr || !meetInsert) {
    console.error("Meet upsert failed:", meetErr);
    process.exit(3);
  }
  const stagingMeetId = meetInsert.id as number;
  console.log(`Meet staging row id=${stagingMeetId}`);

  // Delete existing children for this meet, then re-insert (idempotent).
  const { error: delErr } = await supabase
    .from("swim_staging_ncaa_champs_2026_results")
    .delete()
    .eq("meet_staging_id", stagingMeetId);
  if (delErr) {
    console.error("Failed to clear staging children:", delErr);
    process.exit(4);
  }

  const rowsToInsert = all.map((r) => ({
    meet_staging_id: stagingMeetId,
    event_id: r.event_id,
    event_type: r.event_type,
    round: r.round ?? null,
    final_place: r.final_place ?? null,
    athlete_name: r.athlete_name,
    team_name: r.team_name ?? null,
    team_slug: r.team_slug ?? null,
    swimcloud_id: r.swimcloud_id ?? null,
    final_time_ms: r.final_time_ms ?? null,
    final_score: r.final_score ?? null,
    raw_row: r.raw,
  }));

  // chunked insert (Supabase max 1000)
  const CHUNK = 500;
  for (let i = 0; i < rowsToInsert.length; i += CHUNK) {
    const slice = rowsToInsert.slice(i, i + CHUNK);
    const { error } = await supabase
      .from("swim_staging_ncaa_champs_2026_results")
      .insert(slice);
    if (error) {
      console.error(`Insert chunk ${i / CHUNK} failed:`, error);
      process.exit(5);
    }
  }
  console.log(`Inserted ${rowsToInsert.length} staging results.`);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(99);
});
