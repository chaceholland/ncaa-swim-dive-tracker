#!/usr/bin/env node
/**
 * Swim Pass 1 / Chunk A — NCAA Men's D1 Championships 2026 → STAGING tables.
 *
 *   Meet ID 351190  (https://www.swimcloud.com/results/351190/)
 *
 * Why this file exists: Swimcloud exposes no JSON API to non-browser clients
 * (Cloudflare returns a 403 "challenge"), so the only safe path is
 * Playwright-rendered HTML scraping with headed real Chrome.
 *
 * WHAT IT CAPTURES (reworked 2026-06-16 after a DOM audit):
 *   - Individual events render TWO tables — "Finals" (A-final, 8 rows) and
 *     "Preliminaries" (the full field). We read BOTH, keyed by the round in the
 *     table's preceding heading, and merge each swimmer's prelim + final into a
 *     single staging row (prelim_time_ms/prelim_place + final_time_ms/final_place).
 *     Timed-finals events (1650, etc.) have one table → treated as the final.
 *   - Relay events render a results table whose squad-summary rows (the ones
 *     carrying a /team/ link) hold, in order: place, team, leg1..leg4
 *     (swimmer + split), the SQUAD TOTAL (last time cell), and points. These go
 *     to a separate relay staging table — never into individual results.
 *
 * SAFETY
 *   Reads only Swimcloud HTML. Writes only to:
 *     - swim_staging_ncaa_champs_2026_meet
 *     - swim_staging_ncaa_champs_2026_results   (individual; prelim+final merged)
 *     - swim_staging_ncaa_champs_2026_relays    (relay squads)
 *   All created by 001_create_ncaa_champs_staging.sql.
 *   Never touches swim_meets, swim_individual_results, swim_relay_results,
 *   swim_athletes, swim_teams.
 *
 * USAGE (run from the Mac that already has Playwright installed)
 *   cd ~/Desktop/ncaa-swim-dive-tracker
 *   node scripts/staging/import-ncaa-champs-2026.mjs --dry-run            # parse, print summary, no DB writes
 *   node scripts/staging/import-ncaa-champs-2026.mjs --dry-run --json     # same, but emit parsed JSON under scripts/staging/
 *   node scripts/staging/import-ncaa-champs-2026.mjs --apply              # writes ONLY to staging tables
 *   (add --meet-id=<id> to point at a different meet)
 */

import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { writeFile } from "node:fs/promises";

// ── Args ────────────────────────────────────────────────────────────────────
const APPLY = process.argv.includes("--apply");
const DRY_RUN = !APPLY;
const EMIT_JSON = process.argv.includes("--json");
const MEET_ID = (() => {
  const a = process.argv.find((x) => x.startsWith("--meet-id="));
  return a ? Number(a.split("=")[1]) : 351190;
})();

// ── Event-title → DB slug map ────────────────────────────────────────────────
const EVENT_NAME_TO_SLUG = {
  "1650 free": "1650-free",
  "1000 free": "1000-free",
  "500 free": "500-free",
  "200 free": "200-free",
  "100 free": "100-free",
  "50 free": "50-free",
  "400 im": "400-im",
  "200 im": "200-im",
  "200 back": "200-back",
  "100 back": "100-back",
  "200 breast": "200-breast",
  "100 breast": "100-breast",
  "200 fly": "200-fly",
  "100 fly": "100-fly",
  "200 butterfly": "200-fly",
  "100 butterfly": "100-fly",
  "200 backstroke": "200-back",
  "100 backstroke": "100-back",
  "200 breaststroke": "200-breast",
  "100 breaststroke": "100-breast",
  "200 freestyle": "200-free",
  "100 freestyle": "100-free",
  "50 freestyle": "50-free",
  "1650 freestyle": "1650-free",
  "500 freestyle": "500-free",
  "1000 freestyle": "1000-free",
  "200 individual medley": "200-im",
  "400 individual medley": "400-im",
  "400 free relay": "400-free-relay",
  "800 free relay": "800-free-relay",
  "200 free relay": "200-free-relay",
  "400 medley relay": "400-medley-relay",
  "200 medley relay": "200-medley-relay",
  "1m diving": "1m-diving",
  "3m diving": "3m-diving",
  "10m diving": "platform-diving",
  "platform diving": "platform-diving",
  "1 meter": "1m-diving",
  "3 meter": "3m-diving",
  platform: "platform-diving",
  tower: "platform-diving",
  "1-meter": "1m-diving",
  "3-meter": "3m-diving",
};
const DIVE_SLUGS = new Set(["1m-diving", "3m-diving", "platform-diving"]);
const isRelaySlug = (slug) => !!slug && slug.includes("relay");

