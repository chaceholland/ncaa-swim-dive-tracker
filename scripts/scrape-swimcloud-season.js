/**
 * Scrape 2024-25 SwimCloud season meets for each team and store results in Supabase.
 *
 * Usage: node --env-file=.env.local scripts/scrape-swimcloud-season.js
 *
 * Flow:
 *   1. Read swimcloud-team-ids.json
 *   2. For each team, load their team results page
 *   3. For each meet found, scrape meet metadata + all events
 *   4. For each event, scrape results (athlete, time, place)
 *   5. Upsert into swim_meets and swim_individual_results
 *   6. Update swim_athletes.swimcloud_id where we find matches
 */

require("dotenv").config({ path: ".env.local" });

const { chromium } = require("playwright");
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");
const path = require("path");

// ──────────────────────────────────────────────────────────────────────────────
// Configuration
// ──────────────────────────────────────────────────────────────────────────────

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const DELAY_BETWEEN_TEAMS_MS = 1500;
const DELAY_BETWEEN_MEETS_MS = 1000;
const DELAY_BETWEEN_EVENTS_MS = 600;
const MAX_EVENTS_PER_MEET = 30;
const MAX_MEETS_PER_TEAM = 20;

// Map swimcloud-team-ids.json names to database team slugs (swim_teams.id)
const TEAM_NAME_TO_SLUG = {
  Alabama: "alabama",
  Arizona: "arizona",
  "Arizona State": "arizona-state",
  Auburn: "auburn",
  Brown: "brown",
  Cal: "cal",
  Columbia: "columbia",
  Cornell: "cornell",
  Dartmouth: "dartmouth",
  Duke: "duke",
  Florida: "florida",
  "Florida State": "florida-state",
  Georgia: "georgia",
  "Georgia Tech": "georgia-tech",
  Harvard: "harvard",
  Indiana: "indiana",
  Iowa: "iowa",
  Kentucky: "kentucky",
  Louisville: "louisville",
  LSU: "lsu",
  Michigan: "michigan",
  Minnesota: "minnesota",
  Missouri: "missouri",
  Navy: "navy",
  "NC State": "nc-state",
  "North Carolina": "north-carolina",
  Northwestern: "northwestern",
  "Notre Dame": "notre-dame",
  "Ohio State": "ohio-state",
  Penn: "penn",
  "Penn State": "penn-state",
  Princeton: "princeton",
  Purdue: "purdue",
  SMU: "smu",
  "South Carolina": "south-carolina",
  Stanford: "stanford",
  TCU: "tcu",
  Tennessee: "tennessee",
  Texas: "texas",
  "Texas A&M": "texas-am",
  Towson: "towson",
  UCLA: null, // Not in the 53-team DB list
  UNLV: "unlv",
  USC: "usc",
  Utah: "utah",
  Vanderbilt: null, // Not in the 53-team DB list
  Virginia: "uva",
  "Virginia Tech": "virginia-tech",
  "West Virginia": "west-virginia",
  Wisconsin: "wisconsin",
  Yale: "yale",
  Army: "army",
  "Boston College": "boston-college",
  "George Washington": "george-washington",
  "Southern Illinois": "southern-illinois",
  Pittsburgh: "pittsburgh",
};

// Map SwimCloud event name fragments → swim_events.event_id slugs
// Keys are lowercase fragments found in event page titles/names
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
  "6 meter": "platform-diving",
  "7.5 meter": "platform-diving",
};

// ──────────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────────

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Parse a time string like "1:34.21" → 94210 ms, "44.83" → 44830 ms
 */
function parseTimeToMs(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const cleaned = timeStr.trim();
  if (
    !cleaned ||
    cleaned === "–" ||
    cleaned === "-" ||
    cleaned === "DQ" ||
    cleaned === "NS"
  )
    return null;

  const match = cleaned.match(/^(?:(\d+):)?(\d+)\.(\d+)$/);
  if (!match) return null;

  const minutes = parseInt(match[1] || "0", 10);
  const seconds = parseInt(match[2], 10);
  let csStr = match[3];
  if (csStr.length === 1) csStr = csStr + "0";
  if (csStr.length > 2) csStr = csStr.substring(0, 2);
  const cs = parseInt(csStr, 10);

  return minutes * 60000 + seconds * 1000 + cs * 10;
}

/**
 * Map an event page title/name to a swim_events.event_id slug.
 * Returns null if not recognized (e.g., relay, diving without mapping).
 */
function mapEventNameToSlug(eventTitle) {
  const lower = (eventTitle || "").toLowerCase();

  // Try each pattern
  for (const [fragment, slug] of Object.entries(EVENT_NAME_TO_SLUG)) {
    if (lower.includes(fragment)) {
      return slug;
    }
  }

  return null;
}

