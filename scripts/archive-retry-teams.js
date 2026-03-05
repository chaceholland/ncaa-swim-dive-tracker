/**
 * Retry archiving for teams missed due to rate limiting.
 * Usage: node --env-file=.env.local scripts/archive-retry-teams.js
 */
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const sb = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// Teams that were rate-limited in the main run
const RETRY_TEAMS = [
  { name: "Alabama", swimcloudId: "65", slug: "alabama" },
  { name: "Arizona", swimcloudId: "120", slug: "arizona" },
  { name: "Arizona State", swimcloudId: "87", slug: "arizona-state" },
  { name: "Army", swimcloudId: "326", slug: "army" },
  { name: "Yale", swimcloudId: "376", slug: "yale" },
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36";

function normalizeName(n) {
  return n
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function isOnRoster(athleteName, rosterNames) {
  const norm = normalizeName(athleteName);
  if (rosterNames.has(norm)) return true;
  const parts = norm.split(" ");
  const last = parts[parts.length - 1];
  const firstInit = parts[0][0];
  for (const rName of rosterNames) {
    const rParts = rName.split(" ");
    if (
      rParts[rParts.length - 1] === last &&
      (rParts[0] === parts[0] || rParts[0][0] === firstInit)
    ) {
      return true;
    }
  }
  return false;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  let totalArchived = 0;

  for (const team of RETRY_TEAMS) {
    await sleep(3000);

    const res = await fetch(
      `https://www.swimcloud.com/team/${team.swimcloudId}/roster/`,
      { headers: { "User-Agent": USER_AGENT } },
    );
    const html = await res.text();
    const regex = /href="\/swimmer\/(\d+)\/?">[\s]*([^<\n]{2,50})[\s]*<\/a>/g;
    const rosterNames = new Set();
    let m;
    while ((m = regex.exec(html)) !== null) {
      rosterNames.add(normalizeName(m[2].trim()));
    }

    if (rosterNames.size === 0) {
      console.log(`[${team.name}] Could not fetch roster (${res.status})`);
      continue;
    }
    console.log(`[${team.name}] ${rosterNames.size} on SwimCloud roster`);

    // Get team id from DB
    const { data: teamRow } = await sb
      .from("teams")
      .select("id")
      .eq("name", team.name)
      .single();
    if (!teamRow) {
      console.log(`  No DB team found`);
      continue;
    }

    const { data: athletes } = await sb
      .from("athletes")
      .select("id, name, is_archived")
      .eq("team_id", teamRow.id);

    const toArchive = (athletes || []).filter(
      (a) => !a.is_archived && !isOnRoster(a.name, rosterNames),
    );
    const toUnarchive = (athletes || []).filter(
      (a) => a.is_archived && isOnRoster(a.name, rosterNames),
    );

    if (toArchive.length > 0) {
      console.log(
        `  Archive (${toArchive.length}): ${toArchive.map((a) => a.name).join(", ")}`,
      );
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
      console.log(
        `  Re-activate (${toUnarchive.length}): ${toUnarchive.map((a) => a.name).join(", ")}`,
      );
      await sb
        .from("athletes")
        .update({ is_archived: false })
        .in(
          "id",
          toUnarchive.map((a) => a.id),
        );
    }
    if (toArchive.length === 0 && toUnarchive.length === 0) {
      console.log(`  ✓ All active`);
    }
  }

  console.log(`\nTotal archived: ${totalArchived}`);
}

main().catch(console.error);
