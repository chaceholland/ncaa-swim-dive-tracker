/**
 * Explore SwimCloud team meets pages and meet structure more carefully
 */
const { chromium } = require("playwright");

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ userAgent: USER_AGENT });
  const page = await context.newPage();

  try {
    // Try different URL formats for Ohio State team page
    const urls = [
      "https://www.swimcloud.com/team/97/",
      "https://www.swimcloud.com/team/97/meets/",
      "https://www.swimcloud.com/team/97/?season=25",
    ];

    for (const url of urls) {
      console.log(`\n=== Loading: ${url} ===`);
      await page.goto(url, { waitUntil: "networkidle", timeout: 30000 });
      await page.waitForTimeout(2000);

      const info = await page.evaluate(() => {
        const allLinks = Array.from(document.querySelectorAll("a"))
          .map((a) => ({
            href: a.href,
            text: a.textContent.trim().substring(0, 100),
          }))
          .filter(
            (l) =>
              l.href &&
              l.href !== window.location.href &&
              !l.href.startsWith("#"),
          );

        return {
          title: document.title,
          url: window.location.href,
          h1: document.querySelector("h1")?.textContent?.trim(),
          relevantLinks: allLinks
            .filter(
              (l) =>
                l.href.includes("/results/") ||
                l.href.includes("/meet/") ||
                l.href.includes("/event/"),
            )
            .slice(0, 20),
        };
      });

      console.log(`Title: ${info.title}`);
      console.log(`Final URL: ${info.url}`);
      console.log(`H1: ${info.h1}`);
      console.log(`Relevant links (${info.relevantLinks.length}):`);
      info.relevantLinks.forEach((l) =>
        console.log(`  ${l.href} :: ${l.text}`),
      );
    }

    // Try loading a specific meet from the results page
    const meetUrl = "https://www.swimcloud.com/results/370136"; // B1G Champs
    console.log(`\n=== Loading B1G Champs: ${meetUrl} ===`);
    await page.goto(meetUrl, { waitUntil: "networkidle", timeout: 30000 });
    await page.waitForTimeout(2000);

    const meetInfo = await page.evaluate(() => {
      const eventLinks = Array.from(
        document.querySelectorAll('a[href*="/event/"]'),
      );
      const swimmerLinks = Array.from(
        document.querySelectorAll('a[href*="/swimmer/"]'),
      );

      return {
        title: document.title,
        url: window.location.href,
        eventLinks: eventLinks
          .slice(0, 10)
          .map((a) => ({ href: a.href, text: a.textContent.trim() })),
        swimmerLinks: swimmerLinks
          .slice(0, 5)
          .map((a) => ({ href: a.href, text: a.textContent.trim() })),
        h1: document.querySelector("h1")?.textContent?.trim(),
        allRelevantLinks: Array.from(document.querySelectorAll("a"))
          .filter(
            (a) => a.href.includes("/event/") || a.href.includes("/swimmer/"),
          )
          .slice(0, 20)
          .map((a) => ({ href: a.href, text: a.textContent.trim() })),
      };
    });

    console.log("Meet info:");
    console.log(JSON.stringify(meetInfo, null, 2));

    // Try loading the API endpoint for team meets
    console.log("\n=== Trying API endpoint ===");
    // SwimCloud has an API at /api/v2/
    const apiUrl = "https://www.swimcloud.com/api/v1/team/97/meets/?season=25";
    try {
      await page.goto(apiUrl, {
        waitUntil: "domcontentloaded",
        timeout: 15000,
      });
      const text = await page.evaluate(() => document.body.innerText);
      console.log("API response (first 500 chars):", text.substring(0, 500));
    } catch (e) {
      console.log("API error:", e.message);
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
