const { chromium } = require("playwright");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

  try {
    // Vanderbilt is in the SEC - let's load the SEC champs event pages more thoroughly
    await page.goto("https://www.swimcloud.com/results/370160/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);

    // Get ALL event links
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
      return links;
    });

    console.log(`Found ${eventLinks.length} events in SEC Champs`);

    // Check all events for Vanderbilt
    for (const eventUrl of eventLinks) {
      await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 20000 });
      await page.waitForTimeout(500);

      const teams = await page.evaluate(() => {
        const t = {};
        document.querySelectorAll("table tbody tr").forEach((row) => {
          const teamCell = row.querySelector('.hidden-xs a[href*="/team/"]');
          if (teamCell) {
            const match = teamCell.href.match(/\/team\/(\d+)\//);
            const name = teamCell.textContent.trim().replace(/\s+/g, " ");
            if (match && name) t[match[1]] = name;
          }
        });
        return t;
      });

      const vanderbilt = Object.entries(teams).find(([id, name]) =>
        name.toLowerCase().includes("vanderbilt"),
      );
      if (vanderbilt) {
        console.log(
          `FOUND VANDERBILT: ID=${vanderbilt[0]}, name="${vanderbilt[1]}"`,
        );
        break;
      }
    }

    // Also try some Vanderbilt-specific search by looking at other SEC meets
    // Try a direct range check near Alabama (65) and Auburn (127)
    const range = [
      66, 67, 68, 69, 70, 71, 72, 74, 76, 78, 79, 81, 83, 84, 86, 88, 90, 91,
      93, 94, 96,
    ];
    for (const id of range) {
      try {
        await page.goto(`https://www.swimcloud.com/team/${id}/`, {
          waitUntil: "domcontentloaded",
          timeout: 8000,
        });
        const h1 = await page.evaluate(
          () => document.querySelector("h1")?.textContent?.trim() || "",
        );
        if (h1.toLowerCase().includes("vanderbilt")) {
          console.log(`FOUND VANDERBILT via direct: ID=${id}, name="${h1}"`);
        }
      } catch (e) {}
    }

    // Try another range
    for (const id of [
      135, 136, 137, 139, 140, 141, 142, 143, 144, 145, 146, 147, 148, 149, 152,
      153, 154, 155, 156, 157, 158, 159,
    ]) {
      try {
        await page.goto(`https://www.swimcloud.com/team/${id}/`, {
          waitUntil: "domcontentloaded",
          timeout: 8000,
        });
        const h1 = await page.evaluate(
          () => document.querySelector("h1")?.textContent?.trim() || "",
        );
        if (h1.toLowerCase().includes("vanderbilt")) {
          console.log(`FOUND VANDERBILT via direct: ID=${id}, name="${h1}"`);
        }
      } catch (e) {}
    }

    // One more range
    for (const id of [
      160, 161, 162, 163, 164, 165, 167, 168, 169, 170, 171, 172, 173, 175, 177,
      178, 179, 180,
    ]) {
      try {
        await page.goto(`https://www.swimcloud.com/team/${id}/`, {
          waitUntil: "domcontentloaded",
          timeout: 8000,
        });
        const h1 = await page.evaluate(
          () => document.querySelector("h1")?.textContent?.trim() || "",
        );
        if (h1.toLowerCase().includes("vanderbilt")) {
          console.log(`FOUND VANDERBILT via direct: ID=${id}, name="${h1}"`);
        }
      } catch (e) {}
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
