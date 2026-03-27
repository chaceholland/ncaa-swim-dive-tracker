const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  async function goTo(url, wait = 8000) {
    try {
      await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
    } catch (e) {
      console.log("  load error:", e.message.substring(0, 80));
    }
    await page.waitForTimeout(wait);
  }

  // Yale — try longer wait and check if roster loads
  console.log("\n=== Yale (longer wait) ===");
  await goTo(
    "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    15000,
  );
  const yale = await page.evaluate(() => {
    const sels = {};
    [
      "tbody tr",
      "td.roster_class",
      'td[class*="class"]',
      ".name_earit",
      "[data-label]",
      ".sidearm-table-player-name",
      ".roster-player",
      "tr.odd",
      "tr.even",
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    // Check tbody
    const tbodies = document.querySelectorAll("tbody");
    const tbodyInfo = Array.from(tbodies).map((tb) => ({
      rowCount: tb.querySelectorAll("tr").length,
      cellCount: tb.querySelectorAll("td").length,
      firstHTML: tb.innerHTML.substring(0, 300).replace(/\n/g, " "),
    }));
    return { sels, tbodyInfo };
  });
  console.log(
    "Yale sels:",
    JSON.stringify(Object.entries(yale.sels).filter(([k, v]) => v > 0)),
  );
  console.log(
    "Yale tbodies:",
    JSON.stringify(
      yale.tbodyInfo?.map((t) => ({
        rowCount: t.rowCount,
        cellCount: t.cellCount,
        firstHTML: t.firstHTML.substring(0, 150),
      })),
    ),
  );

  // UNLV — try API interception
  console.log("\n=== UNLV (API intercept) ===");
  const unlvResponses = [];
  page.on("response", async (res) => {
    const url = res.url();
    if (
      (url.includes("api") ||
        url.includes("roster") ||
        url.includes("player") ||
        url.includes("sidearm")) &&
      res.status() === 200
    ) {
      const ct = res.headers()["content-type"] || "";
      if (ct.includes("json")) {
        unlvResponses.push({ url: url.substring(0, 100), ct });
      }
    }
  });
  await goTo(
    "https://unlvrebels.com/sports/mens-swimming-and-diving/roster",
    15000,
  );
  console.log("UNLV JSON API responses:", unlvResponses.slice(0, 5));
  const unlvDOM = await page.evaluate(() => {
    const sels = {};
    [
      "tbody tr",
      "td.roster_class",
      'td[class*="class"]',
      ".sidearm-table-player-name",
      "tr.odd",
      '[data-label="Class"]',
      '[data-label="Yr."]',
      ".s-person-card",
      ".roster-player",
      '[class*="player-card"]',
      "div.container",
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    // Check if JavaScript has populated any roster data
    const tbodies = document.querySelectorAll("tbody");
    const tbodyInfo = Array.from(tbodies).map((tb) => ({
      rows: tb.querySelectorAll("tr").length,
      firstHTML: tb.innerHTML.substring(0, 200).replace(/\n/g, " "),
    }));
    return { sels, tbodyInfo };
  });
  console.log(
    "UNLV sels:",
    JSON.stringify(Object.entries(unlvDOM.sels).filter(([k, v]) => v > 0)),
  );
  console.log("UNLV tbodies:", JSON.stringify(unlvDOM.tbodyInfo?.slice(0, 3)));

  // Army
  console.log("\n=== Army ===");
  await goTo(
    "https://goarmywestpoint.com/sports/mens-swimming-and-diving/roster",
    8000,
  );
  const army = await page.evaluate(() => {
    const sels = {};
    [
      "td.roster_class",
      'td[class*="class"]',
      ".sidearm-table-player-name",
      "tbody tr",
      "tr.odd",
      ".s-person-card",
      '[data-label="Class"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    const classCell = document.querySelector(
      'td.roster_class, [data-label="Class"]',
    );
    let sample = null;
    if (classCell) {
      const row = classCell.closest("tr");
      if (row) {
        sample = {
          rowCls: row.className,
          classText: classCell.textContent.trim(),
          cells: Array.from(row.querySelectorAll("td")).map((td) => ({
            cls: String(td.className).trim().substring(0, 40),
            txt: td.textContent.trim().substring(0, 25),
          })),
        };
      }
    }
    return { sels, sample };
  });
  console.log(
    "Army sels:",
    JSON.stringify(Object.entries(army.sels).filter(([k, v]) => v > 0)),
  );
  console.log("Army sample:", JSON.stringify(army.sample));

  // SMU — check name cell class
  console.log("\n=== SMU (name class check) ===");
  await goTo(
    "https://smumustangs.com/sports/mens-swimming-and-diving/roster",
    6000,
  );
  const smu = await page.evaluate(() => {
    const classCell = document.querySelector("td.roster_class");
    if (!classCell) return { err: "no td.roster_class" };
    const row = classCell.closest("tr");
    if (!row) return { err: "no row" };
    return {
      rowCls: row.className,
      classText: classCell.textContent.trim(),
      cells: Array.from(row.querySelectorAll("td")).map((td) => ({
        cls: String(td.className).trim().substring(0, 50),
        lbl: td.dataset ? td.dataset.label : "",
        txt: td.textContent.trim().substring(0, 25),
      })),
    };
  });
  console.log("SMU:", JSON.stringify(smu, null, 2));

  // USC
  console.log("\n=== USC ===");
  await goTo(
    "https://usctrojans.com/sports/mens-swimming-and-diving/roster",
    8000,
  );
  const usc = await page.evaluate(() => {
    const sels = {};
    [
      "td.roster_class",
      ".s-person-card",
      "tbody tr",
      ".sidearm-table-player-name",
      '[data-test-id="s-person-details__bio-stats-person-title"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    const bioEl = document.querySelector(
      '[data-test-id="s-person-details__bio-stats-person-title"]',
    );
    const bioText = bioEl ? bioEl.textContent.trim() : null;
    const classCell = document.querySelector("td.roster_class");
    const sampleRow = classCell ? classCell.closest("tr") : null;
    const sampleCells = sampleRow
      ? Array.from(sampleRow.querySelectorAll("td")).map((td) => ({
          cls: String(td.className).trim().substring(0, 40),
          txt: td.textContent.trim().substring(0, 25),
        }))
      : null;
    return { sels, bioText, sampleCells };
  });
  console.log(
    "USC sels:",
    JSON.stringify(Object.entries(usc.sels).filter(([k, v]) => v > 0)),
  );
  console.log("USC bio sample:", usc.bioText);
  console.log("USC sample cells:", JSON.stringify(usc.sampleCells));

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
