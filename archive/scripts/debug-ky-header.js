const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  // Kentucky — check header row for column names
  console.log("\n=== Kentucky header ===");
  await page.goto("https://ukathletics.com/sports/mswim/roster", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(8000);
  const ky = await page.evaluate(() => {
    // Header row
    const headers = Array.from(
      document.querySelectorAll("thead th, thead td"),
    ).map((th) => th.textContent.trim());
    // Also check full row count
    const rows = document.querySelectorAll("tbody tr").length;
    return { headers, rows };
  });
  console.log("Kentucky headers:", ky.headers);
  console.log("Kentucky rows:", ky.rows);

  // Missouri — try different URLs
  console.log("\n=== Missouri URL test ===");
  const moUrls = [
    "https://mutigers.com/sports/swimming-and-diving/roster",
    "https://mutigers.com/sports/men-swimming/roster",
    "https://mutigers.com/sports/swimming/roster",
    "https://mutigers.com/sports/mswim/roster",
  ];
  for (const url of moUrls) {
    const result = await page.evaluate(async (u) => {
      const r = await fetch(u);
      return { status: r.status, url: u };
    }, url);
    console.log(result.status, url);
  }

  // UNC — try with extra cookies/headers
  console.log("\n=== North Carolina (different approach) ===");
  await page.goto(
    "https://goheels.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(25000);
  const unc = await page.evaluate(() => {
    const sels = {};
    [
      "td.roster_class",
      ".s-person-card",
      "tbody tr",
      ".sidearm-table-player-name",
      '[data-test-id="s-person-details__bio-stats-person-title"]',
      '[class*="roster"]',
      '[class*="athlete"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    const body = document.body.innerText
      .substring(0, 300)
      .replace(/\n/g, " | ");
    return { sels, body };
  });
  console.log(
    "UNC sels:",
    JSON.stringify(Object.entries(unc.sels).filter(([k, v]) => v > 0)),
  );
  console.log("UNC body:", unc.body.substring(0, 200));

  // Utah — same
  console.log("\n=== Utah (different approach) ===");
  await page.goto("https://utahutes.com/sports/swimming-and-diving/roster", {
    waitUntil: "domcontentloaded",
    timeout: 30000,
  });
  await page.waitForTimeout(25000);
  const utah = await page.evaluate(() => {
    const sels = {};
    [
      "td.roster_class",
      ".s-person-card",
      "tbody tr",
      ".sidearm-table-player-name",
      '[data-test-id="s-person-details__bio-stats-person-title"]',
      '[class*="roster"]',
    ].forEach((s) => {
      try {
        sels[s] = document.querySelectorAll(s).length;
      } catch {
        sels[s] = 0;
      }
    });
    const body = document.body.innerText
      .substring(0, 300)
      .replace(/\n/g, " | ");
    return { sels, body };
  });
  console.log(
    "Utah sels:",
    JSON.stringify(Object.entries(utah.sels).filter(([k, v]) => v > 0)),
  );
  console.log("Utah body:", utah.body.substring(0, 200));

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
