const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  async function goTo(url) {
    try {
      await page.goto(url, { waitUntil: "networkidle", timeout: 25000 });
    } catch {
      try {
        await page.goto(url, { waitUntil: "domcontentloaded", timeout: 25000 });
      } catch (e) {
        console.log("  load error:", e.message.substring(0, 80));
      }
    }
    await page.waitForTimeout(6000);
  }

  // ----- Georgia bio-stats -----
  console.log("\n=== Georgia bio-stats ===");
  await goTo("https://georgiadogs.com/sports/swimming-and-diving/roster");
  const georgia = await page.evaluate(() => {
    // Full card outer HTML for first few cards
    const cards = document.querySelectorAll(".s-person-card");
    if (!cards.length) return { err: "no cards" };

    // Look at bio-stats inside first card
    const card = cards[0];
    const bioStats = card.querySelector(".s-person-details__bio-stats");
    const bioHTML = bioStats
      ? bioStats.outerHTML.substring(0, 400)
      : "no bio-stats";

    // Get all text from card
    const fullText = card.innerText.replace(/\n/g, " | ").substring(0, 200);

    // Sample all cards
    const sample = Array.from(cards)
      .slice(0, 4)
      .map((c) => {
        const stats = c.querySelector(".s-person-details__bio-stats");
        const name = c.querySelector(
          '.s-person-details__personal-single-line, [class*="personal-single"]',
        );
        return {
          name: name ? name.textContent.trim() : "no name",
          stats: stats
            ? stats.textContent.trim().substring(0, 100).replace(/\n/g, "|")
            : "no stats",
          statsHTML: stats ? stats.outerHTML.substring(0, 300) : "none",
        };
      });

    return { cardCount: cards.length, bioHTML, fullText, sample };
  });
  console.log("Georgia card count:", georgia.cardCount);
  console.log("Georgia bio-stats HTML:", georgia.bioHTML?.substring(0, 400));
  console.log("Sample:");
  georgia.sample?.forEach((s) => console.log(" ", JSON.stringify(s)));

  // ----- UNLV — try waiting longer and check API -----
  console.log("\n=== UNLV (extra wait) ===");
  await page.goto(
    "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(12000); // longer wait
  const unlv = await page.evaluate(() => {
    const sels = {};
    [
      "tbody tr",
      ".s-person-card",
      "td.roster_class",
      ".sidearm-table-player-name",
      "tr.odd",
      '[data-label="Class"]',
      '[data-label="Yr."]',
      '[data-label="Year"]',
      'td[class*="class"]',
      ".roster-player",
      '[class*="player-card"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    // Sample first table
    const tables = document.querySelectorAll("table");
    let tableHTML = "no table";
    if (tables.length > 0) {
      const t = Array.from(tables).find(
        (t) => t.querySelectorAll("td").length > 5,
      );
      if (t) tableHTML = t.outerHTML.substring(0, 600);
    }
    // Get all visible text
    const visible = document.body.innerText
      .substring(0, 1000)
      .replace(/\n/g, " | ");
    return { sels, tableHTML, visible };
  });
  const nonZeroSels = Object.entries(unlv.sels).filter(([k, v]) => v > 0);
  console.log("UNLV sels:", nonZeroSels);
  console.log("UNLV table HTML:", unlv.tableHTML?.substring(0, 400));
  console.log("UNLV visible text:", unlv.visible.substring(0, 500));

  // ----- Yale — deeper look -----
  console.log("\n=== Yale (API check) ===");
  // Intercept requests to see if there's an API call
  const yaleRequests = [];
  page.on("request", (req) => {
    const url = req.url();
    if (
      url.includes("api") ||
      url.includes("roster") ||
      url.includes("player") ||
      url.includes("json")
    ) {
      yaleRequests.push(url.substring(0, 120));
    }
  });
  await page.goto(
    "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(8000);
  console.log("Yale API requests:", yaleRequests.slice(0, 10));
  const yale = await page.evaluate(() => {
    const body = document.body.innerText
      .substring(0, 1000)
      .replace(/\n/g, " | ");
    // Try all structures
    const sels = {};
    [
      "tbody tr",
      ".s-person-card",
      "td.roster_class",
      "[data-label]",
      ".name_earit",
      ".vue-roster",
      '[class*="roster"]',
      "li.roster",
      ".athlete-name",
      '[class*="athlete"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    return { body: body.substring(0, 600), sels };
  });
  console.log("Yale body:", yale.body.substring(0, 500));
  console.log(
    "Yale sels:",
    Object.entries(yale.sels).filter(([k, v]) => v > 0),
  );

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
