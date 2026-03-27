const { chromium } = require("playwright");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    // ECAC Open had Army/Navy/Ivy teams - load events to find Army
    console.log("Loading ECAC Open Championships event...");
    await page.goto("https://www.swimcloud.com/results/370135/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    const eventLinks = await page.evaluate(() => {
      const links = [];
      const seen = new Set();
      document.querySelectorAll('a[href*="/event/"]').forEach((a) => {
        const match = a.href.match(/\/event\/(\d+)\//);
        if (match && !seen.has(match[1])) {
          seen.add(match[1]);
          links.push(a.href.split("?")[0]);
        }
      });
      return links.slice(0, 5);
    });

    console.log("Event links:", eventLinks);

    for (const eventUrl of eventLinks) {
      await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(800);

      const teams = await page.evaluate(() => {
        const teams = {};
        document.querySelectorAll("table tbody tr").forEach((row) => {
          const teamCell = row.querySelector('.hidden-xs a[href*="/team/"]');
          if (teamCell) {
            const match = teamCell.href.match(/\/team\/(\d+)\//);
            const name = teamCell.textContent.trim().replace(/\s+/g, " ");
            if (match && name) teams[match[1]] = name;
          }
        });
        return teams;
      });

      // Check for Army
      for (const [id, name] of Object.entries(teams)) {
        if (
          name.toLowerCase().includes("army") ||
          name.toLowerCase().includes("west point")
        ) {
          console.log(`FOUND ARMY: ID=${id}, name="${name}"`);
        }
        if (name.toLowerCase().includes("vanderbilt")) {
          console.log(`FOUND VANDERBILT: ID=${id}, name="${name}"`);
        }
      }
    }

    // Look for Patriot League Championships (Navy, Army, Bucknell, etc.)
    // Try to find it through the recent results or a known season
    console.log("\nSearching for Patriot League championship...");
    await page.goto("https://www.swimcloud.com/results/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Navigate through multiple pages
    const patriotMeets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/results/"]'))
        .map((a) => ({
          href: a.href,
          text: a.textContent.trim().replace(/\s+/g, " ").substring(0, 80),
        }))
        .filter(
          (l) => l.href.match(/\/results\/\d+/) && /patriot|army/i.test(l.text),
        )
        .slice(0, 10);
    });
    console.log("Patriot meets:", JSON.stringify(patriotMeets));

    // Try checking team page directly for Army
    const armyIds = [
      200, 201, 202, 203, 204, 205, 206, 207, 208, 67, 68, 69, 70, 71, 72,
    ];
    for (const id of armyIds) {
      await page.goto(`https://www.swimcloud.com/team/${id}/`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      await page.waitForTimeout(200);
      const h1 = await page.evaluate(
        () => document.querySelector("h1")?.textContent?.trim() || "",
      );
      if (
        h1.toLowerCase().includes("army") ||
        h1.toLowerCase().includes("west point") ||
        h1.toLowerCase().includes("vanderbilt")
      ) {
        console.log(`FOUND: ID ${id}: ${h1}`);
      }
    }

    // Try the team results via the search system
    // Army West Point's direct URL might reveal their ID
    // They're often at /team/181/ or similar
    const moreIds = [
      181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195,
      196, 197, 198, 199,
    ];
    for (const id of moreIds) {
      await page.goto(`https://www.swimcloud.com/team/${id}/`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      await page.waitForTimeout(200);
      const h1 = await page.evaluate(
        () => document.querySelector("h1")?.textContent?.trim() || "",
      );
      if (
        h1.toLowerCase().includes("army") ||
        h1.toLowerCase().includes("west point") ||
        h1.toLowerCase().includes("vanderbilt")
      ) {
        console.log(`FOUND: ID ${id}: ${h1}`);
      } else {
        console.log(`ID ${id}: ${h1}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
