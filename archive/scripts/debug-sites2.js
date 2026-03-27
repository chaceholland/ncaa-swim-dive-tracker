const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // ----- Stanford -----
  console.log("\n=== Stanford ===");
  await page.goto(
    "https://gostanford.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  await page.waitForTimeout(5000);
  const stanford = await page.evaluate(() => {
    // What's inside a .roster-player-card-profile-field__value--basic?
    const valEls = document.querySelectorAll(
      ".roster-player-card-profile-field__value--basic",
    );
    const sample = Array.from(valEls)
      .slice(0, 6)
      .map((el) => ({
        text: el.textContent.trim(),
        parentHTML: el.closest(".roster-player-card")
          ? el
              .closest(".roster-player-card")
              .innerHTML.substring(0, 400)
              .replace(/\n/g, " ")
          : "no card",
      }));
    // Find name in card
    const card = document.querySelector(".roster-player-card");
    const nameEl = card
      ? card.querySelector(
          '.roster-player-card-profile-name, [class*="player-name"], h2, h3',
        )
      : null;
    return {
      count: valEls.length,
      sample,
      nameFromCard: nameEl ? nameEl.textContent.trim() : "no name",
      cardHTML: card
        ? card.innerHTML.substring(0, 600).replace(/\n/g, " ")
        : "no card",
    };
  });
  console.log("value--basic count:", stanford.count);
  console.log("First card HTML:", stanford.cardHTML.substring(0, 400));
  console.log("Name from card:", stanford.nameFromCard);
  console.log("Samples:", JSON.stringify(stanford.sample.slice(0, 3), null, 2));

  // ----- Georgia (s-person-card) -----
  console.log("\n=== Georgia (s-person-card) ===");
  await page.goto("https://georgiadogs.com/sports/swimming-and-diving/roster", {
    waitUntil: "networkidle",
    timeout: 30000,
  });
  await page.waitForTimeout(5000);
  const georgia = await page.evaluate(() => {
    const card = document.querySelector(".s-person-card");
    if (!card) return { error: "no card" };
    // Find class year inside card
    const classSelectors = [
      ".s-person-card__title--class",
      ".s-person-card__details",
      '[class*="class"]',
      '[class*="year"]',
      ".s-person-details__personal-sport-title",
      "li",
    ];
    const found = {};
    classSelectors.forEach((sel) => {
      const els = card.querySelectorAll(sel);
      if (els.length)
        found[sel] = Array.from(els).map((e) =>
          e.textContent.trim().substring(0, 40),
        );
    });
    // Full card HTML
    return {
      cardHTML: card.innerHTML.substring(0, 800).replace(/\n/g, " "),
      found,
      cardCount: document.querySelectorAll(".s-person-card").length,
    };
  });
  console.log("Card count:", georgia.cardCount);
  console.log("Card HTML:", georgia.cardHTML.substring(0, 500));
  console.log("Found selectors:", JSON.stringify(georgia.found, null, 2));

  // ----- UNLV -----
  console.log("\n=== UNLV ===");
  await page.goto(
    "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  await page.waitForTimeout(8000);
  const unlv = await page.evaluate(() => {
    const sels = {};
    [
      "tbody tr",
      ".s-person-card",
      "td.roster_class",
      '[data-label="Class"]',
      ".sidearm-table-player-name",
      "tr.odd",
      "tr.even",
      "li.roster_item",
    ].forEach((s) => {
      sels[s] = document.querySelectorAll(s).length;
    });
    const html = document.body.innerHTML.substring(0, 1000).replace(/\n/g, " ");
    return { sels, html };
  });
  console.log("UNLV selectors:", unlv.sels);
  console.log("UNLV HTML sample:", unlv.html.substring(0, 400));

  // ----- Yale -----
  console.log("\n=== Yale ===");
  await page.goto(
    "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "networkidle", timeout: 30000 },
  );
  await page.waitForTimeout(5000);
  const yale = await page.evaluate(() => {
    const rows = document.querySelectorAll("tbody tr");
    const firstRow = rows[0];
    if (!firstRow) return { error: "no rows" };
    const cells = Array.from(firstRow.querySelectorAll("td")).map((td) => ({
      cls: td.className.trim().substring(0, 50),
      lbl: td.dataset.label,
      txt: td.textContent.trim().substring(0, 30),
    }));
    const rowSamples = Array.from(rows)
      .slice(0, 5)
      .map((r) => ({
        className: r.className,
        text: r.innerText.substring(0, 80).replace(/\n/g, " | "),
      }));
    return { cells, rowSamples, rowCount: rows.length };
  });
  console.log("Yale rows:", yale.rowCount);
  console.log("Yale cells:", JSON.stringify(yale.cells));
  console.log(
    "Yale rows sample:",
    JSON.stringify(yale.rowSamples?.slice(0, 3)),
  );

  await browser.close();
})().catch((e) => console.error(e.message));
