/**
 * Find remaining missing team IDs by looking at specific meets
 * that should have those teams: SEC, ACC, etc.
 */
const { chromium } = require("playwright");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function extractAllTeamIdsFromMeet(page, meetId) {
  await page.goto(`https://www.swimcloud.com/results/${meetId}/`, {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(1500);

  // Get all event links from the meet
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
    return links.slice(0, 5); // Check first 5 events for team diversity
  });

  const allTeams = {};

  // First get teams from the meet page itself
  const meetTeams = await page.evaluate(() => {
    const teams = {};
    document.querySelectorAll('a[href*="/team/"]').forEach((a) => {
      const match = a.href.match(/\/(?:results\/\d+\/)?team\/(\d+)\//);
      if (match) {
        const name = a.textContent.trim().replace(/\s+/g, " ");
        if (name && !teams[match[1]]) teams[match[1]] = name;
      }
    });
    return teams;
  });
  Object.assign(allTeams, meetTeams);

  for (const eventUrl of eventLinks) {
    await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 20000 });
    await page.waitForTimeout(800);

    const eventTeams = await page.evaluate(() => {
      const teams = {};
      document.querySelectorAll("table tbody tr").forEach((row) => {
        const teamCell = row.querySelector('.hidden-xs a[href*="/team/"]');
        if (teamCell) {
          const match = teamCell.href.match(
            /\/(?:results\/\d+\/)?team\/(\d+)\//,
          );
          const name = teamCell.textContent.trim().replace(/\s+/g, " ");
          if (match && name && !teams[match[1]]) teams[match[1]] = name;
        }
      });
      return teams;
    });
    Object.assign(allTeams, eventTeams);
  }

  return allTeams;
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  const allTeams = {};

  try {
    // SEC Championships - should have: Alabama, Auburn, Florida, Georgia, Tennessee, Texas A&M, LSU, South Carolina, Missouri, Kentucky
    console.log("Extracting from SEC Championships (370160)...");
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "370160"));

    // ACC Championships - should have: NC State, Virginia, Virginia Tech, Notre Dame, Louisville, Duke, Pitt, Georgia Tech, Florida State
    console.log("Extracting from ACC Championships (370159)...");
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "370159"));

    // B1G Championships - should have: Indiana, Michigan, Ohio State, Wisconsin, Minnesota, Penn State, Iowa, Purdue, Northwestern
    console.log("Extracting from B1G Championships (370136)...");
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "370136"));

    // Big 12 Championships - should have: Arizona, Arizona State, Utah, TCU, West Virginia
    console.log("Extracting from Big 12 Championships (370142)...");
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "370142"));

    // Ivy League Championships - should have: Harvard, Yale, Princeton, Penn, Cornell, Brown, Columbia, Dartmouth
    console.log("Extracting from Ivy League Championships (370137)...");
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "370137"));

    // American Conference Championships - should have: Navy, SMU, Towson
    console.log(
      "Extracting from American Conference Championships (370146)...",
    );
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "370146"));

    // Find UCLA/Cal/Stanford from Pac-12 era meets - check ACC champs since they joined
    // Try NCAA D1 Championships
    // Let's also look for Army and UNLV
    console.log("Extracting from MPSF Championships (379295) for UNLV...");
    Object.assign(allTeams, await extractAllTeamIdsFromMeet(page, "379295"));

    console.log("\n=== ALL TEAMS FOUND ===");
    // Sort by ID
    const sorted = Object.entries(allTeams).sort(
      (a, b) => parseInt(a[0]) - parseInt(b[0]),
    );
    sorted.forEach(([id, name]) => console.log(`  ${id}: ${name}`));

    // Print the ones we need
    const NEEDED = {
      "Ohio State": "393", // Already found
      Indiana: "92",
      Michigan: "89",
      Alabama: "65",
      Auburn: "127",
      Florida: "117",
      Georgia: "124",
      Tennessee: "44",
      "Texas A&M": "80",
      LSU: "56",
      "South Carolina": "95",
      Missouri: "431",
      Kentucky: "176",
      Iowa: "166",
      Purdue: "27",
      Northwestern: "401",
      Minnesota: "31",
      Wisconsin: "98",
      Texas: "105",
      Stanford: "112",
      California: "110",
      UCLA: "107",
      USC: "102",
      "Arizona State": "87",
      Arizona: "120",
      Utah: "330",
      TCU: "318",
      "West Virginia": "294",
      "NC State": "394",
      Virginia: "73", // Need to find
      "Virginia Tech": "336",
      "Notre Dame": "53",
      Louisville: "174",
      Duke: "280",
      "Georgia Tech": "34",
      "Florida State": "77",
      Pittsburgh: "405",
      "North Carolina": "60",
      "Penn State": "82",
      Harvard: "134",
      Yale: "376",
      Princeton: "477",
      Penn: "416",
      Cornell: "258",
      Brown: "17",
      Columbia: "283",
      Dartmouth: "272",
      Towson: "320",
      UNLV: "440",
      SMU: "75",
      Navy: null,
      Army: null,
      Vanderbilt: null,
    };

    console.log("\n=== TEAM ID VERIFICATION ===");
    for (const [team, id] of Object.entries(NEEDED)) {
      if (id && allTeams[id]) {
        console.log(
          `${team}: ID=${id} -> "${allTeams[id]}" ${allTeams[id].toLowerCase().includes(team.toLowerCase()) || team.toLowerCase().includes(allTeams[id].toLowerCase()) ? "OK" : "MISMATCH!"}`,
        );
      } else if (id) {
        console.log(`${team}: ID=${id} -> NOT IN FOUND TEAMS`);
      } else {
        // Search for it
        const found = sorted.find(([i, n]) =>
          n.toLowerCase().includes(team.toLowerCase()),
        );
        console.log(
          `${team}: SEARCHING -> ${found ? `ID=${found[0]}, name="${found[1]}"` : "NOT FOUND"}`,
        );
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
