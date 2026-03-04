/**
 * Match swim_athletes (without swimcloud_id) to SwimCloud by scraping team roster pages.
 *
 * Usage: node --env-file=.env.local scripts/match-swimcloud-athlete-ids.js
 *
 * Flow:
 *   1. Get all teams with unmatched swim_athletes (no swimcloud_id)
 *   2. For each team, scrape https://www.swimcloud.com/team/<id>/roster/
 *   3. Extract athlete names + swimcloud IDs from the roster page
 *   4. Match unmatched swim_athletes by name (exact, then partial)
 *   5. Update swimcloud_id in swim_athletes table
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const TEAM_IDS = require("./swimcloud-team-ids.json");

// Same slug mapping as the main scraper
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
  UCLA: "ucla",
  UNLV: "unlv",
  USC: "usc",
  Utah: "utah",
  Vanderbilt: "vanderbilt",
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

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Normalize a name for comparison: lowercase, collapse spaces, strip punctuation */
function normalizeName(name) {
  return name
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Get last name from a full name string */
function lastName(name) {
  const parts = normalizeName(name).split(" ");
  return parts[parts.length - 1];
}

/** Fetch SwimCloud team roster page and extract athlete IDs + names */
async function fetchTeamRoster(swimcloudTeamId) {
  const url = `https://www.swimcloud.com/team/${swimcloudTeamId}/roster/`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "text/html,application/xhtml+xml",
        "Accept-Language": "en-US,en;q=0.9",
      },
    });
    if (!res.ok) {
      console.log(`  HTTP ${res.status} for team ${swimcloudTeamId}`);
      return [];
    }
    const html = await res.text();

    // Extract athlete links: /swimmer/<id>/ with their names
    // SwimCloud roster pages have: href="/swimmer/12345">\n  Name\n</a>
    const athletes = [];
    const regex = /href="\/swimmer\/(\d+)\/?">[\s]*([^<\n]{2,50})[\s]*<\/a>/g;
    let match;
    while ((match = regex.exec(html)) !== null) {
      const id = match[1];
      const name = match[2].trim();
      if (name && name.length > 2) {
        athletes.push({ id, name });
      }
    }

    // Deduplicate by id
    const seen = new Set();
    return athletes.filter((a) => {
      if (seen.has(a.id)) return false;
      seen.add(a.id);
      return true;
    });
  } catch (err) {
    console.log(
      `  Error fetching roster for team ${swimcloudTeamId}: ${err.message}`,
    );
    return [];
  }
}

/** Try to match a roster athlete to an unmatched swim_athlete by name */
function findBestMatch(rosterAthlete, unmatchedAthletes) {
  const rNorm = normalizeName(rosterAthlete.name);
  const rLast = lastName(rosterAthlete.name);

  // 1. Exact normalized name match
  for (const a of unmatchedAthletes) {
    if (normalizeName(a.name) === rNorm) {
      return { athlete: a, confidence: "exact" };
    }
  }

  // 2. Last name + first initial match
  const rParts = rNorm.split(" ");
  const rFirst = rParts[0];
  for (const a of unmatchedAthletes) {
    const aNorm = normalizeName(a.name);
    const aParts = aNorm.split(" ");
    const aFirst = aParts[0];
    const aLast = aParts[aParts.length - 1];
    if (aLast === rLast && aFirst[0] === rFirst[0]) {
      return { athlete: a, confidence: "last+initial" };
    }
  }

  // 3. Last name only (only if unique)
  const lastNameMatches = unmatchedAthletes.filter(
    (a) => lastName(a.name) === rLast,
  );
  if (lastNameMatches.length === 1) {
    return { athlete: lastNameMatches[0], confidence: "last-only" };
  }

  return null;
}

async function main() {
  console.log("=== SwimCloud Athlete ID Matcher ===\n");

  // Get all teams that have unmatched swim_athletes
  const { data: unmatched } = await sb
    .from("swim_athletes")
    .select("id, name, team_id")
    .is("swimcloud_id", null);

  if (!unmatched || unmatched.length === 0) {
    console.log("No unmatched athletes found.");
    return;
  }

  console.log(`Found ${unmatched.length} swim_athletes without swimcloud_id\n`);

  // Group by team_id
  const byTeam = new Map();
  for (const a of unmatched) {
    if (!byTeam.has(a.team_id)) byTeam.set(a.team_id, []);
    byTeam.get(a.team_id).push(a);
  }

  // Build reverse map: slug → swimcloud team ID
  const slugToSwimcloudId = {};
  for (const [teamName, swimcloudId] of Object.entries(TEAM_IDS)) {
    const slug = TEAM_NAME_TO_SLUG[teamName];
    if (slug) slugToSwimcloudId[slug] = swimcloudId;
  }

  let totalUpdated = 0;
  let totalSkipped = 0;

  for (const [teamSlug, athletes] of byTeam.entries()) {
    const swimcloudTeamId = slugToSwimcloudId[teamSlug];
    if (!swimcloudTeamId) {
      console.log(`[${teamSlug}] No SwimCloud team ID found, skipping`);
      continue;
    }

    console.log(
      `[${teamSlug}] ${athletes.length} unmatched athletes — fetching SwimCloud roster (team #${swimcloudTeamId})...`,
    );
    await sleep(800);

    const rosterAthletes = await fetchTeamRoster(swimcloudTeamId);
    if (rosterAthletes.length === 0) {
      console.log(`  No roster data found`);
      continue;
    }

    console.log(
      `  Found ${rosterAthletes.length} athletes on SwimCloud roster`,
    );

    // Also get already-matched swimcloud_ids for this team to avoid duplicate assignment
    const { data: existingMatched } = await sb
      .from("swim_athletes")
      .select("swimcloud_id")
      .eq("team_id", teamSlug)
      .not("swimcloud_id", "is", null);
    const existingIds = new Set(
      (existingMatched || []).map((a) => a.swimcloud_id),
    );

    let teamUpdated = 0;
    const remainingUnmatched = [...athletes];

    for (const rosterAthlete of rosterAthletes) {
      // Skip if this swimcloud_id is already assigned in this team
      if (existingIds.has(rosterAthlete.id)) continue;

      const match = findBestMatch(rosterAthlete, remainingUnmatched);
      if (!match) continue;

      console.log(
        `  ${match.confidence}: "${rosterAthlete.name}" (${rosterAthlete.id}) → "${match.athlete.name}"`,
      );

      const { error } = await sb
        .from("swim_athletes")
        .update({ swimcloud_id: rosterAthlete.id })
        .eq("id", match.athlete.id);

      if (error) {
        console.log(`  ERROR updating ${match.athlete.name}: ${error.message}`);
      } else {
        teamUpdated++;
        totalUpdated++;
        existingIds.add(rosterAthlete.id);
        // Remove matched athlete from the pool
        const idx = remainingUnmatched.indexOf(match.athlete);
        if (idx !== -1) remainingUnmatched.splice(idx, 1);
      }
    }

    const stillUnmatched = remainingUnmatched.length;
    totalSkipped += stillUnmatched;
    console.log(
      `  → Updated ${teamUpdated}, still unmatched: ${stillUnmatched}`,
    );
  }

  console.log(`\n=== Done ===`);
  console.log(`Total updated: ${totalUpdated}`);
  console.log(`Total still unmatched: ${totalSkipped}`);
}

main().catch(console.error);
