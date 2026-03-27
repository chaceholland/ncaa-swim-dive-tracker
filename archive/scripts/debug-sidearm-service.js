const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  for (const site of [
    { name: "Yale", host: "yalebulldogs.com", sportId: 14 },
    { name: "UNLV", host: "unlvrebels.com", sportId: 9 },
  ]) {
    console.log("\n===", site.name, "===");

    // Navigate to site first so we have the right origin for CORS
    await page.goto(
      `https://${site.host}/sports/mens-swimming-and-diving/roster`,
      { waitUntil: "domcontentloaded", timeout: 30000 },
    );
    await page.waitForTimeout(3000);

    const apiUrl = `https://${site.host}/services/roster.ashx?format=json&sport_id=${site.sportId}`;
    const result = await page.evaluate(async (url) => {
      const r = await fetch(url);
      const json = await r.json();
      // Get the first player's keys
      let firstPlayer = null;
      let topKeys = Object.keys(json).join(",");
      if (json.players) firstPlayer = json.players[0];
      else if (json.roster) firstPlayer = json.roster[0];
      else if (Array.isArray(json)) firstPlayer = json[0];
      else {
        // Find any array value
        for (const [k, v] of Object.entries(json)) {
          if (Array.isArray(v) && v.length > 0) {
            firstPlayer = v[0];
            break;
          }
        }
      }
      return {
        topKeys,
        playerKeys: firstPlayer
          ? Object.keys(firstPlayer).join(",")
          : "no player",
        playerSample: firstPlayer
          ? JSON.stringify(firstPlayer).substring(0, 600)
          : null,
        totalLen: JSON.stringify(json).length,
        count: firstPlayer ? (json.players || json.roster || json).length : 0,
      };
    }, apiUrl);

    console.log("API response top keys:", result.topKeys.substring(0, 100));
    console.log("Player keys:", result.playerKeys.substring(0, 200));
    console.log("Player sample:", result.playerSample?.substring(0, 400));
    console.log("Total response length:", result.totalLen);
  }

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