// ──────────────────────────────────────────────────────────────────────────────
// Supabase helpers
// ──────────────────────────────────────────────────────────────────────────────

async function upsertMeet(sb, meetData) {
  const { data, error } = await sb
    .from("swim_meets")
    .upsert(meetData, { onConflict: "id" })
    .select("id")
    .single();

  if (error) {
    console.error(
      `  [DB] Error upserting meet ${meetData.id}: ${error.message}`,
    );
    return null;
  }
  return data?.id;
}

async function upsertResults(sb, results) {
  if (!results.length) return 0;

  // Deduplicate by (meet_id, event_id, athlete_id) - keep first occurrence
  // Same athlete can appear in heats and finals, we want the best time
  const seen = new Map();
  for (const r of results) {
    const key = `${r.meet_id}__${r.event_id}__${r.athlete_id}`;
    const existing = seen.get(key);
    // Keep the one with the best (lowest) time or the first one
    if (
      !existing ||
      (r.final_time_ms &&
        existing.final_time_ms &&
        r.final_time_ms < existing.final_time_ms)
    ) {
      seen.set(key, r);
    }
  }
  const deduped = Array.from(seen.values());

  // Use upsert with ignoreDuplicates to skip rows that already exist
  // (idempotent re-runs)
  const { error } = await sb.from("swim_individual_results").upsert(deduped, {
    onConflict: "meet_id,event_id,athlete_id",
    ignoreDuplicates: true,
  });

  if (error) {
    console.error(
      `  [DB] Error upserting ${deduped.length} results: ${error.message}`,
    );
    return 0;
  }
  return deduped.length;
}

async function updateAthleteSwimcloudId(
  sb,
  athleteName,
  teamSlug,
  swimcloudId,
) {
  if (!teamSlug || !swimcloudId || !athleteName) return;

  try {
    const { data: athletes } = await sb
      .from("swim_athletes")
      .select("id, swimcloud_id")
      .eq("team_id", teamSlug)
      .ilike("name", athleteName)
      .is("swimcloud_id", null)
      .limit(1);

    if (athletes && athletes.length > 0) {
      await sb
        .from("swim_athletes")
        .update({ swimcloud_id: swimcloudId })
        .eq("id", athletes[0].id);
    }
  } catch (e) {
    // Silently ignore
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// SwimCloud page scrapers
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Get list of meet result URLs from a team's results page.
 */
async function getTeamMeetList(page, teamId) {
  const url = `https://www.swimcloud.com/team/${teamId}/results/`;
  try {
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(500);

    const meets = await page.evaluate(() => {
      const links = [];
      const seen = new Set();

      document.querySelectorAll('a[href*="/results/"]').forEach((a) => {
        const match = a.href.match(/\/results\/(\d+)(?:\/|$)/);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);
          const text = a.textContent.trim().replace(/\s+/g, " ");
          if (text && text !== "Meets" && text !== "" && text.length > 3) {
            links.push({
              meetId: match[1],
              meetUrl: `https://www.swimcloud.com/results/${match[1]}/`,
              meetName: text.substring(0, 120),
            });
          }
        }
      });

      return links;
    });

    return meets.slice(0, MAX_MEETS_PER_TEAM);
  } catch (err) {
    console.error(
      `  Error loading team meets for ID ${teamId}: ${err.message}`,
    );
    return [];
  }
}

/**
 * Get meet metadata from a meet page.
 * Also returns the event links found on this page.
 */
async function getMeetInfo(page, meetUrl) {
  try {
    await page.goto(meetUrl, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(500);

    const info = await page.evaluate((maxEvents) => {
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";
      const bodyText = document.body.innerText;

      // Find dates
      const datePattern =
        /\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}(?:[-–]\d{1,2})?,\s+\d{4}\b/gi;
      const dates = bodyText.match(datePattern) || [];

      // Find course type
      const courseMatch = bodyText.match(/\b(SCY|SCM|LCM)\b/);

      // Collect unique event links
      const eventLinks = [];
      const seenEvents = new Set();
      document.querySelectorAll('a[href*="/event/"]').forEach((a) => {
        const m = a.href.match(/\/results\/(\d+)\/event\/(\d+)\//);
        if (m && !seenEvents.has(m[2])) {
          seenEvents.add(m[2]);
          const rawText = a.textContent.trim().replace(/\s+/g, " ");
          eventLinks.push({
            meetId: m[1],
            eventId: m[2],
            eventUrl: `https://www.swimcloud.com/results/${m[1]}/event/${m[2]}/`,
            eventName: rawText.substring(0, 80),
          });
        }
      });

      // Try to get location from the page
      const locationPattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*),\s+([A-Z]{2})/;
      const locationMatch = bodyText.match(locationPattern);

      return {
        name: h1 || document.title,
        dates,
        course: courseMatch ? courseMatch[1] : "SCY",
        location: locationMatch ? locationMatch[0] : null,
        eventLinks: eventLinks.slice(0, maxEvents),
        isNotFound: h1.toLowerCase().includes("not found") || h1 === "",
      };
    }, MAX_EVENTS_PER_MEET);

    return info;
  } catch (err) {
    console.error(`  Error getting meet info from ${meetUrl}: ${err.message}`);
    return null;
  }
}

