const { chromium } = require("playwright");
const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.setExtraHTTPHeaders({ "User-Agent": USER_AGENT });

  try {
    // Check possible Patriot League meets
    const meetIds = [
      370141, 370143, 370145, 370147, 370148, 370149, 370151, 370152, 370153,
    ];

    for (const meetId of meetIds) {
      try {
        await page.goto(`https://www.swimcloud.com/results/${meetId}/`, {
          waitUntil: "domcontentloaded",
          timeout: 10000,
        });
        const title = await page.evaluate(
          () =>
            document.querySelector("h1")?.textContent?.trim() || document.title,
        );
        const isNotFound = title.includes("not found") || title === "SwimCloud";
        if (!isNotFound) {
          console.log(`Meet ${meetId}: ${title}`);

          // Check team links on this page
          const teamLinks = await page.evaluate(() => {
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
          console.log("  Teams:", JSON.stringify(teamLinks));
        }
      } catch (e) {
        // timeout or error
      }
    }

    // Also check Navy's team page directly at /team/327/
    // We know Navy = 327 from ECAC results
    console.log("\nChecking Navy (327)...");
    await page.goto("https://www.swimcloud.com/team/327/", {
      waitUntil: "domcontentloaded",
      timeout: 15000,
    });
    const navyH1 = await page.evaluate(
      () => document.querySelector("h1")?.textContent?.trim() || "",
    );
    console.log(`Navy ID 327: ${navyH1}`);

    // Get Navy's meets to find Army
    await page.goto("https://www.swimcloud.com/team/327/results/", {
      waitUntil: "networkidle",
      timeout: 30000,
    });
    await page.waitForTimeout(2000);
    const navyMeets = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/results/"]'))
        .map((a) => {
          const match = a.href.match(/\/results\/(\d+)/);
          return match
            ? {
                id: match[1],
                text: a.textContent
                  .trim()
                  .replace(/\s+/g, " ")
                  .substring(0, 60),
              }
            : null;
        })
        .filter(Boolean)
        .filter((m) => m.id.match(/^\d+$/))
        .slice(0, 10);
    });
    console.log("Navy meets:", JSON.stringify(navyMeets));

    // Load a Navy meet and look for Army
    for (const meet of navyMeets.slice(0, 5)) {
      await page.goto(`https://www.swimcloud.com/results/${meet.id}/`, {
        waitUntil: "networkidle",
        timeout: 20000,
      });
      await page.waitForTimeout(1000);
      const teams = await page.evaluate(() => {
        const t = {};
        document.querySelectorAll('a[href*="/team/"]').forEach((a) => {
          const match = a.href.match(/\/team\/(\d+)\//);
          if (match) {
            const name = a.textContent.trim().replace(/\s+/g, " ");
            if (name) t[match[1]] = name;
          }
        });
        return t;
      });

      const armyEntry = Object.entries(teams).find(
        ([id, name]) =>
          name.toLowerCase().includes("army") ||
          name.toLowerCase().includes("west point"),
      );
      if (armyEntry) {
        console.log(
          `FOUND ARMY in meet ${meet.id}: ID=${armyEntry[0]}, name="${armyEntry[1]}"`,
        );
      }

      const vanderbiltEntry = Object.entries(teams).find(([id, name]) =>
        name.toLowerCase().includes("vanderbilt"),
      );
      if (vanderbiltEntry) {
        console.log(
          `FOUND VANDERBILT in meet ${meet.id}: ID=${vanderbiltEntry[0]}, name="${vanderbiltEntry[1]}"`,
        );
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
