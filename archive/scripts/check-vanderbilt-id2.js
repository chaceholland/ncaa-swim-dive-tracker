const { chromium } = require("playwright");

async function main() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  try {
    // Vanderbilt likely has a higher ID - search more broadly
    // Try ranges of IDs more systematically
    const ranges = [
      [200, 300],
      [300, 400],
      [400, 500],
      [1000, 1100],
      [2000, 2100],
    ];

    for (const [start, end] of ranges) {
      console.log(`\nSearching IDs ${start}-${end}...`);
      for (let id = start; id < end; id += 10) {
        const url = `https://www.swimcloud.com/team/${id}/`;
        try {
          await page.goto(url, {
            waitUntil: "domcontentloaded",
            timeout: 10000,
          });
          const h1 = await page.evaluate(
            () => document.querySelector("h1")?.textContent?.trim() || "",
          );
          if (h1.toLowerCase().includes("vanderbilt")) {
            console.log(`FOUND! ID: ${id}, Name: ${h1}`);
          } else if (h1 && !h1.includes("not found") && !h1.includes("404")) {
            console.log(`ID ${id}: ${h1}`);
          }
        } catch (e) {
          // skip
        }
      }
    }
  } finally {
    await browser.close();
  }
}

main().catch(console.error);
