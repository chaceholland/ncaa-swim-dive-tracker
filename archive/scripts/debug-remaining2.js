const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Kentucky — detailed row inspection
  console.log("\n=== Kentucky ===");
  await page.goto("https://ukathletics.com/sports/mswim/roster", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(8000);
  const ky = await page.evaluate(() => {
    const rows = document.querySelectorAll("tbody tr");
    // Sample first 3 rows with all cell info
    return Array.from(rows)
      .slice(0, 3)
      .map((row) => ({
        rowCls: row.className,
        cells: Array.from(row.querySelectorAll("td")).map((td) => ({
          cls: String(td.className).trim().substring(0, 40),
          lbl: td.dataset.label || "",
          txt: td.textContent.trim().substring(0, 30),
        })),
      }));
  });
  console.log("Kentucky rows:", JSON.stringify(ky, null, 2));

  // North Carolina — extra long wait
  console.log("\n=== North Carolina (long wait) ===");
  await page.goto(
    "https://goheels.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(20000); // 20 seconds
  const unc = await page.evaluate(() => {
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
    const card = document.querySelector(".s-person-card");
    const cardHTML = card ? card.outerHTML.substring(0, 400) : null;
    return { sels, cardHTML };
  });
  console.log(
    "UNC sels:",
    JSON.stringify(Object.entries(unc.sels).filter(([k, v]) => v > 0)),
  );
  if (unc.cardHTML) console.log("UNC card:", unc.cardHTML.substring(0, 300));

  // Missouri — extra long wait
  console.log("\n=== Missouri (long wait) ===");
  await page.goto(
    "https://mutigers.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(20000);
  const mo = await page.evaluate(() => {
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
    const bodyTxt = document.body.innerText
      .substring(0, 300)
      .replace(/\n/g, " | ");
    return { sels, bodyTxt };
  });
  console.log(
    "Missouri sels:",
    JSON.stringify(Object.entries(mo.sels).filter(([k, v]) => v > 0)),
  );
  console.log("Missouri body:", mo.bodyTxt.substring(0, 200));

  // Utah — extra long wait
  console.log("\n=== Utah (long wait) ===");
  await page.goto("https://utahutes.com/sports/swimming-and-diving/roster", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(20000);
  const utah = await page.evaluate(() => {
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
    const card = document.querySelector(".s-person-card");
    const cardHTML = card ? card.outerHTML.substring(0, 400) : null;
    return { sels, cardHTML };
  });
  console.log(
    "Utah sels:",
    JSON.stringify(Object.entries(utah.sels).filter(([k, v]) => v > 0)),
  );
  if (utah.cardHTML) console.log("Utah card:", utah.cardHTML.substring(0, 300));

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
