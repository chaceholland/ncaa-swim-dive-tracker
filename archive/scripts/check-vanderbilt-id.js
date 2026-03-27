const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Try direct search with longer wait
    await page.goto("https://www.swimcloud.com/teams/?q=Vanderbilt", {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });
    await page.waitForTimeout(3000);

    const content = await page.content();
    const links = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a[href*="/team/"]'))
        .map((a) => ({ href: a.href, text: a.textContent.trim() }))
        .slice(0, 10);
    });
    console.log("Links found:", JSON.stringify(links, null, 2));

    // Try a few known IDs near other SEC teams
    // SEC teams: Alabama=86, Auburn=88, Florida=117, Georgia=124, Tennessee=127, Texas A&M=126
    // Vanderbilt might be around 129 or similar
    const testIds = [
      129, 136, 137, 138, 139, 140, 132, 133, 144, 146, 147, 148, 149, 150,
    ];
    for (const id of testIds) {
      const url = `https://www.swimcloud.com/team/${id}/`;
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 15000 });
      await page.waitForTimeout(500);
      const title = await page.title();
      const h1 = await page.evaluate(
        () => document.querySelector("h1")?.textContent?.trim() || "",
      );
      if (
        title.toLowerCase().includes("vanderbilt") ||
        h1.toLowerCase().includes("vanderbilt")
      ) {
        console.log(`FOUND Vanderbilt! ID: ${id}, URL: ${url}`);
        break;
      } else {
        console.log(`ID ${id}: ${h1 || title}`);
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
