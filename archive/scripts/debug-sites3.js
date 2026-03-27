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

  // ----- Stanford — no .roster-player-card, but 24 .value--basic elements -----
  console.log("\n=== Stanford ===");
  await goTo("https://gostanford.com/sports/mens-swimming-and-diving/roster");
  const stanford = await page.evaluate(() => {
    // The 24 .roster-player-card-profile-field__value--basic are there but no .roster-player-card parent
    // Let's look at the structure of the first one
    const valEl = document.querySelector(
      ".roster-player-card-profile-field__value--basic",
    );
    if (!valEl) return { err: "no valEl" };
    // Walk up 10 levels looking for name
    const levels = [];
    let el = valEl;
    for (let i = 0; i < 12; i++) {
      if (!el) break;
      levels.push({
        tag: el.tagName,
        cls: (el.className || "").substring(0, 80),
        text: (el.textContent || "").trim().substring(0, 60),
      });
      el = el.parentElement;
    }

    // Also check: what are ALL the classes in the card's ancestor?
    const sectionEls = document.querySelectorAll('[class*="roster-player"]');
    const classNames = new Set();
    sectionEls.forEach((e) => {
      (e.className || "").split(" ").forEach((c) => c && classNames.add(c));
    });

    return {
      valText: valEl.textContent.trim(),
      levels,
      rosterPlayerClasses: Array.from(classNames).slice(0, 20),
    };
  });
  console.log("Stanford val:", stanford.valText);
  console.log("Levels:", JSON.stringify(stanford.levels?.slice(0, 8), null, 2));
  console.log("All roster-player classes:", stanford.rosterPlayerClasses);

  // ----- Georgia -----
  console.log("\n=== Georgia ===");
  await goTo("https://georgiadogs.com/sports/swimming-and-diving/roster");
  const georgia = await page.evaluate(() => {
    const card = document.querySelector(".s-person-card");
    if (!card) return { err: "no card" };
    // Get all text content split by element
    const allEls = Array.from(card.querySelectorAll("*"))
      .map((el) => ({
        tag: el.tagName,
        cls: (el.className || "").substring(0, 60),
        txt: el.textContent.trim().substring(0, 40),
      }))
      .filter((e) => e.txt && e.cls);
    return {
      cardHTML: card.outerHTML.substring(0, 800).replace(/\n/g, " "),
      allEls: allEls.slice(0, 20),
    };
  });
  console.log("Georgia card HTML:", georgia.cardHTML?.substring(0, 600));

  // ----- UNLV -----
  console.log("\n=== UNLV ===");
  await goTo("https://unlvrebels.com/sports/mens-swimming-and-diving/roster");
  const unlv = await page.evaluate(() => {
    // Try every possible structure
    const sels = {};
    [
      "tbody tr",
      ".s-person-card",
      "td.roster_class",
      ".sidearm-table-player-name",
      "tr.odd",
      "tr.even",
      "li",
      ".player",
      ".athlete",
      ".s-table",
      '[class*="roster"]',
      '[class*="athlete"]',
      '[class*="player"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch (e) {
        sels[s] = "ERR";
      }
    });
    // Sample body text
    const bodyText = document.body.innerText
      .substring(0, 800)
      .replace(/\n/g, " | ");
    return { sels, bodyText };
  });
  console.log(
    "UNLV sels:",
    JSON.stringify(Object.entries(unlv.sels).filter(([k, v]) => v > 0)),
  );
  console.log("UNLV body:", unlv.bodyText.substring(0, 400));

  // ----- Yale -----
  console.log("\n=== Yale ===");
  await goTo("https://yalebulldogs.com/sports/mens-swimming-and-diving/roster");
  const yale = await page.evaluate(() => {
    const rows = document.querySelectorAll("tbody tr");
    if (!rows.length) {
      // Check all possible structures
      const sels = {};
      [
        ".s-person-card",
        "td.roster_class",
        '[class*="roster"]',
        "[data-label]",
        ".player-name",
        ".name_earit",
      ].forEach((s) => {
        sels[s] = document.querySelectorAll(s).length;
      });
      return { err: "no rows", sels };
    }
    const firstRow = rows[0];
    const cells = Array.from(firstRow.querySelectorAll("td")).map((td) => ({
      cls: td.className.trim().substring(0, 50),
      lbl: td.dataset.label,
      txt: td.textContent.trim().substring(0, 30),
    }));
    // Sample 3 rows
    const rowSamples = Array.from(rows)
      .slice(0, 5)
      .map((r) => ({
        cls: r.className,
        txt: r.innerText.substring(0, 80).replace(/\n/g, " | "),
      }));
    return { cells, rowSamples, rowCount: rows.length };
  });
  console.log("Yale:", JSON.stringify(yale, null, 2));

  await browser.close();
})().catch((e) => console.error(e.message));
