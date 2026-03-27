/**
 * Find SwimCloud numeric team IDs for NCAA swim/dive teams.
 *
 * Usage: node --env-file=.env.local scripts/find-swimcloud-team-ids.js
 *
 * Searches SwimCloud for each team and extracts their numeric ID.
 * Falls back to a hardcoded mapping for known teams.
 * Saves output to scripts/swimcloud-team-ids.json
 */

const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");

// Known hardcoded IDs verified against live SwimCloud site via conference championship meets
// Verified by extracting team IDs from: B1G (370136), SEC (370160), ACC (370159),
// Big 12 (370142), Ivy (370137), ECAC (370135), Patriot (370156), MPSF (379295)
const HARDCODED_IDS = {
  // SEC
  Alabama: "65",
  Auburn: "127",
  Florida: "117",
  Georgia: "124",
  Kentucky: "176",
  LSU: "56",
  Missouri: "431",
  "South Carolina": "95",
  Tennessee: "44",
  "Texas A&M": "80",
  Vanderbilt: "532",
  // Big Ten
  Indiana: "92",
  Iowa: "166",
  Michigan: "89",
  Minnesota: "31",
  Northwestern: "401",
  "Ohio State": "393",
  "Penn State": "82",
  Purdue: "27",
  Wisconsin: "98",
  // ACC
  Duke: "280",
  "Florida State": "77",
  "Georgia Tech": "34",
  Louisville: "174",
  "NC State": "394",
  "North Carolina": "60",
  "Notre Dame": "53",
  Virginia: "73",
  "Virginia Tech": "336",
  // Big 12
  TCU: "318",
  Texas: "105",
  "West Virginia": "294",
  // Pac-12 / ACC (now)
  Arizona: "120",
  "Arizona State": "87",
  Cal: "110",
  Stanford: "112",
  UCLA: "107",
  USC: "102",
  Utah: "330",
  // Ivy League
  Brown: "17",
  Columbia: "283",
  Cornell: "258",
  Dartmouth: "272",
  Harvard: "134",
  Penn: "416",
  Princeton: "477",
  Yale: "376",
  // AAC / Other
  Army: "326",
  Navy: "327",
  SMU: "75",
  Towson: "320",
  UNLV: "440",
};

// Teams required by the task
const TEAMS_TO_FIND = [
  "Alabama",
  "Arizona",
  "Arizona State",
  "Auburn",
  "Brown",
  "Cal",
  "Columbia",
  "Cornell",
  "Dartmouth",
  "Duke",
  "Florida",
  "Florida State",
  "Georgia",
  "Georgia Tech",
  "Harvard",
  "Indiana",
  "Iowa",
  "Kentucky",
  "Louisville",
  "LSU",
  "Michigan",
  "Minnesota",
  "Missouri",
  "Navy",
  "NC State",
  "North Carolina",
  "Northwestern",
  "Notre Dame",
  "Ohio State",
  "Penn",
  "Penn State",
  "Princeton",
  "Purdue",
  "SMU",
  "South Carolina",
  "Stanford",
  "TCU",
  "Tennessee",
  "Texas",
  "Texas A&M",
  "Towson",
  "UCLA",
  "UNLV",
  "USC",
  "Utah",
  "Vanderbilt",
  "Virginia",
  "Virginia Tech",
  "West Virginia",
  "Wisconsin",
  "Yale",
  "Army",
];

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const DELAY_MS = 1000;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function searchTeamOnSwimCloud(page, teamName) {
  const query = encodeURIComponent(`${teamName} men swimming`);
  const url = `https://www.swimcloud.com/teams/?q=${query}`;

  try {
    console.log(`  Searching: ${url}`);
    await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
    await sleep(500);

    // Extract team IDs from search results
    const teamLinks = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a[href*="/team/"]'));
      return links
        .map((link) => {
          const match = link.href.match(/\/team\/(\d+)\//);
          return match
            ? { id: match[1], text: link.textContent.trim(), href: link.href }
            : null;
        })
        .filter(Boolean)
        .slice(0, 5);
    });

    if (teamLinks.length > 0) {
      console.log(`  Found: ${teamLinks[0].text} (ID: ${teamLinks[0].id})`);
      return teamLinks[0].id;
    }

    console.log(`  No results found for ${teamName}`);
    return null;
  } catch (err) {
    console.log(`  Error searching for ${teamName}: ${err.message}`);
    return null;
  }
}

async function main() {
  const outputPath = path.join(__dirname, "swimcloud-team-ids.json");

  // Start with hardcoded IDs
  const result = {};

  // Track which teams need live searching
  const teamsToSearch = [];

  console.log("Building SwimCloud team ID mapping...\n");

  for (const team of TEAMS_TO_FIND) {
    if (HARDCODED_IDS[team]) {
      result[team] = HARDCODED_IDS[team];
      console.log(`[hardcoded] ${team}: ${HARDCODED_IDS[team]}`);
    } else {
      teamsToSearch.push(team);
    }
  }

  // Search for teams not in hardcoded list
  if (teamsToSearch.length > 0) {
    console.log(
      `\nSearching for ${teamsToSearch.length} teams on SwimCloud...`,
    );
    console.log("Teams to search:", teamsToSearch);

    let browser;
    try {
      browser = await chromium.launch({ headless: true });
      const context = await browser.newContext({ userAgent: USER_AGENT });
      const page = await context.newPage();

      for (const team of teamsToSearch) {
        console.log(`\nSearching for: ${team}`);
        const id = await searchTeamOnSwimCloud(page, team);
        if (id) {
          result[team] = id;
        } else {
          console.log(`  WARNING: Could not find SwimCloud ID for ${team}`);
        }
        await sleep(DELAY_MS);
      }
    } finally {
      if (browser) await browser.close();
    }
  }

  // Sort and save
  const sorted = {};
  TEAMS_TO_FIND.forEach((team) => {
    if (result[team]) {
      sorted[team] = result[team];
    }
  });

  fs.writeFileSync(outputPath, JSON.stringify(sorted, null, 2));
  console.log(
    `\nSaved ${Object.keys(sorted).length} team IDs to ${outputPath}`,
  );

  // Print missing teams
  const missing = TEAMS_TO_FIND.filter((t) => !result[t]);
  if (missing.length > 0) {
    console.log("\nMissing teams (no ID found):");
    missing.forEach((t) => console.log(`  - ${t}`));
  } else {
    console.log("\nAll teams found!");
  }

  console.log("\nFinal mapping:");
  console.log(JSON.stringify(sorted, null, 2));
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
