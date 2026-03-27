const { chromium } = require("playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  const responses = [];
  page.on("response", async (res) => {
    const url = res.url();
    const host = new URL(url).hostname;
    // Only capture from the same host
    if (
      !host.includes("yalebulldogs") &&
      !host.includes("sidearm") &&
      !host.includes("cloudfront")
    )
      return;
    const ct = res.headers()["content-type"] || "";
    try {
      if (ct.includes("json")) {
        const json = await res.json();
        const str = JSON.stringify(json);
        if (str.length > 200) {
          responses.push({
            url: url.substring(0, 150),
            len: str.length,
            sample: str.substring(0, 300),
          });
        }
      } else if (
        ct.includes("text") ||
        ct.includes("html") ||
        ct.includes("javascript")
      ) {
        const text = await res.text();
        if (
          text.includes("class_year") ||
          text.includes("year_eligibility") ||
          text.includes("academic_year") ||
          text.includes('"year"')
        ) {
          responses.push({
            url: url.substring(0, 150),
            len: text.length,
            type: ct,
            sample: text.substring(0, 300),
          });
        }
      }
    } catch {
      /**/
    }
  });

  await page.goto(
    "https://yalebulldogs.com/sports/mens-swimming-and-diving/roster",
    { waitUntil: "domcontentloaded", timeout: 30000 },
  );
  await page.waitForTimeout(12000);

  console.log("\nAll relevant responses:");
  responses.forEach((r) => {
    console.log(`\n  URL: ${r.url}`);
    console.log(`  Len: ${r.len} | Type: ${r.type || "json"}`);
    console.log(`  Sample: ${r.sample.substring(0, 200)}`);
  });

  // Also try the cloudfront roster.ashx endpoint directly
  const cfResp = await page.evaluate(async () => {
    // The SIDEARM v1 KO roster calls a services endpoint
    const urls = [
      "https://yalebulldogs.com/services/roster.ashx?type=100&sport_id=14",
      "https://yalebulldogs.com/services/roster_players.ashx?sport_id=14",
      "https://yalebulldogs.com/services/adaptive_components.ashx?type=roster&sport_id=14",
      "/services/responsive_roster.aspx?sport_id=14",
    ];
    const results = [];
    for (const url of urls) {
      try {
        const r = await fetch(url);
        const text = await r.text();
        results.push({
          url,
          status: r.status,
          len: text.length,
          ct: r.headers.get("content-type"),
          sample: text.substring(0, 300),
        });
      } catch (e) {
        results.push({ url, error: e.message });
      }
    }
    return results;
  });
  console.log("\nDirect API calls:");
  cfResp.forEach((r) =>
    console.log(
      `  ${r.url}: status=${r.status} len=${r.len} sample=${r.sample?.substring(0, 150)}`,
    ),
  );

  await browser.close();
})().catch((e) => console.error("Fatal:", e.message));