/**
 * Scrape results from a single event page.
 * Returns { eventName, results[] }
 */
async function scrapeEventPage(page, eventUrl) {
  try {
    await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(300);

    const data = await page.evaluate(() => {
      // Get event name from page title
      const title = document.title; // e.g., "B1G Champs - 1650 Free Men"
      const h1 = document.querySelector("h1")?.textContent?.trim() || "";

      const rows = Array.from(document.querySelectorAll("table tbody tr"));

      const results = rows
        .map((row) => {
          // Place: first TD
          const placeText = row
            .querySelector("td:first-child")
            ?.textContent?.trim();
          const place = parseInt(placeText || "0", 10) || null;

          // Athlete name + SwimCloud athlete ID
          const swimmerLink = row.querySelector('a[href*="/swimmer/"]');
          const athleteName = swimmerLink
            ? swimmerLink.textContent.trim()
            : null;
          const swimmerHref = swimmerLink?.href || "";
          const swimmerMatch = swimmerHref.match(/\/swimmer\/(\d+)\//);
          const swimcloudAthleteId = swimmerMatch ? swimmerMatch[1] : null;

          // Team name (from hidden-xs team link)
          const teamCell = row.querySelector('.hidden-xs a[href*="/team/"]');
          const teamName = teamCell?.textContent?.trim() || null;

          // Time: scan all TDs for a time format
          const tds = Array.from(row.querySelectorAll("td"));
          let timeText = null;
          for (const td of tds) {
            const t = td.textContent.trim();
            // Time patterns: "1:34.21" or "44.83" or "14:25.40"
            if (
              /^\d{1,2}:\d{2}\.\d{2}$/.test(t) ||
              /^\d{2,3}\.\d{2}$/.test(t)
            ) {
              timeText = t;
              break;
            }
          }

          // Personal best
          const isPb = row.textContent.includes("PB");

          return {
            place,
            athleteName,
            swimcloudAthleteId,
            teamName,
            timeText,
            isPb,
          };
        })
        .filter((r) => r.athleteName && r.timeText);

      return { title, h1, results };
    });

    return data;
  } catch (err) {
    console.error(`  Error scraping event ${eventUrl}: ${err.message}`);
    return null;
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────────────────────────────────────

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY",
    );
  }

  const sb = createClient(supabaseUrl, supabaseKey);

  // Load team IDs
  const teamIdsPath = path.join(__dirname, "swimcloud-team-ids.json");
  const teamIds = JSON.parse(fs.readFileSync(teamIdsPath, "utf8"));

  console.log(`\nLoaded ${Object.keys(teamIds).length} team IDs`);
  console.log("Starting SwimCloud 2024-25 season scraper...\n");

  let totalMeets = 0;
  let totalResults = 0;
  let totalTeamsProcessed = 0;
  const processedMeetIds = new Set(); // avoid re-scraping same meet for multiple teams

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const teams = Object.entries(teamIds);

  for (const [teamName, swimcloudTeamId] of teams) {
    const teamSlug = TEAM_NAME_TO_SLUG[teamName];

    if (!teamSlug) {
      console.log(`\nSkipping ${teamName} (not in DB team list)`);
      continue;
    }

    totalTeamsProcessed++;
    console.log(
      `\n${"=".repeat(60)}\n[${totalTeamsProcessed}/${teams.length}] ${teamName} (SwimCloud ID: ${swimcloudTeamId})`,
    );

    // Step 1: Get meet list
    const meetList = await getTeamMeetList(page, swimcloudTeamId);
    console.log(`  Found ${meetList.length} meets`);

    if (meetList.length === 0) {
      await sleep(DELAY_BETWEEN_TEAMS_MS);
      continue;
    }

    // Step 2: Process each meet
    for (const { meetId, meetUrl, meetName } of meetList) {
      const shortName = meetName.substring(0, 55);
      console.log(`\n  Meet ${meetId}: ${shortName}`);

      // Skip if already processed this meet (from another team)
      if (processedMeetIds.has(meetId)) {
        console.log(`  Already processed meet ${meetId}, skipping`);
        continue;
      }

      // Step 3: Get meet info + event list
      const meetInfo = await getMeetInfo(page, meetUrl);
      if (!meetInfo || meetInfo.isNotFound) {
        console.log("  Meet not found or error, skipping");
        await sleep(DELAY_BETWEEN_MEETS_MS);
        continue;
      }

      // Parse dates
      let dateStart = null;
      let dateEnd = null;
      if (meetInfo.dates.length > 0) {
        try {
          const d = new Date(meetInfo.dates[0]);
          dateStart = isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
        } catch (e) {}
        if (meetInfo.dates.length > 1) {
          try {
            const d = new Date(meetInfo.dates[meetInfo.dates.length - 1]);
            dateEnd = isNaN(d.getTime()) ? null : d.toISOString().split("T")[0];
          } catch (e) {}
        }
      }

      // Step 4: Upsert meet
      const meetRow = {
        id: parseInt(meetId, 10),
        name: meetInfo.name,
        url: meetUrl,
        season: "2024-25",
        date_start: dateStart,
        date_end: dateEnd || dateStart,
        location: meetInfo.location,
        course_type: meetInfo.course || "SCY",
      };

      const dbMeetId = await upsertMeet(sb, meetRow);
      if (!dbMeetId) {
        console.log(`  Failed to upsert meet, skipping`);
        await sleep(DELAY_BETWEEN_MEETS_MS);
        continue;
      }

      processedMeetIds.add(meetId);
      totalMeets++;
      console.log(
        `  Upserted meet ${dbMeetId} | ${meetInfo.eventLinks.length} events | dates: ${dateStart || "unknown"}`,
      );

      // Step 5: Process each event
      let meetResultCount = 0;

      for (const { eventId, eventUrl, eventName } of meetInfo.eventLinks) {
        // Scrape event
        const eventData = await scrapeEventPage(page, eventUrl);
        if (!eventData || eventData.results.length === 0) {
          await sleep(200);
          continue;
        }

        // Map event name to slug
        const combinedTitle = `${eventData.title} ${eventData.h1} ${eventName}`;
        const eventSlug = mapEventNameToSlug(combinedTitle);

        if (!eventSlug) {
          // Log unknown events for debugging (but don't skip relay tracking)
          const lowerTitle = combinedTitle.toLowerCase();
          if (!lowerTitle.includes("relay") && !lowerTitle.includes("diving")) {
            console.log(`    Unknown event: ${combinedTitle.substring(0, 60)}`);
          }
          await sleep(200);
          continue;
        }

        // Build result rows
        const dbResults = [];
        for (const r of eventData.results) {
          const timeMs = parseTimeToMs(r.timeText);
          if (!timeMs || !r.swimcloudAthleteId) continue;

          const resultId = `${meetId}_${eventId}_${r.swimcloudAthleteId}`;

          dbResults.push({
            meet_id: String(meetId),
            event_id: eventSlug,
            athlete_id: r.swimcloudAthleteId,
            team_id: teamSlug,
            final_time_ms: timeMs,
            final_place: r.place,
            course: meetInfo.course || "SCY",
            round: "finals",
            is_personal_best: r.isPb || false,
            swimcloud_result_id: resultId,
          });

          // Update athlete's swimcloud_id asynchronously
          if (r.athleteName && r.swimcloudAthleteId) {
            updateAthleteSwimcloudId(
              sb,
              r.athleteName,
              teamSlug,
              r.swimcloudAthleteId,
            ).catch(() => {});
          }
        }

        if (dbResults.length > 0) {
          const upserted = await upsertResults(sb, dbResults);
          meetResultCount += upserted;
          totalResults += upserted;
        }

        await sleep(DELAY_BETWEEN_EVENTS_MS);
      }

      console.log(
        `  Meet results: ${meetResultCount} | Running total: ${totalResults}`,
      );
      await sleep(DELAY_BETWEEN_MEETS_MS);
    }

    console.log(
      `\n[STATS] Teams: ${totalTeamsProcessed}, Meets: ${totalMeets}, Results: ${totalResults}`,
    );
    await sleep(DELAY_BETWEEN_TEAMS_MS);
  }

  await browser.close();

  console.log("\n" + "=".repeat(60));
  console.log("SCRAPING COMPLETE");
  console.log(`Teams processed: ${totalTeamsProcessed}`);
  console.log(`Meets upserted: ${totalMeets}`);
  console.log(`Results upserted: ${totalResults}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
