/**
 * Archive web-app athletes who are no longer on their team's active SwimCloud roster.
 *
 * Usage: node --env-file=.env.local scripts/archive-inactive-athletes.js [--dry-run]
 *
 * Flow:
 *   1. For each team, fetch the current SwimCloud roster page
 *   2. Extract active athlete names
 *   3. Compare against athletes table — anyone NOT found on roster → is_archived = true
 *   4. Also un-archive athletes who ARE found on roster (in case of re-activation)
 *
 * Note: SwimCloud rosters may not include every walk-on or diver.
 *       The script prints a preview before making any changes.
 */

require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");
const TEAM_IDS = require("./swimcloud-team-ids.json");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const DRY_RUN = process.argv.includes("--dry-run");

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

// DB team name → slug (inverse of above)
const DB_TEAM_NAME_TO_SWIMCLOUD_ID = {};
for (const [teamName, swimcloudId] of Object.entries(TEAM_IDS)) {
  const slug = TEAM_NAME_TO_SLUG[teamName];
  if (slug) DB_TEAM_NAME_TO_SWIMCLOUD_ID[teamName] = swimcloudId;
}

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function normalizeName(n) {
  return n
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchSwimCloudRoster(teamId) {
  try {
    const res = await fetch(
      `https://www.swimcloud.com/team/${teamId}/roster/`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    if (!res.ok) return null;
    const html = await res.text();
    const regex = /href="\/swimmer\/(\d+)\/?">[\s]*([^<\n]{2,50})[\s]*<\/a>/g;
    const names = new Set();
    let m;
    while ((m = regex.exec(html)) !== null) {
      names.add(normalizeName(m[2].trim()));
    }
    return names.size > 0 ? names : null;
  } catch {
    return null;
  }
}

function isOnRoster(athleteName, rosterNames) {
  const norm = normalizeName(athleteName);
  if (rosterNames.has(norm)) return true;

  // Also check if first initial + last name matches
  const parts = norm.split(" ");
  if (parts.length >= 2) {
    const last = parts[parts.length - 1];
    const firstInit = parts[0][0];
    for (const rName of rosterNames) {
      const rParts = rName.split(" ");
      const rLast = rParts[rParts.length - 1];
      const rFirst = rParts[0];
      if (rLast === last && (rFirst === parts[0] || rFirst[0] === firstInit)) {
        return true;
      }
    }
  }
  return false;
}

async function main() {
  console.log(
    `=== Archive Inactive Athletes ${DRY_RUN ? "(DRY RUN)" : ""} ===\n`,
  );

  // Get all teams with their DB names
  const { data: teams } = await sb
    .from("teams")
    .select("id, name")
    .order("name");

  let totalArchived = 0;
  let totalUnarchived = 0;
  let totalActive = 0;

  for (const team of teams) {
    const swimcloudId = DB_TEAM_NAME_TO_SWIMCLOUD_ID[team.name];
    if (!swimcloudId) {
      console.log(`[${team.name}] No SwimCloud ID — skipping`);
      continue;
    }

    // Get all athletes for this team
    const { data: athletes } = await sb
      .from("athletes")
      .select("id, name, is_archived")
      .eq("team_id", team.id);

    if (!athletes || athletes.length === 0) continue;

    await sleep(700);
    const rosterNames = await fetchSwimCloudRoster(swimcloudId);

    if (!rosterNames) {
      console.log(`[${team.name}] Could not fetch roster — skipping`);
      continue;
    }

    const toArchive = [];
    const toUnarchive = [];

    for (const athlete of athletes) {
      const onRoster = isOnRoster(athlete.name, rosterNames);
      if (!onRoster && !athlete.is_archived) {
        toArchive.push(athlete);
      } else if (onRoster && athlete.is_archived) {
        toUnarchive.push(athlete);
      } else if (onRoster) {
        totalActive++;
      }
    }

    if (toArchive.length === 0 && toUnarchive.length === 0) {
      console.log(`[${team.name}] ✓ All ${athletes.length} athletes active`);
      totalActive += athletes.length;
      continue;
    }

    console.log(`[${team.name}]`);
    if (toArchive.length > 0) {
      console.log(
        `  Archive (${toArchive.length}): ${toArchive.map((a) => a.name).join(", ")}`,
      );
    }
    if (toUnarchive.length > 0) {
      console.log(
        `  Re-activate (${toUnarchive.length}): ${toUnarchive.map((a) => a.name).join(", ")}`,
      );
    }

    if (!DRY_RUN) {
      if (toArchive.length > 0) {
        await sb
          .from("athletes")
          .update({ is_archived: true })
          .in(
            "id",
            toArchive.map((a) => a.id),
          );
        totalArchived += toArchive.length;
      }
      if (toUnarchive.length > 0) {
        await sb
          .from("athletes")
          .update({ is_archived: false })
          .in(
            "id",
            toUnarchive.map((a) => a.id),
          );
        totalUnarchived += toUnarchive.length;
      }
    } else {
      totalArchived += toArchive.length;
    }

    totalActive += athletes.length - toArchive.length - toUnarchive.length;
  }

  console.log(`\n=== Summary ===`);
  console.log(`Archived: ${totalArchived}`);
  console.log(`Re-activated: ${totalUnarchived}`);
  console.log(`Active: ${totalActive}`);
  if (DRY_RUN)
    console.log(`\n(Dry run — no changes made. Remove --dry-run to apply.)`);
}

main().catch(console.error);
