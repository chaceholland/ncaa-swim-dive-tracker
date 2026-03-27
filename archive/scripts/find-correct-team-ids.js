/**
 * Find correct SwimCloud IDs for major D1 swim programs
 * by searching the site and verifying team names
 */
const { chromium } = require("playwright");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Map of team names to search for
const TEAMS = [
  "Ohio State",
  "Indiana",
  "Michigan",
  "Auburn",
  "Alabama",
  "Florida",
  "Georgia",
  "Texas",
  "Stanford",
  "California",
  "UCLA",
  "USC",
  "Tennessee",
  "NC State",
  "Virginia",
  "Wisconsin",
  "Minnesota",
  "Notre Dame",
  "Penn State",
  "Florida State",
  "Louisville",
  "Georgia Tech",
  "Virginia Tech",
  "Arizona State",
  "Arizona",
  "Utah",
  "Texas A&M",
  "LSU",
  "South Carolina",
  "Missouri",
  "Kentucky",
  "Iowa",
  "Purdue",
  "Northwestern",
  "West Virginia",
  "North Carolina",
  "Duke",
  "TCU",
  "SMU",
  "Towson",
  "UNLV",
  "Navy",
  "Army",
  "Harvard",
  "Yale",
  "Princeton",
  "Penn",
  "Cornell",
  "Brown",
  "Columbia",
  "Dartmouth",
  "Vanderbilt",
  "Pittsburgh",
];

async function searchTeam(page, teamName) {
  // Use SwimCloud's team search
  const query = encodeURIComponent(teamName);
  await page.goto(`https://www.swimcloud.com/teams/?q=${query}`, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });
  await page.waitForTimeout(1500);

  // Get team links from search results
  const teams = await page.evaluate((searchName) => {
    const links = Array.from(document.querySelectorAll("a"));
    const teamLinks = [];

    for (const link of links) {
      const href = link.href || "";
      const match = href.match(/swimcloud\.com\/team\/(\d+)\//);
      if (match) {
        const text = link.textContent.trim().replace(/\s+/g, " ");
        teamLinks.push({
          id: match[1],
          name: text,
          href,
        });
      }
    }

    return teamLinks.slice(0, 10);
  }, teamName);

  return teams;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const results = {};

  try {
    for (const team of TEAMS) {
      console.log(`\nSearching for: ${team}`);
      const found = await searchTeam(page, team);
      console.log(`  Found ${found.length} results:`);
      found.forEach((t) => console.log(`    ID ${t.id}: ${t.name}`));

      // Pick first match that looks right
      if (found.length > 0) {
        results[team] = found;
      }

      await page.waitForTimeout(800);
    }

    console.log("\n\n=== RESULTS ===");
    console.log(JSON.stringify(results, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
