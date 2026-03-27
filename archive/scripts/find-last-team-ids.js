const { chromium } = require("playwright");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function extractTeamsFromEvent(page, eventUrl) {
  await page.goto(eventUrl, { waitUntil: "networkidle", timeout: 20000 });
  await page.waitForTimeout(800);
  return await page.evaluate(() => {
    const teams = {};
    document.querySelectorAll("table tbody tr").forEach((row) => {
      const teamCell = row.querySelector('.hidden-xs a[href*="/team/"]');
      if (teamCell) {
        const match = teamCell.href.match(/\/(?:results\/\d+\/)?team\/(\d+)\//);
        const name = teamCell.textContent.trim().replace(/\s+/g, " ");
        if (match && name && !teams[match[1]]) teams[match[1]] = name;
      }
    });
    return teams;
  });
}

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    const allTeams = {};

    // Search for Iowa - they should be in B1G meets
    // Let me look at a specific Big 10 dual meet or invite where Iowa swam
    // Iowa ID might be 166 based on earlier broader search
    // Let me verify by checking their team page
    for (const id of [
      166, 107, 320, 150, 151, 152, 153, 155, 156, 157, 160, 161, 162, 163, 164,
      165,
    ]) {
      await page.goto(`https://www.swimcloud.com/team/${id}/`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      await page.waitForTimeout(300);
      const h1 = await page.evaluate(
        () =>
          document.querySelector("h1")?.textContent?.trim() || document.title,
      );
      console.log(`ID ${id}: ${h1}`);
    }

    // Also search for Navy, Army, Vanderbilt, Towson
    console.log("\nSearching for specific teams...");
    for (const id of [
      240, 241, 242, 243, 244, 245, 247, 248, 249, 250, 251, 252, 253, 254, 255,
      256,
    ]) {
      await page.goto(`https://www.swimcloud.com/team/${id}/`, {
        waitUntil: "domcontentloaded",
        timeout: 10000,
      });
      await page.waitForTimeout(300);
      const h1 = await page.evaluate(
        () =>
          document.querySelector("h1")?.textContent?.trim() || document.title,
      );
      console.log(`ID ${id}: ${h1}`);
    }

    // Try Patriot League Championships for Navy and Army
    // Search for a Patriot League meet
    await page.goto("https://www.swimcloud.com/results/?q=patriot+league", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    const patriots = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/results/"]'))
        .map((a) => ({
          href: a.href,
          text: a.textContent.trim().replace(/\s+/g, " ").substring(0, 80),
        }))
        .filter(
          (l) =>
            l.href.match(/\/results\/\d+/) && /patriot|army|navy/i.test(l.text),
        )
        .slice(0, 5);
    });
    console.log("\nPatriot League meets:", JSON.stringify(patriots));

    // Try ECAC meet (Eastern Collegial Athletic Conference) which has Army, Navy, Ivy
    await page.goto("https://www.swimcloud.com/results/370135/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    const ecacTeams = await page.evaluate(() => {
      const teams = {};
      document.querySelectorAll('a[href*="/team/"]').forEach((a) => {
        const match = a.href.match(/\/team\/(\d+)\//);
        if (match) {
          const name = a.textContent.trim().replace(/\s+/g, " ");
          if (name) teams[match[1]] = name;
        }
      });
      return teams;
    });
    console.log("\nECAC teams:", JSON.stringify(ecacTeams));
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