function mapEventNameToSlug(title) {
  const lower = (title || "").toLowerCase();
  // Longest matching fragment wins, so specific keys ("200 free relay") beat the
  // shorter substring they contain ("200 free"). Order-independent on purpose.
  let best = null,
    bestLen = 0;
  for (const [frag, slug] of Object.entries(EVENT_NAME_TO_SLUG)) {
    if (lower.includes(frag) && frag.length > bestLen) {
      best = slug;
      bestLen = frag.length;
    }
  }
  return best;
}

function parseTimeToMs(s) {
  if (!s || typeof s !== "string") return null;
  const t = s.trim();
  if (!t || ["-", "–", "DQ", "NS"].includes(t)) return null;
  const m = t.match(/^(?:(\d+):)?(\d+)\.(\d+)$/);
  if (!m) return null;
  let cs = m[3];
  if (cs.length === 1) cs += "0";
  if (cs.length > 2) cs = cs.slice(0, 2);
  return Number(m[1] || 0) * 60000 + Number(m[2]) * 1000 + Number(cs) * 10;
}

function parseDiveScore(s) {
  if (!s || typeof s !== "string") return null;
  const m = s.trim().match(/^(\d{2,4}(?:\.\d{1,3})?)$/);
  return m ? Number(m[1]) : null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Wait for Cloudflare's "Just a moment" interstitial to auto-clear. Polls for
// the target selector, reloading every ~30s if still challenged. Returns true
// once the real page (with `selector`) is present.
async function clearChallenge(page, selector, maxMs = 90000) {
  const deadline = Date.now() + maxMs;
  let lastReload = Date.now();
  while (Date.now() < deadline) {
    if (await page.$(selector)) return true;
    const title = await page.title().catch(() => "");
    const challenged =
      /just a moment|security verification|verify you are human/i.test(title);
    if (challenged && Date.now() - lastReload > 30000) {
      lastReload = Date.now();
      await page
        .reload({ waitUntil: "domcontentloaded", timeout: 45000 })
        .catch(() => {});
    }
    await sleep(2500);
  }
  return !!(await page.$(selector));
}

// ── Page helpers ─────────────────────────────────────────────────────────────
async function getMeetInfo(page, meetUrl) {
  await page.goto(meetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  console.log(
    "  (if a Cloudflare 'verify you are human' check shows in the Chrome window, click it)",
  );
  await clearChallenge(page, 'a[href*="/event/"]', 180000);
  await sleep(800);
  return page.evaluate(() => {
    const h1 =
      document.querySelector("h1")?.textContent?.trim() || document.title;
    const bodyText = document.body.innerText;
    const datePattern =
      /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:[-–]\d{1,2})?,\s+\d{4}\b/gi;
    const dates = bodyText.match(datePattern) || [];
    const course = (bodyText.match(/\b(SCY|SCM|LCM)\b/) || [])[1] ?? "SCY";
    const seen = new Set();
    const events = [];
    for (const a of document.querySelectorAll('a[href*="/event/"]')) {
      const m = a.href.match(/\/results\/(\d+)\/event\/(\d+)\//);
      if (m && !seen.has(m[2])) {
        seen.add(m[2]);
        events.push({
          meetId: m[1],
          eventId: m[2],
          eventUrl: `https://www.swimcloud.com/results/${m[1]}/event/${m[2]}/`,
          eventName: a.textContent.trim().replace(/\s+/g, " ").slice(0, 100),
        });
      }
    }
    const loc = bodyText.match(/[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*,\s+[A-Z]{2}/);
    return { name: h1, dates, course, location: loc ? loc[0] : null, events };
  });
}

// Parse an event page into round-tagged individual rows + relay squads.
// Returns { title, h1, individual:[...], relay:[...] }.
async function scrapeEventPage(page, eventUrl) {
  await page.goto(eventUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await clearChallenge(page, "table tbody tr");
  await sleep(300);
  return page.evaluate(() => {
    const TIME_RE = /^\d{1,2}:\d{2}\.\d{2}$|^\d{1,3}\.\d{2}$/; // 1:12.46 or 18.59
    const txt = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();
    const idFrom = (href, kind) => {
      const m = (href || "").match(new RegExp(`/${kind}/(\\d+)/`));
      return m ? Number(m[1]) : null;
    };

    const title = document.title || "";
    const h1 = document.querySelector("h1")?.textContent?.trim() || "";

    // Round label from the nearest preceding heading/caption of a table.
    const roundFor = (tbl) => {
      let n = tbl;
      for (let hops = 0; hops < 6 && n; hops++) {
        n = n.previousElementSibling || n.parentElement;
        if (!n) break;
        const h = n.matches?.("h1,h2,h3,h4,h5,caption,legend")
          ? n
          : n.querySelector?.("h1,h2,h3,h4,h5,caption,legend");
        const t = h ? txt(h) : "";
        if (t) return /prelim/i.test(t) ? "prelim" : "final";
      }
      const cap = txt(tbl.querySelector("caption"));
      return /prelim/i.test(cap) ? "prelim" : "final";
    };

    const individual = [];
    const relay = [];

    for (const tbl of document.querySelectorAll("table")) {
      const rows = Array.from(tbl.querySelectorAll("tbody tr"));
      // Result tables have rows with a /team/ link; relay leg-detail tables
      // (swimmer + split only) have none — skip those.
      const resultRows = rows.filter((r) =>
        r.querySelector('a[href*="/team/"]'),
      );
      if (!resultRows.length) continue;
      const round = roundFor(tbl);

      for (const row of resultRows) {
        const tds = Array.from(row.querySelectorAll("td"));
        const place = parseInt(txt(tds[0]).replace(/[^\d]/g, ""), 10) || null;
        const teamLink = row.querySelector('a[href*="/team/"]');
        const teamName = txt(teamLink);
        const teamSwimcloudId = idFrom(teamLink?.getAttribute("href"), "team");
        const swimmerLinks = Array.from(
          row.querySelectorAll('a[href*="/swimmer/"]'),
        );
        const timeCells = tds
          .map((td) => txt(td))
          .filter((t) => TIME_RE.test(t));

        if (swimmerLinks.length >= 2) {
          // Relay squad summary row: legs in order, squad total = last time cell.
          const legs = swimmerLinks.slice(0, 4).map((a, i) => ({
            swimcloudId: idFrom(a.getAttribute("href"), "swimmer"),
            name: txt(a),
            splitText: timeCells[i] ?? null,
          }));
          const totalTimeText =
            timeCells.length > legs.length
              ? timeCells[timeCells.length - 1]
              : null;
          const last = txt(tds[tds.length - 1]);
          const points = /^\d+(\.\d+)?$/.test(last) ? Number(last) : null;
          relay.push({
            place,
            teamName,
            teamSwimcloudId,
            totalTimeText,
            points,
            legs,
          });
        } else {
          // Individual result row.
          const swimmer = swimmerLinks[0];
          const athleteName = txt(swimmer);
          const swimcloudId = idFrom(swimmer?.getAttribute("href"), "swimmer");
          const timeText = timeCells[0] ?? null;
          // Diving: no time, score sits in the last numeric cell (e.g. 382.50).
          const last = txt(tds[tds.length - 1]);
          const scoreText =
            !timeText && /^\d{2,4}(?:\.\d{1,3})?$/.test(last) ? last : null;
          if (!athleteName || !(timeText || scoreText)) continue;
          individual.push({
            round,
            place,
            athleteName,
            swimcloudId,
            teamName,
            teamSwimcloudId,
            timeText,
            scoreText,
          });
        }
      }
    }
    return { title, h1, individual, relay };
  });
}

// ── Main ────────────────────────────────────────────────────────────────────
async function main() {
  console.log(
    `Mode: ${APPLY ? "APPLY (staging tables only)" : "DRY-RUN (no writes)"}`,
  );
  console.log(`Meet: https://www.swimcloud.com/results/${MEET_ID}/`);

  const browser = await chromium.launch({
    channel: "chrome",
    headless: false,
    ignoreDefaultArgs: ["--enable-automation"],
    args: ["--disable-blink-features=AutomationControlled"],
  });
  const context = await browser.newContext({
    // No userAgent override on purpose: let real Chrome send its NATIVE UA so it
    // matches the TLS/JS fingerprint. A stale forced UA (e.g. Chrome/131 while the
    // installed Chrome is 149) makes Cloudflare Turnstile distrust every solve and
    // re-challenge in an infinite loop.
    viewport: { width: 1280, height: 900 },
  });
  await context.addInitScript(() => {
    Object.defineProperty(navigator, "webdriver", { get: () => undefined });
  });
  const page = await context.newPage();

  const meetUrl = `https://www.swimcloud.com/results/${MEET_ID}/`;
  let meetInfo;
  try {
    meetInfo = await getMeetInfo(page, meetUrl);
  } catch (e) {
    console.error("Failed to load meet page:", e.message);
    await browser.close();
    process.exit(2);
  }
  console.log(`Meet name: "${meetInfo.name}"`);
  console.log(`Dates: ${meetInfo.dates.join(" | ") || "(none on page)"}`);
  console.log(
    `Course: ${meetInfo.course}  Location: ${meetInfo.location ?? "?"}`,
  );
  console.log(`Events found on page: ${meetInfo.events.length}`);

  const individualRows = []; // one per (event, swimmer): prelim + final merged
  const relayRows = []; // one per (event, team)

  for (const ev of meetInfo.events) {
    let data = null;
    try {
      data = await scrapeEventPage(page, ev.eventUrl);
    } catch (e) {
      console.error(`  ! event ${ev.eventId} failed: ${e.message}`);
      continue;
    }
    const titleSource = `${ev.eventName} ${data?.h1 ?? ""} ${data?.title ?? ""}`;
    const slug = mapEventNameToSlug(titleSource);
    if (!slug) {
      console.log(
        `  ${ev.eventId.padStart(4)} "${ev.eventName.slice(0, 28)}" → (unmapped)`,
      );
      continue;
    }

    if (isRelaySlug(slug)) {
      let n = 0;
      for (const sq of data.relay) {
        if (!sq.teamSwimcloudId) continue;
        relayRows.push({
          event_id: slug,
          team_name: sq.teamName,
          team_swimcloud_id: sq.teamSwimcloudId,
          final_place: sq.place,
          final_time_ms: parseTimeToMs(sq.totalTimeText),
          points: sq.points,
          leg1_swimcloud_id: sq.legs[0]?.swimcloudId ?? null,
          leg1_name: sq.legs[0]?.name ?? null,
          leg1_split_ms: parseTimeToMs(sq.legs[0]?.splitText),
          leg2_swimcloud_id: sq.legs[1]?.swimcloudId ?? null,
          leg2_name: sq.legs[1]?.name ?? null,
          leg2_split_ms: parseTimeToMs(sq.legs[1]?.splitText),
          leg3_swimcloud_id: sq.legs[2]?.swimcloudId ?? null,
          leg3_name: sq.legs[2]?.name ?? null,
          leg3_split_ms: parseTimeToMs(sq.legs[2]?.splitText),
          leg4_swimcloud_id: sq.legs[3]?.swimcloudId ?? null,
          leg4_name: sq.legs[3]?.name ?? null,
          leg4_split_ms: parseTimeToMs(sq.legs[3]?.splitText),
          raw_payload: sq,
        });
        n++;
      }
      console.log(
        `  ${ev.eventId.padStart(4)} ${slug.padEnd(18)} → relay squads=${n}`,
      );
    } else {
      const evType = DIVE_SLUGS.has(slug) ? "dive" : "swim";
      // Merge prelim + final per swimmer into one record.
      const byAthlete = new Map();
      for (const r of data.individual) {
        if (!r.swimcloudId) continue;
        let rec = byAthlete.get(r.swimcloudId);
        if (!rec) {
          rec = {
            event_id: slug,
            event_type: evType,
            athlete_name: r.athleteName,
            team_name: r.teamName,
            swimcloud_id: r.swimcloudId,
            team_swimcloud_id: r.teamSwimcloudId,
            prelim_time_ms: null,
            prelim_place: null,
            prelim_score: null,
            final_time_ms: null,
            final_place: null,
            final_score: null,
            raw_payload: { rounds: [] },
          };
          byAthlete.set(r.swimcloudId, rec);
        }
        const ms = parseTimeToMs(r.timeText);
        // Dive scores (e.g. 382.50) also satisfy the time regex, so they arrive
        // in timeText — fall back to it when scoreText is empty.
        const score = parseDiveScore(r.scoreText) ?? parseDiveScore(r.timeText);
        if (r.round === "prelim") {
          rec.prelim_place = r.place;
          if (evType === "dive") rec.prelim_score = score;
          else rec.prelim_time_ms = ms;
        } else {
          rec.final_place = r.place;
          if (evType === "dive") rec.final_score = score;
          else rec.final_time_ms = ms;
        }
        rec.raw_payload.rounds.push(r);
      }
      const recs = [...byAthlete.values()];
      individualRows.push(...recs);
      console.log(
        `  ${ev.eventId.padStart(4)} ${slug.padEnd(18)} → athletes=${recs.length} (${data.individual.length} round-rows)`,
      );
    }
    await sleep(400);
  }

  const swimCount = individualRows.filter(
    (r) => r.event_type === "swim",
  ).length;
  const diveCount = individualRows.filter(
    (r) => r.event_type === "dive",
  ).length;
  const indivEvents = new Set(individualRows.map((r) => r.event_id)).size;
  const relayEvents = new Set(relayRows.map((r) => r.event_id)).size;
  console.log(
    `\nTOTAL: ${individualRows.length} individual athlete-results ` +
      `(swim=${swimCount} / dive=${diveCount}) across ${indivEvents} events; ` +
      `${relayRows.length} relay squads across ${relayEvents} events.`,
  );

  if (EMIT_JSON) {
    const out = `scripts/staging/dry-run-meet-${MEET_ID}.json`;
    await writeFile(
      out,
      JSON.stringify({ meetInfo, individualRows, relayRows }, null, 2),
    );
    console.log(`Wrote ${out}`);
  }

  await browser.close();

  if (DRY_RUN) {
    console.log("DRY-RUN complete. No DB writes performed.");
    return;
  }

  // ── APPLY: write to staging tables only ───────────────────────────────────
  const SUPABASE_URL =
    process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Apply mode needs SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY env vars.",
    );
    process.exit(3);
  }
  const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

  const meetRow = {
    swimcloud_id: MEET_ID,
    name: meetInfo.name,
    date_start: null,
    date_end: null,
    location: meetInfo.location,
    course_type: meetInfo.course,
    url: meetUrl,
    season: "2025-26",
    raw_payload: { dates: meetInfo.dates, event_count: meetInfo.events.length },
  };
  const { data: meetIns, error: meetErr } = await sb
    .from("swim_staging_ncaa_champs_2026_meet")
    .upsert([meetRow], { onConflict: "swimcloud_id" })
    .select("id")
    .single();
  if (meetErr || !meetIns) {
    console.error("Meet upsert failed:", meetErr);
    process.exit(4);
  }
  const stagingMeetId = meetIns.id;
  console.log(`Meet staging row id=${stagingMeetId}`);

  const writeChildren = async (table, rows) => {
    const { error: delErr } = await sb
      .from(table)
      .delete()
      .eq("meet_staging_id", stagingMeetId);
    if (delErr) {
      console.error(`Failed to clear ${table}:`, delErr);
      process.exit(5);
    }
    const withMeet = rows.map((r) => ({
      ...r,
      meet_staging_id: stagingMeetId,
    }));
    const CHUNK = 500;
    for (let i = 0; i < withMeet.length; i += CHUNK) {
      const { error } = await sb
        .from(table)
        .insert(withMeet.slice(i, i + CHUNK));
      if (error) {
        console.error(`Insert into ${table} failed at ${i}:`, error);
        process.exit(6);
      }
    }
    console.log(`Inserted ${withMeet.length} rows into ${table}.`);
  };

  await writeChildren("swim_staging_ncaa_champs_2026_results", individualRows);
  await writeChildren("swim_staging_ncaa_champs_2026_relays", relayRows);
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(99);
});
