const { chromium } = require("playwright");

const SITES = [
  {
    name: "North Carolina",
    url: "https://goheels.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Utah",
    url: "https://utahutes.com/sports/swimming-and-diving/roster",
  },
  { name: "Kentucky", url: "https://ukathletics.com/sports/mswim/roster" },
  {
    name: "Missouri",
    url: "https://mutigers.com/sports/mens-swimming-and-diving/roster",
  },
];

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  for (const site of SITES) {
    console.log("\n===", site.name, "===");
    try {
      await page.goto(site.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    } catch (e) {
      console.log("Load error:", e.message.substring(0, 60));
      continue;
    }
    await page.waitForTimeout(10000);

    const info = await page.evaluate(() => {
      const sels = {};
      [
        "td.roster_class",
        ".s-person-card",
        "tbody tr",
        ".sidearm-table-player-name",
        '[data-test-id="s-person-details__bio-stats-person-title"]',
        ".roster-player-card",
        ".roster-card-item",
        ".roster-list_item",
      ].forEach((s) => {
        try {
          sels[s] = document.querySelectorAll(s).length;
        } catch {
          sels[s] = 0;
        }
      });

      // Get card sample
      const card = document.querySelector(".s-person-card");
      let cardSample = null;
      if (card) {
        const bioStats = card.querySelector(
          '[data-test-id="s-person-details__bio-stats-person-title"]',
        );
        const nameEl = card.querySelector(
          '.s-person-details__personal-single-line, [class*="personal-single"]',
        );
        cardSample = {
          name: nameEl ? nameEl.textContent.trim() : "no name",
          bioStats: bioStats ? bioStats.textContent.trim() : "no bio stats",
          cardHTML: card.outerHTML.substring(0, 500),
        };
      }

      // Get row sample
      const row = document.querySelector("tbody tr:nth-child(2)");
      let rowSample = null;
      if (row) {
        const cells = Array.from(row.querySelectorAll("td")).map((td) => ({
          cls: String(td.className).trim().substring(0, 40),
          txt: td.textContent.trim().substring(0, 20),
        }));
        rowSample = { cells };
      }

      return { sels, cardSample, rowSample };
    });

    const nonZero = Object.entries(info.sels).filter(([k, v]) => v > 0);
    console.log(
      "Non-zero selectors:",
      nonZero.map(([k, v]) => `${k}: ${v}`).join(", "),
    );
    if (info.cardSample) {
      console.log(
        "Card sample:",
        JSON.stringify(info.cardSample.name),
        "|",
        info.cardSample.bioStats,
      );
      console.log(
        "Card HTML sample:",
        info.cardSample.cardHTML.substring(0, 300),
      );
    }
    if (info.rowSample)
      console.log("Row cells:", JSON.stringify(info.rowSample.cells));
  }

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
