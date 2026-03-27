const { chromium } = require("playwright");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    // Check ECAC events for Army
    const ecacEvents = [
      "https://www.swimcloud.com/results/370135/event/26/",
      "https://www.swimcloud.com/results/370135/event/12/",
    ];

    for (const eventUrl of ecacEvents) {
      console.log(`Loading: ${eventUrl}`);
      await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(1000);

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

      console.log("Teams in event:", JSON.stringify(teams));
    }

    // Direct check for Army/Navy/Vanderbilt IDs
    const idsToCheck = [
      181, 182, 183, 184, 185, 186, 187, 188, 189, 190, 191, 192, 193, 194, 195,
      196, 197, 198, 199, 200, 210, 211, 212, 213, 214, 215, 216, 217, 218, 219,
      220, 221, 222, 223, 224, 225, 226, 227, 228, 229, 230, 231, 232, 233, 234,
      235, 236, 237, 238, 239,
    ];

    console.log("\nChecking IDs 181-239...");
    for (const id of idsToCheck) {
      try {
        await page.goto(`https://www.swimcloud.com/team/${id}/`, {
          waitUntil: "domcontentloaded",
          timeout: 15000,
        });
        await page.waitForTimeout(100);
        const h1 = await page.evaluate(
          () => document.querySelector("h1")?.textContent?.trim() || "",
        );
        if (h1 && !h1.includes("not found")) {
          const lower = h1.toLowerCase();
          if (
            lower.includes("army") ||
            lower.includes("west point") ||
            lower.includes("vanderbilt") ||
            lower.includes("navy")
          ) {
            console.log(`FOUND: ID ${id}: ${h1}`);
          }
        }
      } catch (e) {
        // skip timeout
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
