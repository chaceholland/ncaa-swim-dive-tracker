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

  // ----- Georgia -----
  console.log("\n=== Georgia ===");
  await goTo("https://georgiadogs.com/sports/swimming-and-diving/roster");
  const georgia = await page.evaluate(() => {
    const card = document.querySelector(".s-person-card");
    if (!card) return { err: "no card" };
    // Avoid SVGAnimatedString by checking nodeType
    const outerHTML = card.outerHTML.substring(0, 1000).replace(/\n/g, " ");
    // Try finding class year
    const cls = card.querySelector(
      '[class*="class"], [class*="year"], .s-person-card__title',
    );
    const clsText = cls ? cls.textContent.trim() : "none";
    const clsCls = cls ? String(cls.className).substring(0, 60) : "none";
    // Get structured content of card
    const nameEl = card.querySelector(
      '[class*="title"], [class*="name"], h3, h2',
    );
    const nameTxt = nameEl
      ? nameEl.textContent.trim().substring(0, 40)
      : "none";
    return { outerHTML: outerHTML.substring(0, 600), clsText, clsCls, nameTxt };
  });
  console.log("Georgia card HTML:", georgia.outerHTML?.substring(0, 600));
  console.log("Georgia class text:", georgia.clsText, "| cls:", georgia.clsCls);

  // ----- UNLV -----
  console.log("\n=== UNLV ===");
  await goTo("https://unlvrebels.com/sports/mens-swimming-and-diving/roster");
  const unlv = await page.evaluate(() => {
    const sels = {};
    [
      "tbody tr",
      ".s-person-card",
      "td.roster_class",
      ".sidearm-table-player-name",
      "tr.odd",
      "tr.even",
      '[class*="roster"]',
      "[data-label]",
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    const bodyText = document.body.innerText
      .substring(0, 500)
      .replace(/\n/g, " | ");
    // If no roster data, look for any table
    const tables = document.querySelectorAll("table");
    const tableCount = tables.length;
    const firstTableHTML = tables[0]
      ? tables[0].outerHTML.substring(0, 300)
      : "none";
    return { sels, bodyText, tableCount, firstTableHTML };
  });
  console.log(
    "UNLV sels:",
    JSON.stringify(Object.entries(unlv.sels).filter(([k, v]) => v > 0)),
  );
  console.log("UNLV body:", unlv.bodyText.substring(0, 400));
  console.log("UNLV tables:", unlv.tableCount);

  // ----- Yale -----
  console.log("\n=== Yale ===");
  await goTo("https://yalebulldogs.com/sports/mens-swimming-and-diving/roster");
  const yale = await page.evaluate(() => {
    const rows = document.querySelectorAll("tbody tr");
    const rowCount = rows.length;
    if (!rowCount) {
      const sels = {};
      [
        ".s-person-card",
        "td.roster_class",
        "[data-label]",
        ".name_earit",
      ].forEach((s) => {
        try {
          sels[s] = document.querySelectorAll(s).length;
        } catch {
          sels[s] = 0;
        }
      });
      const body = document.body.innerText
        .substring(0, 400)
        .replace(/\n/g, " | ");
      return { err: "no rows", sels, body };
    }
    const firstRow = rows[1] || rows[0]; // skip header
    const cells = Array.from(firstRow.querySelectorAll("td")).map((td) => ({
      cls: String(td.className).trim().substring(0, 50),
      lbl: td.dataset ? td.dataset.label : "",
      txt: td.textContent.trim().substring(0, 30),
    }));
    const rowSamples = Array.from(rows)
      .slice(0, 4)
      .map((r) => ({
        cls: r.className,
        txt: r.innerText.substring(0, 80).replace(/\n/g, " | "),
      }));
    return { rowCount, cells, rowSamples };
  });
  console.log("Yale:", JSON.stringify(yale, null, 2));

  // ----- Michigan (s-person-card) -----
  console.log("\n=== Michigan ===");
  await goTo("https://mgoblue.com/sports/mens-swimming-and-diving/roster");
  const michigan = await page.evaluate(() => {
    const card = document.querySelector(".s-person-card");
    if (!card) return { err: "no card" };
    const outerHTML = card.outerHTML.substring(0, 1000).replace(/\n/g, " ");
    // What classes exist inside?
    const innerEls = Array.from(card.querySelectorAll("[class]"))
      .map((el) =>
        String(el.className)
          .split(" ")
          .filter((c) => c),
      )
      .flat();
    const uniqueClasses = [...new Set(innerEls)];
    return {
      outerHTML: outerHTML.substring(0, 700),
      uniqueClasses: uniqueClasses.slice(0, 30),
    };
  });
  console.log("Michigan card HTML:", michigan.outerHTML?.substring(0, 600));
  console.log("Michigan inner classes:", michigan.uniqueClasses);

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
