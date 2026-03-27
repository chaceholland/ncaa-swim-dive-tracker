/**
 * Extract SwimCloud team IDs from known conference championship meets.
 * The B1G meet at /results/370136 has all B1G teams.
 * We can find other conference meets on the results page to get team IDs.
 */
const { chromium } = require("playwright");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Known conference championship meet IDs we found from browsing the results page
// We saw B1G at 370136
const KNOWN_MEETS = [
  { id: "370136", name: "B1G Conference Championships (M)", conference: "B1G" },
  { id: "370137", name: "Ivy League Championships (M)", conference: "Ivy" },
];

// Additional meets to try - search recent results page
const SEARCH_URLS = [
  "https://www.swimcloud.com/results/?interval=week&orderBy=top&page=1&page_view=globalMeets&period=past&region",
  "https://www.swimcloud.com/results/?interval=month&orderBy=top&page=1&page_view=globalMeets&period=past&region",
];

async function extractTeamIdsFromMeet(page, meetId, meetName) {
  console.log(`\nExtracting team IDs from: ${meetName} (ID: ${meetId})`);
  await page.goto(`https://www.swimcloud.com/results/${meetId}/`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(2000);

  // Look for team links in the meet
  const teamData = await page.evaluate(() => {
    const teamLinks = [];
    const seenIds = new Set();

    document.querySelectorAll('a[href*="/team/"]').forEach((a) => {
      const match = a.href.match(/\/team\/(\d+)\//);
      if (match && !seenIds.has(match[1])) {
        seenIds.add(match[1]);
        teamLinks.push({
          id: match[1],
          name: a.textContent.trim().replace(/\s+/g, " "),
          href: a.href,
        });
      }
    });

    // Also look for team names in result rows
    const teamFromRows = [];
    document
      .querySelectorAll('a[href*="/results/"][href*="/team/"]')
      .forEach((a) => {
        const match = a.href.match(/\/results\/\d+\/team\/(\d+)\//);
        if (match) {
          const name = a.textContent.trim().replace(/\s+/g, " ");
          teamFromRows.push({ id: match[1], name });
        }
      });

    return { teamLinks, teamFromRows };
  });

  console.log("Team links:", JSON.stringify(teamData.teamLinks.slice(0, 20)));

  // Load event to get more team IDs
  // Get first event
  const eventLinks = await page.evaluate(() => {
    const links = [];
    const seen = new Set();
    document.querySelectorAll('a[href*="/event/"]').forEach((a) => {
      const match = a.href.match(/\/results\/\d+\/event\/(\d+)\//);
      if (match && !seen.has(match[1])) {
        seen.add(match[1]);
        links.push(a.href.split("?")[0]);
      }
    });
    return links.slice(0, 3);
  });

  const allTeamIds = {};

  for (const eventUrl of eventLinks) {
    console.log(`  Loading event: ${eventUrl}`);
    await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(1000);

    const teamIdsFromEvent = await page.evaluate(() => {
      const teams = {};
      // Look for team links in format /results/{meetId}/team/{teamId}/
      document
        .querySelectorAll('a[href*="/results/"][href*="/team/"]')
        .forEach((a) => {
          const match = a.href.match(/\/results\/\d+\/team\/(\d+)\//);
          if (match) {
            const teamNameEl = a.querySelector('[class*="team"], span, div');
            const teamName = (teamNameEl?.textContent || a.textContent)
              .trim()
              .replace(/\s+/g, " ");
            if (teamName && !teams[match[1]]) {
              teams[match[1]] = teamName;
            }
          }
        });

      // Also look in table rows for team info
      document.querySelectorAll("table tbody tr").forEach((row) => {
        const teamCell = row.querySelector('.hidden-xs a[href*="/team/"]');
        if (teamCell) {
          const match = teamCell.href.match(/\/team\/(\d+)\//);
          const teamName = teamCell.textContent.trim().replace(/\s+/g, " ");
          if (match && teamName) {
            teams[match[1]] = teamName;
          }
        }

        // Also check for swimmer-team link patterns
        const teamLinks = row.querySelectorAll('a[href*="/team/"]');
        teamLinks.forEach((link) => {
          const match = link.href.match(/\/results\/\d+\/team\/(\d+)\//);
          if (match) {
            const name = link.textContent.trim().replace(/\s+/g, " ");
            if (name && !teams[match[1]]) teams[match[1]] = name;
          }
        });
      });

      return teams;
    });

    Object.assign(allTeamIds, teamIdsFromEvent);
  }

  return allTeamIds;
}

async function findConferenceChampionships(page) {
  console.log("\nSearching for conference championship meets...");

  // Search recent results for championship meets
  const champMeets = [];

  await page.goto(
    "https://www.swimcloud.com/results/?interval=month&orderBy=top&page=1&page_view=globalMeets&period=past&region",
    {
      waitUntil: "networkidle",
      timeout: 30000,
    },
  );
  await page.waitForTimeout(2000);

  const meets = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('a[href*="/results/"]'))
      .map((a) => {
        const match = a.href.match(/\/results\/(\d+)/);
        if (match) {
          return {
            id: match[1],
            name: a.textContent.trim().replace(/\s+/g, " ").substring(0, 100),
            href: a.href,
          };
        }
        return null;
      })
      .filter(Boolean)
      .filter((m) => /championship|championship|conference|champ/i.test(m.name))
      .filter((m) => /men|m\)/i.test(m.name) || !/women|w\)/i.test(m.name))
      .slice(0, 20);
  });

  console.log("Found meets:", JSON.stringify(meets, null, 2));
  return meets;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const allTeamIds = {};

  try {
    // Find conference championships
    const champMeets = await findConferenceChampionships(page);

    // Also add known meets
    const meetsToProcess = [
      ...KNOWN_MEETS,
      ...champMeets.map((m) => ({ id: m.id, name: m.name })),
    ];

    // Remove duplicates
    const seenMeetIds = new Set();
    const uniqueMeets = meetsToProcess.filter((m) => {
      if (seenMeetIds.has(m.id)) return false;
      seenMeetIds.add(m.id);
      return true;
    });

    console.log(`\nProcessing ${uniqueMeets.length} meets...`);

    for (const meet of uniqueMeets.slice(0, 15)) {
      const teamIds = await extractTeamIdsFromMeet(page, meet.id, meet.name);
      Object.assign(allTeamIds, teamIds);
      await page.waitForTimeout(500);
    }

    console.log("\n\n=== ALL TEAM IDs FOUND ===");
    console.log(JSON.stringify(allTeamIds, null, 2));

    // Print mapping for target teams
    const TARGET_TEAMS = [
      "Ohio State",
      "Indiana",
      "Michigan",
      "Auburn",
      "Alabama",
      "Florida",
      "Georgia",
      "Texas",
      "Stanford",
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
      "California",
    ];

    console.log("\n=== MAPPING FOR TARGET TEAMS ===");
    const finalMapping = {};
    for (const [id, name] of Object.entries(allTeamIds)) {
      for (const target of TARGET_TEAMS) {
        if (
          name.toLowerCase().includes(target.toLowerCase()) ||
          target.toLowerCase().includes(name.toLowerCase())
        ) {
          finalMapping[target] = { id, name };
        }
      }
    }
    console.log(JSON.stringify(finalMapping, null, 2));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
