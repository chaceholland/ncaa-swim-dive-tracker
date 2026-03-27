const { chromium } = require("playwright");

const SITES = [
  {
    name: "Navy",
    url: "https://navysports.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "SMU",
    url: "https://smumustangs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Stanford",
    url: "https://gostanford.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "UNLV",
    url: "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Yale",
    url: "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Georgia",
    url: "https://georgiadogs.com/sports/swimming-and-diving/roster",
  },
  {
    name: "Michigan",
    url: "https://mgoblue.com/sports/mens-swimming-and-diving/roster",
  },
  {
    name: "Florida",
    url: "https://floridagators.com/sports/mens-swimming-and-diving/roster",
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
      await page.goto(site.url, { waitUntil: "networkidle", timeout: 30000 });
    } catch {
      await page.goto(site.url, {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      });
    }
    await page.waitForTimeout(5000);

    const info = await page.evaluate(() => {
      const sels = {
        "td.roster_class": document.querySelectorAll("td.roster_class").length,
        'td[class*="class"]':
          document.querySelectorAll('td[class*="class"]').length,
        '[data-label="Class"]': document.querySelectorAll(
          '[data-label="Class"]',
        ).length,
        '[data-label="Cl."]':
          document.querySelectorAll('[data-label="Cl."]').length,
        "tbody tr": document.querySelectorAll("tbody tr").length,
        ".s-person-card": document.querySelectorAll(".s-person-card").length,
        ".roster-player-card": document.querySelectorAll(".roster-player-card")
          .length,
        ".sidearm-roster-player-class_year": document.querySelectorAll(
          ".sidearm-roster-player-class_year",
        ).length,
        ".s-person-details__personal-sport-title": document.querySelectorAll(
          ".s-person-details__personal-sport-title",
        ).length,
        ".roster-player-card-profile-field__value--basic":
          document.querySelectorAll(
            ".roster-player-card-profile-field__value--basic",
          ).length,
        ".sidearm-table-player-name": document.querySelectorAll(
          ".sidearm-table-player-name",
        ).length,
        ".s-table__row": document.querySelectorAll(".s-table__row").length,
      };

      // find the name cell class
      const nameCells = document.querySelectorAll('[class*="name"]');
      const nameClasses = new Set();
      nameCells.forEach((el) => {
        if (el.tagName === "TD") nameClasses.add(el.className.trim());
      });

      // Sample first match if any
      let sample = null;
      const classCell = document.querySelector(
        'td.roster_class, [data-label="Class"], .sidearm-roster-player-class_year',
      );
      if (classCell) {
        const row = classCell.closest("tr");
        if (row) {
          sample = {
            rowClass: row.className,
            classText: classCell.textContent.trim(),
            cells: Array.from(row.querySelectorAll("td"))
              .slice(0, 5)
              .map((td) => ({
                cls: td.className.substring(0, 50),
                lbl: td.dataset.label,
                txt: td.textContent.trim().substring(0, 30),
              })),
          };
        }
      }

      // For card-based sites
      const card = document.querySelector(
        ".s-person-card, .roster-player-card",
      );
      let cardSample = null;
      if (card) {
        cardSample = {
          cardClass: card.className.substring(0, 80),
          innerHTML: card.innerHTML.substring(0, 500).replace(/\n/g, " "),
        };
      }

      return {
        sels,
        nameClasses: Array.from(nameClasses).slice(0, 5),
        sample,
        cardSample,
      };
    });

    // Print counts
    const nonZero = Object.entries(info.sels).filter(([k, v]) => v > 0);
    nonZero.forEach(([k, v]) => console.log(`  ${k}: ${v}`));
    if (info.nameClasses.length)
      console.log("  TD name classes:", info.nameClasses);
    if (info.sample) console.log("  Sample row:", JSON.stringify(info.sample));
    if (info.cardSample)
      console.log("  Card sample:", info.cardSample.cardClass);
  }

  await browser.close();
})().catch((e) => console.error(e.message));
